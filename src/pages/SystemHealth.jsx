import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import {
  getHealth, getOpsHealth, getCatalogStats, getQualityIssues,
  cachedFetch, invalidateAll,
} from '../api/client'
import StatCard      from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { TIER_COLORS, scoreToColor } from '../utils/tierColors'
import { fmtScore, fmtPct, fmtCount } from '../utils/formatters'
import AskWine from '../components/AskWine'
import HelpTip from '../components/HelpTip'

const TIER_ORDER = ['exceptional', 'distinguished', 'quality', 'standard', 'basic']

function SkeletonBlock({ width = '100%', height = 14, style }) {
  return (
    <div aria-hidden="true" style={{
      width, height, borderRadius: 4,
      background: 'linear-gradient(90deg,#222 25%,#2a2a2a 50%,#222 75%)',
      backgroundSize: '400px 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  )
}

function SystemHealthSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '20px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SkeletonBlock width={12} height={12} style={{ borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock width={120} height={14} />
            <SkeletonBlock width={60}  height={10} />
          </div>
        </div>
        <SkeletonBlock width={180} height={12} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 20,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <SkeletonBlock width="60%" height={11} />
            <SkeletonBlock width="40%" height={22} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '20px 24px', height: 320,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <SkeletonBlock width={180} height={11} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
            {[80, 65, 50, 35, 20].map((w, i) => (
              <SkeletonBlock key={i} width={`${w}%`} height={18} />
            ))}
          </div>
        </div>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '20px 24px', height: 320,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <SkeletonBlock width={160} height={11} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBlock width={120} height={13} />
                <SkeletonBlock width={40}  height={16} />
              </div>
            ))}
          </div>
          <SkeletonBlock width="100%" height={36} />
        </div>
      </div>
    </div>
  )
}

export default function SystemHealth() {
  const navigate = useNavigate()
  const [health,     setHealth]     = useState(null)
  const [stats,      setStats]      = useState(null)
  const [issues,     setIssues]     = useState(null)
  const [opsHealth,  setOpsHealth]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [apiMs,      setApiMs]      = useState(null)
  const [apiOnline,  setApiOnline]  = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const applyResults = useCallback((h, s, q, oh, elapsed) => {
    setApiMs(elapsed)
    setApiOnline(true)
    setHealth(h)
    setStats(s)
    setIssues(q)
    setOpsHealth(oh)
  }, [])

  // Initial mount + manual refresh: use cache so navigation-revisit within
  // CACHE_TTL_MS returns instantly.
  const fetchInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    const t0 = Date.now()
    try {
      const [h, s, q, oh] = await Promise.all([
        cachedFetch('sh_health',  getHealth),
        cachedFetch('sh_catalog', getCatalogStats),
        cachedFetch('sh_quality', () =>
          getQualityIssues().catch(() => ({ p1_misses: [], low_confidence: [], tier_anomalies: [] }))),
        cachedFetch('sh_ops',     () => getOpsHealth().catch(() => null)),
      ])
      applyResults(h, s, q, oh, Date.now() - t0)
    } catch (err) {
      setApiOnline(false)
      setError(err.message)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [applyResults])

  // Polling tick: bypass cache so the page actually refreshes.
  const fetchPoll = useCallback(async () => {
    const t0 = Date.now()
    try {
      const [h, s, q, oh] = await Promise.all([
        getHealth(),
        getCatalogStats(),
        getQualityIssues().catch(() => ({ p1_misses: [], low_confidence: [], tier_anomalies: [] })),
        getOpsHealth().catch(() => null),
      ])
      applyResults(h, s, q, oh, Date.now() - t0)
      setError(null)
    } catch (err) {
      setApiOnline(false)
      setError(err.message)
    } finally {
      setLastRefresh(new Date())
    }
  }, [applyResults])

  const handleRefresh = useCallback(() => {
    invalidateAll()
    fetchInitial()
  }, [fetchInitial])

  useEffect(() => {
    fetchInitial()
    const id = setInterval(fetchPoll, 60000)
    return () => clearInterval(id)
  }, [fetchInitial, fetchPoll])

  const refreshStr = lastRefresh
    ? lastRefresh.toLocaleTimeString('en-US', { hour12: false })
    : '—'

  // Tier chart data
  const tierData = stats
    ? TIER_ORDER
        .filter(t => stats.tier_distribution[t] != null)
        .map(t => ({
          tier:  t,
          count: stats.tier_distribution[t] || 0,
          pct:   ((stats.tier_distribution[t] || 0) / (stats.wiqs_scored_count || 1) * 100).toFixed(1),
        }))
    : []

  const totalScored = stats?.wiqs_scored_count || 0
  const anomalyCount = issues?.tier_anomalies?.length ?? 0

  // Confidence accent
  const confAccent = () => {
    if (!stats) return 'var(--gold)'
    const c = stats.avg_wiqs_confidence
    if (c > 0.8) return 'var(--green-light)'
    if (c >= 0.6) return 'var(--amber)'
    return 'var(--red)'
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{
        background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
        padding: '8px 12px', fontSize: 12, color: 'var(--text)',
      }}>
        <div style={{ textTransform: 'capitalize', marginBottom: 2 }}>{d.tier}</div>
        <div style={{ color: TIER_COLORS[d.tier]?.text || '#777' }}>
          {fmtCount(d.count)} wines · {d.pct}%
        </div>
      </div>
    )
  }

  // First-load skeleton: no stats yet AND we're loading. On revisit-with-cache
  // the cachedFetch resolves in a microtask so this branch is invisible.
  if (loading && !stats && !error) {
    return <SystemHealthSkeleton />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ROW 1 — API Status banner */}
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${apiOnline === false ? 'var(--red)' : apiOnline ? '#1e4d2b' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '20px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: apiOnline === null ? '#555'
              : apiOnline ? 'var(--green-light)' : 'var(--red)',
            boxShadow: apiOnline ? '0 0 8px rgba(74,222,128,0.6)' : undefined,
            flexShrink: 0,
          }} />
          <div>
            <div style={{
              fontSize: 15, fontWeight: 600,
              color: apiOnline === false ? 'var(--red)'
                : apiOnline ? 'var(--green-light)' : 'var(--text-dim)',
            }}>
              {apiOnline === null ? 'Connecting…' : apiOnline ? 'API Online' : 'API Offline'}
            </div>
            {health?.version && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                v{health.version}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'right' }}>
            {apiMs != null && <span>Response: {apiMs}ms · </span>}
            Last checked: {refreshStr}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Clear cache and refetch"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: loading ? 'var(--text-dim)' : 'var(--text)',
              padding: '6px 12px', borderRadius: 4,
              fontSize: 12, cursor: loading ? 'default' : 'pointer',
              transition: 'border-color 150ms, background 150ms',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = 'var(--gold-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Loading state — show inline spinner only when refreshing existing data;
          first-load skeleton is rendered below in place of the empty content. */}
      {loading && stats && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-dim)', padding: '16px 0' }}>
          <LoadingSpinner size="sm" />
          Refreshing…
        </div>
      )}

      {error && !stats && (
        <div style={{
          background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
          borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {stats && (
        <>
          {/* ROW 2 — Six StatCards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
          }}>
            <StatCard
              title="Wine Families"
              value={fmtCount(stats.total_families)}
              helpTerm="wine_families"
            />
            <StatCard
              title="Vintages"
              value={fmtCount(stats.total_vintages)}
              helpTerm="vintages"
            />
            <StatCard
              title="Vectors"
              value={fmtCount(stats.total_vectors)}
              subtitle={`${((stats.total_vectors / (stats.total_vintages || 1)) * 100).toFixed(0)}% of vintages`}
              helpTerm="vectors"
            />
            <StatCard
              title="WIQS Scored"
              value={fmtCount(stats.wiqs_scored_count)}
              subtitle={`${fmtCount(stats.wiqs_unscored_count)} unscored`}
              helpTerm="wiqs_scored"
            />
            <StatCard
              title="Avg WIQS Score"
              value={fmtScore(stats.avg_wiqs_score)}
              accent={scoreToColor(stats.avg_wiqs_score).text}
              helpTerm="wiqs_score"
            />
            <StatCard
              title="Avg Confidence"
              value={fmtPct(stats.avg_wiqs_confidence)}
              accent={confAccent()}
              helpTerm="confidence"
            />
          </div>

          {/* ROW 3 — Charts + Quality Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* LEFT: Tier Distribution */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '20px 24px',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 20,
              }}>
                WIQS Tier Distribution<HelpTip term="scoring_distribution" />
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={tierData} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="tier"
                    width={90}
                    tick={{ fill: 'var(--text-dim)', fontSize: 12, textTransform: 'capitalize' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={t => t.charAt(0).toUpperCase() + t.slice(1)}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                    {tierData.map((d) => (
                      <Cell key={d.tier} fill={TIER_COLORS[d.tier]?.border || '#444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* RIGHT: Data Quality Summary */}
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '20px 24px',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 20,
              }}>
                Data Quality Summary<HelpTip term="tier_anomalies" />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <QualityRow
                  label={<>P1 Misses<HelpTip term="p1_misses" /></>}
                  value={issues?.p1_misses?.length ?? 0}
                  warn={(issues?.p1_misses?.length ?? 0) > 0}
                  warnLevel="amber"
                />
                <QualityRow
                  label={<>Low Confidence<HelpTip term="low_confidence" /></>}
                  value={issues?.low_confidence?.length ?? 0}
                  warn={(issues?.low_confidence?.length ?? 0) > 0}
                  warnLevel="amber"
                />
                <QualityRow
                  label={<>Tier Anomalies<HelpTip term="tier_anomalies" /></>}
                  value={anomalyCount}
                  warn={anomalyCount > 0}
                  warnLevel="red"
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 20 }}>
                <button
                  onClick={() => navigate('/quality')}
                  style={{
                    width: '100%', padding: '10px 16px',
                    background: 'transparent',
                    border: '1px solid var(--gold)',
                    borderRadius: 4,
                    color: 'var(--gold)',
                    fontSize: 13, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Open Data Quality Workbench →
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Extended Diagnostics */}
      {opsHealth && <ExtendedDiagnostics data={opsHealth} />}

      {/* ASK WINE */}
      <AskWine />
    </div>
  )
}

function ExtendedDiagnostics({ data }) {
  const rt = data.response_times
  const pool = data.db_pool
  const crons = data.cron_jobs || []
  const proc = data.process

  const dbColor = rt?.db_status === 'healthy' ? 'var(--green-light)'
    : rt?.db_status === 'slow' ? 'var(--amber)' : 'var(--red)'

  const CRON_STATUS = {
    healthy:   { color: '#16a34a', label: 'Healthy' },
    overdue:   { color: '#f59e0b', label: 'Overdue' },
    never_run: { color: '#dc2626', label: 'Never Run' },
  }

  function stuckBg(n) {
    if (n > 5) return 'rgba(220,38,38,0.15)'
    if (n > 0) return 'rgba(245,158,11,0.15)'
    return undefined
  }

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-dim)',
        }}>
          Extended Diagnostics
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
          Response times &middot; DB pool &middot; Cron health &middot; Process state
        </div>
      </div>

      {/* Panel A + B row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Panel A — Response Times */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '20px 24px',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
          }}>
            Response Times
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>DB Query</div>
              <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: dbColor }}>
                {rt?.db_query_ms ?? '\u2014'}ms
              </span>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              color: dbColor, background: `${dbColor}22`,
              padding: '2px 8px', borderRadius: 3,
            }}>
              {rt?.db_status ?? '\u2014'}
            </span>
          </div>
        </div>

        {/* Panel B — DB Connection Pool */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '20px 24px',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
          }}>
            DB Connection Pool
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Total',  val: pool?.total },
              { label: 'Active', val: pool?.active },
              { label: 'Idle',   val: pool?.idle },
              { label: 'Stuck',  val: pool?.idle_in_transaction, bg: stuckBg(pool?.idle_in_transaction || 0) },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 4,
                background: s.bg || undefined,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                  {s.val ?? '\u2014'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel C — Cron Jobs */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '20px 24px', marginBottom: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
        }}>
          Cron Jobs
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 12px' }}>Name</th>
              <th style={{ padding: '8px 12px' }}>Schedule</th>
              <th style={{ padding: '8px 12px' }}>Last Run</th>
              <th style={{ padding: '8px 12px' }}>Hours Ago</th>
              <th style={{ padding: '8px 12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {crons.map(c => {
              const s = CRON_STATUS[c.status] || CRON_STATUS.never_run
              return (
                <tr key={c.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-dim)' }}>{c.schedule}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-dim)' }}>
                    {c.last_run ? new Date(c.last_run).toLocaleString() : '\u2014'}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                    {c.hours_since_run != null ? `${c.hours_since_run}h` : '\u2014'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: s.color,
                        boxShadow: c.status === 'healthy' ? `0 0 6px ${s.color}` : undefined,
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Panel D — Process Status */}
      {proc?.cold_start_detected ? (
        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 6, padding: '12px 16px', fontSize: 12, color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{'\u26A0\uFE0F'}</span>
          <span>Cold start detected &mdash; first requests may be slower than normal.
            Uptime: {proc.uptime_seconds}s</span>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Process uptime: {proc?.uptime_seconds != null ? `${proc.uptime_seconds}s` : '\u2014'}
          {proc?.status === 'stable' && ' \u00b7 stable'}
        </div>
      )}
    </div>
  )
}

function QualityRow({ label, value, warn, warnLevel = 'amber' }) {
  const warnColor = warnLevel === 'red' ? 'var(--red)' : 'var(--amber)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {warn && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={warnColor} strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        )}
        <span style={{
          fontWeight: 600, fontSize: 16,
          color: warn ? warnColor : 'var(--green-light)',
        }}>
          {fmtCount(value)}
        </span>
      </div>
    </div>
  )
}
