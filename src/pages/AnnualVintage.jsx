export default function AnnualVintage() {
  return <PlaceholderPage
    title="Annual Vintage"
    description="Guided workflow for adding each year's new vintage cohort to the catalog — from CSV import to WIQS computation"
    features={['Upload new vintage CSV — validates format before import', 'Review staged wines before committing to catalog', 'Assign regions, tiers, and producer mappings', 'Run WIQS batch compute on new vintage cohort', 'Compare new vintage scores against prior years']}
    part="Part 4"
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
