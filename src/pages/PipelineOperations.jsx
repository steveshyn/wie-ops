import { useState, useEffect, useCallback } from 'react'
import { getPipelines, getPipelineHistory } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

const STATUS_STYLES = {
  healthy:   { color: '#16a34a', label: 'Healthy' },
  complete:  { color: '#555',    label: 'Complete' },
  overdue:   { color: '#f59e0b', label: 'Overdue' },
  never_run: { color: '#dc2626', label: 'Never Run' },
}

function relativeTime(iso) {
  if (!iso) return '\u2014'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function isUpcomingSoon(dateStr) {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 3 * 86400000
}

function isPastDue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr).getTime() < Date.now()
}

function StatusDot({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.never_run
  const isPulse = status === 'healthy'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: s.color,
        display: 'inline-block',
        boxShadow: isPulse ? `0 0 6px ${s.color}` : undefined,
        animation: isPulse ? 'pulse 2s infinite' : undefined,
      }} />
      <span style={{ color: s.color, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
    </span>
  )
}

function HistoryPanel({ pipelineId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPipelineHistory(pipelineId)
      .then(setData)
      .catch(() => setData({ history: [], note: 'Failed to load history' }))
      .finally(() => setLoading(false))
  }, [pipelineId])

  if (loading) return <div style={{ padding: '12px 0', color: 'var(--text-dim)', fontSize: 12 }}>Loading...</div>
  if (!data?.history?.length) {
    return (
      <div style={{ padding: '12px 0', color: 'var(--text-dim)', fontSize: 12 }}>
        {data?.note || 'No run history available. History logged after ARCH-001 extension.'}
      </div>
    )
  }
  return (
    <table style={{ width: '100%', fontSize: 12, marginTop: 8 }}>
      <thead>
        <tr style={{ color: 'var(--text-dim)', textAlign: 'left' }}>
          <th style={{ padding: '4px 8px' }}>Timestamp</th>
          <th style={{ padding: '4px 8px' }}>Operator</th>
          <th style={{ padding: '4px 8px' }}>Details</th>
        </tr>
      </thead>
      <tbody>
        {data.history.map((h, i) => (
          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{h.timestamp || '\u2014'}</td>
            <td style={{ padding: '4px 8px' }}>{h.operator || '\u2014'}</td>
            <td style={{ padding: '4px 8px', color: 'var(--text-dim)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typeof h.diff === 'string' ? h.diff : JSON.stringify(h.diff) || '\u2014'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function PipelineOperations() {
  const [pipelines, setPipelines] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [expanded, setExpanded]   = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getPipelines()
      setPipelines(res.pipelines || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <LoadingSpinner />
  if (error) return <div style={{ color: 'var(--red)', padding: 32 }}>Error: {error}</div>

  return (
    <div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Pipeline Operations</h2>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{pipelines.length} pipelines</span>
        </div>
        <button
          onClick={fetchData}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '6px 16px', borderRadius: 4, fontSize: 12,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{
              borderBottom: '1px solid var(--border)', textAlign: 'left',
              color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              <th style={{ padding: '12px 16px' }}>Pipeline</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Last Run</th>
              <th style={{ padding: '12px 16px' }}>Records</th>
              <th style={{ padding: '12px 16px' }}>Schedule</th>
              <th style={{ padding: '12px 16px' }}>Next Run</th>
            </tr>
          </thead>
          <tbody>
            {pipelines.map((p) => {
              const isExp = expanded === p.id
              const isSothebys = p.id === 'sothebys_realized'
              return (
                <tbody key={p.id}>
                  <tr
                    onClick={() => setExpanded(isExp ? null : p.id)}
                    style={{
                      borderBottom: isExp ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isExp ? 'var(--bg-hover)' : undefined,
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = '' }}
                  >
                    {/* Pipeline */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.description}</div>
                    </td>
                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}><StatusDot status={p.status} /></td>
                    {/* Last Run */}
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-dim)' }}>
                      {relativeTime(p.last_run)}
                    </td>
                    {/* Records */}
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                      {p.records_processed != null ? p.records_processed.toLocaleString() : '\u2014'}
                    </td>
                    {/* Schedule */}
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      {isSothebys ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                          padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                        }}>
                          <span style={{ animation: 'pulse 2s infinite' }}>{'\u23F0'}</span>
                          {p.schedule}
                        </span>
                      ) : (
                        <span style={{
                          color: isUpcomingSoon(p.next_run) ? '#f59e0b' : 'var(--text-dim)',
                        }}>{p.schedule}</span>
                      )}
                    </td>
                    {/* Next Run */}
                    <td style={{ padding: '12px 16px', fontSize: 12, color: isPastDue(p.next_run) ? '#dc2626' : isUpcomingSoon(p.next_run) ? '#f59e0b' : 'var(--text-dim)' }}>
                      {p.next_run || '\u2014'}
                    </td>
                  </tr>
                  {isExp && (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} style={{ padding: '0 16px 16px', background: 'var(--bg-hover)' }}>
                        {/* Run hint */}
                        {p.run_hint && (
                          <div style={{
                            fontSize: 11, color: 'var(--text-dim)', marginBottom: 8,
                            padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 4,
                            fontFamily: 'monospace', wordBreak: 'break-all',
                          }}>
                            <span style={{ color: 'var(--gold)', marginRight: 6 }}>How to run:</span>
                            {p.run_hint}
                          </div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>Run History</div>
                        <HistoryPanel pipelineId={p.id} />
                      </td>
                    </tr>
                  )}
                </tbody>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
