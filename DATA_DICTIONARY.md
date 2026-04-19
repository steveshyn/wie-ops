# wie-ops data dictionary — Phase 1

*Session:* `W-43-DATA-DICTIONARY-PHASE1-20260419`  
*Generated:* 2026-04-19  
*Scope:* structural_inventory_only  
*Pattern source:* W-42-DATA-DICTIONARY-PHASE1 (wie repo)

> This file is generated from `data_dictionary.yaml`. Edit the YAML,
> then run `python scripts/generate_data_dictionary_md.py` to refresh.

## Upstream API

- **Base URL env var:** `VITE_API_BASE_URL`
- **Production:** https://wie-v27l.onrender.com
- **Local dev:** http://localhost:8100

## Pattern adaptation (wie → wie-ops)

wie-ops is a pure frontend (React 19 + Vite 8, static site on Render).
It has no DATABASE_URL, no ORM, no migrations. The W-42 structural
scanner's role — introspect information_schema — is replaced here by
scanning src/api/client.js for apiFetch(...) call sites. The verifier's
role — diff documented columns against pg_catalog — is replaced by
probing wie's /openapi.json and diffing documented endpoints against
FastAPI's auto-spec.

## HTTP consumer contract

- **Source file:** `src/api/client.js`
- **Transport:** fetch (browser)
- **Auth header:** `X-WIE-API-Key` (from `localStorage['wie_api_key']`)

### Error handling policy

Wrapper: `apiFetch (client.js:10-24)`

Non-2xx responses throw Error(err.detail || `HTTP ${status}`). UI pages
surface errors via useAPI's error state (src/hooks/useAPI.js). Two
known sites swallow errors defensively:
  - SystemHealth.jsx:36  getQualityIssues().catch(() => ({...})
  - SystemHealth.jsx:37  getOpsHealth().catch(() => null)
  - HealthDashboard.jsx:84 getDataHealthExtended().catch(() => null)
  - Layout.jsx:12 getHealth() fire-and-forget for indicator pulse

### Endpoints (53)

| Method | Path | Query keys | Has body | Client fn | Call sites |
|---|---|---|---|---|---|
| `POST` | `/admin/ask` | — | yes | `askWine` | `src/components/AskWine.jsx:33` |
| `GET` | `/admin/data-health/extended` | — | — | `getDataHealthExtended` | `src/pages/HealthDashboard.jsx:84` |
| `GET` | `/admin/families` | country, limit, lwin, offset, q, region, sort, tier | — | `getAdminFamilies` | `src/pages/CatalogBrowser.jsx:188` |
| `GET` | `/admin/families/{wineFamilyId}` | — | — | `getAdminFamily` | `src/pages/CatalogBrowser.jsx:431` |
| `PUT` | `/admin/families/{wineFamilyId}` | — | yes | `updateAdminFamily` | `src/pages/CatalogBrowser.jsx:578` |
| `POST` | `/admin/families/{wineFamilyId}/retire` | confirm | yes | `retireFamily` | `src/pages/CatalogBrowser.jsx:592` |
| `POST` | `/admin/families/{wineFamilyId}/unretire` | — | yes | `unretireFamily` | _(orphan — defined but unused)_ |
| `GET` | `/admin/health` | — | — | `getAdminHealth` | `src/pages/HealthDashboard.jsx:83` |
| `GET` | `/admin/lwin/coverage` | — | — | `getLwinCoverage` | `src/pages/LwinCoverage.jsx:65` |
| `POST` | `/admin/override/pillar` | — | yes | `overridePillar` | `src/pages/CatalogBrowser.jsx:786` |
| `DELETE` | `/admin/override/pillar/{overrideId}` | — | yes | `deletePillarOverride` | `src/pages/CatalogBrowser.jsx:933`<br>`src/pages/OverrideQueue.jsx:171` |
| `POST` | `/admin/override/prestige` | — | yes | `overridePrestige` | `src/pages/CatalogBrowser.jsx:948` |
| `GET` | `/admin/overrides/pillars` | — | — | `getPillarOverrides` | `src/pages/OverrideQueue.jsx:92` |
| `GET` | `/admin/overrides/prestige` | — | — | `getPrestigeOverrides` | `src/pages/OverrideQueue.jsx:93` |
| `POST` | `/admin/recompute/region` | — | yes | `recomputeRegion` | _(orphan — defined but unused)_ |
| `POST` | `/admin/recompute/{wineFamilyId}` | — | yes | `recomputeFamily` | `src/pages/CatalogBrowser.jsx:608` |
| `GET` | `/admin/tasting-model/dashboard` | — | — | `getTastingModelDashboard` | `src/pages/TastingModel.jsx:66` |
| `GET` | `/health` | — | — | `getHealth` | `src/components/Layout.jsx:12`<br>`src/pages/SystemHealth.jsx:34` |
| `GET` | `/ops/api-platform/catalog-coverage` | — | — | `getApiPlatformCoverage` | `src/pages/ApiPlatform.jsx:321` |
| `GET` | `/ops/api-platform/endpoint-health` | hours | — | `getEndpointHealth` | `src/pages/ApiPlatform.jsx:137` |
| `GET` | `/ops/api-platform/summary` | — | — | `getApiPlatformSummary` | `src/pages/ApiPlatform.jsx:320` |
| `GET` | `/ops/audit` | from_date, limit, offset, operator, table_name, to_date | — | `getAuditLog` | `src/pages/AuditLog.jsx:211` |
| `GET` | `/ops/audit` | date_from, date_to, field_name, limit, offset, operator, record_id, search, session_id, table_name | — | `getAuditTrail` | `src/pages/AuditTrail.jsx:143` |
| `GET` | `/ops/audit/export` | — | — | `getAuditExportUrl` | `src/pages/AuditTrail.jsx:168` |
| `GET` | `/ops/audit/tables` | — | — | `getAuditTables` | `src/pages/AuditLog.jsx:232` |
| `GET` | `/ops/catalog-intelligence` | — | — | `getCatalogIntelligence` | `src/pages/CatalogIntelligence.jsx:192` |
| `GET` | `/ops/catalog/stats` | — | — | `getCatalogStats` | `src/pages/AnnualVintage.jsx:548`<br>`src/pages/SystemHealth.jsx:35`<br>`src/pages/WIQSScores.jsx:129` |
| `GET` | `/ops/data-quality/summary` | — | — | `getDataQualitySummary` | `src/pages/DataQualityMonitor.jsx:336` |
| `GET` | `/ops/data-quality/wines` | country, limit, max_score, min_score, offset, status | — | `getDataQualityWines` | `src/pages/DataQualityMonitor.jsx:222` |
| `GET` | `/ops/health` | — | — | `getOpsHealth` | `src/pages/SystemHealth.jsx:37` |
| `GET` | `/ops/lookup/denomination-tiers` | — | — | `getDenominationTiers` | `src/pages/LookupTables.jsx:882` |
| `POST` | `/ops/lookup/producer` | — | yes | `createProducer` | `src/pages/LookupTables.jsx:757` |
| `PATCH` | `/ops/lookup/producer/{id}` | — | yes | `updateProducer` | `src/pages/LookupTables.jsx:693` |
| `GET` | `/ops/lookup/producers` | — | — | `getProducers` | `src/pages/LookupTables.jsx:882` |
| `POST` | `/ops/lookup/subregion` | — | yes | `createSubregion` | `src/pages/DataQuality.jsx:333`<br>`src/pages/LookupTables.jsx:502` |
| `PATCH` | `/ops/lookup/subregion/{id}` | — | yes | `updateSubregion` | `src/pages/LookupTables.jsx:443` |
| `GET` | `/ops/lookup/subregions` | — | — | `getSubregions` | `src/pages/LookupTables.jsx:882` |
| `GET` | `/ops/pipelines` | — | — | `getPipelines` | `src/pages/PipelineOperations.jsx:105` |
| `GET` | `/ops/pipelines/{pipelineId}/history` | — | — | `getPipelineHistory` | `src/pages/PipelineOperations.jsx:57` |
| `GET` | `/ops/quality-issues` | — | — | `getQualityIssues` | `src/pages/DataQuality.jsx:33`<br>`src/pages/SystemHealth.jsx:36` |
| `GET` | `/ops/regions` | — | — | `getRegions` | `src/pages/AnnualVintage.jsx:548`<br>`src/pages/DataQuality.jsx:33` |
| `GET` | `/ops/scoring-engine` | — | — | `getScoringEngine` | `src/pages/ScoringEngine.jsx:202` |
| `POST` | `/ops/wine/{wineId}/recompute` | — | yes | `recomputeWine` | `src/pages/DataQuality.jsx:366`<br>`src/pages/WIQSScores.jsx:194` |
| `PATCH` | `/ops/wine/{wineId}/region` | — | yes | `updateWineRegion` | `src/pages/DataQuality.jsx:347` |
| `PATCH` | `/ops/wine/{wineId}/tier` | — | yes | `updateWineTier` | `src/pages/DataQuality.jsx:350` |
| `POST` | `/ops/wiqs/batch` | — | yes | `batchRecompute` | `src/pages/AnnualVintage.jsx:275`<br>`src/pages/LookupTables.jsx:460`<br>`src/pages/LookupTables.jsx:710`<br>`src/pages/WIQSScores.jsx:183` |
| `GET` | `/ops/wiqs/history/{wineFamilyId}` | — | — | `getWIQSHistory` | `src/pages/WIQSScores.jsx:133` |
| `GET` | `/ops/wiqs/scores` | — | — | `getWIQSScores` | `src/pages/AnnualVintage.jsx:548`<br>`src/pages/VintageHeatMap.jsx:106`<br>`src/pages/WIQSScores.jsx:130` |
| `GET` | `/ops/wiqs/vintage-heat-map` | — | — | `getVintageHeatMap` | `src/pages/VintageHeatMap.jsx:105` |
| `POST` | `/recommend` | — | yes | `getRecommendations` | `src/pages/CustomerLayer.jsx:177` |
| `POST` | `/recommend/match` | — | yes | `getMatchScore` | `src/pages/CustomerLayer.jsx:196` |
| `GET` | `/recommend/profile/{customerId}` | — | — | `getCustomerProfile` | `src/pages/CustomerLayer.jsx:163` |
| `GET` | `/wines/search` | q | — | `searchWines` | `src/pages/WIQSScores.jsx:158` |

## SQL consumer contract (secondary)

wie-ops does not otherwise touch the wie database. The entries below document the one exception — the W-38 audit script — so that any schema change in wie's `regions` or `wine_families` tables triggers a visible impact on wie-ops.

### `scripts/audits/w38_scan.py`

**Purpose.** Read-only regions-integrity scan (authority + self-distribution).

**Connection.**
> Uses wie's DATABASE_URL via `from database import engine` after
> `sys.path.insert(0, "<wie repo>")` (w38_scan.py:44-45). READ-ONLY —
> executes only SELECTs. Print asserts "WRITES EXECUTED: NONE".

**Tables read.**

| Table | Columns | Predicate | Cross-ref |
|---|---|---|---|
| `regions` | id, name, subregion, zone, country, parent_region | `WHERE r.id != 13` | regions (wie W-42 Phase 1 dictionary) |
| `wine_families` | id, region_id | `—` | wine_families (wie W-42 Phase 1 dictionary) |

**Authority list.**

- Variable: `AUTHORITY (w38_scan.py:54-267)`
- Approx. size: 95
- Domain: top global wine regions (country, zone) by PDO/AOC dominance

*Modification policy:*
> Additions/edits require Steve's review. An incorrect authority entry
> silently vouches for a corrupted row, hiding it from future scans.
> PRs modifying AUTHORITY must cite a public source in the commit msg
> (Wikipedia, PDO/AOC registries, or equivalent).

**Writes.** NONE (READ-ONLY)

**Invocation.** `python scripts/audits/w38_scan.py`

**Env required.** DATABASE_URL

## Operational notes

### auto_deploy_asymmetry

wie-ops auto-deploys on push to main (Render static site defaults);
wie (backend) does NOT auto-deploy. Pushing a breaking client.js
change to main ships to production wie-ops immediately, while wie
would still need a separate deploy action. Keep this asymmetry in
mind when staging coordinated frontend/backend changes.

_Source: render.yaml; confirmed 2026-04-19_

### password_gate_not_auth

VITE_OPS_PASSWORD gates UI access at the login page — it is NOT
transport auth. API authentication is X-WIE-API-Key (from localStorage
'wie_api_key'), injected by getAuthHeaders() in client.js.

### single_fetch_chokepoint

All HTTP traffic funnels through apiFetch in src/api/client.js. There
are zero direct fetch() calls elsewhere in src/. This makes the
structural scanner's single-file parse sufficient.

## Findings (Phase 1)

### Stale endpoints in CLAUDE.md (0)

_None._

### Endpoints called by wie-ops but missing from CLAUDE.md (9)

- `DELETE` `/admin/override/pillar/{overrideId}` — `deletePillarOverride`
- `GET` `/ops/api-platform/endpoint-health` — `getEndpointHealth`
- `GET` `/ops/audit` — `getAuditLog`, `getAuditTrail`
  > CLAUDE.md lists /ops/audit/tables only. The bare /ops/audit path
  > (query-string driven) is the primary audit-viewer surface and is
  > missing from the documented set.
- `GET` `/ops/audit/export` — `getAuditExportUrl`
- `GET` `/ops/pipelines/{pipelineId}/history` — `getPipelineHistory`
- `POST` `/ops/wine/{wineId}/recompute` — `recomputeWine`
- `PATCH` `/ops/wine/{wineId}/region` — `updateWineRegion`
- `PATCH` `/ops/wine/{wineId}/tier` — `updateWineTier`
- `GET` `/ops/wiqs/history/{wineFamilyId}` — `getWIQSHistory`

### Orphan client functions (2)

Exported from `src/api/client.js` but never referenced by any page or component. Not necessarily dead on the backend; may be unshipped features or superseded flows.

- `unretireFamily` → `/admin/families/{wineFamilyId}/unretire`
  - Hypothesis: Retire has UI (CatalogBrowser.jsx:592); unretire never wired up.
- `recomputeRegion` → `/admin/recompute/region`
  - Hypothesis: Region-level recompute flow may have been superseded by batchRecompute('region', ...).

### W-38 scan cross-repo import

*Severity:* **medium** — `scripts/audits/w38_scan.py:44-45`

`sys.path.insert(0, "/Users/StephenShyn/Desktop/.../wie")` — the script
cannot run on any machine where wie isn't checked out at that exact
absolute path. Portability issue, not a correctness issue. Candidate
for Phase 2 (e.g., honour a WIE_REPO env var, or relocate the script
into wie/scripts/audits/).

### OpenAPI verification status

- Probe URL: `https://wie-v27l.onrender.com/openapi.json`
- Probed this session: `False`
> Verifier (scripts/verify_data_dictionary.py) will probe on first CI run.
> If /openapi.json returns 200, verifier runs shape-diff mode. If 404/5xx,
> verifier downgrades to endpoint-liveness mode and emits an observability
> finding.

## Cross-repo links

- **wie dictionary:** repo `wie`, branch `w42-data-dictionary-phase1-20260419`, commit `b410802`
- **Tables cross-referenced from the wie dictionary:** `regions`, `wine_families`
