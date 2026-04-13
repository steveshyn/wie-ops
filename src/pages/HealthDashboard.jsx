import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import { getAdminHealth, getDataHealthExtended } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import StatCard from '../components/StatCard'
import HelpTip from '../components/HelpTip'

const TIER_COLORS = {
  exceptional:   '#c9a84c',
  distinguished: '#4a9e8e',
  quality:       '#16a34a',
  standard:      '#666',
  basic:         '#7f1d1d',
}

const TIER_ORDER = ['exceptional', 'distinguished', 'quality', 'standard', 'basic']

const OPERATOR_STYLES = {
  steve:         { bg: 'rgba(201,168,76,0.15)', border: '#c9a84c', text: '#c9a84c' },
  claude_code:   { bg: 'rgba(56,189,248,0.12)', border: '#38bdf8', text: '#7dd3fc' },
  pipeline_auto: { bg: 'rgba(120,120,120,0.15)', border: '#666',    text: '#9e8e7e' },
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const Card = ({ title, children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '20px 24px',
    ...style,
  }}>
    {title && (
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
      }}>{title}</div>
    )}
    {children}
  </div>
)

function OperatorChip({ operator, count }) {
  const s = OPERATOR_STYLES[operator] || OPERATOR_STYLES.pipeline_auto
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px',
      borderRadius: 12, background: s.bg,
      border: `1px solid ${s.border}`, color: s.text,
      display: 'inline-block', marginRight: 8,
    }}>
      {operator} <span style={{ marginLeft: 4, opacity: 0.8 }}>{count}</span>
    </span>
  )
}

export default function HealthDashboard() {
  const navigate = useNavigate()
  const [health, setHealth] = useState(null)
  const [extHealth, setExtHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchHealth = useCallback(async () => {
    setError(null)
    try {
      const [h, ext] = await Promise.all([
        getAdminHealth(),
        getDataHealthExtended().catch(() => null),
      ])
      setHealth(h)
      setExtHealth(ext)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const id = setInterval(fetchHealth, 60000)
    return () => clearInterval(id)
  }, [fetchHealth])

  if (loading && !health) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
        <LoadingSpinner size="md" /> Loading data health…
      </div>
    )
  }

  if (error && !health) {
    return (
      <div style={{
        background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
        borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
      }}>{error}</div>
    )
  }

  if (!health) return null

  // Tier chart data
  const tierData = TIER_ORDER.map(t => ({
    tier:  t,
    count: (health.scoring_distribution ?? {})[t]?.count || 0,
    pct:   (health.scoring_distribution ?? {})[t]?.pct   || 0,
  }))

  const refreshStr = lastRefresh
    ? lastRefresh.toLocaleTimeString('en-US', { hour12: false })
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Last refresh indicator */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8,
        fontSize: 11, color: 'var(--text-dim)',
      }}>
        Auto-refresh every 60s · Last update: {refreshStr}
      </div>

      {/* SECTION 1 — Catalog Overview stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
      }}>
        <StatCard title="Wine Families"     value={health.catalog?.total_families?.toLocaleString() ?? '—'} helpTerm="wine_families" />
        <StatCard title="Scored Vintages"   value={health.catalog?.scored_vintages?.toLocaleString() ?? '—'}
          subtitle={`${health.catalog?.unscored_vintages ?? '—'} unscored`} helpTerm="wiqs_scored" />
        <StatCard title="LWIN Coverage"     value={`${(health.coverage ?? {}).lwin_pct ?? '—'}%`}
          subtitle={`${(health.coverage ?? {}).lwin_matched ?? '—'} matched`} helpTerm="lwin" />
        <StatCard title="SSURGO Producers"  value={(health.coverage ?? {}).ssurgo_producers ?? '—'} helpTerm="ssurgo_producers" />
        <P4StatusCard active={(health.coverage ?? {}).p4_active} flatValue={(health.coverage ?? {}).p4_flat_value} />
        <StatCard title="Retired Families"  value={health.catalog?.retired_families ?? '—'} />
      </div>

      {/* SECTION 2 — Scoring Distribution */}
      <Card title={<>Scoring Distribution<HelpTip term="scoring_distribution" /></>}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={tierData} layout="vertical" margin={{ left: 0, right: 60, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="tier"
              width={110}
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={t => t.charAt(0).toUpperCase() + t.slice(1)}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a', border: '1px solid #333',
                borderRadius: 4, fontSize: 12, color: 'var(--text)',
              }}
              formatter={(v, _n, p) => [`${v} wines · ${p.payload.pct}%`, 'Count']}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar
              dataKey="count"
              radius={[0, 3, 3, 0]}
              onClick={(d) => navigate(`/catalog?tier=${d.tier}`)}
              cursor="pointer"
            >
              {tierData.map((d) => (
                <Cell key={d.tier} fill={TIER_COLORS[d.tier]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: 4 }}>
          Click any bar to view that tier in the catalog
        </div>
      </Card>

      {/* SECTION 3 — Coverage Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
      }}>
        <CoverageCard
          title={<>LWIN Coverage<HelpTip term="lwin" /></>}
          big={`${(health.coverage ?? {}).lwin_pct ?? '—'}%`}
          pct={(health.coverage ?? {}).lwin_pct}
          subtitle={`${(health.coverage ?? {}).lwin_matched ?? '—'} matched · ${(health.coverage ?? {}).lwin_unmatched ?? '—'} unmatched`}
          linkLabel="View Unmatched →"
          onLinkClick={() => navigate('/catalog?lwin=missing')}
        />
        <CoverageCard
          title={<>Vector Coverage<HelpTip term="vector_coverage" /></>}
          big={`${((health.catalog?.scored_vintages ?? 0) - ((health.coverage ?? {}).wines_missing_vectors ?? 0)).toLocaleString()}`}
          pct={(health.catalog?.scored_vintages ?? 0) > 0
            ? Math.round((1 - ((health.coverage ?? {}).wines_missing_vectors ?? 0) / (health.catalog?.scored_vintages ?? 1)) * 100)
            : 0}
          subtitle={`${(health.coverage ?? {}).wines_missing_vectors ?? '—'} missing 1+ dimensions`}
          linkLabel="View Missing →"
          onLinkClick={() => navigate('/catalog')}
        />
        <CoverageCard
          title="Override Activity"
          big={`${((health.coverage ?? {}).pillar_overrides_active ?? 0) + ((health.coverage ?? {}).prestige_overrides_active ?? 0)}`}
          pct={null}
          subtitle={`${(health.coverage ?? {}).pillar_overrides_active ?? 0} pillar · ${(health.coverage ?? {}).prestige_overrides_active ?? 0} prestige`}
          linkLabel="View Overrides →"
          onLinkClick={() => navigate('/overrides')}
        />
      </div>

      {/* SECTION 4 — Recent Activity */}
      <Card title="Recent Activity">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8,
            }}>
              Audit Writes (Last 24h)
            </div>
            <div style={{
              fontSize: 28, fontWeight: 600, color: 'var(--gold)',
              fontFamily: 'var(--font-serif)', marginBottom: 10,
            }}>
              {health.recent_activity?.audit_rows_24h ?? '—'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(health.recent_activity?.operator_breakdown ?? {}).map(([op, cnt]) => (
                <OperatorChip key={op} operator={op} count={cnt} />
              ))}
              {Object.keys(health.recent_activity?.operator_breakdown ?? {}).length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  No activity in last 24 hours
                </span>
              )}
            </div>
          </div>

          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6,
            }}>
              Last Recompute
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>
              {timeAgo(health.recent_activity?.last_recompute_at)}
              {health.recent_activity?.last_recompute_at && (
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>
                  ({new Date(health.recent_activity.last_recompute_at).toLocaleString('en-US', { hour12: false })})
                </span>
              )}
            </div>
          </div>

          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6,
            }}>
              Score Anomalies (Last 30d, Δ &gt; 5)<HelpTip term="score_anomalies" />
            </div>
            {(health.anomalies?.score_changed_gt5_last30d ?? []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                No anomalies
              </div>
            ) : (
              <div>
                {(health.anomalies?.score_changed_gt5_last30d ?? []).map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text)' }}>
                    {a.wine_name} · {a.old_score} → {a.new_score} (Δ {a.delta})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* SECTION 5 — Tasting Model Health (extended data health) */}
      {extHealth && (
        <>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text)',
            paddingTop: 12, borderTop: '1px solid var(--border)',
            marginTop: 4,
          }}>
            Tasting Model Health
          </div>

          {/* Vector Enrichment Needed */}
          {(extHealth.vector_enrichment_needed || []).length > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid var(--amber)',
              borderRadius: 8, padding: '16px 20px',
            }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 12,
              }}>
                {extHealth.vector_enrichment_needed.length} wines have scored vintages but no vector enrichment.
                These are invisible to the recommender and need enrichment to reflect true quality.
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(245,158,11,0.3)' }}>
                    {['Producer', 'Wine', 'Current WIQS', 'Flag'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '6px 8px', fontSize: 10,
                        fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--text-dim)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extHealth.vector_enrichment_needed.map((v, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
                      <td style={{ padding: '8px', color: 'var(--text)' }}>{v.producer}</td>
                      <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{v.wine_name}</td>
                      <td style={{ padding: '8px', color: 'var(--amber)', fontWeight: 600 }}>
                        {v.wiqs_score != null ? Number(v.wiqs_score).toFixed(1) : '—'}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: 'rgba(245,158,11,0.15)', color: 'var(--amber)',
                        }}>
                          {v.flag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Missing LWIN7 + No Archetype row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}>
            <StatCard
              title="Missing LWIN7"
              value={extHealth.missing_lwin7}
              subtitle="Run LWIN matching pipeline to improve coverage"
              accent="var(--amber)"
            />
            <Card title="Unclassified Archetypes">
              {(extHealth.no_archetype || []).length === 0 ? (
                <div style={{
                  fontSize: 12, color: 'var(--green-light)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 14 }}>&#10003;</span>
                  All rollup wines have archetype assignments
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Producer', 'Wine'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '6px 8px', fontSize: 10,
                          fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'var(--text-dim)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(extHealth.no_archetype || []).map((n, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', color: 'var(--text)' }}>{n.producer}</td>
                        <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{n.wine_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ── P4 status card ───────────────────────────────────────────────────────────

function P4StatusCard({ active, flatValue }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${active ? 'var(--green)' : '#f59e0b'}`,
      borderRadius: 8,
      padding: '16px 20px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6,
      }}>
        P4 Market Validation<HelpTip term="p4" />
      </div>
      <div style={{
        fontSize: 22, fontWeight: 600,
        color: active ? 'var(--green-light)' : '#f59e0b',
        fontFamily: 'var(--font-serif)',
      }}>
        {active ? 'ACTIVE' : 'INACTIVE'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
        {active ? 'Wine-Searcher' : `Flat ${flatValue}/20`}
      </div>
    </div>
  )
}

// ── Coverage card ────────────────────────────────────────────────────────────

function CoverageCard({ title, big, pct, subtitle, linkLabel, onLinkClick }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '20px 24px',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 10,
      }}>{title}</div>

      <div style={{
        fontSize: 32, fontWeight: 600, color: 'var(--gold)',
        fontFamily: 'var(--font-serif)', marginBottom: 10,
      }}>{big}</div>

      {pct != null && (
        <div style={{ height: 5, background: '#2a2a2a', borderRadius: 2, marginBottom: 10 }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%',
            background: 'var(--gold)', borderRadius: 2,
          }} />
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
        {subtitle}
      </div>

      <button
        onClick={onLinkClick}
        style={{
          background: 'transparent', border: 'none', color: 'var(--gold)',
          fontSize: 11, padding: 0, cursor: 'pointer', textAlign: 'left',
        }}
      >{linkLabel}</button>
    </div>
  )
}
