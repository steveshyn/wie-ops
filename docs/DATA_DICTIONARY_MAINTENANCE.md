# Data dictionary — maintenance contract

*Established:* 2026-04-19 (session `W-43-DATA-DICTIONARY-PHASE1-20260419`)
*Pattern source:* `W-42-DATA-DICTIONARY-PHASE1` (wie repo, commit `b410802`)

## What this dictionary is

`data_dictionary.yaml` at the repo root is the authoritative inventory of
wie-ops's external-system dependencies.

wie-ops has no database of its own. Its dependency surface is:

1. **HTTP:** every wie API endpoint it calls (primary — `http_consumer_contract`).
2. **SQL:** `scripts/audits/w38_scan.py` reads wie's DB directly (secondary — `sql_consumer_contract`).

Anything the UI renders ultimately flows through one of those two surfaces.
If the dictionary is accurate, breaking changes upstream become detectable
on a PR rather than in production.

## Why Python tooling in a JS repo

The scanner, Markdown generator, and verifier are Python (`.py`). wie-ops is
otherwise a JavaScript frontend. The asymmetry is deliberate and follows the
`scripts/audits/w38_scan.py` precedent:

- Python is already present in the repo for the W-38 audit script.
- The verifier probes wie's backend, which is Python — downstream tooling can
  share vocabulary with the backend team.
- Keeps the frontend bundle free of YAML / schema libraries that would only
  serve tooling.
- Uses Python 3 stdlib only (no `pip install` needed) — see
  `scripts/_dictionary_io.py` for the minimal purpose-built YAML reader.

When the wie backend team ships a new endpoint, a single language (Python)
handles both the wie dictionary (W-42) and this one.

## File layout

```
data_dictionary.yaml                         # authoritative, hand + auto
DATA_DICTIONARY.md                           # generated view (regenerate on change)
docs/DATA_DICTIONARY_MAINTENANCE.md          # this file
scripts/
  _dictionary_io.py                          # minimal YAML reader (stdlib-only)
  generate_data_dictionary_structure.py      # scanner — emits endpoint structural block
  generate_data_dictionary_md.py             # YAML -> Markdown renderer
  verify_data_dictionary.py                  # CI check: drift + API contract
```

## When to run what

### You added a new API call to `src/api/client.js`

1. Re-run the scanner to produce the updated structural block:
   ```sh
   python3 scripts/generate_data_dictionary_structure.py
   ```
2. Copy-paste the block between `# ---- BEGIN STRUCTURAL ----` and
   `# ---- END STRUCTURAL ----` in `data_dictionary.yaml`.
3. Regenerate the Markdown view:
   ```sh
   python3 scripts/generate_data_dictionary_md.py
   ```
4. Commit both `data_dictionary.yaml` and `DATA_DICTIONARY.md` together with
   the client change. A PR that updates `client.js` but not the dictionary
   will fail CI.

### You removed or renamed a client fn

Same flow as above. The verifier detects both directions — endpoints added
to client.js but missing from the YAML, and endpoints in the YAML with no
call site in client.js.

### You modified `scripts/audits/w38_scan.py`

The scanner does **not** inspect the audit script. If you change which columns
the script reads, or expand the authority list domain, hand-edit
`sql_consumer_contract.scripts[0]` in `data_dictionary.yaml` and regenerate
the Markdown.

**Authority list additions require Steve's review** — see the
`modification_policy` block in the YAML. Cite a public source (Wikipedia,
PDO/AOC registry, or equivalent) in the commit message.

### You want to verify locally before pushing

```sh
python3 scripts/verify_data_dictionary.py            # full check incl. OpenAPI probe
python3 scripts/verify_data_dictionary.py --skip-api # local drift check only
```

Exit codes: `0` pass, `1` check failed (drift or contract mismatch), `2`
verifier crashed.

## CI integration (recommended)

Add to `.github/workflows/` or equivalent on every PR to `main`:

```yaml
- name: Verify data dictionary
  run: python3 scripts/verify_data_dictionary.py
```

This check enforces two invariants:

1. `data_dictionary.yaml` is in sync with `src/api/client.js`.
2. Every endpoint documented here exists in wie's OpenAPI spec (shape-diff
   mode) — **or**, if wie's `/openapi.json` is unavailable, a small liveness
   probe against a curated set of known endpoints returns non-5xx.

The second invariant is load-bearing for the **cross-repo asymmetry** noted
in the dictionary: wie-ops auto-deploys on push to main while wie does not.
Without this check, a dictionary-correct wie-ops PR can still ship to
production against a wie that has removed one of the endpoints.

## Phase roadmap

### Phase 1 (this session — locked in)

- Structural inventory: method, path, query keys, body presence, call sites.
- Scanner + Markdown generator + verifier.
- SQL-consumer contract for `w38_scan.py`.
- Findings surfaced but not fixed: undocumented endpoints in CLAUDE.md,
  orphan client fns, cross-repo import in the audit script, OpenAPI
  availability TBD.

### Phase 2 (future — not part of this session)

- Semantic half for each endpoint: human description, *which response fields
  the UI actually consumes*, expected failure modes.
- Shape-diff mode in the verifier exercises response bodies against the
  documented `consumed_fields` list.
- Reconcile CLAUDE.md endpoint section against this dictionary (or delete
  the CLAUDE.md section, pointing to `DATA_DICTIONARY.md` as authoritative).
- Resolve the `w38_scan.py` cross-repo `sys.path` hack — either add a
  `WIE_REPO` env var or move the script into the wie repo proper.

### Phase 3 (future — out of scope)

- Standing-guard cadence for `w38_scan.py`, documented in the dictionary.
- Cross-repo dictionary linkage (automated: wie's Phase 1 regions schema
  imported into wie-ops's Phase 1 cross-ref block).

## Pitfalls and gotchas

- **Do not hand-edit the endpoint list.** Always round-trip through
  `generate_data_dictionary_structure.py`. The scanner uses a deterministic
  path-normalisation pass (strips `encodeURIComponent()`, normalises
  template literals, drops query strings into `query_keys`); hand-edits
  will fail the verifier.
- **Multi-line imports.** The scanner's call-site indexer tracks multi-line
  `import { ... } from '...'` blocks to avoid counting imports as call
  sites. If you introduce an unusual import shape, re-run the verifier.
- **Orphan client fns.** The dictionary lists them as findings. Do not
  delete them silently — they may correspond to backend endpoints that are
  stable and waiting for UI work. Coordinate with the wie dictionary
  (W-42) before removal.
- **Query-string-driven endpoints.** `/ops/audit` is called by two
  different client functions (`getAuditLog`, `getAuditTrail`) with
  different query key sets. The dictionary treats them as two entries
  because the UI pages consume different shapes. Keep this pattern when
  adding similar endpoints.

## Contact

For changes that would widen the scope of the dictionary (new dependency
category, new surface type, changes to the authority list in w38_scan), add
a session note and get Steve's sign-off.
