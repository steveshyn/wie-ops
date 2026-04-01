export default function VintageHeatMap() {
  return <PlaceholderPage
    title="Vintage Heat Map"
    description="Region × vintage year quality map — the signature data visualization of the WIE ops platform"
    features={['Heat map grid: region rows × vintage year columns', 'Color scale from basic (dark) to exceptional (gold)', 'Click any cell to see wines in that region/year', 'Filter by country, min wine count, score range']}
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
        <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Coming in {part}
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--gold)', marginBottom: 10 }}>{title}</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{description}</p>
        <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {features.map((f, i) => <li key={i} style={{ color: 'var(--text-dim)', fontSize: 13 }}>{f}</li>)}
        </ul>
      </div>
    </div>
  )
}
