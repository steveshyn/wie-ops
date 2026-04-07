import { useState, useEffect, useCallback } from 'react'
import {
  getPillarOverrides, getPrestigeOverrides,
  deletePillarOverride,
} from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'

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

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 0,
    overflow: 'hidden',
    ...style,
  }}>{children}</div>
)

const TH = ({ children, style = {} }) => (
  <th style={{
    padding: '10px 14px', textAlign: 'left', fontSize: 10,
    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-dim)', background: '#111',
    whiteSpace: 'nowrap', ...style,
  }}>{children}</th>
)

const TD = ({ children, style = {} }) => (
  <td style={{
    padding: '10px 14px', fontSize: 12,
    borderTop: '1px solid var(--border)', ...style,
  }}>{children}</td>
)

function OperatorChip({ operator }) {
  const s = OPERATOR_STYLES[operator] || OPERATOR_STYLES.pipeline_auto
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 10, background: s.bg,
      border: `1px solid ${s.border}`, color: s.text,
      display: 'inline-block',
    }}>{operator}</span>
  )
}

const ghostBtn = {
  padding: '5px 10px', fontSize: 10, fontWeight: 500,
  background: 'transparent', border: '1px solid var(--gold)',
  borderRadius: 3, color: 'var(--gold)', cursor: 'pointer',
}

const redBtn = {
  padding: '5px 10px', fontSize: 10, fontWeight: 500,
  background: 'transparent', border: '1px solid var(--red)',
  borderRadius: 3, color: 'var(--red)', cursor: 'pointer',
}

export default function OverrideQueue() {
  const [tab, setTab] = useState('pillars')
  const [pillars, setPillars] = useState([])
  const [prestige, setPrestige] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, pr] = await Promise.all([
        getPillarOverrides(),
        getPrestigeOverrides(),
      ])
      setPillars(p.overrides || [])
      setPrestige(pr.overrides || [])
    } catch (err) {
      setError(err.message || 'Failed to load overrides')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load, version])

  const refresh = () => setVersion(v => v + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4,
        borderBottom: '1px solid var(--border)',
      }}>
        <TabButton active={tab === 'pillars'}  onClick={() => setTab('pillars')}>
          Pillar Overrides ({pillars.length})
        </TabButton>
        <TabButton active={tab === 'prestige'} onClick={() => setTab('prestige')}>
          Prestige Overrides ({prestige.length})
        </TabButton>
      </div>

      {loading ? (
        <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)' }}>
          <LoadingSpinner size="md" /> Loading overrides…
        </div>
      ) : error ? (
        <div style={{
          background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
          borderRadius: 8, padding: '12px 16px', color: 'var(--red)', fontSize: 13,
        }}>{error}</div>
      ) : tab === 'pillars' ? (
        <PillarTable rows={pillars} onRefresh={refresh} />
      ) : (
        <PrestigeTable rows={prestige} onRefresh={refresh} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 16px', fontSize: 12, fontWeight: 600,
        letterSpacing: '0.06em', textTransform: 'uppercase',
        background: 'transparent', border: 'none',
        color: active ? 'var(--gold)' : 'var(--text-dim)',
        borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >{children}</button>
  )
}

// ── Pillar table ─────────────────────────────────────────────────────────────

function PillarTable({ rows, onRefresh }) {
  const [removing, setRemoving] = useState(null)
  const [removeNote, setRemoveNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const wineCount = new Set(rows.map(r => r.wine_family_id)).size

  const doRemove = async (oid) => {
    if (!removeNote.trim()) return
    setSubmitting(true)
    try {
      await deletePillarOverride(oid, removeNote)
      setRemoving(null)
      setRemoveNote('')
      onRefresh()
    } catch (err) {
      alert(err.message || 'Remove failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 4px' }}>
        {rows.length} active pillar override{rows.length === 1 ? '' : 's'} across {wineCount} wine{wineCount === 1 ? '' : 's'}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState message="No active pillar overrides." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH style={{ paddingLeft: 24 }}>Wine</TH>
                <TH>Producer</TH>
                <TH>Vintage</TH>
                <TH>Pillar</TH>
                <TH style={{ textAlign: 'right' }}>Override</TH>
                <TH>Note</TH>
                <TH>Operator</TH>
                <TH>Set</TH>
                <TH style={{ paddingRight: 24 }}>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.override_id}>
                  <TD style={{
                    paddingLeft: 24, fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic', color: 'var(--text)',
                  }}>{r.wine_name}</TD>
                  <TD style={{ color: 'var(--text-dim)' }}>{r.producer}</TD>
                  <TD style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{r.vintage_year}</TD>
                  <TD style={{ fontFamily: 'monospace', color: 'var(--gold)' }}>{r.pillar.toUpperCase()}</TD>
                  <TD style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>
                    {r.override_value}
                  </TD>
                  <TD style={{ color: 'var(--text-dim)', maxWidth: 220 }}>{r.note}</TD>
                  <TD><OperatorChip operator={r.operator} /></TD>
                  <TD style={{ color: 'var(--text-dim)', fontSize: 11 }}>{timeAgo(r.created_at)}</TD>
                  <TD style={{ paddingRight: 24 }}>
                    {removing === r.override_id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input
                          type="text"
                          placeholder="reason (required)"
                          value={removeNote}
                          onChange={e => setRemoveNote(e.target.value)}
                          style={{ fontSize: 11 }}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => doRemove(r.override_id)}
                            disabled={submitting || !removeNote.trim()}
                            style={redBtn}
                          >
                            {submitting ? '…' : 'Confirm'}
                          </button>
                          <button onClick={() => setRemoving(null)} style={ghostBtn}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRemoving(r.override_id); setRemoveNote('') }}
                        style={redBtn}
                      >Remove</button>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}

// ── Prestige table ───────────────────────────────────────────────────────────

function PrestigeTable({ rows }) {
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 4px' }}>
        {rows.length} manually set prestige score{rows.length === 1 ? '' : 's'}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState message="No manually set prestige overrides." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH style={{ paddingLeft: 24 }}>Producer</TH>
                <TH style={{ textAlign: 'right' }}>Prestige Score</TH>
                <TH>Tier</TH>
                <TH>Note</TH>
                <TH style={{ paddingRight: 24 }}>Set</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <TD style={{
                    paddingLeft: 24, color: 'var(--text)',
                  }}>{r.producer_name}</TD>
                  <TD style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--gold)' }}>
                    {r.prestige_score}
                  </TD>
                  <TD style={{ color: 'var(--text-dim)' }}>{r.tier || '—'}</TD>
                  <TD style={{ color: 'var(--text-dim)', maxWidth: 320 }}>{r.manual_note}</TD>
                  <TD style={{ paddingRight: 24, color: 'var(--text-dim)', fontSize: 11 }}>
                    {timeAgo(r.manually_set_at)}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
