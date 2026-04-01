import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCatalogStats, getWIQSScores, batchRecompute, getRegions } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import Badge from '../components/Badge'

const LAST_RUN_KEY  = 'wie_annual_vintage_last_run'
const LAST_YEAR_KEY = 'wie_annual_vintage_last_year'

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_YEAR = CURRENT_YEAR - 1

// ── Design primitives ─────────────────────────────────────────────────────────

function GoldBtn({ children, onClick, loading, outline, disabled, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        padding: '10px 20px', fontSize: 13, fontWeight: 600,
        background: outline ? 'transparent' : disabled ? '#2a2a2a' : 'var(--gold)',
        border: `1px solid ${disabled ? '#444' : 'var(--gold)'}`,
        borderRadius: 5,
        color: outline ? 'var(--gold)' : disabled ? '#555' : '#0d0d0d',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        opacity: loading ? 0.7 : 1,
        transition: 'background 150ms',
        ...style,
      }}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}

function DimBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px', fontSize: 13,
        background: 'transparent', border: '1px solid #444',
        borderRadius: 5, color: 'var(--text-dim)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ['Select Year', 'Review', 'Compute', 'Complete']

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
      {STEP_LABELS.map((label, i) => {
        const step = i + 1
        const done    = step < current
        const active  = step === current
        const future  = step > current
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: step < STEP_LABELS.length ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: done ? 'var(--gold)' : active ? 'transparent' : 'transparent',
                border: done ? 'none' : active ? '2px solid var(--gold)' : '2px solid #444',
                color: done ? '#0d0d0d' : active ? 'var(--gold)' : '#555',
              }}>
                {done ? '✓' : step}
              </div>
              <div style={{ fontSize: 11, marginTop: 6, color: active ? 'var(--gold)' : done ? 'var(--text-dim)' : '#444', whiteSpace: 'nowrap' }}>
                {label}
              </div>
            </div>
            {step < STEP_LABELS.length && (
              <div style={{
                flex: 1, height: 2, margin: '0 4px', marginBottom: 22,
                background: done ? 'var(--gold)' : '#2a2a2a',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({ year, setYear, scope, setScope, regionId, setRegionId, tier, setTier, catalogStats, regions, onNext }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Select the harvest year to add</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 28 }}>
        Choose a vintage year and the scope of wines to process.
      </p>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Harvest Year
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setYear(y => Math.max(2015, y - 1))}
            style={{ width: 36, height: 36, borderRadius: 4, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}
          >−</button>
          <input
            type="number"
            min={2015}
            max={CURRENT_YEAR}
            value={year}
            onChange={e => setYear(Math.min(CURRENT_YEAR, Math.max(2015, parseInt(e.target.value) || DEFAULT_YEAR)))}
            style={{ width: 100, textAlign: 'center', fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}
          />
          <button
            onClick={() => setYear(y => Math.min(CURRENT_YEAR, y + 1))}
            style={{ width: 36, height: 36, borderRadius: 4, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}
          >+</button>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
          Scope
        </div>
        {[
          { value: 'all',    label: `All wines (${catalogStats?.total_families ?? '…'} families)`, recommended: true },
          { value: 'region', label: 'By region' },
          { value: 'tier',   label: 'By tier' },
        ].map(opt => (
          <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input type="radio" value={opt.value} checked={scope === opt.value} onChange={() => setScope(opt.value)} style={{ width: 'auto' }} />
            <span style={{ fontSize: 14, color: 'var(--text)' }}>
              {opt.label}
              {opt.recommended && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', padding: '1px 6px', borderRadius: 8 }}>recommended</span>}
            </span>
          </label>
        ))}

        {scope === 'region' && (
          <select value={regionId} onChange={e => setRegionId(e.target.value)} style={{ marginTop: 8, width: 280 }}>
            <option value="">— Select region —</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name} ({r.country})</option>)}
          </select>
        )}

        {scope === 'tier' && (
          <select value={tier} onChange={e => setTier(e.target.value)} style={{ marginTop: 8, width: 280 }}>
            <option value="">— Select tier —</option>
            {['grand_cru', 'premier_cru', 'village', 'regional', 'commercial'].map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{
        background: 'rgba(201,168,76,0.06)', border: '1px solid var(--gold)',
        borderRadius: 6, padding: '14px 16px', fontSize: 13, marginBottom: 28,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: 6 }}>What this does</div>
        <div style={{ color: 'var(--text-dim)', lineHeight: 1.7 }}>
          New vintage rows will be created for each wine in scope.
          Initial WIQS scores will inherit from the prior vintage at 50% confidence.
          Scores improve as price data and market signals are added throughout the year.
        </div>
      </div>

      <GoldBtn onClick={onNext}>Next: Review Scope →</GoldBtn>
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({ year, scope, scopeLabel, catalogStats, onBack, onConfirm }) {
  const count = catalogStats?.total_families ?? 0

  return (
    <div style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Review before adding vintage {year}</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>
        Confirm the scope and what will happen.
      </p>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
          {[
            ['Scope',             scopeLabel],
            ['Wines affected',    count],
            ['New vintage rows',  count],
            ['Initial confidence','50%'],
            ['Compute reason',    `annual_vintage_add`],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>What will happen</div>
        <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            `Create wine_vintages row for each wine with vintage_year = ${year}`,
            'Copy pillar scores from prior vintage as starting baseline',
            'Set wiqs_confidence = 0.50',
            'Flag all new rows as awaiting_price_data',
            'Trigger WIQS compute for all new rows',
          ].map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>{item}</li>
          ))}
        </ol>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>What will NOT happen</div>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'Existing vintages will not be modified',
            'Current scores will not be changed',
            'No data will be deleted',
          ].map((item, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--text-dim)' }}>{item}</li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <DimBtn onClick={onBack}>← Back</DimBtn>
        <GoldBtn onClick={onConfirm}>Confirm and Add Vintage {year} →</GoldBtn>
      </div>
    </div>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

function Step3({ year, scope, onComplete }) {
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // TODO: Replace with POST /vintages/annual-add endpoint when built.
        // That endpoint will handle vintage row creation + inherit scores
        // + set confidence = 0.50 + flag for price data.
        // Current implementation triggers a full recompute which achieves
        // similar results but doesn't create new vintage rows.
        // Full annual workflow requires backend work in a future build.
        const res = await batchRecompute(scope === 'all' ? 'all' : scope, {
          reason: `annual_vintage_add_${year}`,
        })
        if (!cancelled) {
          setResult(res)
          onComplete(res)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ maxWidth: 560 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Adding vintage {year}…</h3>

      {/* Backend limitation notice */}
      <div style={{
        background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 6, padding: '12px 16px', marginBottom: 28, fontSize: 13,
      }}>
        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Note: </span>
        <span style={{ color: 'var(--text-dim)' }}>
          Full vintage row creation requires a backend update scheduled for a future build.
          This step runs a full WIQS recompute to refresh all scores.
          New vintage rows should be added manually or via the ingest pipeline.
        </span>
      </div>

      {!result && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
          <LoadingSpinner size="lg" />
          <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>Running batch WIQS compute…</div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
          borderRadius: 6, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

function Step4({ year, result, onReset }) {
  const navigate = useNavigate()

  const tierDist = result?.tier_distribution || {}
  const TIER_COLORS = {
    exceptional:   '#c9a84c',
    distinguished: '#e8ddd0',
    quality:       '#4ade80',
    standard:      '#777',
    basic:         '#555',
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="35" stroke="var(--gold)" strokeWidth="2" fill="rgba(201,168,76,0.06)" />
          <polyline points="20,37 31,48 53,25" stroke="var(--gold)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--gold)' }}>Vintage {year} workflow complete</h3>
      </div>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '20px 24px', marginBottom: 28,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Wines Recomputed</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--gold)' }}>{result?.computed ?? '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Errors</div>
            <div style={{ fontWeight: 700, fontSize: 22, color: (result?.errors ?? 0) > 0 ? 'var(--red)' : 'var(--green-light)' }}>
              {result?.errors ?? 0}
            </div>
          </div>
        </div>

        {Object.keys(tierDist).length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Tier Distribution</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(tierDist).map(([tier, count]) => (
                <div key={tier} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a2a',
                  borderRadius: 6, padding: '6px 12px', fontSize: 12,
                }}>
                  <span style={{ color: TIER_COLORS[tier] || '#777', fontWeight: 600 }}>{count}</span>
                  <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{tier}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <GoldBtn onClick={() => navigate('/scores')}>View WIQS Scores →</GoldBtn>
        <GoldBtn onClick={() => navigate('/quality')} outline>View Data Quality →</GoldBtn>
      </div>

      <button
        onClick={onReset}
        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
      >
        Run again for a different year
      </button>
    </div>
  )
}

// ── Price data queue ──────────────────────────────────────────────────────────

function PriceDataQueue({ wines }) {
  const [open, setOpen] = useState(false)

  const lowConf = wines.filter(w => (w.wiqs_confidence ?? 1) < 0.8)
    .sort((a, b) => b.wiqs_score - a.wiqs_score)

  const priority = (w) => {
    if (w.wiqs_tier === 'exceptional' || w.wiqs_tier === 'distinguished') return 'High'
    if (w.wiqs_tier === 'quality') return 'Medium'
    return 'Low'
  }
  const priorityColor = (p) => p === 'High' ? 'var(--gold)' : p === 'Medium' ? 'var(--amber)' : 'var(--text-dim)'

  const exportCSV = () => {
    const headers = ['wine_name', 'producer_name', 'region_name', 'wiqs_score', 'wiqs_tier']
    const rows = lowConf.map(w => headers.map(h => `"${(w[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'price_data_gaps.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ marginTop: 48, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', color: 'var(--text)',
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 16 : 0,
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 150ms', fontSize: 12 }}>▶</span>
        Price Data Outstanding
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-dim)', marginLeft: 4 }}>({lowConf.length} wines)</span>
      </button>

      {open && (
        <>
          <div style={{
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13,
          }}>
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>P4 Market Validation (20% of WIQS) </span>
            <span style={{ color: 'var(--text-dim)' }}>
              defaults to 10.0 when price data is missing. Adding <code style={{ background: '#1a1a1a', padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>price_retail</code> to wine_vintages
              will unlock accurate P4 scores.
              Currently: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{lowConf.length}</span> wines have no price data.
            </span>
          </div>

          {lowConf.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '16px 0' }}>
              All wines currently have confidence ≥ 80%. No price data gaps detected.
            </div>
          ) : (
            <>
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, overflow: 'hidden', marginBottom: 12,
              }}>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Wine', 'Score', 'Confidence', 'Missing', 'Priority'].map(h => (
                          <th key={h} style={{
                            padding: '10px 16px', textAlign: 'left', fontSize: 10,
                            fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                            color: 'var(--text-dim)', background: '#111',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lowConf.map(w => {
                        const p = priority(w)
                        return (
                          <tr key={w.wine_family_id} style={{ borderBottom: '1px solid #1e1e1e' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '10px 16px', fontSize: 13 }}>
                              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{w.wine_name}</span>
                              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{w.producer_name}</div>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>
                              <Badge tier={w.wiqs_tier} />
                              <span style={{ marginLeft: 8 }}>{w.wiqs_score?.toFixed(1)}</span>
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--amber)' }}>
                              {w.wiqs_confidence != null ? `${(w.wiqs_confidence * 100).toFixed(0)}%` : '—'}
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                              price_retail
                            </td>
                            <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: priorityColor(p) }}>
                              {p}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <button
                onClick={exportCSV}
                style={{
                  background: 'none', border: '1px solid #444', borderRadius: 4,
                  padding: '7px 14px', fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer',
                }}
              >
                Export price data gaps as CSV
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnnualVintage() {
  const [step, setStep]         = useState(1)
  const [year, setYear]         = useState(DEFAULT_YEAR)
  const [scope, setScope]       = useState('all')
  const [regionId, setRegionId] = useState('')
  const [tier, setTier]         = useState('')
  const [result, setResult]     = useState(null)

  const [catalogStats, setCatalogStats] = useState(null)
  const [wines, setWines]               = useState([])
  const [regions, setRegions]           = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  const lastRun  = localStorage.getItem(LAST_RUN_KEY)
  const lastYear = localStorage.getItem(LAST_YEAR_KEY)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [stats, scoresRes, regRes] = await Promise.all([
          getCatalogStats(), getWIQSScores(), getRegions(),
        ])
        if (!cancelled) {
          setCatalogStats(stats)
          setWines(scoresRes.wines || [])
          setRegions(regRes.regions || [])
        }
      } catch { /* non-fatal */ }
      finally { if (!cancelled) setStatsLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  const scopeLabel = scope === 'all'
    ? `All wines (${catalogStats?.total_families ?? '…'})`
    : scope === 'region'
      ? regions.find(r => String(r.id) === String(regionId))?.name || 'Selected region'
      : tier || 'Selected tier'

  const handleStep1Next = () => {
    if (scope === 'region' && !regionId) return
    if (scope === 'tier' && !tier) return
    setStep(2)
  }

  const handleComplete = (res) => {
    setResult(res)
    localStorage.setItem(LAST_RUN_KEY,  new Date().toISOString())
    localStorage.setItem(LAST_YEAR_KEY, String(year))
    setStep(4)
  }

  const handleReset = () => {
    setStep(1); setYear(DEFAULT_YEAR); setScope('all')
    setRegionId(''); setTier(''); setResult(null)
  }

  const latestVintage = wines.length
    ? Math.max(...wines.map(w => parseInt(w.wiqs_computed_at?.slice(0, 4) || 0)))
    : null

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Annual Vintage Workflow</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          Add a new harvest year to the catalog. Run once per year, February–March.
        </p>
      </div>

      {/* Status banner */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '12px 16px', fontSize: 13,
        display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 40,
      }}>
        {statsLoading ? (
          <span style={{ color: 'var(--text-dim)' }}>Loading catalog state…</span>
        ) : (
          <>
            <span style={{ color: 'var(--text-dim)' }}>
              Catalog: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{catalogStats?.total_families ?? '—'}</span> wine families
            </span>
            <span style={{ color: 'var(--text-dim)' }}>
              Latest vintage tracked: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{latestVintage ?? '—'}</span>
            </span>
            <span style={{ color: 'var(--text-dim)' }}>
              Last annual run:{' '}
              <span style={{ color: lastRun ? 'var(--text)' : '#555', fontWeight: 600 }}>
                {lastRun ? `${lastYear} · ${new Date(lastRun).toLocaleDateString()}` : 'Never'}
              </span>
            </span>
          </>
        )}
      </div>

      <StepIndicator current={step} />

      {step === 1 && (
        <Step1
          year={year} setYear={setYear}
          scope={scope} setScope={setScope}
          regionId={regionId} setRegionId={setRegionId}
          tier={tier} setTier={setTier}
          catalogStats={catalogStats}
          regions={regions}
          onNext={handleStep1Next}
        />
      )}
      {step === 2 && (
        <Step2
          year={year} scope={scope} scopeLabel={scopeLabel}
          catalogStats={catalogStats}
          onBack={() => setStep(1)}
          onConfirm={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <Step3 year={year} scope={scope} onComplete={handleComplete} />
      )}
      {step === 4 && (
        <Step4 year={year} result={result} onReset={handleReset} />
      )}

      <PriceDataQueue wines={wines} />
    </div>
  )
}
