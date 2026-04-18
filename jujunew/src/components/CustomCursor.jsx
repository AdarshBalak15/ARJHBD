import { useEffect, useRef, useCallback, useState } from 'react'

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input, textarea, .nav-dot, .reveal-btn'

function CustomCursor() {
  const [isHoverSupported, setIsHoverSupported] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia("(hover: hover)")
      setIsHoverSupported(mql.matches)
      
      const handleChange = (e) => setIsHoverSupported(e.matches)
      mql.addEventListener('change', handleChange)
      return () => mql.removeEventListener('change', handleChange)
    }
  }, [])

  const cursorRef = useRef(null)
  const posRef = useRef({ x: -100, y: -100 })
  const targetRef = useRef({ x: -100, y: -100 })
  const hoveringRef = useRef(false)
  const visibleRef = useRef(false)
  const rafRef = useRef(null)

  const updateCursorStyle = useCallback(() => {
    const el = cursorRef.current
    if (!el) return

    // Smooth lerp toward target
    posRef.current.x += (targetRef.current.x - posRef.current.x) * 0.35
    posRef.current.y += (targetRef.current.y - posRef.current.y) * 0.35

    const scale = hoveringRef.current ? 2.5 : 1
    el.style.transform = `translate3d(${posRef.current.x - 6}px, ${posRef.current.y - 6}px, 0) scale(${scale})`
    el.style.opacity = visibleRef.current ? '1' : '0'
    el.style.boxShadow = hoveringRef.current
      ? '0 0 25px rgba(200, 162, 200, 1), 0 0 50px rgba(200, 162, 200, 0.6)'
      : '0 0 15px rgba(200, 162, 200, 0.5)'

    rafRef.current = requestAnimationFrame(updateCursorStyle)
  }, [])

  useEffect(() => {
    if (!isHoverSupported) return

    rafRef.current = requestAnimationFrame(updateCursorStyle)

    const onMouseMove = (e) => {
      targetRef.current.x = e.clientX
      targetRef.current.y = e.clientY
      if (!visibleRef.current) visibleRef.current = true
    }

    const onMouseOver = (e) => {
      if (e.target.closest(INTERACTIVE_SELECTOR)) {
        hoveringRef.current = true
      }
    }

    const onMouseOut = (e) => {
      if (e.target.closest(INTERACTIVE_SELECTOR)) {
        hoveringRef.current = false
      }
    }

    const onMouseEnter = () => { visibleRef.current = true }
    const onMouseLeave = () => { visibleRef.current = false }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('mouseover', onMouseOver, { passive: true })
    document.addEventListener('mouseout', onMouseOut, { passive: true })
    document.body.addEventListener('mouseenter', onMouseEnter)
    document.body.addEventListener('mouseleave', onMouseLeave)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('mouseout', onMouseOut)
      document.body.removeEventListener('mouseenter', onMouseEnter)
      document.body.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [updateCursorStyle, isHoverSupported])

  if (!isHoverSupported) return null;

  return (
    <div
      ref={cursorRef}
      className="custom-cursor-dot"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: '#C8A2C8',
        pointerEvents: 'none',
        zIndex: 100001,
        opacity: 0,
        willChange: 'transform',
        transition: 'box-shadow 0.2s ease, opacity 0.15s ease',
        transform: 'translate3d(-100px, -100px, 0) scale(1)',
      }}
    />
  )
}

export default CustomCursor

