"""
W-43-DATA-DICTIONARY-PHASE1 — structural scanner for wie-ops HTTP consumer surface.

READ-ONLY. Scans src/api/client.js for every `apiFetch(...)` call, resolves the
HTTP method from the options object, normalises template-literal paths into
{param}-placeholder form, and cross-indexes exported function names against
call sites across src/.

Emits a deterministic structural block (YAML) to stdout. This block matches the
`http_consumer_contract.endpoints` section of data_dictionary.yaml and is the
basis for drift detection in scripts/verify_data_dictionary.py.

Usage:
    python scripts/generate_data_dictionary_structure.py                # stdout
    python scripts/generate_data_dictionary_structure.py --json         # json form

Rationale for Python-in-a-JS-frontend:
    wie-ops already hosts scripts/audits/w38_scan.py (W-38-SCAN-DURABILITY).
    Adding a second standalone Python utility is consistent with that precedent
    and avoids pulling a YAML lib into the frontend bundle. See
    docs/DATA_DICTIONARY_MAINTENANCE.md for the asymmetry rationale.
"""
import argparse
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
CLIENT_JS = REPO_ROOT / "src" / "api" / "client.js"
SRC_DIR = REPO_ROOT / "src"


# Match:  export const <name> = (<args>) => ... apiFetch(<first>, <options?>)
# apiFetch can be on the same line or next; body can be single-line arrow.
# We capture the whole export block up to the matching trailing ) or newline;
# simpler heuristic: scan line-by-line and join continuation until balanced.
EXPORT_RE = re.compile(r"^export\s+const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=")
APIFETCH_FIRST_ARG_RE = re.compile(r"apiFetch\s*\(\s*(`[^`]*`|'[^']*'|\"[^\"]*\")")
METHOD_RE = re.compile(r"method\s*:\s*['\"]([A-Z]+)['\"]")
BODY_RE = re.compile(r"body\s*:\s*JSON\.stringify")


def _strip_quotes(s):
    if s.startswith("`") or s.startswith("'") or s.startswith('"'):
        return s[1:-1]
    return s


def _normalise_path(raw):
    """Template literal -> {param} form. Example: `/ops/wine/${wineId}/region`
    becomes /ops/wine/{wineId}/region.

    Strips `encodeURIComponent(x)` -> `x` and drops `?${sp.toString()}` style
    query-sentinel fragments (query params are captured separately from body).
    Path is always the URL path without query string.
    """
    # ${expr} -> {expr}
    s = re.sub(r"\$\{([^}]+)\}", lambda m: "{" + m.group(1).strip() + "}", raw)
    # encodeURIComponent(x) -> x  (nested parens not used in this codebase)
    s = re.sub(r"encodeURIComponent\(([^)]+)\)", r"\1", s)
    # Strip query string entirely — documented separately under query_params.
    s = s.split("?")[0]
    return s


def _extract_query_keys(body):
    """Find `sp.set('key', ...)` / `params.set('key', ...)` invocations inside
    an export body. Returns sorted unique keys.
    """
    keys = set()
    for m in re.finditer(r"\.set\(\s*['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]", body):
        keys.add(m.group(1))
    # Also catch `?confirm=${confirm}`-style inline query fragments.
    for m in re.finditer(r"[?&]([a-zA-Z_][a-zA-Z0-9_]*)=\$\{", body):
        keys.add(m.group(1))
    # `?q=${encodeURIComponent(q)}`
    for m in re.finditer(r"[?&]([a-zA-Z_][a-zA-Z0-9_]*)=encodeURIComponent", body):
        keys.add(m.group(1))
    return sorted(keys)


def _split_exports(text):
    """Yield (name, body_text) for each `export const <name> = ...` block.
    A block runs until the next `export const` or EOF.
    """
    lines = text.splitlines()
    blocks = []
    current_name = None
    current_lines = []
    for line in lines:
        m = EXPORT_RE.match(line)
        if m:
            if current_name is not None:
                blocks.append((current_name, "\n".join(current_lines)))
            current_name = m.group(1)
            current_lines = [line]
        else:
            if current_name is not None:
                current_lines.append(line)
    if current_name is not None:
        blocks.append((current_name, "\n".join(current_lines)))
    return blocks


def parse_client():
    text = CLIENT_JS.read_text()
    endpoints = []
    for name, body in _split_exports(text):
        m = APIFETCH_FIRST_ARG_RE.search(body)
        if not m:
            # Not an apiFetch export (e.g., getAuthHeaders is not exported;
            # getAuditExportUrl uses `${BASE}` directly, handle separately below).
            continue
        path = _normalise_path(_strip_quotes(m.group(1)))
        method = "GET"
        mm = METHOD_RE.search(body)
        if mm:
            method = mm.group(1)
        has_body = bool(BODY_RE.search(body))
        query_keys = _extract_query_keys(body)
        endpoints.append({
            "id": name,
            "method": method,
            "path": path,
            "has_body": has_body,
            "query_keys": query_keys,
        })

    # Special-case: getAuditExportUrl builds a URL string, never hits apiFetch.
    # It is still a consumer surface (browser follows the URL). Detect by name.
    export_url_block = next(
        (b for n, b in _split_exports(text) if n == "getAuditExportUrl"), None
    )
    if export_url_block is not None:
        m = re.search(r"`\$\{BASE\}([^`]+)`", export_url_block)
        if m:
            endpoints.append({
                "id": "getAuditExportUrl",
                "method": "GET",
                "path": _normalise_path(m.group(1).split("?")[0]),
                "has_body": False,
                "note": "URL builder; browser navigation, not apiFetch",
            })

    return endpoints


def index_call_sites(endpoint_ids):
    """For each exported fn name, find call/reference sites in src/ (excluding
    client.js). A reference counts when the name appears outside an import
    line — it may be invoked directly (fn()) or passed by reference to useAPI.
    """
    sites = {eid: [] for eid in endpoint_ids}
    for path in sorted(SRC_DIR.rglob("*.jsx")) + sorted(SRC_DIR.rglob("*.js")):
        if path == CLIENT_JS:
            continue
        rel = path.relative_to(REPO_ROOT)
        try:
            lines = path.read_text().splitlines()
        except Exception:
            continue
        in_import_block = False
        for i, line in enumerate(lines, start=1):
            stripped = line.lstrip()
            # Track multi-line import blocks `import { ...\n  foo,\n} from 'x'`.
            # `export default function` / `export const` are not imports.
            if stripped.startswith("import "):
                if " from " in line and (line.rstrip().endswith("'")
                                           or line.rstrip().endswith('"')
                                           or line.rstrip().endswith(";")):
                    in_import_block = False
                else:
                    in_import_block = True
                continue
            if in_import_block:
                if " from " in line:
                    in_import_block = False
                continue
            for eid in endpoint_ids:
                if re.search(r"\b" + re.escape(eid) + r"\b", line):
                    sites[eid].append(f"{rel}:{i}")
    return sites


def emit_yaml(endpoints, sites):
    # Deterministic order: by path, then method.
    endpoints = sorted(endpoints, key=lambda e: (e["path"], e["method"]))
    out = []
    out.append("# AUTO-GENERATED by scripts/generate_data_dictionary_structure.py")
    out.append("# Do not hand-edit the endpoint list — edit client.js and re-run.")
    out.append("endpoints:")
    for e in endpoints:
        out.append(f"  - id: {e['id']}")
        out.append(f"    method: {e['method']}")
        out.append(f"    path: {e['path']}")
        out.append(f"    has_body: {'true' if e['has_body'] else 'false'}")
        qk = e.get("query_keys", [])
        if qk:
            out.append(f"    query_keys: [{', '.join(qk)}]")
        else:
            out.append(f"    query_keys: []")
        cs = sites.get(e["id"], [])
        out.append(f"    call_sites:")
        out.append(f"      - src/api/client.js  # definition")
        for s in cs:
            out.append(f"      - {s}")
        if "note" in e:
            out.append(f"    note: {e['note']!r}")
    return "\n".join(out) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="emit JSON instead of YAML")
    args = ap.parse_args()

    endpoints = parse_client()
    sites = index_call_sites([e["id"] for e in endpoints])

    if args.json:
        payload = {
            "endpoints": [
                {**e, "call_sites": sites.get(e["id"], [])} for e in endpoints
            ]
        }
        print(json.dumps(payload, indent=2, sort_keys=True))
        return

    sys.stdout.write(emit_yaml(endpoints, sites))


if __name__ == "__main__":
    main()
