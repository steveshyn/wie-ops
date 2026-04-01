import { TIER_COLORS } from '../utils/tierColors'

export default function Badge({ tier }) {
  if (!tier) return null
  const c = TIER_COLORS[tier] || { bg: 'rgba(51,51,51,0.5)', border: '#444', text: '#777', label: tier }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      borderRadius: 10,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}
