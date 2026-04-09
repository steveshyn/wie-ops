import { useState, useEffect, useCallback } from 'react'
import { getLwinCoverage } from '../api/client'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { fmtCount, fmtDate } from '../utils/formatters'

const Card = ({ title, children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '20px 24px', ...style,
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

function CoverageGauge({ pct }) {
  const size = 140
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const gaugeColor = pct >= 80 ? 'var(--green-light)' : pct >= 50 ? 'var(--gold)' : 'var(--amber)'

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#2a2a2a" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={gaugeColor} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 600ms ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: gaugeColor, lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>COVERAGE</div>
      </div>
    </div>
  )
}

export default function LwinCoverage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setError(null)
    try {
      const d = await getLwinCoverage()
      setData(d)
    } catch (err) {
      setError(err.message || 'Failed to load LWIN coverage')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading && !data) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
        <LoadingSpinner size="md" /> Loading LWIN coverage...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{
        background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
        borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
      }}>{error}</div>
    )
  }

  if (!data) return null

  const sm = data.summary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ROW 1 -- Gauge + Summary cards */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 200 }}>
          <CoverageGauge pct={sm.coverage_pct} />
        </Card>
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 16,
        }}>
          <StatCard title="Matched" value={fmtCount(sm.lwin_matched)} accent="var(--green-light)" />
          <StatCard title="Unmatched" value={fmtCount(sm.lwin_unmatched)} accent="var(--amber)" />
          <StatCard title="Collision Held" value={fmtCount(sm.collision_held)} accent="var(--text-dim)" />
          <StatCard title="Total Families" value={fmtCount(sm.total_active_families)} />
        </div>
      </div>

      {/* ROW 2 -- Coverage by Region */}
      <Card title="Coverage by Region">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Region', 'Total Wines', 'Matched', 'Coverage %'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px', fontSize: 10,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.matched_by_region || []).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px', color: 'var(--text)', fontFamily: 'var(--font-serif)' }}>
                    {r.region}
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-dim)' }}>{r.total}</td>
                  <td style={{ padding: '10px', color: 'var(--text-dim)' }}>{r.matched}</td>
                  <td style={{ padding: '10px', width: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#2a2a2a', borderRadius: 2 }}>
                        <div style={{
                          width: `${Math.max(0, Math.min(100, r.coverage_pct))}%`,
                          height: '100%', borderRadius: 2,
                          background: r.coverage_pct >= 80 ? 'var(--green-light)'
                                   : r.coverage_pct >= 50 ? 'var(--gold)' : 'var(--amber)',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 40, textAlign: 'right' }}>
                        {r.coverage_pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ROW 3 -- Recently Matched + Unmatched Sample */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT: Recently Matched */}
        <Card title="Recently Matched">
          {(data.recently_matched || []).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              No recent matches
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Producer', 'Wine', 'LWIN7', 'Matched'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 8px', fontSize: 10,
                      fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                      color: 'var(--text-dim)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.recently_matched || []).map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                        <span style={{ color: 'var(--green-light)', fontSize: 13 }}>&#10003;</span>
                        {m.producer}
                      </span>
                    </td>
                    <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{m.wine_name}</td>
                    <td style={{ padding: '8px', color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: 11 }}>{m.lwin7}</td>
                    <td style={{ padding: '8px', color: 'var(--text-dim)', fontSize: 11 }}>{fmtDate(m.lwin_matched_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* RIGHT: Unmatched Sample */}
        <Card title="Unmatched Sample">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Producer', 'Wine', 'Region'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '6px 8px', fontSize: 10,
                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.unmatched_sample || []).map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                      <span style={{ color: 'var(--amber)', fontSize: 12 }}>&#9888;</span>
                      {u.producer}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{u.wine_name}</td>
                  <td style={{ padding: '8px', color: 'var(--text-dim)' }}>{u.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, fontStyle: 'italic' }}>
            Sample of unmatched families. Full list available via LWIN matching pipeline.
          </div>
        </Card>
      </div>
    </div>
  )
}
