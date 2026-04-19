"""
W-43-DATA-DICTIONARY-PHASE1 — CI verifier for wie-ops's API-consumer dictionary.

Two checks, run in order:

1. STRUCTURAL DRIFT. Re-runs the structural scanner and diffs its output
   against the `http_consumer_contract.endpoints` block in data_dictionary.yaml.
   Any mismatch (new endpoint added to client.js without regenerating the
   dictionary, or vice versa) fails the check.

2. API CONTRACT DRIFT. Attempts to fetch wie's /openapi.json. If it is
   available, compares documented endpoint paths/methods against the
   OpenAPI spec (shape-diff mode). If /openapi.json is unavailable (404,
   5xx, or network), downgrades to endpoint-liveness mode: issues a HEAD
   (or safe GET) to a small curated subset and reports which return non-5xx.

Exit codes:
    0  — all checks pass
    1  — structural drift or contract mismatch
    2  — verifier itself failed (unexpected exception, bad env, etc.)

Usage:
    python scripts/verify_data_dictionary.py
    python scripts/verify_data_dictionary.py --skip-api        # skip network probe
    python scripts/verify_data_dictionary.py --base-url URL    # override API base

CI integration: run as a required step on every PR. See
docs/DATA_DICTIONARY_MAINTENANCE.md for the recommended GitHub Actions hook.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _dictionary_io as dio  # noqa: E402
import generate_data_dictionary_structure as gen  # noqa: E402


REPO_ROOT = Path(__file__).resolve().parent.parent
YAML_PATH = REPO_ROOT / "data_dictionary.yaml"
DEFAULT_BASE_URL = "https://wie-v27l.onrender.com"

# Endpoints safe to probe without auth or path params. Keep short.
LIVENESS_PROBE_SET = [
    ("GET", "/health"),
    ("GET", "/ops/health"),
]


def _load_documented():
    d = dio.load_file(YAML_PATH)
    return d["http_consumer_contract"]["endpoints"]


def _scan_current():
    endpoints = gen.parse_client()
    sites = gen.index_call_sites([e["id"] for e in endpoints])
    enriched = []
    for e in endpoints:
        enriched.append({
            "id": e["id"],
            "method": e["method"],
            "path": e["path"],
            "has_body": e["has_body"],
            "query_keys": e.get("query_keys", []),
            "call_sites": ["src/api/client.js"] + sites.get(e["id"], []),
        })
    # Sort by (path, method) to match the dictionary's canonical order.
    enriched.sort(key=lambda e: (e["path"], e["method"]))
    return enriched


def _ep_fingerprint(e):
    """Stable hashable fingerprint of the fields we consider load-bearing."""
    return (
        e.get("id"),
        e.get("method"),
        e.get("path"),
        bool(e.get("has_body")),
        tuple(sorted(e.get("query_keys", []) or [])),
        tuple(e.get("call_sites", []) or []),
    )


def check_structural_drift():
    documented = _load_documented()
    scanned = _scan_current()

    doc_by_id = {e["id"]: e for e in documented}
    scan_by_id = {e["id"]: e for e in scanned}

    problems = []

    missing = set(scan_by_id) - set(doc_by_id)
    added = set(doc_by_id) - set(scan_by_id)

    for eid in sorted(missing):
        e = scan_by_id[eid]
        problems.append(
            f"  + scanner found `{eid}` ({e['method']} {e['path']}) "
            f"— not in data_dictionary.yaml. Re-run "
            f"scripts/generate_data_dictionary_structure.py and commit the update."
        )
    for eid in sorted(added):
        e = doc_by_id[eid]
        problems.append(
            f"  - dictionary has `{eid}` ({e['method']} {e['path']}) "
            f"— not in src/api/client.js. Either remove from the dictionary "
            f"or restore the client fn."
        )
    for eid in sorted(set(doc_by_id) & set(scan_by_id)):
        fp_doc = _ep_fingerprint(doc_by_id[eid])
        fp_scan = _ep_fingerprint(scan_by_id[eid])
        if fp_doc != fp_scan:
            problems.append(
                f"  ~ `{eid}` drifted: "
                f"documented={fp_doc} vs scanned={fp_scan}"
            )

    return problems


def _http_get(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "w43-verifier/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return None, str(e)


def check_api_contract(base_url):
    """Returns (ok, mode, details)."""
    openapi_url = base_url.rstrip("/") + "/openapi.json"
    status, body = _http_get(openapi_url)
    if status == 200 and body:
        try:
            spec = json.loads(body)
        except Exception as e:
            return False, "openapi_parse_error", f"could not parse {openapi_url}: {e}"
        return _shape_diff(spec)
    # Downgrade to liveness probing.
    results = []
    for method, path in LIVENESS_PROBE_SET:
        url = base_url.rstrip("/") + path
        if method != "GET":
            results.append((method, path, "skipped (non-GET probe not implemented)"))
            continue
        s, _ = _http_get(url)
        results.append((method, path, f"HTTP {s}"))
    details = (
        f"/openapi.json unavailable (status={status}); "
        "downgraded to endpoint-liveness mode.\n"
        + "\n".join(f"  {m} {p} -> {r}" for m, p, r in results)
        + "\n(Observability finding: consider enabling FastAPI's built-in "
        "OpenAPI route so future Phase 2 shape-diffs have something to chew on.)"
    )
    liveness_ok = all(
        isinstance(r[2], str) and r[2].startswith("HTTP ") and
        r[2].split()[1].isdigit() and int(r[2].split()[1]) < 500
        for r in results
    )
    return liveness_ok, "liveness_fallback", details


def _shape_diff(spec):
    """Compare documented (method, path) pairs against the OpenAPI spec.

    Placeholder-normalised comparison: wie-ops uses `{camelCase}` placeholders
    while FastAPI typically emits `{snake_case}`. We strip placeholder *names*
    and compare `{X}`-skeleton paths plus method.
    """
    documented = _load_documented()

    def skeleton(p):
        import re
        return re.sub(r"\{[^}]+\}", "{X}", p)

    doc_set = {(e["method"].upper(), skeleton(e["path"])) for e in documented}

    spec_set = set()
    paths = spec.get("paths", {}) if isinstance(spec, dict) else {}
    for p, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        sk = skeleton(p)
        for m in methods:
            if m.lower() in ("get", "post", "put", "patch", "delete"):
                spec_set.add((m.upper(), sk))

    missing_in_spec = sorted(doc_set - spec_set)
    problems = []
    for m, p in missing_in_spec:
        problems.append(f"  ! {m} {p} documented in wie-ops but not present in wie's OpenAPI spec")

    extra_in_spec_count = len(spec_set - doc_set)
    details = (
        f"shape-diff: documented={len(doc_set)}, spec={len(spec_set)}, "
        f"missing_in_spec={len(missing_in_spec)}, "
        f"spec_extra={extra_in_spec_count} (not an error — wie has endpoints "
        "wie-ops doesn't use)"
    )
    if problems:
        details += "\n" + "\n".join(problems)
    return (len(problems) == 0), "shape_diff", details


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-api", action="store_true",
                    help="skip the network contract probe (local drift check only)")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL,
                    help="wie API base URL to probe")
    args = ap.parse_args()

    print("== W-43 data dictionary verifier ==")

    drift = check_structural_drift()
    if drift:
        print("FAIL: structural drift detected")
        for p in drift:
            print(p)
        return 1
    print("PASS: structural drift (client.js in sync with data_dictionary.yaml)")

    if args.skip_api:
        print("SKIP: API contract probe (--skip-api)")
        return 0

    ok, mode, details = check_api_contract(args.base_url)
    tag = "PASS" if ok else "FAIL"
    print(f"{tag}: API contract probe ({mode})")
    print(details)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
