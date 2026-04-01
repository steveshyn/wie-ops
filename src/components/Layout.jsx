import { useState, useEffect, useRef } from 'react'
import { getHealth } from '../api/client'
import Sidebar from './Sidebar'

export default function Layout({ title, children, onLogout }) {
  const [status, setStatus] = useState({ online: null, ms: null, checkedAt: null })
  const intervalRef = useRef(null)

  const checkHealth = async () => {
    const t0 = Date.now()
    try {
      await getHealth()
      setStatus({ online: true, ms: Date.now() - t0, checkedAt: new Date() })
    } catch {
      setStatus({ online: false, ms: null, checkedAt: new Date() })
    }
  }

  useEffect(() => {
    checkHealth()
    intervalRef.current = setInterval(checkHealth, 30000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const checkedStr = status.checkedAt
    ? status.checkedAt.toLocaleTimeString('en-US', { hour12: false })
    : '—'

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar onLogout={onLogout} />

      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(13,13,13,0.95)',
          borderBottom: '1px solid var(--border)',
          padding: '0 32px',
          height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            {/* Status dot */}
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: status.online === null
                ? '#555'
                : status.online ? 'var(--green-light)' : 'var(--red)',
              boxShadow: status.online
                ? '0 0 6px rgba(74,222,128,0.5)'
                : undefined,
            }} />
            <span style={{ color: status.online ? 'var(--green-light)' : 'var(--text-dim)' }}>
              {status.online === null ? 'Checking…' : status.online ? 'API Online' : 'API Offline'}
            </span>
            {status.ms != null && (
              <span style={{ color: 'var(--text-dim)' }}>· {status.ms}ms</span>
            )}
            <span style={{ color: 'var(--text-dim)' }}>· {checkedStr}</span>
          </div>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
