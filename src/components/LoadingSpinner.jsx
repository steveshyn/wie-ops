const sizes = { sm: 16, md: 24, lg: 40 }

export default function LoadingSpinner({ size = 'md' }) {
  const px = sizes[size] || sizes.md
  return (
    <div style={{
      width: px, height: px,
      border: `2px solid rgba(201,168,76,0.2)`,
      borderTopColor: '#c9a84c',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      display: 'inline-block',
      flexShrink: 0,
    }} />
  )
}
