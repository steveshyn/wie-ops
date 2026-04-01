import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { getHealth, getCatalogStats, getQualityIssues } from '../api/client'
import StatCard      from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { TIER_COLORS, scoreToColor } from '../utils/tierColors'
import { fmtScore, fmtPct, fmtCount } from '../utils/formatters'

const TIER_ORDER = ['exceptional', 'distinguished', 'quality', 'standard', 'basic']

export default function SystemHealth() {
  const navigate = useNavigate()
  const [health,     setHealth]     = useState(null)
  const [stats,      setStats]      = useState(null)
  const [issues,     setIssues]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [apiMs,      setApiMs]      = useState(null)
  const [apiOnline,  setApiOnline]  = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const t0 = Date.now()
    try {
      const [h, s, q] = await Promise.all([
        getHealth(),
        getCatalogStats(),
        getQualityIssues(),
      ])
      setApiMs(Date.now() - t0)
      setApiOnline(true)
      setHealth(h)
      setStats(s)
      setIssues(q)
    } catch (err) {
      setApiOnline(false)
      setError(err.message)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 60000)
    return () => clearInterval(id)
  }, [fetchAll])

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
          pct:   ((stats.tier_distribution[t] || 0) / stats.wiqs_scored_count * 100).toFixed(1),
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

        <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'right' }}>
          {apiMs != null && <span>Response: {apiMs}ms · </span>}
          Last checked: {refreshStr}
        </div>
      </div>

      {/* Loading overlay */}
      {loading && !stats && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-dim)', padding: '16px 0' }}>
          <LoadingSpinner size="sm" />
          Loading catalog stats…
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
            />
            <StatCard
              title="Vintages"
              value={fmtCount(stats.total_vintages)}
            />
            <StatCard
              title="Vectors"
              value={fmtCount(stats.total_vectors)}
              subtitle={`${((stats.total_vectors / stats.total_vintages) * 100).toFixed(0)}% of vintages`}
            />
            <StatCard
              title="WIQS Scored"
              value={fmtCount(stats.wiqs_scored_count)}
              subtitle={`${fmtCount(stats.wiqs_unscored_count)} unscored`}
            />
            <StatCard
              title="Avg WIQS Score"
              value={fmtScore(stats.avg_wiqs_score)}
              accent={scoreToColor(stats.avg_wiqs_score).text}
            />
            <StatCard
              title="Avg Confidence"
              value={fmtPct(stats.avg_wiqs_confidence)}
              accent={confAccent()}
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
                WIQS Tier Distribution
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
                Data Quality Summary
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <QualityRow
                  label="P1 Misses"
                  value={stats.p1_miss_count}
                  warn={stats.p1_miss_count > 0}
                  warnLevel="amber"
                />
                <QualityRow
                  label="Low Confidence"
                  value={stats.low_confidence_count}
                  warn={stats.low_confidence_count > 0}
                  warnLevel="amber"
                />
                <QualityRow
                  label="Tier Anomalies"
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
