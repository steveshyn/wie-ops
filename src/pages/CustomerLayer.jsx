import { useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip,
} from 'recharts'
import {
  getCustomerProfile,
  getRecommendations,
  getMatchScore,
} from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import HelpTip from '../components/HelpTip'

const DIM_ORDER = [
  'body', 'acidity', 'tannin', 'sweetness',
  'oak_influence', 'finish_length', 'flavour_intensity', 'site_expression',
]

const DIM_LABELS = {
  body:              'Body',
  acidity:           'Acidity',
  tannin:            'Tannin',
  sweetness:         'Sweetness',
  oak_influence:     'Oak',
  finish_length:     'Finish',
  flavour_intensity: 'Flavour',
  site_expression:   'Site',
}

const CONTEXT_OPTIONS = [
  { value: '',             label: 'No context' },
  { value: 'weeknight',    label: 'Weeknight' },
  { value: 'dinner_party', label: 'Dinner Party' },
  { value: 'gift',         label: 'Gift' },
  { value: 'restaurant',   label: 'Restaurant' },
]

const RECOMMENDATION_STYLES = {
  strong_match: { bg: 'rgba(201,168,76,0.15)', border: '#c9a84c', text: '#c9a84c', label: 'Strong match' },
  good_match:   { bg: 'rgba(56,189,248,0.12)', border: '#38bdf8', text: '#7dd3fc', label: 'Good match'   },
  neutral:      { bg: 'rgba(120,120,120,0.15)', border: '#666',   text: '#9e8e7e', label: 'Neutral'      },
  mismatch:     { bg: 'rgba(220,38,38,0.10)',  border: '#dc2626', text: '#f87171', label: 'Mismatch'     },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30)  return `${d} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function matchBarColor(pct) {
  if (pct >= 80) return 'var(--gold)'
  if (pct >= 65) return '#38bdf8'
  return '#666'
}

// ── Design primitives ────────────────────────────────────────────────────────

const Card = ({ children, title, style = {} }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '20px 24px',
    ...style,
  }}>
    {title && (
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 16,
      }}>
        {title}
      </div>
    )}
    {children}
  </div>
)

const Chip = ({ children, color = 'var(--text-dim)', bg = 'transparent', border = 'var(--border)' }) => (
  <span style={{
    fontSize: 10, fontWeight: 600, padding: '3px 8px',
    borderRadius: 10, letterSpacing: '0.04em',
    background: bg, border: `1px solid ${border}`, color,
    display: 'inline-block', whiteSpace: 'nowrap', textTransform: 'uppercase',
  }}>
    {children}
  </span>
)

const TH = ({ children, style = {} }) => (
  <th style={{
    padding: '10px 14px', textAlign: 'left', fontSize: 10,
    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text-dim)', background: '#111',
    whiteSpace: 'nowrap', ...style,
  }}>
    {children}
  </th>
)

const TD = ({ children, style = {} }) => (
  <td style={{
    padding: '10px 14px', fontSize: 12,
    borderTop: '1px solid var(--border)', ...style,
  }}>{children}</td>
)

const ghostBtn = {
  padding: '8px 14px',
  fontSize: 12, fontWeight: 500,
  background: 'transparent',
  border: '1px solid var(--gold)',
  borderRadius: 4,
  color: 'var(--gold)',
  cursor: 'pointer',
}

const goldBtn = {
  padding: '9px 16px',
  fontSize: 13, fontWeight: 600,
  background: 'var(--gold)',
  border: '1px solid var(--gold)',
  borderRadius: 4,
  color: '#0d0d0d',
  cursor: 'pointer',
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerLayer() {
  const [customerIdInput, setCustomerIdInput] = useState('test_user_high')
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState(null)

  // Recommendation tester state
  const [recContext, setRecContext] = useState('')
  const [recLimit, setRecLimit] = useState(10)
  const [recommendations, setRecommendations] = useState(null)
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState(null)

  // Match score tester state
  const [matchWineId, setMatchWineId] = useState('1')
  const [matchVintage, setMatchVintage] = useState('')
  const [matchResult, setMatchResult] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchError, setMatchError] = useState(null)

  const loadProfile = async () => {
    setProfileLoading(true)
    setProfileError(null)
    setProfile(null)
    setRecommendations(null)
    setMatchResult(null)
    try {
      const p = await getCustomerProfile(customerIdInput.trim())
      setProfile(p)
    } catch (err) {
      setProfileError(err.message || 'Failed to load profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const loadRecommendations = async () => {
    if (!profile) return
    setRecLoading(true)
    setRecError(null)
    try {
      const r = await getRecommendations(
        profile.customer_id,
        Number(recLimit),
        recContext || null,
      )
      setRecommendations(r)
    } catch (err) {
      setRecError(err.message || 'Failed to load recommendations')
    } finally {
      setRecLoading(false)
    }
  }

  const runMatchTest = async () => {
    if (!profile) return
    setMatchLoading(true)
    setMatchError(null)
    setMatchResult(null)
    try {
      const r = await getMatchScore(
        profile.customer_id,
        Number(matchWineId),
        matchVintage ? Number(matchVintage) : null,
      )
      setMatchResult(r)
    } catch (err) {
      setMatchError(err.message || 'Failed to compute match')
    } finally {
      setMatchLoading(false)
    }
  }

  // Radar chart data
  const radarData = profile
    ? DIM_ORDER.map(dim => ({
        dimension: DIM_LABELS[dim],
        value:     profile.dimensions[dim] ?? 0,
      }))
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Customer ID loader */}
      <Card>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--text-dim)', marginBottom: 6,
            }}>
              Customer ID
            </label>
            <input
              type="text"
              value={customerIdInput}
              onChange={e => setCustomerIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadProfile()}
              placeholder="e.g. test_user_high"
            />
          </div>
          <button onClick={loadProfile} disabled={profileLoading} style={goldBtn}>
            {profileLoading ? 'Loading…' : 'Load Profile'}
          </button>
        </div>
      </Card>

      {/* Error / empty state */}
      {profileError && (
        <Card style={{ borderColor: 'var(--red)' }}>
          <div style={{ color: 'var(--red)', fontSize: 13 }}>
            {profileError}
          </div>
        </Card>
      )}

      {!profile && !profileLoading && !profileError && (
        <Card>
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            color: 'var(--text-dim)', fontSize: 13,
          }}>
            Enter a customer ID above to inspect their preference profile and test recommendations.
            <div style={{ marginTop: 8, fontSize: 11, fontStyle: 'italic' }}>
              Try <span style={{ color: 'var(--gold)' }}>test_user_high</span> or{' '}
              <span style={{ color: 'var(--gold)' }}>test_user_low</span>
            </div>
          </div>
        </Card>
      )}

      {profile && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 20,
        }}>

          {/* ═══════════════════ LEFT PANEL: Profile Inspector ══════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Archetype card */}
            <Card title={<>Archetype<HelpTip term="archetype" /></>}>
              <div style={{
                fontSize: 28, fontWeight: 600, color: 'var(--gold)',
                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                marginBottom: 4,
              }}>
                {profile.archetype_label || '—'}
              </div>
              <div style={{
                fontSize: 11, color: 'var(--text-dim)',
                fontFamily: 'monospace', marginBottom: 18,
              }}>
                {profile.archetype_id || 'none'}
              </div>

              <div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--text-dim)',
                  marginBottom: 6,
                }}>
                  <span>Profile confidence</span>
                  <span>{((profile.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, background: '#2a2a2a', borderRadius: 3 }}>
                  <div style={{
                    width: `${(profile.confidence || 0) * 100}%`,
                    height: '100%',
                    background: 'var(--gold)',
                    borderRadius: 3,
                    transition: 'width 300ms',
                  }} />
                </div>
              </div>
            </Card>

            {/* Radar chart */}
            <Card title={<>Palate Dimensions<HelpTip term="palate_dimensions" /></>}>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 10]}
                    tick={{ fill: 'var(--text-dim)', fontSize: 9 }}
                    axisLine={false}
                  />
                  <Radar
                    name="Palate"
                    dataKey="value"
                    stroke="#c9a84c"
                    fill="#c9a84c"
                    fillOpacity={0.6}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: 4,
                      fontSize: 12,
                      color: 'var(--text)',
                    }}
                    formatter={v => [v.toFixed(1), 'value']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            {/* Influence sensitivity */}
            {profile.influence_sensitivity && (
              <Card title={<>Influence Sensitivity<HelpTip term="influence_sensitivity" /></>}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 14,
                }}>
                  <span style={{
                    fontSize: 28, fontWeight: 600,
                    color: profile.influence_sensitivity.influence_score > 0.6
                      ? '#f59e0b' : 'var(--green-light)',
                  }}>
                    {(profile.influence_sensitivity.influence_score * 100).toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {profile.influence_sensitivity.influence_score > 0.6
                      ? 'Trend-influenced' : 'Expert-oriented'}
                  </span>
                </div>

                <InfluenceBar label="Trend sensitivity"   value={profile.influence_sensitivity.trend_sensitivity} />
                <InfluenceBar label="Social validation"   value={profile.influence_sensitivity.social_validation} />
                <InfluenceBar label="Critic score weight" value={profile.influence_sensitivity.critic_score_weight} />

                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>
                  {profile.influence_sensitivity.signal_count} behavioral signal{profile.influence_sensitivity.signal_count === 1 ? '' : 's'}
                </div>
              </Card>
            )}

            {/* Metadata row */}
            <Card>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {profile.communication_pattern_signal && (
                  <Chip color="var(--gold)" bg="rgba(201,168,76,0.1)" border="#c9a84c">
                    {profile.communication_pattern_signal}
                  </Chip>
                )}
                {profile.source && (
                  <Chip color="#7dd3fc" bg="rgba(56,189,248,0.08)" border="#38bdf8">
                    {profile.source}
                  </Chip>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Updated {relativeDate(profile.updated_at)}
                </span>
              </div>
            </Card>
          </div>

          {/* ═══════════════════ RIGHT PANEL: Recommendation Tester ═════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Recommendation controls */}
            <Card title="Recommendation Tester">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ minWidth: 160 }}>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--text-dim)', marginBottom: 6,
                  }}>
                    Context
                  </label>
                  <select value={recContext} onChange={e => setRecContext(e.target.value)}>
                    {CONTEXT_OPTIONS.map(o => (
                      <option key={o.value || 'none'} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ minWidth: 100 }}>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--text-dim)', marginBottom: 6,
                  }}>
                    Limit
                  </label>
                  <select value={recLimit} onChange={e => setRecLimit(e.target.value)}>
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                  </select>
                </div>
                <button onClick={loadRecommendations} disabled={recLoading} style={goldBtn}>
                  {recLoading ? 'Running…' : 'Get Recommendations'}
                </button>
              </div>

              {recError && (
                <div style={{
                  background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
                  borderRadius: 4, padding: '10px 14px', color: 'var(--red)', fontSize: 12,
                  marginBottom: 12,
                }}>
                  {recError}
                </div>
              )}

              {recLoading && !recommendations && (
                <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                  <LoadingSpinner size="md" />
                </div>
              )}

              {recommendations && recommendations?.recommendations?.length === 0 && (
                <div style={{
                  padding: '24px 16px', textAlign: 'center',
                  color: 'var(--text-dim)', fontSize: 13,
                }}>
                  No wines meet the current filter criteria
                  {recommendations.warning && (
                    <div style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                      {recommendations.warning}
                    </div>
                  )}
                </div>
              )}

              {recommendations && recommendations?.recommendations?.length > 0 && (
                <div style={{ overflowX: 'auto', margin: '0 -24px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <TH style={{ paddingLeft: 24 }}>#</TH>
                        <TH>Wine</TH>
                        <TH>Producer</TH>
                        <TH>Vintage</TH>
                        <TH style={{ textAlign: 'right' }}>WIQS</TH>
                        <TH>Match<HelpTip term="match_score" /></TH>
                        <TH style={{ paddingRight: 24 }}>Alignment</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {(recommendations?.recommendations ?? []).map(r => {
                        const pct = Math.round(r.match_score * 100)
                        return (
                          <tr key={`${r.rank}-${r.wine_family_id}-${r.vintage_year}`}>
                            <TD style={{ paddingLeft: 24, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                              {r.rank}
                            </TD>
                            <TD style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text)' }}>
                              {r.wine_name}
                            </TD>
                            <TD style={{ color: 'var(--text-dim)' }}>{r.producer}</TD>
                            <TD style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                              {r.vintage_year}
                            </TD>
                            <TD style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)' }}>
                              {r.wiqs_score?.toFixed(1)}
                            </TD>
                            <TD>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                                <div style={{
                                  flex: 1, height: 5, background: '#2a2a2a',
                                  borderRadius: 2, minWidth: 60,
                                }}>
                                  <div style={{
                                    width: `${pct}%`, height: '100%',
                                    background: matchBarColor(pct),
                                    borderRadius: 2,
                                  }} />
                                </div>
                                <span style={{
                                  fontSize: 11, fontWeight: 600, minWidth: 32,
                                  color: matchBarColor(pct),
                                }}>
                                  {pct}%
                                </span>
                              </div>
                            </TD>
                            <TD style={{ paddingRight: 24 }}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {(r.top_matching_dimensions || []).slice(0, 3).map(d => (
                                  <Chip key={d}>{DIM_LABELS[d] || d}</Chip>
                                ))}
                              </div>
                            </TD>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Match score sub-panel */}
            <Card title={<>Test Match Score<HelpTip term="match_score" /></>}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ minWidth: 140 }}>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--text-dim)', marginBottom: 6,
                  }}>
                    Wine Family ID
                  </label>
                  <input
                    type="number"
                    value={matchWineId}
                    onChange={e => setMatchWineId(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
                <div style={{ minWidth: 120 }}>
                  <label style={{
                    display: 'block', fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--text-dim)', marginBottom: 6,
                  }}>
                    Vintage (opt)
                  </label>
                  <input
                    type="number"
                    value={matchVintage}
                    onChange={e => setMatchVintage(e.target.value)}
                    placeholder="e.g. 2019"
                  />
                </div>
                <button onClick={runMatchTest} disabled={matchLoading} style={ghostBtn}>
                  {matchLoading ? 'Running…' : 'Test Match'}
                </button>
              </div>

              {matchError && (
                <div style={{
                  background: 'rgba(220,38,38,0.08)', border: '1px solid var(--red)',
                  borderRadius: 4, padding: '10px 14px', color: 'var(--red)', fontSize: 12,
                }}>
                  {matchError}
                </div>
              )}

              {matchResult && (
                <MatchResultDisplay result={matchResult} />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InfluenceBar({ label, value }) {
  const pct = (value || 0) * 100
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: 'var(--text-dim)', marginBottom: 4,
      }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'monospace' }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 4, background: '#2a2a2a', borderRadius: 2 }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: pct > 60 ? '#f59e0b' : '#4ade80',
          borderRadius: 2,
        }} />
      </div>
    </div>
  )
}

function MatchResultDisplay({ result }) {
  const s = RECOMMENDATION_STYLES[result.recommendation] || RECOMMENDATION_STYLES.neutral

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Headline: big match % + recommendation chip */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12,
        paddingBottom: 12, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          fontSize: 36, fontWeight: 600, color: s.text,
          fontFamily: 'var(--font-serif)', lineHeight: 1,
        }}>
          {result.palate_match_percentage}%
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px',
          borderRadius: 10, letterSpacing: '0.06em',
          background: s.bg, border: `1px solid ${s.border}`, color: s.text,
          textTransform: 'uppercase',
        }}>
          {s.label}
        </span>
      </div>

      {/* Wine info */}
      <div style={{
        fontFamily: 'var(--font-serif)', fontStyle: 'italic',
        fontSize: 15, color: 'var(--text)',
      }}>
        {result.wine_name}
        <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8, fontStyle: 'normal' }}>
          {result.producer} · {result.vintage_year} · WIQS {result.wiqs_score}
        </span>
      </div>

      {/* Explanation */}
      <div style={{
        fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5,
        padding: '10px 12px', background: '#0f0f0f', borderRadius: 4,
        borderLeft: `2px solid ${s.border}`,
      }}>
        {result.match_explanation}
      </div>

      {/* Dimension breakdown */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{
            color: 'var(--text-dim)', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            Top matching
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(result.top_matching_dimensions || []).map(d => (
              <Chip key={d} color="var(--green-light)" bg="rgba(22,163,74,0.1)" border="var(--green)">
                {DIM_LABELS[d] || d}
              </Chip>
            ))}
          </div>
        </div>
        {result.mismatched_dimensions && result.mismatched_dimensions.length > 0 && (
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{
              color: 'var(--text-dim)', fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Divergent
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {result.mismatched_dimensions.map(d => (
                <Chip key={d} color="#f87171" bg="rgba(220,38,38,0.08)" border="var(--red)">
                  {DIM_LABELS[d] || d}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Raw numbers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        fontSize: 11, color: 'var(--text-dim)',
        paddingTop: 8, borderTop: '1px solid var(--border)',
      }}>
        <div>
          Match score: <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>
            {(result.match_score ?? 0).toFixed(4)}
          </span>
        </div>
        <div>
          Similarity: <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>
            {(result.similarity_score ?? 0).toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  )
}
