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

// Wine search
export const searchWines = (q) =>
  apiFetch(`/wines/search?q=${encodeURIComponent(q)}`)
