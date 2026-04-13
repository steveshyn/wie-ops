import { useState, useMemo, useRef, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useAPI } from '../hooks/useAPI'
import { getVintageHeatMap, getWIQSScores } from '../api/client'
import Badge from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import { scoreToColor } from '../utils/tierColors'
import { fmtScore } from '../utils/formatters'
import HelpTip from '../components/HelpTip'

// ── Color scale ───────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}
function lerp(a, b, t) { return Math.round(a + (b - a) * t) }
function lerpColor(hex1, hex2, t) {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  return `rgb(${lerp(r1, r2, t)},${lerp(g1, g2, t)},${lerp(b1, b2, t)})`
}

function heatColor(score) {
  if (score == null) return '#1a1a1a'
  if (score >= 85)   return '#c9a84c'                                    // gold
  if (score >= 70)   return lerpColor('#e8ddd0', '#c9a84c', (score - 70) / 15) // cream → gold
  if (score >= 55)   return lerpColor('#4ade80', '#e8ddd0', (score - 55) / 15) // green → cream
  if (score >= 40)   return lerpColor('#555555', '#4ade80', (score - 40) / 15) // gray → green
  return '#333333'
}

function textColorForBg(score) {
  if (score == null) return '#333'
  if (score >= 70) return 'rgba(0,0,0,0.75)'
  if (score >= 55) return 'rgba(0,0,0,0.65)'
  return 'rgba(255,255,255,0.5)'
}

// ── Cell tooltip ──────────────────────────────────────────────────────────────
function CellTooltip({ cell }) {
  if (!cell) return null
  const c = scoreToColor(cell.score)
  return (
    <div style={{
      background: '#1e1e1e', border: `1px solid ${c.border}`,
      borderRadius: 8, padding: '10px 14px', fontSize: 11,
      pointerEvents: 'none', zIndex: 300, minWidth: 160,
    }}>
      <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#e8ddd0', marginBottom: 4 }}>
        {cell.region}
      </div>
      <div style={{ color: '#666', marginBottom: 8 }}>{cell.year}</div>
      <div style={{ color: c.text, fontSize: 18, fontWeight: 800, marginBottom: 2 }}>
        {fmtScore(cell.score)}
      </div>
      <Badge tier={c === scoreToColor(85) ? 'exceptional'
        : c === scoreToColor(70) ? 'distinguished'
        : c === scoreToColor(55) ? 'quality'
        : c === scoreToColor(40) ? 'standard' : 'basic'} />
      <div style={{ marginTop: 8, color: '#555', fontSize: 10 }}>
        {cell.count} wine{cell.count !== 1 ? 's' : ''} · click for details
      </div>
    </div>
  )
}

// ── Recharts tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  const c = scoreToColor(v)
  return (
    <div style={{
      background: '#1e1e1e', border: '1px solid #333',
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
    }}>
      <div style={{ color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ color: c.text, fontWeight: 700 }}>{fmtScore(v)}</div>
    </div>
  )
}

const METRIC_LABELS = {
  avg_score: <>Avg WIQS Score<HelpTip term="wiqs_score" /></>,
  avg_p1:    <>P1 Terroir<HelpTip term="p1" /></>,
  avg_p5:    <>P5 Complexity<HelpTip term="p5" /></>,
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VintageHeatMap() {
  const [countryFilter, setCountryFilter] = useState('All')
  const [metric,        setMetric]        = useState('avg_score')
  const [minWines,      setMinWines]      = useState(2)
  const [hoveredCell,   setHoveredCell]   = useState(null)
  const [tooltipPos,    setTooltipPos]    = useState({ x: 0, y: 0 })
  const [selectedCell,  setSelectedCell]  = useState(null)
  const [drawerOpen,    setDrawerOpen]    = useState(false)

  const { data: heatmapRes, loading: hmLoading } = useAPI(getVintageHeatMap)
  const { data: scoresRes, loading: scoresLoading } = useAPI(getWIQSScores)

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setDrawerOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const rawData = heatmapRes?.data ?? []
  const allWines = scoresRes?.wines ?? []

  // ── Derived data ─────────────────────────────────────────────────────────
  const countries = useMemo(() => {
    const s = new Set(rawData.map(d => d.country).filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [rawData])

  const years = useMemo(() => {
    const s = new Set(rawData.map(d => d.vintage_year))
    return Array.from(s).sort()
  }, [rawData])

  // Build lookup: [region][year] = cell
  const lookup = useMemo(() => {
    const m = {}
    for (const d of rawData) {
      if (!m[d.region]) m[d.region] = {}
      m[d.region][d.vintage_year] = d
    }
    return m
  }, [rawData])

  // Filtered regions grouped by country
  const regionsByCountry = useMemo(() => {
    const groups = {}
    for (const d of rawData) {
      if (countryFilter !== 'All' && d.country !== countryFilter) continue
      if (!groups[d.country]) groups[d.country] = new Set()
      groups[d.country].add(d.region)
    }
    const result = {}
    for (const [country, regions] of Object.entries(groups)) {
      result[country] = Array.from(regions).sort()
    }
    return result
  }, [rawData, countryFilter])

  const allRegions = useMemo(() =>
    Object.values(regionsByCountry).flat()
  , [regionsByCountry])

  // Row summaries (avg across years)
  const rowSummary = useMemo(() => {
    const m = {}
    for (const region of allRegions) {
      const cells = Object.values(lookup[region] ?? {})
        .filter(c => c.wine_count >= minWines && c[metric] != null)
      m[region] = cells.length
        ? cells.reduce((s, c) => s + c[metric], 0) / cells.length
        : null
    }
    return m
  }, [allRegions, lookup, minWines, metric])

  // Column summaries (avg across regions)
  const colSummary = useMemo(() => {
    const m = {}
    for (const year of years) {
      const cells = allRegions
        .map(r => lookup[r]?.[year])
        .filter(c => c && c.wine_count >= minWines && c[metric] != null)
      m[year] = cells.length
        ? cells.reduce((s, c) => s + c[metric], 0) / cells.length
        : null
    }
    return m
  }, [years, allRegions, lookup, minWines, metric])

  // Best vintages chart data
  const vintageChartData = useMemo(() =>
    years.map(y => ({ year: String(y), score: colSummary[y] != null ? +colSummary[y].toFixed(2) : null }))
      .filter(d => d.score != null)
  , [years, colSummary])

  // Strongest regions chart data
  const regionChartData = useMemo(() => {
    return allRegions
      .map(r => ({ region: r, score: rowSummary[r] != null ? +rowSummary[r].toFixed(2) : null }))
      .filter(d => d.score != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
  }, [allRegions, rowSummary])

  // Drawer wines
  const drawerWines = useMemo(() => {
    if (!selectedCell) return []
    return allWines
      .filter(w => w.region_name === selectedCell.region)
      .sort((a, b) => (b.wiqs_score ?? 0) - (a.wiqs_score ?? 0))
  }, [selectedCell, allWines])

  const CELL = 48

  function handleCellClick(region, year, cell) {
    setSelectedCell({ region, year, ...cell })
    setDrawerOpen(true)
  }

  function handleCellMouseEnter(e, region, year, cell) {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredCell({ region, year, score: cell[metric], count: cell.wine_count })
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (hmLoading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <LoadingSpinner size="lg" />
        <div style={{ marginTop: 16, color: '#555', fontSize: 12 }}>Loading heat map data…</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700,
          color: '#fff', margin: '0 0 4px',
        }}>Vintage Heat Map</h1>
        <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
          Region × vintage year · {rawData.length} data points across {allRegions.length} regions
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12,
        alignItems: 'center', marginBottom: 20,
        padding: '12px 16px', background: '#111',
        border: '1px solid #222', borderRadius: 10,
      }}>
        {/* Country filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#666' }}>Country</span>
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
            style={selectStyle}>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Metric toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.entries(METRIC_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setMetric(key)}
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 5,
                cursor: 'pointer', border: '1px solid',
                background: metric === key ? 'rgba(201,168,76,0.15)' : '#1a1a1a',
                borderColor: metric === key ? '#c9a84c' : '#2a2a2a',
                color: metric === key ? '#c9a84c' : '#666',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Min wines slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#666' }}>Min wines: <b style={{ color: '#ccc' }}>{minWines}</b></span>
          <input type="range" min={1} max={10} value={minWines}
            onChange={e => setMinWines(+e.target.value)}
            style={{ accentColor: '#c9a84c', cursor: 'pointer' }} />
        </div>

        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#444' }}>
          {allRegions.length} regions · {years.length} years
        </span>
      </div>

      {/* ── Heat map ───────────────────────────────────────────────────────── */}
      <div style={{
        overflowX: 'auto', marginBottom: 28,
        border: '1px solid #222', borderRadius: 10,
        background: '#0e0e0e', padding: '16px',
      }}>
        {/* Year column headers */}
        <div style={{ display: 'flex', marginLeft: 148, marginBottom: 6 }}>
          {years.map(y => (
            <div key={y} style={{
              width: CELL, textAlign: 'center',
              fontSize: 10, color: '#555', flexShrink: 0,
            }}>
              {y}
            </div>
          ))}
          {/* Row summary header */}
          <div style={{ width: 52, textAlign: 'center', fontSize: 10, color: '#444', flexShrink: 0 }}>
            Avg
          </div>
        </div>

        {/* Rows */}
        {Object.entries(regionsByCountry).map(([country, regions]) => (
          <div key={country}>
            {/* Country group header */}
            <div style={{
              fontSize: 10, color: '#c9a84c', fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase',
              padding: '8px 0 4px 0', borderTop: '1px solid #1a1a1a',
              marginTop: 4,
            }}>
              {country}
            </div>

            {regions.map(region => {
              const summary = rowSummary[region]
              return (
                <div key={region} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                  {/* Row label */}
                  <div style={{
                    width: 140, textAlign: 'right', paddingRight: 8,
                    fontSize: 11, color: '#777', flexShrink: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: `${CELL}px`,
                  }} title={region}>
                    {region}
                  </div>

                  {/* Cells */}
                  {years.map(year => {
                    const cell = lookup[region]?.[year]
                    const val  = cell && cell.wine_count >= minWines ? cell[metric] : null
                    const bg   = heatColor(val)
                    const txt  = textColorForBg(val)

                    return (
                      <div key={year}
                        onMouseEnter={e => cell && cell.wine_count >= minWines
                          ? handleCellMouseEnter(e, region, year, cell)
                          : setHoveredCell(null)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => cell && cell.wine_count >= minWines && handleCellClick(region, year, cell)}
                        style={{
                          width: CELL, height: CELL, flexShrink: 0,
                          background: bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: txt,
                          cursor: val != null ? 'pointer' : 'default',
                          border: '1px solid rgba(0,0,0,0.2)',
                          transition: 'outline 0.1s',
                          outline: hoveredCell?.region === region && hoveredCell?.year === year
                            ? '2px solid rgba(255,255,255,0.6)' : 'none',
                          outlineOffset: -1,
                        }}>
                        {val != null ? val.toFixed(0) : ''}
                      </div>
                    )
                  })}

                  {/* Row summary bar */}
                  <div style={{
                    width: 52, paddingLeft: 6, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {summary != null && (
                      <>
                        <div style={{
                          height: 6, flex: 1,
                          background: '#1e1e1e', borderRadius: 3, overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', width: `${Math.min(100, summary)}%`,
                            background: heatColor(summary), borderRadius: 3,
                          }} />
                        </div>
                        <span style={{ fontSize: 9, color: '#555', width: 22, textAlign: 'right' }}>
                          {summary.toFixed(0)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Column summaries */}
        <div style={{ display: 'flex', marginLeft: 148, marginTop: 8, borderTop: '1px solid #1a1a1a', paddingTop: 6 }}>
          {years.map(y => {
            const s = colSummary[y]
            return (
              <div key={y} style={{ width: CELL, flexShrink: 0, textAlign: 'center' }}>
                {s != null && (
                  <>
                    <div style={{
                      height: 4, margin: '0 2px 3px',
                      background: heatColor(s), borderRadius: 2,
                    }} />
                    <div style={{ fontSize: 9, color: '#555' }}>{s.toFixed(0)}</div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating tooltip */}
      {hoveredCell && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: 'translate(-50%, -100%)',
          zIndex: 500, pointerEvents: 'none',
        }}>
          <CellTooltip cell={hoveredCell} />
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 28, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, color: '#555' }}>Score scale:</span>
        <div style={{ display: 'flex', height: 12, width: 200, borderRadius: 3, overflow: 'hidden' }}>
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i} style={{ flex: 1, background: heatColor(i) }} />
          ))}
        </div>
        {[
          { score: 0,  label: '0 Basic' },
          { score: 40, label: '40 Standard' },
          { score: 55, label: '55 Quality' },
          { score: 70, label: '70 Distinguished' },
          { score: 85, label: '85 Exceptional' },
        ].map(({ score, label }) => (
          <span key={score} style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 10,
            background: heatColor(score), color: textColorForBg(score),
          }}>
            {label}
          </span>
        ))}
      </div>

      {/* ── Analysis panels ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>

        {/* Best Vintages */}
        <div style={{
          flex: '1 1 340px', background: '#111',
          border: '1px solid #222', borderRadius: 12, padding: '18px 20px',
        }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Best Vintages Overall
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vintageChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#555' }} />
              <YAxis domain={[40, 80]} tick={{ fontSize: 9, fill: '#555' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {vintageChartData.map((d, i) => (
                  <Cell key={i} fill={heatColor(d.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Strongest Regions */}
        <div style={{
          flex: '1 1 340px', background: '#111',
          border: '1px solid #222', borderRadius: 12, padding: '18px 20px',
        }}>
          <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Strongest Regions
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, regionChartData.length * 22)}>
            <BarChart data={regionChartData} layout="vertical"
              margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
              <XAxis type="number" domain={[40, 90]} tick={{ fontSize: 9, fill: '#555' }} />
              <YAxis type="category" dataKey="region" tick={{ fontSize: 10, fill: '#777' }} width={110} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="score" radius={[0, 3, 3, 0]}>
                {regionChartData.map((d, i) => (
                  <Cell key={i} fill={heatColor(d.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      {drawerOpen && selectedCell && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'flex-end',
        }}
          onClick={e => e.target === e.currentTarget && setDrawerOpen(false)}
        >
          <div style={{
            width: 420, background: '#141414',
            borderLeft: '1px solid #2a2a2a',
            padding: 24, overflowY: 'auto',
            animation: 'slideIn 0.2s ease',
          }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h2 style={{
                  fontFamily: 'Georgia, serif', fontStyle: 'italic',
                  fontSize: 17, color: '#e8ddd0', margin: '0 0 4px',
                }}>
                  {selectedCell.region}
                </h2>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {selectedCell.vintage_year} · {selectedCell.wine_count ?? drawerWines.length} wines
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'none', border: 'none', color: '#555',
                  fontSize: 20, cursor: 'pointer', lineHeight: 1,
                }}>
                ×
              </button>
            </div>

            {/* Cell score summary */}
            <div style={{
              display: 'flex', gap: 16, marginBottom: 20,
              padding: '12px 16px', background: '#1a1a1a',
              border: '1px solid #222', borderRadius: 8,
            }}>
              <div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Avg Score<HelpTip term="wiqs_score" /></div>
                <div style={{ fontSize: 24, fontWeight: 800, color: heatColor(selectedCell.avg_score) }}>
                  {selectedCell.avg_score?.toFixed(1)}
                </div>
              </div>
              {selectedCell.avg_p1 != null && (
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>P1 Terroir<HelpTip term="p1" /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#c9a84c' }}>
                    {selectedCell.avg_p1?.toFixed(1)}
                  </div>
                </div>
              )}
              {selectedCell.avg_p5 != null && (
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>P5 Complexity<HelpTip term="p5" /></div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#c9a84c' }}>
                    {selectedCell.avg_p5?.toFixed(1)}
                  </div>
                </div>
              )}
            </div>

            {/* Wines in this region */}
            <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Wines in {selectedCell.region}
            </div>
            {scoresLoading ? (
              <div style={{ color: '#555', fontSize: 12, padding: '20px 0', textAlign: 'center' }}><LoadingSpinner size="sm" /> Loading wines…</div>
            ) : drawerWines.length === 0 ? (
              <div style={{ color: '#555', fontSize: 12, padding: '20px 0' }}>No scored wines found for this vintage.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {drawerWines.map(w => {
                  const c = scoreToColor(w.wiqs_score)
                  return (
                    <div key={w.wine_family_id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 7,
                      background: '#1a1a1a', border: '1px solid #222',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                        background: heatColor(w.wiqs_score),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: textColorForBg(w.wiqs_score),
                      }}>
                        {w.wiqs_score?.toFixed(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'Georgia, serif', fontStyle: 'italic',
                          fontSize: 12, color: '#e8ddd0',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {w.wine_name}
                        </div>
                        <div style={{ fontSize: 10, color: '#555' }}>{w.producer_name}</div>
                      </div>
                      <Badge tier={w.wiqs_tier} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const selectStyle = {
  background: '#1a1a1a', border: '1px solid #2a2a2a',
  color: '#888', borderRadius: 6, padding: '5px 10px',
  fontSize: 11, cursor: 'pointer',
}
