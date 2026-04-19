# wie-ops — CLAUDE.md

## What this repo is
Conektiq WINE Ops dashboard. Internal tool for Steve and the team to monitor the WINE scoring engine, review data quality, and manage the wine catalog. Desktop-only, minimum 1280px viewport. High information density is correct.

## Data Dictionary

wie-ops has no database of its own — it is a React/Vite static frontend consuming the wie API. The "data dictionary" for this repo is an **API-consumer contract dictionary**: the inventory of every wie endpoint this repo depends on, plus the one SQL surface (the W-38 audit script).

- **Authoritative source:** `data_dictionary.yaml`
- **Human-readable view:** `DATA_DICTIONARY.md`
- **Maintenance contract:** `docs/DATA_DICTIONARY_MAINTENANCE.md`
- **Drift-guard verifier:** `scripts/verify_data_dictionary.py` (supports `--skip-api` for code-only checks; full API shape-diff probe available)

**For Claude sessions (Code / Chat / Cowork):** verify endpoint contracts against this dictionary rather than from memory or from `CLAUDE.md`'s earlier endpoint list. If a discrepancy surfaces between this dictionary and CLAUDE.md's endpoint list elsewhere in this file, the dictionary wins and the CLAUDE.md reference is stale (Phase 2 reconciliation pending).

**For endpoint changes:** any new/removed/changed API call site must update the dictionary. Nine endpoints were found undocumented in CLAUDE.md when the dictionary was first generated (2026-04-19); see the dictionary's findings section.

**SQL exception:** `scripts/audits/w38_scan.py` is the one place this repo touches the wie database directly. Its tables/columns are documented in the dictionary's `sql_consumer_contract` section and cross-reference wie's own dictionary.

**Related controls:** See wie repo's `data/conektiq_backlog.yaml` for the cross-cutting backlog and `data/conektiq_spend_ledger.yaml` for the spend authority.

## Tech stack
- React 19 + Vite 8 + react-router-dom 7
- Deployed at: https://wie-ops.onrender.com (Render static site)
- Talks to: wie API at https://wie-v27l.onrender.com (local dev: http://localhost:8100)
- No external charting library except recharts (used sparingly)
- All styling is inline — no CSS modules, no Tailwind

## Domains shipped
- Domain 01: System Health — API status, catalog stats, scoring distribution
- Domain 02: Data Quality Workbench — P1 issue triage, region/tier corrections
- Domain 03: Catalog Browser — full wine family admin, retire/unretire, pillar overrides
- Domain 04: Pipeline Operations — 8 registered pipeline status, run history, schedule tracking
- Domain 05: Data Quality Monitor — certification overview, enrichment depth, protected tiers, known issues, paginated wine table
- Domain 06: WIQS Scores — score browser, vintage-level detail
- Domain 07: Audit Log — wie_audit_log viewer with table/operator filters
- Domain 08: Customer Layer — palate profile viewer, recommendation engine
- Domain 09: Tasting Model — dimension weights, vector inspection
- Domain 10: LWIN Coverage — match rates, unmatched wine list
- Domain 11: Catalog Intelligence — catalog-level analytics
- Domain 12: Scoring Engine — scoring formula inspector
- Domain 13: API Platform — external API usage, catalog coverage

## Key pages / routes
```
src/pages/SystemHealth.jsx          /
src/pages/DataQuality.jsx           /quality
src/pages/WIQSScores.jsx            /scores
src/pages/VintageHeatMap.jsx        /heatmap
src/pages/LookupTables.jsx          /lookup
src/pages/LwinCoverage.jsx          /lwin
src/pages/AnnualVintage.jsx         /vintage
src/pages/CatalogBrowser.jsx        /catalog
src/pages/AuditLog.jsx              /audit
src/pages/TastingModel.jsx          /tasting
src/pages/CustomerLayer.jsx         /customers
src/pages/HealthDashboard.jsx       /health
src/pages/OverrideQueue.jsx         /overrides
src/pages/PipelineOperations.jsx    /pipelines
src/pages/DataQualityMonitor.jsx    /dq-monitor
src/pages/ScoringEngine.jsx         /scoring
src/pages/CatalogIntelligence.jsx   /catalog-intel
src/pages/ApiPlatform.jsx           /api-platform
src/pages/AuditTrail.jsx            /audit-trail
src/pages/Login.jsx                 /login
```

## Components
```
src/components/Layout.jsx           Main layout with sidebar + top bar
src/components/Sidebar.jsx          Fixed left nav (240px)
src/components/StatCard.jsx         Reusable stat card with accent color
src/components/Badge.jsx            Status badge component
src/components/LoadingSpinner.jsx   Spinner for async loads
src/components/EmptyState.jsx       Empty state placeholder
src/components/HelpTip.jsx          Tooltip helper
src/components/AskWine.jsx          Natural language query component
```

## API endpoints consumed
```
/health
/ops/health
/ops/catalog/stats
/ops/quality-issues
/ops/regions
/ops/pipelines
/ops/data-quality/summary
/ops/data-quality/wines
/ops/wiqs/scores
/ops/wiqs/batch
/ops/wiqs/vintage-heat-map
/ops/lookup/subregions
/ops/lookup/producers
/ops/lookup/denomination-tiers
/ops/lookup/subregion
/ops/lookup/producer
/ops/audit/tables
/ops/scoring-engine
/ops/catalog-intelligence
/ops/api-platform/summary
/ops/api-platform/catalog-coverage
/admin/health
/admin/families
/admin/families/:id
/admin/families/:id/retire
/admin/families/:id/unretire
/admin/recompute/:id
/admin/recompute/region
/admin/override/pillar
/admin/override/prestige
/admin/overrides/pillars
/admin/overrides/prestige
/admin/tasting-model/dashboard
/admin/lwin/coverage
/admin/data-health/extended
/admin/ask
/recommend
/recommend/match
/recommend/profile/:id
/wines/search
```

## Environment variables (keys only)
```
VITE_API_BASE_URL          # wie backend URL
VITE_OPS_PASSWORD          # ops dashboard password
```

## Design language
- Dark background: --bg #0d0d0d, --bg-card #1a1a1a
- Gold accent: --gold #c9a84c (branding, WIQS data)
- Green #16a34a (healthy/certified), Amber #f59e0b (needs attention), Red #dc2626 (failed/rejected)
- Mono font for all numbers and scores
- Fixed 240px left sidebar nav
- No animations except subtle pulse on active jobs

## Standing rules
- Read master.yaml before starting work
- INT-01 parity: La Tache fid=1 2020 = 92.84, Margaux fid=11 2016 = 97.20
- No DB writes without Steve approval
- communication_pattern_signal — NEVER age_inference
- Model string: claude-sonnet-4-6
- SQL: SQLAlchemy text() + :named params only
- Bulk operations only — no per-row queries
- Protected tiers: fids 11, 12, 369, 912, 983, 1061 must remain grand_cru
- Database: PostgreSQL 18.3 on Render (shared dev/prod)
