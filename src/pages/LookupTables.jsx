import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getSubregions, getProducers, getDenominationTiers,
  updateSubregion, updateProducer,
  createSubregion, createProducer,
  batchRecompute,
} from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

const CHANGE_LOG_KEY = 'wie_lookup_changes'
const MAX_LOG = 10

// ── Helpers ──────────────────────────────────────────────────────────────────

function readLog() {
  try { return JSON.parse(localStorage.getItem(CHANGE_LOG_KEY) || '[]') } catch { return [] }
}
function appendLog(entry) {
  const log = [entry, ...readLog()].slice(0, MAX_LOG)
  localStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(log))
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) > 1 ? 's' : ''} ago`
}

// ── Design primitives ─────────────────────────────────────────────────────────

const TH = ({ children, onClick, style = {} }) => (
  <th onClick={onClick} style={{
    padding: '10px 16px', textAlign: 'left', fontSize: 10,
    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-dim)', cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none', background: '#111', whiteSpace: 'nowrap', ...style,
  }}>
    {children}
  </th>
)

const TD = ({ children, style = {} }) => (
  <td style={{ padding: '11px 16px', fontSize: 13, ...style }}>{children}</td>
)

function ActionBtn({ label, onClick, disabled, title, outline }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '4px 10px', fontSize: 11, fontWeight: 500,
        background: hover && !disabled ? 'rgba(201,168,76,0.08)' : 'transparent',
        border: `1px solid ${disabled ? '#444' : 'var(--gold)'}`,
        borderRadius: 3,
        color: disabled ? '#555' : 'var(--gold)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 120ms',
      }}
    >
      {label}
    </button>
  )
}

function GoldBtn({ children, onClick, loading, outline, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '9px 18px', fontSize: 13, fontWeight: 600,
        background: outline ? 'transparent' : 'var(--gold)',
        border: '1px solid var(--gold)',
        borderRadius: 5,
        color: outline ? 'var(--gold)' : '#0d0d0d',
        cursor: loading ? 'wait' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        opacity: loading ? 0.7 : 1,
        ...style,
      }}
    >
      {loading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// Inline mini bar for quality/prestige scores
function ScoreBar({ score, max, color }) {
  const pct = Math.min(100, (score / max) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 600, color, minWidth: 32, textAlign: 'right', fontSize: 13 }}>
        {score}
      </span>
      <div style={{ flex: 1, height: 4, background: '#2a2a2a', borderRadius: 2, minWidth: 60 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 300ms' }} />
      </div>
    </div>
  )
}

function subregionScoreColor(score) {
  if (score >= 20) return 'var(--gold)'
  if (score >= 15) return 'var(--green-light)'
  if (score >= 10) return 'var(--amber)'
  return 'var(--red)'
}

function producerScoreColor(score) {
  if (score >= 18) return 'var(--gold)'
  if (score >= 14) return 'var(--green-light)'
  if (score >= 10) return 'var(--amber)'
  return 'var(--red)'
}

const PRODUCER_TIER_STYLES = {
  iconic:      { bg: 'rgba(201,168,76,0.15)', border: '#c9a84c', text: '#c9a84c' },
  elite:       { bg: 'rgba(232,221,208,0.08)', border: '#e8ddd0', text: '#e8ddd0' },
  established: { bg: 'rgba(22,163,74,0.12)', border: '#16a34a', text: '#4ade80' },
  commercial:  { bg: 'rgba(51,51,51,0.5)', border: '#444', text: '#777' },
  standard:    { bg: 'rgba(33,33,33,0.5)', border: '#333', text: '#555' },
}

function TierPill({ tier }) {
  const s = PRODUCER_TIER_STYLES[tier] || PRODUCER_TIER_STYLES.standard
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 10, letterSpacing: '0.06em',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      textTransform: 'uppercase',
    }}>
      {tier}
    </span>
  )
}

// ── Slide-in panel ────────────────────────────────────────────────────────────

function SlidePanel({ title, subtitle, onClose, children }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, animation: 'fadeIn 150ms',
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380,
        background: 'var(--bg-card)',
        borderLeft: '2px solid var(--gold)',
        zIndex: 201, overflowY: 'auto',
        animation: 'slideInRight 200ms',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-serif)', fontStyle: 'italic',
              fontSize: 16, color: 'var(--text)', marginBottom: 4,
            }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 20, lineHeight: 1, padding: '2px 6px', marginLeft: 12 }}
          >×</button>
        </div>
        <div style={{ padding: 24, flex: 1 }}>
          {children}
        </div>
      </div>
    </>
  )
}

// ── Change log ────────────────────────────────────────────────────────────────

function ChangeLog() {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState(() => readLog())

  const refresh = () => setLog(readLog())
  const clear = () => { localStorage.removeItem(CHANGE_LOG_KEY); setLog([]) }

  useEffect(() => {
    if (open) refresh()
  }, [open])

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', color: 'var(--text-dim)',
          fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 150ms' }}>▶</span>
        Recent Changes ({log.length})
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {log.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>No changes recorded yet.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {log.map((entry, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    <span style={{ color: 'var(--text)' }}>{entry.name}</span>
                    {' → '}{entry.field}: <span style={{ color: 'var(--gold)' }}>{entry.newVal}</span>
                    {entry.oldVal !== undefined && <span style={{ color: '#555' }}> (was {entry.oldVal})</span>}
                    {' · '}{timeAgo(entry.at)}
                  </div>
                ))}
              </div>
              <button
                onClick={clear}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear log
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Summary pill bar ──────────────────────────────────────────────────────────

function SummaryBar({ stats }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {stats.map(({ label, value, color }) => (
        <div key={label} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '8px 14px', fontSize: 12,
        }}>
          <span style={{ color: 'var(--text-dim)' }}>{label}: </span>
          <span style={{ fontWeight: 600, color: color || 'var(--text)' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ search, onSearch, children, onAdd }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder="Search…"
        style={{ width: 220, flex: 'none' }}
      />
      {children}
      <div style={{ marginLeft: 'auto' }}>
        <GoldBtn onClick={onAdd}>{onAdd.label || '+ Add'}</GoldBtn>
      </div>
    </div>
  )
}

// ── Subregion Quality tab ─────────────────────────────────────────────────────

function SubregionTab({ subregions, onUpdate }) {
  const [search, setSearch]   = useState('')
  const [country, setCountry] = useState('all')
  const [sort, setSort]       = useState({ field: 'quality_score', dir: 'desc' })
  const [panel, setPanel]     = useState(null) // 'edit' | 'add', + item
  const [rows, setRows]       = useState(subregions)

  useEffect(() => setRows(subregions), [subregions])

  const countries = useMemo(() =>
    ['all', ...Array.from(new Set(subregions.map(s => s.country))).sort()],
    [subregions]
  )

  const filtered = useMemo(() => {
    let r = rows.filter(s => {
      const q = search.toLowerCase()
      if (q && !s.subregion_name.toLowerCase().includes(q) && !s.country.toLowerCase().includes(q)) return false
      if (country !== 'all' && s.country !== country) return false
      return true
    })
    r = [...r].sort((a, b) => {
      const dir = sort.dir === 'desc' ? -1 : 1
      if (sort.field === 'quality_score') return dir * (a.quality_score - b.quality_score)
      return dir * a.subregion_name.localeCompare(b.subregion_name)
    })
    return r
  }, [rows, search, country, sort])

  const avg = rows.length ? (rows.reduce((s, r) => s + r.quality_score, 0) / rows.length).toFixed(1) : '—'
  const highest = rows.length ? [...rows].sort((a, b) => b.quality_score - a.quality_score)[0] : null
  const lowest  = rows.length ? [...rows].sort((a, b) => a.quality_score - b.quality_score)[0] : null

  const handleSaved = (updated) => {
    setRows(r => r.map(row => row.id === updated.id ? { ...row, ...updated } : row))
    setPanel(null)
    onUpdate()
  }
  const handleAdded = (newRow) => {
    setRows(r => [newRow, ...r])
    setPanel(null)
    onUpdate()
  }

  const toggleSort = (field) =>
    setSort(s => s.field === field ? { field, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { field, dir: 'desc' })

  const sortIndicator = (field) => sort.field === field ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <div>
      <SummaryBar stats={[
        { label: 'Total', value: rows.length },
        { label: 'Avg Score', value: avg, color: 'var(--gold)' },
        { label: 'Highest', value: highest ? `${highest.subregion_name} (${highest.quality_score})` : '—', color: 'var(--green-light)' },
        { label: 'Lowest',  value: lowest  ? `${lowest.subregion_name} (${lowest.quality_score})`  : '—', color: 'var(--red)' },
      ]} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subregion…" style={{ width: 220 }} />
        <select value={country} onChange={e => setCountry(e.target.value)} style={{ width: 160 }}>
          {countries.map(c => <option key={c} value={c}>{c === 'all' ? 'All countries' : c}</option>)}
        </select>
        <select
          value={`${sort.field}:${sort.dir}`}
          onChange={e => { const [f, d] = e.target.value.split(':'); setSort({ field: f, dir: d }) }}
          style={{ width: 160 }}
        >
          <option value="quality_score:desc">Score ↓</option>
          <option value="quality_score:asc">Score ↑</option>
          <option value="subregion_name:asc">Name A–Z</option>
          <option value="subregion_name:desc">Name Z–A</option>
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <GoldBtn onClick={() => setPanel({ mode: 'add' })}>+ Add Subregion</GoldBtn>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <TH onClick={() => toggleSort('subregion_name')}>Subregion{sortIndicator('subregion_name')}</TH>
                <TH>Country</TH>
                <TH onClick={() => toggleSort('quality_score')}>Quality Score (0–25){sortIndicator('quality_score')}</TH>
                <TH>Notes</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  No subregions match your filters.
                </td></tr>
              ) : filtered.map(s => (
                <tr
                  key={s.id}
                  style={{ borderBottom: '1px solid #1e1e1e' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <TD>
                    <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{s.subregion_name}</span>
                  </TD>
                  <TD style={{ color: 'var(--text-dim)' }}>{s.country}</TD>
                  <TD>
                    <ScoreBar score={s.quality_score} max={25} color={subregionScoreColor(s.quality_score)} />
                  </TD>
                  <TD style={{ color: 'var(--text-dim)', fontSize: 12, maxWidth: 200 }}>{s.notes || '—'}</TD>
                  <TD>
                    <ActionBtn label="Edit" onClick={() => setPanel({ mode: 'edit', item: s })} />
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ChangeLog />

      {panel?.mode === 'edit' && (
        <SubregionEditPanel item={panel.item} onClose={() => setPanel(null)} onSaved={handleSaved} />
      )}
      {panel?.mode === 'add' && (
        <SubregionAddPanel onClose={() => setPanel(null)} onAdded={handleAdded} />
      )}
    </div>
  )
}

function SubregionEditPanel({ item, onClose, onSaved }) {
  const [score, setScore]         = useState(item.quality_score)
  const [notes, setNotes]         = useState(item.notes || '')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState('')

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await updateSubregion(item.id, { quality_score: parseFloat(score), notes })
      appendLog({
        name: item.subregion_name, field: 'quality_score',
        newVal: score, oldVal: item.quality_score, at: new Date().toISOString(),
      })
      setSaved(true)
      onSaved({ ...item, quality_score: parseFloat(score), notes })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRecompute = async () => {
    setRecomputing(true); setRecomputeMsg(''); setError('')
    try {
      const res = await batchRecompute('region', { region_name: item.subregion_name, reason: 'lookup_update' })
      setRecomputeMsg(`Recomputed ${res.computed ?? '?'} wines.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <SlidePanel title={item.subregion_name} subtitle={item.country} onClose={onClose}>
      <Field label="Quality Score (0–25)">
        <input type="number" min={0} max={25} step={0.5} value={score} onChange={e => setScore(e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
      </Field>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {saved && <div style={{ color: 'var(--green-light)', fontSize: 12, marginBottom: 12 }}>✓ Saved</div>}
      <GoldBtn onClick={handleSave} loading={saving} style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
        Save Changes
      </GoldBtn>
      <GoldBtn onClick={handleRecompute} loading={recomputing} outline style={{ width: '100%', justifyContent: 'center' }}>
        Recompute affected wines
      </GoldBtn>
      {recomputeMsg && <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>{recomputeMsg}</div>}
    </SlidePanel>
  )
}

function SubregionAddPanel({ onClose, onAdded }) {
  const [name, setName]     = useState('')
  const [cnt, setCnt]       = useState('')
  const [score, setScore]   = useState(15)
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleAdd = async () => {
    if (!name.trim() || !cnt.trim()) { setError('Name and country are required.'); return }
    setSaving(true); setError('')
    try {
      const res = await createSubregion({ subregion_name: name.trim(), country: cnt.trim(), quality_score: parseFloat(score), notes })
      onAdded(res)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <SlidePanel title="Add Subregion" onClose={onClose}>
      <Field label="Subregion Name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Country"><input value={cnt} onChange={e => setCnt(e.target.value)} /></Field>
      <Field label="Quality Score (0–25)">
        <input type="number" min={0} max={25} step={0.5} value={score} onChange={e => setScore(e.target.value)} />
      </Field>
      <Field label="Notes"><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} /></Field>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <GoldBtn onClick={handleAdd} loading={saving} style={{ width: '100%', justifyContent: 'center' }}>
        Add Subregion
      </GoldBtn>
    </SlidePanel>
  )
}

// ── Producer Prestige tab ─────────────────────────────────────────────────────

const PRODUCER_TIERS = ['iconic', 'elite', 'established', 'commercial', 'standard']

function ProducerTab({ producers, onUpdate }) {
  const [search, setSearch] = useState('')
  const [tier, setTier]     = useState('all')
  const [sort, setSort]     = useState({ field: 'prestige_score', dir: 'desc' })
  const [panel, setPanel]   = useState(null)
  const [rows, setRows]     = useState(producers)

  useEffect(() => setRows(producers), [producers])

  const tierCounts = useMemo(() =>
    PRODUCER_TIERS.reduce((acc, t) => { acc[t] = rows.filter(p => p.tier === t).length; return acc }, {}),
    [rows]
  )
  const avg = rows.length ? (rows.reduce((s, r) => s + r.prestige_score, 0) / rows.length).toFixed(1) : '—'

  const oldestNotesYear = useMemo(() => {
    const years = rows.flatMap(p => {
      const m = (p.notes || '').match(/\b(20\d{2}|19\d{2})\b/g)
      return m ? m.map(Number) : []
    })
    return years.length ? Math.min(...years) : null
  }, [rows])

  const filtered = useMemo(() => {
    let r = rows.filter(p => {
      const q = search.toLowerCase()
      if (q && !p.producer_name.toLowerCase().includes(q)) return false
      if (tier !== 'all' && p.tier !== tier) return false
      return true
    })
    r = [...r].sort((a, b) => {
      const dir = sort.dir === 'desc' ? -1 : 1
      if (sort.field === 'prestige_score') return dir * (a.prestige_score - b.prestige_score)
      if (sort.field === 'tier') return dir * PRODUCER_TIERS.indexOf(a.tier) - PRODUCER_TIERS.indexOf(b.tier)
      return dir * a.producer_name.localeCompare(b.producer_name)
    })
    return r
  }, [rows, search, tier, sort])

  const isStale = (p) => {
    const years = (p.notes || '').match(/\b(20\d{2}|19\d{2})\b/g)
    if (!years) return false
    return years.some(y => Number(y) < new Date().getFullYear() - 1)
  }

  const handleSaved = (updated) => {
    setRows(r => r.map(row => row.id === updated.id ? { ...row, ...updated } : row))
    setPanel(null)
    onUpdate()
  }
  const handleAdded = (newRow) => {
    setRows(r => [newRow, ...r])
    setPanel(null)
    onUpdate()
  }

  return (
    <div>
      {/* Annual review callout */}
      <div style={{
        background: 'rgba(201,168,76,0.06)', border: '1px solid var(--gold)',
        borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13,
      }}>
        <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Annual Review</span>
        <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
          Producer prestige scores should be reviewed annually.
          Last bulk review year referenced in notes:{' '}
          <span style={{ color: 'var(--text)' }}>{oldestNotesYear || 'Never'}</span>.
          Rows with notes containing an older year are highlighted.
        </span>
      </div>

      <SummaryBar stats={[
        { label: 'Total', value: rows.length },
        { label: 'Avg Score', value: avg, color: 'var(--gold)' },
        ...PRODUCER_TIERS.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1), value: tierCounts[t] || 0 })),
      ]} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search producer…" style={{ width: 220 }} />
        <select value={tier} onChange={e => setTier(e.target.value)} style={{ width: 160 }}>
          <option value="all">All tiers</option>
          {PRODUCER_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select
          value={`${sort.field}:${sort.dir}`}
          onChange={e => { const [f, d] = e.target.value.split(':'); setSort({ field: f, dir: d }) }}
          style={{ width: 160 }}
        >
          <option value="prestige_score:desc">Score ↓</option>
          <option value="prestige_score:asc">Score ↑</option>
          <option value="producer_name:asc">Name A–Z</option>
          <option value="tier:asc">Tier</option>
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <GoldBtn onClick={() => setPanel({ mode: 'add' })}>+ Add Producer</GoldBtn>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <TH>Producer</TH>
                <TH>Prestige Score (0–20)</TH>
                <TH>Tier</TH>
                <TH>Notes</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  No producers match your filters.
                </td></tr>
              ) : filtered.map(p => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: '1px solid #1e1e1e',
                    borderLeft: isStale(p) ? '3px solid rgba(245,158,11,0.4)' : '3px solid transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <TD><span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{p.producer_name}</span></TD>
                  <TD><ScoreBar score={p.prestige_score} max={20} color={producerScoreColor(p.prestige_score)} /></TD>
                  <TD><TierPill tier={p.tier} /></TD>
                  <TD style={{ color: 'var(--text-dim)', fontSize: 12, maxWidth: 200 }}>{p.notes || '—'}</TD>
                  <TD><ActionBtn label="Edit" onClick={() => setPanel({ mode: 'edit', item: p })} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ChangeLog />

      {panel?.mode === 'edit' && (
        <ProducerEditPanel item={panel.item} onClose={() => setPanel(null)} onSaved={handleSaved} />
      )}
      {panel?.mode === 'add' && (
        <ProducerAddPanel onClose={() => setPanel(null)} onAdded={handleAdded} />
      )}
    </div>
  )
}

function ProducerEditPanel({ item, onClose, onSaved }) {
  const [score, setScore]         = useState(item.prestige_score)
  const [tier, setTier]           = useState(item.tier)
  const [notes, setNotes]         = useState(item.notes || '')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState('')

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await updateProducer(item.id, { prestige_score: parseFloat(score), tier, notes })
      appendLog({
        name: item.producer_name, field: 'prestige_score',
        newVal: score, oldVal: item.prestige_score, at: new Date().toISOString(),
      })
      setSaved(true)
      onSaved({ ...item, prestige_score: parseFloat(score), tier, notes })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRecompute = async () => {
    setRecomputing(true); setRecomputeMsg(''); setError('')
    try {
      const res = await batchRecompute('all', { reason: 'lookup_update' })
      setRecomputeMsg(`Recomputed ${res.computed ?? '?'} wines.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setRecomputing(false)
    }
  }

  return (
    <SlidePanel title={item.producer_name} onClose={onClose}>
      <Field label="Prestige Score (0–20)">
        <input type="number" min={0} max={20} step={0.5} value={score} onChange={e => setScore(e.target.value)} />
      </Field>
      <Field label="Tier">
        <select value={tier} onChange={e => setTier(e.target.value)}>
          {PRODUCER_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </Field>
      <Field label="Notes">
        <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
      </Field>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {saved && <div style={{ color: 'var(--green-light)', fontSize: 12, marginBottom: 12 }}>✓ Saved</div>}
      <GoldBtn onClick={handleSave} loading={saving} style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>
        Save Changes
      </GoldBtn>
      <GoldBtn onClick={handleRecompute} loading={recomputing} outline style={{ width: '100%', justifyContent: 'center' }}>
        Recompute affected wines
      </GoldBtn>
      {recomputeMsg && <div style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>{recomputeMsg}</div>}
    </SlidePanel>
  )
}

function ProducerAddPanel({ onClose, onAdded }) {
  const [name, setName]     = useState('')
  const [score, setScore]   = useState(12)
  const [tier, setTier]     = useState('established')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleAdd = async () => {
    if (!name.trim()) { setError('Producer name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await createProducer({ producer_name: name.trim(), prestige_score: parseFloat(score), tier, notes })
      onAdded(res)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <SlidePanel title="Add Producer" onClose={onClose}>
      <Field label="Producer Name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Prestige Score (0–20)">
        <input type="number" min={0} max={20} step={0.5} value={score} onChange={e => setScore(e.target.value)} />
      </Field>
      <Field label="Tier">
        <select value={tier} onChange={e => setTier(e.target.value)}>
          {PRODUCER_TIERS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} /></Field>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
      <GoldBtn onClick={handleAdd} loading={saving} style={{ width: '100%', justifyContent: 'center' }}>
        Add Producer
      </GoldBtn>
    </SlidePanel>
  )
}

// ── Denomination Tiers tab ────────────────────────────────────────────────────

function DenominationTab({ denominations }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return denominations
    const q = search.toLowerCase()
    return denominations.filter(d =>
      d.denomination_name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q)
    )
  }, [denominations, search])

  return (
    <div>
      <div style={{
        background: 'rgba(201,168,76,0.06)', border: '1px solid #3a3020',
        borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--text-dim)',
      }}>
        Denomination tier bonuses are applied on top of classification scores in P3.
        Edit endpoints are coming in a future build.
      </div>

      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search denomination or country…" style={{ width: 280 }} />
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <TH>Denomination</TH>
                <TH>Country</TH>
                <TH>Tier Bonus</TH>
                <TH>Notes</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr
                  key={d.id}
                  style={{ borderBottom: '1px solid #1e1e1e' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <TD><span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{d.denomination_name}</span></TD>
                  <TD style={{ color: 'var(--text-dim)' }}>{d.country}</TD>
                  <TD>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: d.tier_bonus >= 4.5 ? 'var(--gold)' : d.tier_bonus >= 3 ? 'var(--green-light)' : 'var(--text-dim)', minWidth: 28 }}>
                        +{d.tier_bonus}
                      </span>
                      <div style={{ width: 60, height: 4, background: '#2a2a2a', borderRadius: 2 }}>
                        <div style={{ width: `${(d.tier_bonus / 5) * 100}%`, height: '100%', background: d.tier_bonus >= 4.5 ? 'var(--gold)' : 'var(--green-light)', borderRadius: 2 }} />
                      </div>
                    </div>
                  </TD>
                  <TD style={{ color: 'var(--text-dim)', fontSize: 12 }}>{d.notes || '—'}</TD>
                  <TD>
                    <ActionBtn
                      label="Edit"
                      disabled
                      title="Denomination editing coming soon"
                    />
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'subregion',    label: 'Subregion Quality' },
  { key: 'producer',     label: 'Producer Prestige' },
  { key: 'denomination', label: 'Denomination Tiers' },
]

export default function LookupTables() {
  const [tab, setTab]             = useState('subregion')
  const [subregions, setSubregions] = useState(null)
  const [producers, setProducers]   = useState(null)
  const [denominations, setDenominations] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [sub, pro, den] = await Promise.all([
        getSubregions(), getProducers(), getDenominationTiers(),
      ])
      setSubregions(sub.subregions || [])
      setProducers(pro.producers || [])
      setDenominations(den.denominations || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (loading) return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--text-dim)', padding: 16 }}>
      <LoadingSpinner size="sm" /> Loading lookup tables…
    </div>
  )

  if (error) return (
    <div style={{
      background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
      borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
    }}>{error}</div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none',
              padding: '12px 20px', fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--gold)' : 'var(--text-dim)',
              borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer', transition: 'all 150ms',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subregion'    && <SubregionTab    subregions={subregions}       onUpdate={fetchAll} />}
      {tab === 'producer'     && <ProducerTab     producers={producers}         onUpdate={fetchAll} />}
      {tab === 'denomination' && <DenominationTab denominations={denominations} />}
    </div>
  )
}
