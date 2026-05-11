# wie-ops — Cowork handoff memo

**Date:** 2026-04-20 (EDT)
**Repo:** wie-ops (React 19 + Vite 8 static frontend, deployed at wie-ops.onrender.com, talks to wie API at wie-v27l.onrender.com)
**Sessions covered:** 7 (Apr 19 EDT 09:03 through Apr 20 EDT 21:35)
**Protocol:** Orchestration Protocol v1 + Amendments No. 1 + 2

**TL;DR.** Yesterday (Apr 19 EDT) was the scripted-tag arc: a regions-integrity audit (W-38-SCAN) was relocated from `/tmp/` into the repo, a full API-consumer data dictionary shipped (W-43 Phase 1), CLAUDE.md got its Data Dictionary discovery section, and everything landed on `origin/main` via PRs #1 and #2. Today (Apr 20 EDT) was a short ad-hoc touch-up on CatalogIntelligence (score-distribution sort) that is still uncommitted. One small UX decision is pending from Steve; no production incidents.

## Chronological session log

| Session (UTC start) | Exit tag | Goal | Outcome | Commits / Push |
|---|---|---|---|---|
| 0e036091 · 2026-04-19T13:03Z | `W-38-SCAN-REGROUP-20260419` | Broadened regions integrity audit using a curated authority list; read-only SELECTs against wie DB. | 8 findings from authority list; self-distribution yielded 0 (confirmed inert on this schema). Script left at `/tmp/w38_scan.py` per directive; INT-01 parity verified (92.84 / 97.20). No writes. | None (read-only + memory writes). |
| 4bfe113c · 2026-04-19T13:42Z | `W-41-REGROUP-20260419` | Enrichment-visibility investigation across wie/wie-ops — who wrote the 1,356-row window flagged by W-38? | False-alarm: traceable to undocumented W-34 Phase 2 nohup re-launches. Surfaced three durable facts: `enriched_by` default is non-falsifiable, model-string drift, nohup re-launch ledger gap. Read-only; no writes. | None. YAML diff for W-41 prepared but deferred (parent entry not yet committed in backlog). |
| bf01e0fa · 2026-04-19T14:19Z | `W-38-SCAN-DURABILITY-PUSH-20260419` | Relocate W-38 scan script from `/tmp/` into the repo. | Script moved to `scripts/audits/w38_scan.py` byte-preserved; docstring augmented with provenance header. | Branch `w38-scan-durability-20260419`, commit `73e51f3`, pushed. Became PR #1, merged (commit `0b81b07`). |
| d11f5ee2 · 2026-04-19T16:08Z | `W-43-PHASE1-PUSH-20260419` | Ship Phase 1 data dictionary: structural half only (endpoints + SQL surface, not semantic fields). | `data_dictionary.yaml`, `DATA_DICTIONARY.md`, `docs/DATA_DICTIONARY_MAINTENANCE.md`, `scripts/generate_data_dictionary_{structure,md}.py`, `scripts/verify_data_dictionary.py`, `scripts/_dictionary_io.py`. 53 endpoints catalogued; 9 undocumented vs CLAUDE.md flagged; 2 orphan client fns noted. | Branch `w43-data-dictionary-phase1-20260419`, commit `d48bab2`, pushed. Became PR #2, merged (commit `f1a213c`). |
| 43a646ce · 2026-04-19T18:43Z | `CLAUDE-MD-DICTIONARY-REF-WIEOPS-20260419` | Add Data Dictionary section to CLAUDE.md so future sessions discover the dictionary cold. | `CLAUDE.md` first-ever commit; section inserted as #2, between `## What this repo is` and `## Tech stack`. 148 insertions, one file. | Local commit `cd498fe`, not pushed (per protocol — awaiting combined push). |
| c7335f2a · 2026-04-19T18:52Z | `DICTIONARY-REF-PUSH-WIEOPS-20260419` | Push `cd498fe` to `origin/main`. Last scripted tag of the day. | Push landed clean. | `cd498fe` now on `origin/main`. |
| 284db045 · 2026-04-21T01:06Z (= Apr 20 21:06 EDT) | *(no formal exit tag — ad-hoc)* | Steve flagged UI bug on `/catalog-intel`: `below-50` band displayed above `50-59`. Also asked about enrichment-coverage accuracy and feasibility of 1-point sub-distributions. | Fix shipped inline in `src/pages/CatalogIntelligence.jsx` (+10/−2): added `bandRank()` helper and sorted the distribution descending. Verified rendered order via preview eval. Local wie API was offline; rendered card not observable but sort is pure-fn tested. End-of-day healthcheck: wie API 200/249ms, wie-ops 200/288ms, both prod. | **Uncommitted** — still in working tree. Steve asked to pick between commit-to-main, branch+PR, or discard (see Open threads). |

## Deliverables now on origin/main

```
cd498fe  CLAUDE-MD-DICTIONARY-REF: add Data Dictionary section for session discoverability
f1a213c  Merge pull request #2 from steveshyn/w43-data-dictionary-phase1-20260419
d48bab2  W-43-DATA-DICTIONARY-PHASE1: API-consumer dictionary + W-38 SQL surface
0b81b07  Merge pull request #1 from steveshyn/w38-scan-durability-20260419
73e51f3  W-38-SCAN-DURABILITY: relocate regions audit script from /tmp/ to scripts/audits/
```

## Open threads / deferred items

- **Uncommitted CatalogIntelligence sort fix** (Apr 20 evening). `src/pages/CatalogIntelligence.jsx`, +10/−2. Steve has not chosen commit / branch+PR / discard yet. First thing to resolve.
- **`below-50` / `60-69` 1-point sub-histogram.** Recommended backend endpoint `/ops/catalog-intelligence/score-histogram?min=50&max=69` with `GROUP BY FLOOR(wiqs_score)`, UI mini-histogram expandable on click. Needs a W-ticket opened on wie side.
- **Enrichment coverage labeling.** Card mixes vintages (41,937) and families (20,672) without disclosing unit on the "Count" header. Easy UI relabel.
- **W-43 Phase 2** (semantic half): consumed response fields per endpoint, CLAUDE.md reconciliation against dictionary (9 endpoints found undocumented), resolve `scripts/audits/w38_scan.py` cross-repo `WIE_REPO` import (currently a `sys.path` hack), CI verifier hook. Deferred.
- **Backlog parent-entry precondition.** W-41 and W-38-SCAN-DURABILITY both prepared YAML sub-bullets that had to be deferred because their parent W-XX entries weren't yet in `wie/data/conektiq_backlog.yaml`. Recurred twice on 2026-04-19 — promote to standing precondition.
- **Local merged branches safe to prune:** `w38-scan-durability-20260419`, `w43-data-dictionary-phase1-20260419`.

## Memory entries touched today (Apr 19 EDT — nothing new Apr 20)

All at `/Users/StephenShyn/.claude/projects/-Users-StephenShyn-Desktop-a---The-Han-Project-Connectiq-Application-Technology-wie-ops/memory/`:

- `MEMORY.md` (Apr 19 12:29) — index; now 10 entries.
- `feedback_int01_canonical_columns.md` — INT-01 canonical query uses stale `fid`/`vintage`; prod is `wine_family_id`/`vintage_year`. Translate silently; scores 92.84 / 97.20 unchanged.
- `feedback_regions_self_distribution_inert.md` — `regions.name` is UNIQUE; self-distribution has zero detection power. Authority list is the only load-bearing mechanism for regions integrity audits.
- `feedback_w38_scan_script_relocated.md` — Audit script now at `scripts/audits/w38_scan.py`; AUTHORITY dict changes need Steve review.
- `feedback_backlog_parent_existence_precondition.md` — grep backlog YAML for parent ID before drafting sub-bullets; deferred twice.
- `project_enrichment_origin_tag_gap.md` — `wine_enrichment.enriched_by` defaults `'auto'`; row-level auth claims non-falsifiable until W-45 closes.
- `project_enrichment_model_string_drift.md` — `enrich_wine_intelligence.py` stamps `claude-sonnet-4-20250514` (two gens stale). Authoritative target is `claude-sonnet-4-6`. W-46 verification gate closed.
- `project_nohup_relaunch_ledger_gap.md` — W-34 Phase 2 nohup re-launches unledgered. Attribute via `logs/w34_phase2_backfill_*.log` tails, not shell history (Claude Code Bash nohups don't hit history). W-47 tracks the fix.
- `project_w43_data_dictionary_phase1.md` — Phase 1 shipped; Phase 2 semantic half deferred.

## Gotchas a fresh Cowork session needs

- **Dictionary authority:** For endpoint contracts, read `data_dictionary.yaml` first, not CLAUDE.md's endpoint list — 9 endpoints are missing from CLAUDE.md. Dictionary wins until Phase 2 reconciles.
- **INT-01 parity query** uses stale column names. Use `wine_family_id` and `vintage_year` on prod. Scores: La Tâche fid=1 2020 = 92.84, Margaux fid=11 2016 = 97.20.
- **P4 pillar alias.** Always alias `p4_vcs_vintage AS p4_market_validation` in any endpoint returning pillar scores.
- **Schema drift.** `wine_families` columns differ between local and prod. Verify before adding endpoints.
- **Protected tiers.** fids 11, 12, 369, 912, 983, 1061 must stay `grand_cru`.
- **Model string.** `claude-sonnet-4-6` is authoritative. Reject anything stamping `claude-sonnet-4-20250514`.
- **SQL exception.** Only `scripts/audits/w38_scan.py` touches wie DB directly — SQLAlchemy `text()` + `:named` params only, bulk ops only.
- **Communication-pattern signal.** Use `communication_pattern_signal` wording — never `age_inference`.
- **Desktop-only UI.** 1280px minimum; high info density is correct; styling is inline only; no Tailwind / CSS modules.
- **No DB writes without Steve approval.** wie-ops consumes wie API; if you open a SQL path, it's exceptional and needs explicit authorization.

## Current repo state

- Branch: `main`
- HEAD: `cd498fe0a345cd1109179c315538ae2896e4d9cf`
- `origin/main`: `cd498fe…` — parity.
- Working tree: **dirty** — `src/pages/CatalogIntelligence.jsx` has +10/−2 from the Apr 20 sort fix. Staging/commit decision pending from Steve.
- Prod health (end of Apr 20 EDT): wie API 200 / 249ms, wie-ops 200 / 288ms. Preview server stopped.
