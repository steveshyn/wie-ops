export const fmtScore   = (s) => s != null ? Number(s).toFixed(1) : '—'
export const fmtPct     = (n) => n != null ? `${(Number(n) * 100).toFixed(0)}%` : '—'
export const fmtCount   = (n) => n != null ? Number(n).toLocaleString() : '—'
export const fmtDate    = (d) => d ? new Date(d).toLocaleDateString('en-US',
  { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
export const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
