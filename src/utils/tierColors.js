export const TIER_COLORS = {
  exceptional:   { bg: 'rgba(201,168,76,0.12)',  border: '#c9a84c', text: '#c9a84c', label: '✦ Exceptional' },
  distinguished: { bg: 'rgba(232,221,208,0.08)', border: '#e8ddd0', text: '#e8ddd0', label: '◆ Distinguished' },
  quality:       { bg: 'rgba(22,163,74,0.12)',   border: '#16a34a', text: '#4ade80', label: '● Quality' },
  standard:      { bg: 'rgba(51,51,51,0.5)',     border: '#444',    text: '#777',    label: 'Standard' },
  basic:         { bg: 'rgba(33,33,33,0.5)',     border: '#333',    text: '#555',    label: 'Basic' },
}

export const scoreToColor = (score) => {
  if (score >= 85) return TIER_COLORS.exceptional
  if (score >= 70) return TIER_COLORS.distinguished
  if (score >= 55) return TIER_COLORS.quality
  if (score >= 40) return TIER_COLORS.standard
  return TIER_COLORS.basic
}
