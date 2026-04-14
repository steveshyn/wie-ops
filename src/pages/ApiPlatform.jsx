import { useState, useEffect, useCallback } from 'react'
import { getApiPlatformSummary, getApiPlatformCoverage } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

function relativeTime(iso) {
  if (!iso) return '\u2014'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function CustomerCard({ customer }) {
  return (
    <div style={{
      flex: 1, minWidth: 320, padding: 20,
      background: 'var(--bg-card)', borderRadius: 8,
      border: customer.status === 'active' ? '1px solid var(--gold)' : '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{customer.name}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--text-dim)', background: 'var(--bg-hover)',
          padding: '2px 8px', borderRadius: 3,
        }}>{customer.type}</span>
      </div>
      <div style={{ display: 'flex', gap: 24, marginBottom: 14, fontSize: 13 }}>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>Plan: </span>
          <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{customer.plan}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-dim)' }}>Status: </span>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: customer.status === 'active' ? 'var(--green)' : '#555',
            boxShadow: customer.status === 'active' ? '0 0 6px var(--green)' : undefined,
          }} />
          <span style={{ color: customer.status === 'active' ? 'var(--green)' : '#555', textTransform: 'capitalize' }}>
            {customer.status}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Endpoints in use:</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {customer.endpoints_used.map(e => (
          <div key={e} style={{
            fontFamily: 'monospace', fontSize: 12, color: 'var(--text)',
            padding: '3px 8px', background: 'var(--bg)', borderRadius: 3,
          }}>{e}</div>
        ))}
      </div>
    </div>
  )
}

function SyncHealthCards({ sync, distributor }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Sync card */}
      <div style={{
        padding: 20, background: 'var(--bg-card)', borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
        }}>Catalog Sync</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>
            {(sync?.certified_wines || 0).toLocaleString()}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>certified wines available via sync</span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
          <div>
            <span style={{ color: 'var(--text-dim)' }}>Coverage: </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold)' }}>
              {sync?.coverage_pct ?? 0}%
            </span>
            <span style={{ color: 'var(--text-dim)' }}> of active catalog</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
          Last certification: {relativeTime(sync?.last_certified_at)}
        </div>
      </div>

      {/* Distributor card */}
      <div style={{
        padding: 20, background: 'var(--bg-card)', borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
        }}>Distributor API</div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {[
            { label: 'Distributors', val: distributor?.distributor_count },
            { label: 'Wine Relationships', val: distributor?.total_relationships },
            { label: 'CT-Registered Wines', val: distributor?.ct_registered_wines },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>
                {(s.val || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const EP_STATUS = {
  healthy:  { color: '#16a34a', label: 'Healthy' },
  degraded: { color: '#f59e0b', label: 'Degraded' },
  no_data:  { color: '#555',    label: 'No Data' },
}

function EndpointHealthTable({ endpoints }) {
  const hasData = endpoints.some(e => e.calls_24h != null)

  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
      }}>Endpoint Health &mdash; Last 24 Hours</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '8px 12px' }}>Endpoint</th>
            <th style={{ padding: '8px 12px' }}>Calls</th>
            <th style={{ padding: '8px 12px' }}>Avg ms</th>
            <th style={{ padding: '8px 12px' }}>P95 ms</th>
            <th style={{ padding: '8px 12px' }}>Errors</th>
            <th style={{ padding: '8px 12px' }}>Last Called</th>
            <th style={{ padding: '8px 12px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {endpoints.map(ep => {
            const s = EP_STATUS[ep.status] || EP_STATUS.no_data
            return (
              <tr key={ep.endpoint} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12 }}>{ep.endpoint}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>{ep.calls_24h ?? '\u2014'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>{ep.avg_ms ?? '\u2014'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>{ep.p95_ms ?? '\u2014'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>{ep.errors_24h ?? '\u2014'}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)' }}>
                  {ep.last_called ? relativeTime(ep.last_called) : '\u2014'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!hasData && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 12, fontStyle: 'italic' }}>
          Request logging activates after ARCH-001 audit extension ships.
        </div>
      )}
    </div>
  )
}

function enrichPctColor(pct) {
  if (pct >= 50) return 'var(--gold)'
  if (pct >= 20) return 'var(--text)'
  return 'var(--text-dim)'
}

function CatalogCoverageTable({ countries }) {
  if (!countries?.length) return null
  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-dim)',
        }}>Certified Catalog Coverage</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
          Wines available to API consumers by country &mdash; top 20 by family count
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
          <thead>
            <tr style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '8px 10px' }}>Country</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Families</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>CT Registered</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Scored Vintages</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Avg WIQS</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Enriched</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Enrichment %</th>
            </tr>
          </thead>
          <tbody>
            {countries.map(c => (
              <tr key={c.country} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.country}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {c.families.toLocaleString()}
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right', color: 'var(--text-dim)' }}>
                  {c.ct_registered.toLocaleString()}
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right', color: 'var(--text-dim)' }}>
                  {c.scored_vintages.toLocaleString()}
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: 'var(--gold)' }}>
                  {c.avg_wiqs?.toFixed(1) ?? '\u2014'}
                </td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right', color: 'var(--text-dim)' }}>
                  {c.fully_enriched.toLocaleString()}
                </td>
                <td style={{
                  padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right',
                  fontWeight: 600, color: enrichPctColor(c.enrichment_pct),
                }}>
                  {c.enrichment_pct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function ApiPlatform() {
  const [summary, setSummary] = useState(null)
  const [coverage, setCoverage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        getApiPlatformSummary(),
        getApiPlatformCoverage(),
      ])
      setSummary(s)
      setCoverage(c)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) return <LoadingSpinner />
  if (error) return (
    <div style={{ padding: 24, color: 'var(--red)', background: 'rgba(220,38,38,0.1)', borderRadius: 8 }}>
      Failed to load API Platform: {error}
    </div>
  )
  if (!summary) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Section 1 — Customers */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)',
          }}>API Customers</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            Platforms licensed to query the WINE Intelligence Engine
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {summary.customers.map(c => <CustomerCard key={c.id} customer={c} />)}
          <button style={{
            minWidth: 200, padding: '20px 24px',
            background: 'transparent', borderRadius: 8,
            border: '1px dashed var(--border)',
            color: 'var(--text-dim)', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'default', opacity: 0.5,
          }}>
            <span style={{ fontSize: 18 }}>+</span> Add API Customer
          </button>
        </div>
      </div>

      {/* Section 2 — Sync health */}
      <SyncHealthCards sync={summary.sync_health} distributor={summary.distributor_api} />

      {/* Section 3 — Endpoint health */}
      <EndpointHealthTable endpoints={summary.endpoint_health} />

      {/* Section 4 — Coverage table */}
      {coverage && <CatalogCoverageTable countries={coverage.by_country} />}
    </div>
  )
}
