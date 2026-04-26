const BASE = import.meta.env.VITE_API_BASE_URL

// In-memory navigation-revisit cache.
// Polling paths must call the underlying fetch directly to keep data live;
// only initial mounts and user-triggered loads should go through cachedFetch.
const _cache = new Map()
const CACHE_TTL_MS = 60_000

export async function cachedFetch(key, fetchFn) {
  const hit = _cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.data
  const data = await fetchFn()
  _cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
  return data
}

export function invalidateCache(key) { _cache.delete(key) }
export function invalidateAll() { _cache.clear() }

function getAuthHeaders() {
  // Replace this function only to change auth strategy
  // (JWT, OAuth2, network-level, etc) — no other changes needed
  const key = localStorage.getItem('wie_api_key')
  return key ? { 'X-WIE-API-Key': key } : {}
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// Health
export const getHealth = () => apiFetch('/health')
export const getOpsHealth = () => apiFetch('/ops/health')

// Catalog
export const getCatalogStats  = () => apiFetch('/ops/catalog/stats')
export const getQualityIssues = () => apiFetch('/ops/quality-issues')
export const getRegions       = () => apiFetch('/ops/regions')

// Wine edits
export const updateWineRegion = (wineId, regionId, reason) =>
  apiFetch(`/ops/wine/${wineId}/region`, {
    method: 'PATCH',
    body: JSON.stringify({ region_id: regionId, reason }),
  })

export const updateWineTier = (wineId, tier, reason) =>
  apiFetch(`/ops/wine/${wineId}/tier`, {
    method: 'PATCH',
    body: JSON.stringify({ production_tier: tier, reason }),
  })

export const recomputeWine = (wineId, reason = 'manual_recompute') =>
  apiFetch(`/ops/wine/${wineId}/recompute`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

// Batch
export const batchRecompute = (scope, options = {}) =>
  apiFetch('/ops/wiqs/batch', {
    method: 'POST',
    body: JSON.stringify({ scope, ...options }),
  })

// WIQS history
export const getWIQSHistory = (wineFamilyId) =>
  apiFetch(`/ops/wiqs/history/${wineFamilyId}`)

// Lookup tables
export const getSubregions = () => apiFetch('/ops/lookup/subregions')
export const getProducers  = () => apiFetch('/ops/lookup/producers')

export const updateSubregion = (id, data) =>
  apiFetch(`/ops/lookup/subregion/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
export const updateProducer = (id, data) =>
  apiFetch(`/ops/lookup/producer/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
export const createSubregion = (data) =>
  apiFetch('/ops/lookup/subregion', {
    method: 'POST',
    body: JSON.stringify(data),
  })
export const createProducer = (data) =>
  apiFetch('/ops/lookup/producer', {
    method: 'POST',
    body: JSON.stringify(data),
  })

// Vintage heat map
export const getVintageHeatMap = () => apiFetch('/ops/wiqs/vintage-heat-map')

// All wines with latest WIQS scores (catalog)
export const getWIQSScores = () => apiFetch('/ops/wiqs/scores')

// Denomination tiers (read-only)
export const getDenominationTiers = () => apiFetch('/ops/lookup/denomination-tiers')

// Wine search
export const searchWines = (q) =>
  apiFetch(`/wines/search?q=${encodeURIComponent(q)}`)

// ARCH-001 Audit log
export const getAuditLog = ({ tableName, operator, limit = 50, offset = 0, from_date, to_date } = {}) => {
  const params = new URLSearchParams()
  if (tableName) params.set('table_name', tableName)
  if (operator)  params.set('operator',   operator)
  if (from_date) params.set('from_date',  from_date)
  if (to_date)   params.set('to_date',    to_date)
  params.set('limit',  String(limit))
  params.set('offset', String(offset))
  return apiFetch(`/ops/audit?${params.toString()}`)
}

export const getAuditTables = () => apiFetch('/ops/audit/tables')

// Domain 07 — Audit Trail (extended)
export const getAuditTrail = (params = {}) => {
  const sp = new URLSearchParams()
  if (params.operator)   sp.set('operator',   params.operator)
  if (params.table_name) sp.set('table_name', params.table_name)
  if (params.field_name) sp.set('field_name', params.field_name)
  if (params.record_id)  sp.set('record_id',  params.record_id)
  if (params.session_id) sp.set('session_id', params.session_id)
  if (params.date_from)  sp.set('date_from',  params.date_from)
  if (params.date_to)    sp.set('date_to',    params.date_to)
  if (params.search)     sp.set('search',     params.search)
  sp.set('limit',  String(params.limit  ?? 100))
  sp.set('offset', String(params.offset ?? 0))
  return apiFetch(`/ops/audit?${sp.toString()}`)
}

export const getAuditExportUrl = (params = {}) => {
  const sp = new URLSearchParams()
  if (params.operator)   sp.set('operator',   params.operator)
  if (params.table_name) sp.set('table_name', params.table_name)
  if (params.field_name) sp.set('field_name', params.field_name)
  if (params.record_id)  sp.set('record_id',  params.record_id)
  if (params.session_id) sp.set('session_id', params.session_id)
  if (params.date_from)  sp.set('date_from',  params.date_from)
  if (params.date_to)    sp.set('date_to',    params.date_to)
  if (params.search)     sp.set('search',     params.search)
  return `${BASE}/ops/audit/export?${sp.toString()}`
}

// Phase 3 — Customer Layer
export const getCustomerProfile = (customerId) =>
  apiFetch(`/recommend/profile/${encodeURIComponent(customerId)}`)

export const getRecommendations = (customerId, limit = 10, context = null, minWiqs = 55.0) =>
  apiFetch('/recommend', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: customerId,
      limit,
      min_wiqs: minWiqs,
      context,
    }),
  })

export const getMatchScore = (customerId, wineFamilyId, vintageYear = null) =>
  apiFetch('/recommend/match', {
    method: 'POST',
    body: JSON.stringify({
      customer_id:    customerId,
      wine_family_id: wineFamilyId,
      vintage_year:   vintageYear,
    }),
  })

// ARCH-002 — Admin / Data Management

export const getAdminFamilies = (params = {}) => {
  const sp = new URLSearchParams()
  if (params.q)       sp.set('q',       params.q)
  if (params.country) sp.set('country', params.country)
  if (params.region)  sp.set('region',  params.region)
  if (params.tier)    sp.set('tier',    params.tier)
  if (params.lwin)    sp.set('lwin',    params.lwin)
  if (params.sort)    sp.set('sort',    params.sort)
  sp.set('limit',  String(params.limit  ?? 50))
  sp.set('offset', String(params.offset ?? 0))
  return apiFetch(`/admin/families?${sp.toString()}`)
}

export const getAdminFamily = (wineFamilyId) =>
  apiFetch(`/admin/families/${wineFamilyId}`)

export const updateAdminFamily = (wineFamilyId, fields, note) =>
  apiFetch(`/admin/families/${wineFamilyId}`, {
    method: 'PUT',
    body:   JSON.stringify({ fields, note }),
  })

export const retireFamily = (wineFamilyId, reason, confirm = false) =>
  apiFetch(`/admin/families/${wineFamilyId}/retire?confirm=${confirm}`, {
    method: 'POST',
    body:   JSON.stringify({ reason }),
  })

export const unretireFamily = (wineFamilyId, note) =>
  apiFetch(`/admin/families/${wineFamilyId}/unretire`, {
    method: 'POST',
    body:   JSON.stringify({ note }),
  })

export const recomputeFamily = (wineFamilyId, note, operator = 'steve') =>
  apiFetch(`/admin/recompute/${wineFamilyId}`, {
    method: 'POST',
    body:   JSON.stringify({ note, operator }),
  })

export const recomputeRegion = (region, note, operator = 'steve') =>
  apiFetch('/admin/recompute/region', {
    method: 'POST',
    body:   JSON.stringify({ region, note, operator }),
  })

export const overridePillar = (wineVintageId, pillar, value, note) =>
  apiFetch('/admin/override/pillar', {
    method: 'POST',
    body:   JSON.stringify({
      wine_vintage_id: wineVintageId,
      pillar,
      override_value:  Number(value),
      note,
    }),
  })

export const deletePillarOverride = (overrideId, note) =>
  apiFetch(`/admin/override/pillar/${overrideId}`, {
    method: 'DELETE',
    body:   JSON.stringify({ note }),
  })

export const overridePrestige = (wineFamilyId, score, tier, note) =>
  apiFetch('/admin/override/prestige', {
    method: 'POST',
    body:   JSON.stringify({
      wine_family_id: wineFamilyId,
      prestige_score: Number(score),
      tier,
      note,
    }),
  })

export const getPillarOverrides = () =>
  apiFetch('/admin/overrides/pillars')

export const getPrestigeOverrides = () =>
  apiFetch('/admin/overrides/prestige')

export const getAdminHealth = () =>
  apiFetch('/admin/health')

// Tasting Model dashboard
export const getTastingModelDashboard = () =>
  apiFetch('/admin/tasting-model/dashboard')

// LWIN coverage
export const getLwinCoverage = () =>
  apiFetch('/admin/lwin/coverage')

// Data health extended (tasting model flags)
export const getDataHealthExtended = () =>
  apiFetch('/admin/data-health/extended')

// Ask WINE — natural language query
export const askWine = (question, format = 'table') =>
  apiFetch('/admin/ask', {
    method: 'POST',
    body: JSON.stringify({ question, format }),
  })

// Domain 04 — Pipeline Operations
export const getPipelines = () => apiFetch('/ops/pipelines')
export const getPipelineHistory = (pipelineId) =>
  apiFetch(`/ops/pipelines/${encodeURIComponent(pipelineId)}/history`)

// Domain 06 — API Platform
export const getApiPlatformSummary = () => apiFetch('/ops/api-platform/summary')
export const getApiPlatformCoverage = () => apiFetch('/ops/api-platform/catalog-coverage')

export const getEndpointHealth = (hours = 24) =>
  apiFetch(`/ops/api-platform/endpoint-health?hours=${hours}`)

// Domain 02 — Scoring Engine
export const getScoringEngine = () => apiFetch('/ops/scoring-engine')

// Domain 03 — Catalog Intelligence
export const getCatalogIntelligence = () => apiFetch('/ops/catalog-intelligence')

// W-56 — Data Queue
export const getCandidateQueueSummary = () =>
  apiFetch('/admin/candidates/queue-summary')

export const getCandidateReviewQueue = (params = {}) => {
  const sp = new URLSearchParams()
  if (params.country)    sp.set('country',    params.country)
  if (params.confidence) sp.set('confidence', params.confidence)
  if (params.reason)     sp.set('reason',     params.reason)
  sp.set('limit',  String(params.limit  ?? 50))
  sp.set('offset', String(params.offset ?? 0))
  return apiFetch(`/admin/candidates/review-queue?${sp.toString()}`)
}

export const getCandidateDetail = (id) =>
  apiFetch(`/admin/candidates/${id}`)

export const submitCandidateDecision = (id, decision, note, operator = 'steve') =>
  apiFetch(`/admin/candidates/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, note, operator }),
  })

export const submitBatchDecision = (ids, decision, note, operator = 'steve') =>
  apiFetch('/admin/candidates/batch-decision', {
    method: 'POST',
    body: JSON.stringify({ ids, decision, note, operator }),
  })

// W-58 — Promotion engine
export const triggerPromotion = (opts = {}) =>
  apiFetch('/admin/candidates/promote', {
    method: 'POST',
    body: JSON.stringify({
      no_palate_sync: opts.noPalateSync ?? false,
      limit: opts.limit ?? 500,
    }),
  })

// Domain 05 — Data Quality Monitor
export const getDataQualitySummary = () => apiFetch('/ops/data-quality/summary')
export const getDataQualityWines = (params = {}) => {
  const sp = new URLSearchParams()
  if (params.status)    sp.set('status',    params.status)
  if (params.min_score) sp.set('min_score', params.min_score)
  if (params.max_score) sp.set('max_score', params.max_score)
  if (params.country)   sp.set('country',   params.country)
  sp.set('limit',  String(params.limit  ?? 50))
  sp.set('offset', String(params.offset ?? 0))
  return apiFetch(`/ops/data-quality/wines?${sp.toString()}`)
}
