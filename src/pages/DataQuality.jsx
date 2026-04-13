import { useState, useEffect, useCallback } from 'react'
import {
  getQualityIssues, getRegions,
  updateWineRegion, updateWineTier, recomputeWine,
  createSubregion,
} from '../api/client'
import Badge          from '../components/Badge'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState     from '../components/EmptyState'
import { scoreToColor, TIER_COLORS } from '../utils/tierColors'
import { fmtScore }   from '../utils/formatters'

const VALID_TIERS = ['exceptional', 'distinguished', 'quality', 'standard', 'basic']
const TIER_LABELS = {
  exceptional: 'Exceptional', distinguished: 'Distinguished',
  quality: 'Quality', standard: 'Standard', basic: 'Basic',
}

export default function DataQuality() {
  const [issues,  setIssues]  = useState(null)
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('p1')
  const [sortDir, setSortDir] = useState('desc')
  const [panel,   setPanel]   = useState(null) // { wine, mode }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [iss, reg] = await Promise.all([getQualityIssues(), getRegions()])
      setIssues(iss)
      setRegions(reg.regions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const sorted = (arr) => {
    if (!arr) return []
    return [...arr].sort((a, b) =>
      sortDir === 'desc' ? b.wiqs_score - a.wiqs_score : a.wiqs_score - b.wiqs_score
    )
  }

  const issueForMode = (issue) => ({
    wine: issue,
    mode: tab === 'anomaly' ? 'tier' : tab === 'confidence' ? 'detail' : 'region',
  })

  const tabs = [
    { key: 'p1',         label: 'P1 Misses',       count: issues?.p1_misses?.length ?? 0 },
    { key: 'confidence', label: 'Low Confidence',   count: issues?.low_confidence?.length ?? 0 },
    { key: 'anomaly',    label: 'Tier Anomalies',   count: issues?.tier_anomalies?.length ?? 0 },
  ]

  const currentList = () => {
    if (!issues) return []
    if (tab === 'p1')         return sorted(issues.p1_misses)
    if (tab === 'confidence') return sorted(issues.low_confidence)
    return sorted(issues.tier_anomalies)
  }

  if (loading) return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-dim)', padding: 16 }}>
      <LoadingSpinner size="sm" /> Loading quality issues…
    </div>
  )

  if (error) return (
    <div style={{
      background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
      borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
    }}>{error}</div>
  )

  return (
    <div style={{ position: 'relative' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none',
              padding: '12px 20px',
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--gold)' : 'var(--text-dim)',
              borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            {t.label}
            <span style={{
              marginLeft: 8, fontSize: 11,
              color: tab === t.key ? 'var(--gold)' : '#555',
              background: tab === t.key ? 'rgba(201,168,76,0.12)' : '#1a1a1a',
              borderRadius: 10, padding: '1px 6px',
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {tab === 'p1' && <P1Headers sortDir={sortDir} setSortDir={setSortDir} />}
                {tab === 'confidence' && <ConfHeaders sortDir={sortDir} setSortDir={setSortDir} />}
                {tab === 'anomaly' && <AnomalyHeaders sortDir={sortDir} setSortDir={setSortDir} />}
              </tr>
            </thead>
            <tbody>
              {currentList().length === 0 ? (
                <tr><td colSpan="99">
                  <EmptyState icon="✓" message="No issues in this category" />
                </td></tr>
              ) : currentList().map(wine => (
                <tr
                  key={wine.wine_family_id}
                  style={{ borderBottom: '1px solid #1e1e1e', transition: 'background 100ms' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {tab === 'p1' && <P1Row wine={wine} onFix={() => setPanel(issueForMode(wine))} onAddSubregion={() => setPanel({ wine, mode: 'add_subregion' })} />}
                  {tab === 'confidence' && <ConfRow wine={wine} onReview={() => setPanel(issueForMode(wine))} />}
                  {tab === 'anomaly' && <AnomalyRow wine={wine} onFix={() => setPanel(issueForMode(wine))} />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Panel */}
      {panel && (
        <EditPanel
          wine={panel.wine}
          mode={panel.mode}
          regions={regions}
          onClose={() => setPanel(null)}
          onFixed={fetchAll}
        />
      )}
    </div>
  )
}

// ── Table header components ──────────────────────────────────────────────────

const TH = ({ children, onClick, style = {} }) => (
  <th onClick={onClick} style={{
    padding: '10px 16px', textAlign: 'left', fontSize: 10,
    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-dim)', cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none', background: '#111', ...style,
  }}>
    {children}
  </th>
)

function P1Headers({ sortDir, setSortDir }) {
  return <>
    <TH>Wine</TH><TH>Producer</TH><TH>Country</TH><TH>State</TH><TH>Region</TH><TH>Tier</TH>
    <TH onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
      Score {sortDir === 'desc' ? '↓' : '↑'}
    </TH>
    <TH>P1</TH><TH>Reason</TH><TH>Action</TH>
  </>
}
function ConfHeaders({ sortDir, setSortDir }) {
  return <>
    <TH>Wine</TH><TH>Producer</TH><TH>Region</TH>
    <TH onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
      Score {sortDir === 'desc' ? '↓' : '↑'}
    </TH>
    <TH>Confidence</TH><TH>Action</TH>
  </>
}
function AnomalyHeaders({ sortDir, setSortDir }) {
  return <>
    <TH>Wine</TH><TH>Producer</TH><TH>Current Tier</TH>
    <TH onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
      Score {sortDir === 'desc' ? '↓' : '↑'}
    </TH>
    <TH>Issue</TH><TH>Action</TH>
  </>
}

// ── Table row components ─────────────────────────────────────────────────────

const TD = ({ children, style = {} }) => (
  <td style={{ padding: '11px 16px', fontSize: 13, ...style }}>{children}</td>
)

const ScoreCell = ({ score }) => {
  const c = scoreToColor(score)
  return <TD><span style={{ color: c.text, fontWeight: 600 }}>{fmtScore(score)}</span></TD>
}

const ActionBtnInline = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 10px', fontSize: 11, fontWeight: 500,
      background: 'transparent', border: '1px solid var(--gold)',
      borderRadius: 3, color: 'var(--gold)', cursor: 'pointer',
      transition: 'background 120ms', whiteSpace: 'nowrap',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.08)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  >
    {label}
  </button>
)

const ActionBtn = ({ label, onClick }) => (
  <TD><ActionBtnInline label={label} onClick={onClick} /></TD>
)

function P1Row({ wine, onFix, onAddSubregion }) {
  const isP1Miss = wine.p1_site_terroir === 10.0 || wine.p1_site_terroir === '10.0'
  const reason = wine.p1_miss_reason ?? ''
  const isMissingLookup = reason.includes('not in subregion lookup')
  return <>
    <TD><span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{wine.wine_name}</span></TD>
    <TD style={{ color: 'var(--text-dim)' }}>{wine.producer_name}</TD>
    <TD style={{ color: 'var(--text-dim)' }}>{wine.country || '—'}</TD>
    <TD style={{ color: 'var(--text-dim)' }}>{wine.state || '—'}</TD>
    <TD style={{ color: 'var(--text-dim)' }}>{wine.region_name}</TD>
    <TD><Badge tier={wine.production_tier} /></TD>
    <ScoreCell score={wine.wiqs_score} />
    <TD>
      <span style={{ color: isP1Miss ? 'var(--red)' : 'var(--text-dim)', fontWeight: isP1Miss ? 600 : 400 }}>
        {fmtScore(wine.p1_site_terroir)}
      </span>
    </TD>
    <TD style={{ color: 'var(--amber)', fontSize: 11, maxWidth: 200 }}>{reason}</TD>
    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <ActionBtnInline label="Fix Region" onClick={onFix} />
        {isMissingLookup && (
          <ActionBtnInline label="Add Subregion" onClick={onAddSubregion} />
        )}
      </div>
    </td>
  </>
}

function ConfRow({ wine, onReview }) {
  const c = wine.wiqs_confidence
  const confColor = c > 0.8 ? 'var(--green-light)' : c >= 0.6 ? 'var(--amber)' : 'var(--red)'
  return <>
    <TD><span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{wine.wine_name}</span></TD>
    <TD style={{ color: 'var(--text-dim)' }}>{wine.producer_name}</TD>
    <TD style={{ color: 'var(--text-dim)' }}>{wine.region_name}</TD>
    <ScoreCell score={wine.wiqs_score} />
    <TD><span style={{ color: confColor, fontWeight: 600 }}>{c != null ? `${(c * 100).toFixed(0)}%` : '—'}</span></TD>
    <ActionBtn label="Review" onClick={onReview} />
  </>
}

function AnomalyRow({ wine, onFix }) {
  const issue = wine.production_tier === 'grand_cru'
    ? 'Grand cru scoring below Distinguished'
    : 'Commercial scoring above standard'
  return <>
    <TD><span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{wine.wine_name}</span></TD>
    <TD style={{ color: 'var(--text-dim)' }}>{wine.producer_name}</TD>
    <TD><Badge tier={wine.production_tier} /></TD>
    <ScoreCell score={wine.wiqs_score} />
    <TD style={{ color: 'var(--amber)', fontSize: 12 }}>{issue}</TD>
    <ActionBtn label="Fix Tier" onClick={onFix} />
  </>
}

// ── Edit Panel ────────────────────────────────────────────────────────────────

function EditPanel({ wine, mode, regions, onClose, onFixed }) {
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedTier,   setSelectedTier]   = useState(wine.production_tier || '')
  const [reason,         setReason]         = useState('')
  const [saving,         setSaving]         = useState(false)
  const [saveError,      setSaveError]      = useState('')
  const [updated,        setUpdated]        = useState(false)
  const [recomputing,    setRecomputing]    = useState(false)
  const [newScore,       setNewScore]       = useState(null)

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Add subregion mode
  const [qualityScore, setQualityScore] = useState('')
  const [subNotes,     setSubNotes]     = useState('')

  // Group regions by country
  const byCountry = regions.reduce((acc, r) => {
    const c = r.country || 'Unknown'
    if (!acc[c]) acc[c] = []
    acc[c].push(r)
    return acc
  }, {})
  const countries = Object.keys(byCountry).sort()

  const handleSave = async () => {
    setSaveError('')
    setSaving(true)
    try {
      if (mode === 'add_subregion') {
        const score = parseFloat(qualityScore)
        if (isNaN(score) || score < 0 || score > 25) {
          setSaveError('Quality score must be 0–25.'); setSaving(false); return
        }
        await createSubregion({
          subregion_name: wine.region_name,
          country: wine.country || 'Unknown',
          quality_score: score,
          notes: subNotes.trim() || null,
        })
        setUpdated(true)
        onFixed()
      } else {
        if (!reason.trim() || reason.trim().length < 10) {
          setSaveError('Reason must be at least 10 characters.'); setSaving(false); return
        }
        if (mode === 'region') {
          if (!selectedRegion) { setSaveError('Select a region.'); setSaving(false); return }
          await updateWineRegion(wine.wine_family_id, parseInt(selectedRegion), reason)
        } else {
          if (!selectedTier) { setSaveError('Select a tier.'); setSaving(false); return }
          await updateWineTier(wine.wine_family_id, selectedTier, reason)
        }
        setUpdated(true)
        onFixed()
      }
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRecompute = async () => {
    setRecomputing(true)
    setSaveError('')
    try {
      const result = await recomputeWine(wine.wine_family_id, mode === 'add_subregion' ? 'subregion_added' : mode === 'region' ? 'region_fix' : 'tier_fix')
      setNewScore(result)
      onFixed()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setRecomputing(false)
    }
  }

  const newTierLabel = newScore
    ? (TIER_COLORS[newScore.wiqs_tier]?.label || newScore.wiqs_tier)
    : null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, animation: 'fadeIn 150ms',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
        background: 'var(--bg-card)',
        borderLeft: '2px solid var(--gold)',
        zIndex: 201,
        overflowY: 'auto',
        animation: 'slideInRight 200ms',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 16, color: 'var(--text)', marginBottom: 4,
            }}>
              {wine.wine_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{wine.producer_name}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-dim)',
              fontSize: 20, lineHeight: 1, padding: '2px 6px', marginLeft: 12,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          {mode === 'add_subregion' ? (
            <>
              <Field label="Subregion Name">
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{wine.region_name}</span>
              </Field>

              <Field label="Country">
                <span style={{ color: 'var(--text)' }}>{wine.country || 'Unknown'}</span>
              </Field>

              <Field label="Quality Score (0–25)">
                <input
                  type="number"
                  min="0" max="25" step="0.5"
                  value={qualityScore}
                  onChange={e => setQualityScore(e.target.value)}
                  disabled={updated}
                  placeholder="e.g. 18.0"
                  style={{ width: '100%' }}
                />
              </Field>

              <Field label="Notes (optional)">
                <textarea
                  rows={2}
                  placeholder="e.g. Sonoma County AVA"
                  value={subNotes}
                  onChange={e => setSubNotes(e.target.value)}
                  disabled={updated}
                  style={{ resize: 'vertical', minHeight: 48 }}
                />
              </Field>
            </>
          ) : mode === 'detail' ? (
            <>
              <Field label="Region">
                <span style={{ color: 'var(--text)' }}>{wine.region_name || '—'}</span>
              </Field>
              <Field label="Country">
                <span style={{ color: 'var(--text)' }}>{wine.country || '—'}</span>
              </Field>
              <Field label="Tier">
                <Badge tier={wine.production_tier} />
              </Field>
              <Field label="WIQS Score">
                <span style={{ color: scoreToColor(wine.wiqs_score).text, fontWeight: 600 }}>{fmtScore(wine.wiqs_score)}</span>
              </Field>
              <Field label="Confidence">
                <span style={{ color: wine.wiqs_confidence > 0.8 ? 'var(--green-light)' : wine.wiqs_confidence >= 0.6 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>
                  {wine.wiqs_confidence != null ? `${(wine.wiqs_confidence * 100).toFixed(0)}%` : '—'}
                </span>
              </Field>
            </>
          ) : mode === 'region' ? (
            <>
              <Field label="Current Region">
                <span style={{ color: 'var(--text)' }}>{wine.region_name}</span>
              </Field>

              <Field label="New Region">
                <select
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  disabled={updated}
                >
                  <option value="">— Select region —</option>
                  {countries.map(country => (
                    <optgroup key={country} label={country}>
                      {byCountry[country].map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Current Tier">
                <Badge tier={wine.production_tier} />
              </Field>

              <Field label="New Tier">
                <select
                  value={selectedTier}
                  onChange={e => setSelectedTier(e.target.value)}
                  disabled={updated}
                >
                  {VALID_TIERS.map(t => (
                    <option key={t} value={t}>{TIER_LABELS[t]}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {mode !== 'add_subregion' && mode !== 'detail' && (
            <Field label="Reason (required)">
              <textarea
                rows={3}
                placeholder="Minimum 10 characters…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={updated}
                style={{ resize: 'vertical', minHeight: 72 }}
              />
            </Field>
          )}

          {saveError && (
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
              borderRadius: 4, padding: '8px 12px', color: 'var(--red)',
              fontSize: 12, marginBottom: 16,
            }}>
              {saveError}
            </div>
          )}

          {mode !== 'detail' && (!updated ? (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '10px',
                background: 'var(--gold)', color: '#0d0d0d',
                border: 'none', borderRadius: 4,
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving && <LoadingSpinner size="sm" />}
              {mode === 'add_subregion' ? 'Add Subregion' : mode === 'region' ? 'Update Region' : 'Update Tier'}
            </button>
          ) : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                color: 'var(--green-light)', fontSize: 13, marginBottom: 16,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {mode === 'add_subregion' ? 'Subregion added' : mode === 'region' ? 'Region updated' : 'Tier updated'}
              </div>

              {newScore ? (
                <div style={{
                  padding: '10px 14px', background: 'rgba(22,163,74,0.08)',
                  border: '1px solid var(--green)', borderRadius: 4,
                  fontSize: 13, color: 'var(--green-light)',
                }}>
                  New WIQS: {fmtScore(newScore.wiqs_score)} · {newTierLabel}
                </div>
              ) : (
                <button
                  onClick={handleRecompute}
                  disabled={recomputing}
                  style={{
                    width: '100%', padding: '10px',
                    background: 'transparent',
                    border: '1px solid var(--gold)',
                    borderRadius: 4, color: 'var(--gold)',
                    fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: recomputing ? 0.7 : 1,
                  }}
                >
                  {recomputing && <LoadingSpinner size="sm" />}
                  Recompute WIQS
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 600,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--text-dim)', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}
