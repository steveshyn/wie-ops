import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { isAuthed, login } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [apiKey,   setApiKey]   = useState('')
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (isAuthed) navigate('/')
  }, [isAuthed, navigate])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const ok = login(password, apiKey)
    if (ok) {
      navigate('/')
    } else {
      setError('Invalid credentials')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: '2px solid var(--gold)',
        borderRadius: 8,
        padding: '40px 36px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4,
          }}>
            Conektiq
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            WINE Intelligence Engine
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Operations Platform</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-dim)', marginBottom: 6,
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ops password"
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--text-dim)', marginBottom: 6,
            }}>
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="WIE API key (blank for local dev)"
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: 'var(--red)', marginBottom: 16,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%', padding: '10px',
              background: 'var(--gold)', color: '#0d0d0d',
              border: 'none', borderRadius: 4,
              fontSize: 13, fontWeight: 700,
              letterSpacing: '0.06em',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={e => e.target.style.opacity = '0.88'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
