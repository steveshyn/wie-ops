import { useState, useEffect, useCallback } from 'react'
import { getScoringEngine } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

const PILLAR_DEFS = [
  { key: 'p1', label: 'P1 Site & Terroir', weight: 25 },
  { key: 'p2', label: 'P2 Producer',       weight: 25 },
  { key: 'p3', label: 'P3 Classification', weight: 15 },
  { key: 'p4', label: 'P4 Vintage',        weight: 20 },
  { key: 'p5', label: 'P5 Sensory',        weight: 15 },
]

function fmt(v, decimals = 2) {
  if (v == null) return '\u2014'
  return Number(v).toFixed(decimals)
}

function INT01Card({ item }) {
  const isOk = item.ok
  const border = isOk ? 'var(--green)' : 'var(--red)'
  const driftMatch = item.drift != null && item.drift === 0

  return (
    <div style={{
      flex: 1, minWidth: 340, padding: 20,
      background: 'var(--bg-card)', borderRadius: 8,
      border: `1px solid ${border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{item.wine}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>fid={item.fid} &middot; {item.vintage}</span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
          background: isOk ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
          color: isOk ? 'var(--green)' : 'var(--red)',
        }}>
          {isOk ? 'HEALTHY' : 'DRIFT DETECTED'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 32, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>Locked</div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, color: 'var(--gold)', fontWeight: 700 }}>
            {fmt(item.locked_score)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>Current</div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, color: 'var(--text)', fontWeight: 700 }}>
            {fmt(item.current_score)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>Drift</div>
          <div style={{ fontFamily: 'monospace', fontSize: 22, color: isOk ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
            {driftMatch ? '= Locked \u2713' : fmt(item.drift, 3)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {PILLAR_DEFS.map(p => (
          <div key={p.key} style={{
            padding: '4px 10px', borderRadius: 4,
            background: 'var(--bg)', fontSize: 12, fontFamily: 'monospace',
          }}>
            <span style={{ color: 'var(--text-dim)' }}>{p.key.toUpperCase()}</span>{' '}
            <span style={{ color: 'var(--text)' }}>{fmt(item.pillars?.[p.key])}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PillarWeightsPanel({ weights }) {
  const maxWeight = 25
  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>
        Pillar Weights
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PILLAR_DEFS.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 140, fontSize: 13, color: 'var(--text-dim)' }}>{p.label}</div>
            <div style={{ flex: 1, height: 18, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${(p.weight / maxWeight) * 100}%`, height: '100%',
                background: 'var(--gold)', borderRadius: 3,
              }} />
            </div>
            <div style={{ width: 50, textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: 'var(--gold)' }}>
              {p.weight} pts
            </div>
          </div>
        ))}
      </div>
      <div style={{
        borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10,
        display: 'flex', justifyContent: 'space-between', fontSize: 13,
      }}>
        <span style={{ color: 'var(--text-dim)' }}>Total</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold)' }}>100 pts</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, lineHeight: 1.5 }}>
        Version locked. Changes require CEO approval + full recalibration.
      </div>
    </div>
  )
}

function ProtectedTiersPanel({ tiers, triggerActive }) {
  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>
        Protected Tiers
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tiers.map(t => (
          <div key={t.fid} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: t.ok ? 'var(--green)' : 'var(--red)',
              boxShadow: t.ok ? '0 0 6px var(--green)' : '0 0 6px var(--red)',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace', width: 50 }}>
              fid={t.fid}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-serif)' }}>
              {t.producer}
            </span>
            <span style={{
              fontSize: 12, fontFamily: 'monospace',
              color: t.ok ? 'var(--green)' : 'var(--red)',
            }}>
              {t.tier} {t.ok ? '\u2713' : '\u2717'}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 14, padding: '8px 12px', borderRadius: 6,
        background: triggerActive ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
        color: triggerActive ? 'var(--green)' : 'var(--red)',
        fontSize: 12, fontFamily: 'monospace',
      }}>
        enforce_protected_tiers trigger: {triggerActive ? 'ACTIVE \u2713' : 'MISSING \u2717'}
      </div>
    </div>
  )
}

function WIQSVersionPanel({ version, lockedDate }) {
  return (
    <div style={{
      padding: 20, background: 'var(--bg-card)', borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--text)' }}>
        WIQS Version
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 20, color: 'var(--gold)', fontWeight: 700 }}>
          WIQS {version !== 'unknown' ? `v${version}` : version}
        </div>
        {[
          ['P1 model', 'v1.5'],
          ['BLS', 'v1.2'],
          ['Pipeline complete', 'true'],
          ['Last locked', lockedDate || '\u2014'],
        ].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--text-dim)' }}>{label}</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ScoringEngine() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(() => {
    setLoading(true)
    getScoringEngine()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <LoadingSpinner />
  if (error) return (
    <div style={{ padding: 24, color: 'var(--red)', background: 'rgba(220,38,38,0.1)', borderRadius: 8 }}>
      Failed to load scoring engine data: {error}
    </div>
  )
  if (!data) return null

  // Pick the locked vintages for INT-01 display (fid=1 vintage=2020, fid=11 vintage=2016)
  const int01_1  = data.int01.find(r => r.fid === 1  && r.vintage === 2020) || data.int01.find(r => r.fid === 1)
  const int01_11 = data.int01.find(r => r.fid === 11 && r.vintage === 2016) || data.int01.find(r => r.fid === 11)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* INT-01 Parity Monitor */}
      <div>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            INT-01 Parity Monitor
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
            These two wines are the immutable reference points for the scoring engine.
            Any drift &gt; 0.1 points triggers an alert.
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap',
          padding: 16, background: data.int01_healthy ? 'rgba(22,163,74,0.05)' : 'rgba(220,38,38,0.05)',
          borderRadius: 8, border: `1px solid ${data.int01_healthy ? 'var(--green)' : 'var(--red)'}`,
        }}>
          {int01_1 && <INT01Card item={int01_1} />}
          {int01_11 && <INT01Card item={int01_11} />}
        </div>
      </div>

      {/* Two-column bottom */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <PillarWeightsPanel weights={data.pillar_weights} />
        <ProtectedTiersPanel tiers={data.protected_tiers} triggerActive={data.trigger_active} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <WIQSVersionPanel version={data.wiqs_version} lockedDate={data.locked_date} />
        <div style={{
          padding: 20, background: 'var(--bg-card)', borderRadius: 8,
          border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Query Time</div>
          <div style={{ fontFamily: 'monospace', fontSize: 28, color: data.query_ms > 300 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
            {data.query_ms}ms
          </div>
        </div>
      </div>
    </div>
  )
}
