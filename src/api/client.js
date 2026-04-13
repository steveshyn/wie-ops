const BASE = import.meta.env.VITE_API_BASE_URL

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
