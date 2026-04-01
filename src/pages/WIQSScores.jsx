export default function WIQSScores() {
  return <PlaceholderPage
    title="WIQS Scores"
    description="Full catalog scores with score history charts and batch recompute controls"
    features={['Full catalog table — 1,047 wines, sortable and filterable', 'Score history chart per wine — trend over recomputes', 'Batch recompute — all, by region, by tier, or low-confidence', 'Distribution drill-down — click any tier to filter']}
    part="Part 3"
  />
}

function PlaceholderPage({ title, description, features, part }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
      <div style={{
        maxWidth: 520, width: '100%',
        background: 'var(--bg-card)',
        borderTop: '2px solid var(--gold)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '36px 40px',
      }}>
        <div style={{
          fontSize: 11, color: 'var(--text-dim)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Coming in {part}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--gold)', marginBottom: 10 }}>
          {title}
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          {description}
        </p>
        <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => (
            <li key={i} style={{ color: 'var(--text-dim)', fontSize: 13 }}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
