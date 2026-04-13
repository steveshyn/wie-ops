import { useState } from 'react'
import HelpTip from './HelpTip'

export default function StatCard({ title, value, subtitle, accent = 'var(--gold)', helpTerm }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? accent : 'var(--border)'}`,
        borderRadius: 8,
        padding: '20px 24px',
        transition: 'border-color 200ms',
      }}
    >
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8,
      }}>
        {title}{helpTerm && <HelpTip term={helpTerm} />}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1.1, marginBottom: 4,
      }}>
        {value ?? '—'}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{subtitle}</div>
      )}
    </div>
  )
}
