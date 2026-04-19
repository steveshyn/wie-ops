"""
W-43-DATA-DICTIONARY-PHASE1 — render DATA_DICTIONARY.md from data_dictionary.yaml.

Usage:
    python scripts/generate_data_dictionary_md.py              # writes DATA_DICTIONARY.md
    python scripts/generate_data_dictionary_md.py --stdout     # prints to stdout
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import _dictionary_io as dio  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
YAML_PATH = REPO_ROOT / "data_dictionary.yaml"
MD_PATH = REPO_ROOT / "DATA_DICTIONARY.md"


def render(d):
    out = []
    w = out.append

    w(f"# wie-ops data dictionary — Phase {d.get('phase', '?')}")
    w("")
    w(f"*Session:* `{d.get('session_tag')}`  ")
    w(f"*Generated:* {d.get('generated_on')}  ")
    w(f"*Scope:* {d.get('phase_scope')}  ")
    w(f"*Pattern source:* {d.get('pattern_source')}")
    w("")
    w("> This file is generated from `data_dictionary.yaml`. Edit the YAML,")
    w("> then run `python scripts/generate_data_dictionary_md.py` to refresh.")
    w("")
    w("## Upstream API")
    w("")
    u = d.get("upstream_api", {})
    w(f"- **Base URL env var:** `{u.get('base_url_env')}`")
    w(f"- **Production:** {u.get('production')}")
    w(f"- **Local dev:** {u.get('local_dev')}")
    w("")
    w("## Pattern adaptation (wie → wie-ops)")
    w("")
    for line in str(d.get("pattern_adaptation", "")).strip().splitlines():
        w(line)
    w("")

    # ----- HTTP consumer contract -----
    http = d.get("http_consumer_contract", {})
    w("## HTTP consumer contract")
    w("")
    w(f"- **Source file:** `{http.get('source_file')}`")
    w(f"- **Transport:** {http.get('transport')}")
    auth = http.get("auth", {})
    w(f"- **Auth header:** `{auth.get('header')}` (from `{auth.get('source')}`)")
    w("")
    w("### Error handling policy")
    w("")
    err = http.get("error_handling", {})
    w(f"Wrapper: `{err.get('wrapper_fn')}`")
    w("")
    for line in str(err.get("policy", "")).strip().splitlines():
        w(line)
    w("")

    endpoints = http.get("endpoints", [])
    w(f"### Endpoints ({len(endpoints)})")
    w("")
    w("| Method | Path | Query keys | Has body | Client fn | Call sites |")
    w("|---|---|---|---|---|---|")
    for ep in sorted(endpoints, key=lambda e: (e["path"], e["method"])):
        qk = ep.get("query_keys") or []
        qk_s = ", ".join(qk) if qk else "—"
        body = "yes" if ep.get("has_body") else "—"
        sites = [s for s in ep.get("call_sites", []) if s != "src/api/client.js"]
        if not sites:
            sites_s = "_(orphan — defined but unused)_"
        else:
            sites_s = "<br>".join(f"`{s}`" for s in sites)
        w(
            f"| `{ep['method']}` | `{ep['path']}` | "
            f"{qk_s} | {body} | `{ep['id']}` | {sites_s} |"
        )
    w("")

    # ----- SQL consumer contract -----
    sql = d.get("sql_consumer_contract", {})
    w("## SQL consumer contract (secondary)")
    w("")
    w(
        "wie-ops does not otherwise touch the wie database. The entries below "
        "document the one exception — the W-38 audit script — so that any "
        "schema change in wie's `regions` or `wine_families` tables triggers "
        "a visible impact on wie-ops."
    )
    w("")
    for s in sql.get("scripts", []):
        w(f"### `{s.get('path')}`")
        w("")
        w(f"**Purpose.** {s.get('purpose')}")
        w("")
        w("**Connection.**")
        for line in str(s.get("connection", "")).strip().splitlines():
            w(f"> {line}")
        w("")
        w("**Tables read.**")
        w("")
        w("| Table | Columns | Predicate | Cross-ref |")
        w("|---|---|---|---|")
        for t in s.get("tables_read", []):
            cols = ", ".join(t.get("columns", []))
            pred = t.get("predicate") or "—"
            xref = t.get("cross_ref_wie_dictionary") or "—"
            w(f"| `{t['name']}` | {cols} | `{pred}` | {xref} |")
        w("")
        auth_list = s.get("authority_list")
        if auth_list:
            w("**Authority list.**")
            w("")
            w(f"- Variable: `{auth_list.get('variable')}`")
            w(f"- Approx. size: {auth_list.get('size_approx')}")
            w(f"- Domain: {auth_list.get('domain')}")
            w("")
            w("*Modification policy:*")
            for line in str(auth_list.get("modification_policy", "")).strip().splitlines():
                w(f"> {line}")
            w("")
        w(f"**Writes.** {s.get('writes')}")
        w("")
        w(f"**Invocation.** `{s.get('invocation')}`")
        if s.get("env_required"):
            w("")
            w(f"**Env required.** {', '.join(s['env_required'])}")
        w("")

    # ----- Operational notes -----
    w("## Operational notes")
    w("")
    for note in d.get("operational_notes", []) or []:
        w(f"### {note['id']}")
        w("")
        for line in str(note.get("description", "")).strip().splitlines():
            w(line)
        if note.get("source"):
            w("")
            w(f"_Source: {note['source']}_")
        w("")

    # ----- Findings -----
    w("## Findings (Phase 1)")
    w("")
    f = d.get("findings", {}) or {}

    stale = f.get("stale_in_CLAUDE_md", {})
    w(f"### Stale endpoints in CLAUDE.md ({stale.get('count', 0)})")
    w("")
    entries = stale.get("entries") or []
    if not entries:
        w("_None._")
    else:
        for e in entries:
            w(f"- `{e.get('method', '?')}` `{e['path']}` — {e.get('reason', 'no call site')}")
    w("")

    undoc = f.get("undocumented_in_CLAUDE_md", {})
    w(f"### Endpoints called by wie-ops but missing from CLAUDE.md ({undoc.get('count', 0)})")
    w("")
    for e in undoc.get("entries", []) or []:
        fn = e.get("client_fn")
        if isinstance(fn, list):
            fn_s = ", ".join(f"`{x}`" for x in fn)
        else:
            fn_s = f"`{fn}`"
        w(f"- `{e['method']}` `{e['path']}` — {fn_s}")
        if e.get("note"):
            for line in str(e["note"]).strip().splitlines():
                w(f"  > {line}")
    w("")

    orph = f.get("orphan_client_fns", {})
    w(f"### Orphan client functions ({orph.get('count', 0)})")
    w("")
    w(
        "Exported from `src/api/client.js` but never referenced by any page "
        "or component. Not necessarily dead on the backend; may be unshipped "
        "features or superseded flows."
    )
    w("")
    for e in orph.get("entries", []) or []:
        w(f"- `{e['id']}` → `{e['path']}`")
        w(f"  - Hypothesis: {e.get('hypothesis', '—')}")
    w("")

    cross = f.get("w38_scan_cross_repo_import")
    if cross:
        w("### W-38 scan cross-repo import")
        w("")
        w(f"*Severity:* **{cross.get('severity')}** — `{cross.get('location')}`")
        w("")
        for line in str(cross.get("description", "")).strip().splitlines():
            w(line)
        w("")

    openapi = f.get("openapi_status")
    if openapi:
        w("### OpenAPI verification status")
        w("")
        w(f"- Probe URL: `{openapi.get('probe_url')}`")
        w(f"- Probed this session: `{openapi.get('probed_this_session')}`")
        for line in str(openapi.get("note", "")).strip().splitlines():
            w(f"> {line}")
        w("")

    # ----- Cross-repo -----
    cr = d.get("cross_repo")
    if cr:
        w("## Cross-repo links")
        w("")
        wie = cr.get("wie_data_dictionary", {})
        w(f"- **wie dictionary:** repo `{wie.get('repo')}`, branch "
          f"`{wie.get('branch')}`, commit `{wie.get('commit')}`")
        rel = wie.get("relevant_tables_for_wie_ops", []) or []
        if rel:
            w(f"- **Tables cross-referenced from the wie dictionary:** "
              + ", ".join(f"`{t}`" for t in rel))
        w("")

    return "\n".join(out).rstrip() + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stdout", action="store_true")
    args = ap.parse_args()
    d = dio.load_file(YAML_PATH)
    rendered = render(d)
    if args.stdout:
        sys.stdout.write(rendered)
    else:
        MD_PATH.write_text(rendered)
        print(f"wrote {MD_PATH.relative_to(REPO_ROOT)} ({len(rendered.splitlines())} lines)")


if __name__ == "__main__":
    main()
