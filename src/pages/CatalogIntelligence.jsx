import { useState, useEffect, useCallback } from 'react'
import { getCatalogIntelligence } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

function fmt(v, decimals = 1) {
  if (v == null) return '\u2014'
  return Number(v).toFixed(decimals)
}

function coveragePctColor(pct) {
  if (pct >= 80) return 'var(--green)'
  if (pct >= 40) return 'var(--amber)'
  return 'var(--red)'
}

function pillarColor(key, val) {
  if (val == null) return 'var(--text-dim)'
  const v = Number(val)
  const thresholds = {
    p1: [20, 15], p2: [20, 15],
    p3: [12, 8],  p4: [16, 10], p5: [12, 8],
  }
  const [gold, mid] = thresholds[key] || [20, 15]
  if (v >= gold) return 'var(--gold)'
  if (v >= mid)  return 'var(--text)'
  return 'var(--text-dim)'
}

function StatChip({ label, value }) {
  return (
    <div style={{
      padding: '12px 20px', background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)', textAlign: 'center', flex: 1, minWidth: 130,
    }}>
      <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function ScoreDistribution({ distribution }) {
  const maxCount = Math.max(...distribution.map(d => d.count), 1)

  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)', flex: 1,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>
        Score Distribution
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {distribution.map(d => (
          <div key={d.band} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 60, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-dim)', textAlign: 'right' }}>
              {d.band}
            </div>
            <div style={{ flex: 1, height: 20, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${(d.count / maxCount) * 100}%`, height: '100%',
                background: 'var(--gold)', borderRadius: 3,
                minWidth: d.count > 0 ? 4 : 0,
              }} />
            </div>
            <div style={{ width: 70, fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', textAlign: 'right' }}>
              {d.count.toLocaleString()} wines
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EnrichmentCoverage({ coverage }) {
  const total = coverage.total_families || 1
  const signals = [
    { label: 'LWIN matched',    count: coverage.has_lwin,       pct: coverage.has_lwin_pct },
    { label: 'Real P1 score',   count: coverage.has_real_p1,    pct: coverage.has_real_p1_pct },
    { label: 'BLS enriched',    count: coverage.has_bls,        pct: coverage.has_bls_pct },
    { label: 'Real soil data',  count: coverage.has_real_soil,  pct: coverage.has_real_soil_pct },
    { label: 'Climate data',    count: coverage.has_climate,    pct: coverage.has_climate_pct },
    { label: 'Label image',     count: coverage.has_label,      pct: coverage.has_label_pct },
    { label: 'CT registered',   count: coverage.is_ct_registered, pct: coverage.is_ct_registered_pct },
  ]

  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)', flex: 1,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>
        Enrichment Coverage
      </h3>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Signal</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Count</th>
            <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {signals.map(s => (
            <tr key={s.label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 8px', color: 'var(--text)' }}>{s.label}</td>
              <td style={{ padding: '8px 8px', fontFamily: 'monospace', textAlign: 'right', color: 'var(--text)' }}>
                {(s.count || 0).toLocaleString()}
              </td>
              <td style={{ padding: '8px 8px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: coveragePctColor(s.pct || 0) }}>
                {fmt(s.pct)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PillarHeatmap({ countries }) {
  const pillars = ['p1', 'p2', 'p3', 'p4', 'p5']
  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
          Pillar Averages by Country
        </h3>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
          Top 15 countries by family count
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Country</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Families</th>
              {pillars.map(p => (
                <th key={p} style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>
                  {p.toUpperCase()}
                </th>
              ))}
              <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Avg WIQS</th>
            </tr>
          </thead>
          <tbody>
            {countries.map(c => (
              <tr key={c.country} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.country}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right', color: 'var(--text)' }}>
                  {c.families.toLocaleString()}
                </td>
                {pillars.map(p => {
                  const val = c[`avg_${p}`]
                  return (
                    <td key={p} style={{
                      padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right',
                      color: pillarColor(p, val), fontWeight: val != null && pillarColor(p, val) === 'var(--gold)' ? 700 : 400,
                    }}>
                      {fmt(val)}
                    </td>
                  )
                })}
                <td style={{
                  padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right',
                  fontWeight: 700, color: 'var(--gold)',
                }}>
                  {fmt(c.avg_wiqs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function CatalogIntelligence() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(() => {
    setLoading(true)
    getCatalogIntelligence()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <LoadingSpinner />
  if (error) return (
    <div style={{ padding: 24, color: 'var(--red)', background: 'rgba(220,38,38,0.1)', borderRadius: 8 }}>
      Failed to load catalog intelligence: {error}
    </div>
  )
  if (!data) return null

  const v = data.vintages
  const c = data.coverage
  const scoredPct = v.total > 0 ? ((v.scored / v.total) * 100).toFixed(1) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatChip label="Families" value={(c.total_families || 0).toLocaleString()} />
        <StatChip label="Vintages" value={(v.total || 0).toLocaleString()} />
        <StatChip label="Avg WIQS" value={fmt(v.avg_wiqs)} />
        <StatChip label="Max WIQS" value={fmt(v.max_wiqs)} />
        <StatChip label="Scored" value={`${scoredPct}%`} />
        <StatChip label="CT Registered" value={(c.is_ct_registered || 0).toLocaleString()} />
      </div>

      {/* Two-column: score distribution + enrichment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ScoreDistribution distribution={data.score_distribution} />
        <EnrichmentCoverage coverage={c} />
      </div>

      {/* Pillar heatmap */}
      <PillarHeatmap countries={data.pillar_by_country} />
    </div>
  )
}
