import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { GLOSSARY } from '../utils/glossary'

export default function HelpTip({ term, text }) {
  const definition = text || GLOSSARY[term]
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0, above: true })
  const iconRef = useRef(null)
  const timer = useRef(null)

  const open = useCallback(() => {
    timer.current = setTimeout(() => {
      if (iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect()
        const above = rect.top > 160
        setPos({
          x: rect.left + rect.width / 2,
          y: above ? rect.top - 8 : rect.bottom + 8,
          above,
        })
      }
      setShow(true)
    }, 200)
  }, [])

  const close = useCallback(() => {
    clearTimeout(timer.current)
    setShow(false)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!definition) return null

  return (
    <span
      ref={iconRef}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      tabIndex={0}
      role="button"
      aria-label="Help"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 4,
        cursor: 'help',
        verticalAlign: 'middle',
        outline: 'none',
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%',
        border: '1px solid #555',
        fontSize: 9, fontWeight: 700, fontStyle: 'normal',
        color: '#8a7a5a', lineHeight: 1,
        transition: 'border-color 0.15s, color 0.15s',
        ...(show ? { borderColor: '#c9a84c', color: '#c9a84c' } : {}),
      }}>
        i
      </span>

      {show && createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            left: pos.x,
            transform: 'translateX(-50%)',
            ...(pos.above
              ? { top: pos.y, transform: 'translate(-50%, -100%)' }
              : { top: pos.y }),
            width: 260,
            padding: '10px 12px',
            background: '#1a1a1a',
            border: '1px solid #3a3527',
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.5,
            color: '#ccc',
            fontWeight: 400,
            fontStyle: 'normal',
            textTransform: 'none',
            letterSpacing: 'normal',
            whiteSpace: 'normal',
            zIndex: 9999,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{
            position: 'absolute',
            left: '50%', transform: 'translateX(-50%)',
            ...(pos.above
              ? { bottom: -5, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #3a3527' }
              : { top: -5, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid #3a3527' }),
            width: 0, height: 0,
          }} />
          {definition}
        </span>,
        document.body
      )}
    </span>
  )
}
