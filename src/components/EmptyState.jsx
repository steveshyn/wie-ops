export default function EmptyState({ message = 'No data', icon }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', gap: 12,
      color: 'var(--text-dim)',
    }}>
      {icon && <div style={{ fontSize: 32, opacity: 0.4 }}>{icon}</div>}
      <div style={{ fontSize: 13 }}>{message}</div>
    </div>
  )
}
