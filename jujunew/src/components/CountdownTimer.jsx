import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const birthDate = new Date("2002-05-04T00:00:00")

// ── Accurate age calculator ──────────────────────────────────────
function calculateExactAge(birthDate) {
  const now = new Date()
  let years = now.getFullYear() - birthDate.getFullYear()
  let months = now.getMonth() - birthDate.getMonth()
  let days = now.getDate() - birthDate.getDate()
  let hours = now.getHours() - birthDate.getHours()
  let minutes = now.getMinutes() - birthDate.getMinutes()
  let seconds = now.getSeconds() - birthDate.getSeconds()

  if (seconds < 0) { seconds += 60; minutes-- }
  if (minutes < 0) { minutes += 60; hours-- }
  if (hours < 0) { hours += 24; days-- }
  if (days < 0) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    days += prevMonth.getDate()
    months--
  }
  if (months < 0) { months += 12; years-- }

  return { years, months, days, hours, minutes, seconds }
}

// ── Lightweight confetti ─────────────────────────────────────────
function launchConfetti() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  const colors = ['#C8A2C8', '#9D4EDD', '#C77DFF', '#FFD700', '#FF69B4', '#FFFFFF', '#7DF9FF']
  const particles = Array.from({ length: 150 }, () => ({
    x: canvas.width * 0.5 + (Math.random() - 0.5) * canvas.width * 0.4,
    y: canvas.height * 0.45,
    vx: (Math.random() - 0.5) * 14,
    vy: -(Math.random() * 16 + 4),
    size: Math.random() * 7 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    opacity: 1,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }))

  let frame = 0
  const maxFrames = 180

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach((p) => {
      p.x += p.vx
      p.vy += 0.25
      p.y += p.vy
      p.rotation += p.rotationSpeed
      p.opacity = Math.max(0, 1 - frame / maxFrames)

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.color

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    })

    frame++
    if (frame < maxFrames) {
      requestAnimationFrame(draw)
    } else {
      canvas.remove()
    }
  }
  requestAnimationFrame(draw)
}

// ── Glow particles background (subtle) ──────────────────────────
function GlowParticles() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const dots = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      r: Math.random() * 2.5 + 1,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2,
    }))

    function loop() {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
      dots.forEach((d) => {
        d.x += d.dx
        d.y += d.dy
        if (d.x < 0 || d.x > canvas.offsetWidth) d.dx *= -1
        if (d.y < 0 || d.y > canvas.offsetHeight) d.dy *= -1

        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,162,200,${d.alpha})`
        ctx.shadowBlur = 12
        ctx.shadowColor = 'rgba(200,162,200,0.5)'
        ctx.fill()
        ctx.shadowBlur = 0
      })
      animId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        borderRadius: 'inherit',
      }}
    />
  )
}

// ── Typing animation hook ────────────────────────────────────────
function useTypingEffect(text, speed = 45) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let i = 0
    setDisplayed('')
    setDone(false)
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(id)
        setDone(true)
      }
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])

  return { displayed, done }
}

// ── Main component ───────────────────────────────────────────────
function CountdownTimer() {
  // ── Configuration ──────────────────────────────────────────────
  const BIRTHDAY_MONTH = 4    // May (0-indexed)
  const BIRTHDAY_DAY = 4
  const CELEBRATION_MONTHS = 6 // Celebration lasts 6 months

  // ── Cyclic mode determination (pure function of current time) ──
  //
  // The system cycles forever between two phases:
  //   Phase 1 — COUNTDOWN:    counting down to the next birthday
  //   Phase 2 — CELEBRATION:  showing live age for 6 months
  //
  // Timeline each year (birthday = May 4):
  //   [Jan 1 ··· May 4)  → countdown to May 4
  //   [May 4 ··· Nov 4)  → celebration (6 months)
  //   [Nov 4 ··· Dec 31] → countdown to next May 4
  //
  const determineMode = useCallback(() => {
    const now = new Date()
    const currentYear = now.getFullYear()

    // This year's birthday at midnight
    const currentBirthday = new Date(currentYear, BIRTHDAY_MONTH, BIRTHDAY_DAY, 0, 0, 0)

    // Celebration window ends exactly 6 months after birthday
    // JS Date constructor safely handles month overflow (10 = November)
    const celebrationEnd = new Date(currentYear, BIRTHDAY_MONTH + CELEBRATION_MONTHS, BIRTHDAY_DAY, 0, 0, 0)

    if (now < currentBirthday) {
      // ── Before this year's birthday → countdown to it
      return { mode: 'countdown', target: currentBirthday }
    }

    if (now < celebrationEnd) {
      // ── After birthday but within 6-month window → celebration
      return { mode: 'celebration', target: null }
    }

    // ── Past the 6-month window → countdown to NEXT year's birthday
    return {
      mode: 'countdown',
      target: new Date(currentYear + 1, BIRTHDAY_MONTH, BIRTHDAY_DAY, 0, 0, 0),
    }
  }, []) // Constants are stable — no deps needed

  // ── Calculate time remaining to a target date ─────────────────
  const calculateTimeLeft = useCallback((target) => {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0 }

    const difference = target - Date.now()

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    }
  }, [])

  // ── Eagerly compute initial state to prevent flicker ───────────
  const initialState = determineMode()
  const [mode, setMode] = useState(initialState.mode)
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(initialState.target))
  const [age, setAge] = useState(() => calculateExactAge(birthDate))

  // Refs for transition detection without stale closures
  const modeRef = useRef(initialState.mode)
  const confettiFired = useRef(false)

  // Fire confetti on first render if starting in celebration mode
  useEffect(() => {
    if (modeRef.current === 'celebration' && !confettiFired.current) {
      confettiFired.current = true
      launchConfetti()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Single unified tick — handles both modes + transitions ────
  //
  // One interval drives the entire system. On each tick:
  //   1. Recompute the correct mode from current time (pure)
  //   2. Detect mode transitions via modeRef (no stale closures)
  //   3. Update the appropriate state (timeLeft OR age)
  //
  useEffect(() => {
    const tick = () => {
      const current = determineMode()

      if (current.mode === 'celebration') {
        // ── Transition: countdown → celebration
        if (modeRef.current !== 'celebration') {
          modeRef.current = 'celebration'
          setMode('celebration')
          if (!confettiFired.current) {
            confettiFired.current = true
            setTimeout(launchConfetti, 400)
          }
        }
        // Update live age every second
        setAge(calculateExactAge(birthDate))
      } else {
        // ── Transition: celebration → countdown
        if (modeRef.current !== 'countdown') {
          modeRef.current = 'countdown'
          setMode('countdown')
          confettiFired.current = false // Reset for next celebration cycle
        }
        // Update countdown every second
        setTimeLeft(calculateTimeLeft(current.target))
      }
    }

    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [determineMode, calculateTimeLeft])

  const timeUnits = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ]

  const tagline = 'Every second with you is a celebration 💫'
  const { displayed: typedTagline, done: taglineDone } = useTypingEffect(
    mode === 'celebration' ? tagline : '',
    45,
  )

  // ── Shared card style (matches existing countdown cards) ──────
  const cardStyle = {
    backdropFilter: 'blur(10px)',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(200, 162, 200, 0.3)',
    borderRadius: '20px',
    padding: 'clamp(24px, 4vw, 32px) 8px',
    textAlign: 'center',
    width: 'clamp(140px, 40vw, 170px)',
    boxShadow: 'inset 0 0 15px rgba(200, 162, 200, 0.05)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  }

  const numberStyle = {
    fontFamily: "'Poppins', sans-serif",
    fontSize: 'clamp(2rem, 6vw, 3.5rem)',
    fontWeight: 800,
    color: '#fff',
    textShadow: '0 0 20px rgba(200, 162, 200, 0.4)',
    lineHeight: 1,
  }

  const labelStyle = {
    fontFamily: "'Poppins', sans-serif",
    fontSize: 'clamp(0.7rem, 2vw, 0.95rem)',
    fontWeight: 500,
    color: '#EAEAEA',
    marginTop: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.25em',
    opacity: 0.8,
  }

  // ── Age units for birthday mode ───────────────────────────────
  const ageUnits = [
    { label: 'Years', value: age.years },
    { label: 'Months', value: age.months },
    { label: 'Days', value: age.days },
    { label: 'Hours', value: age.hours },
    { label: 'Minutes', value: age.minutes },
    { label: 'Seconds', value: age.seconds },
  ]

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <AnimatePresence mode="wait">
        {mode === 'countdown' ? (
          /* ─── COUNTDOWN ────────────────────────────────────── */
          <motion.div
            key="countdown"
            className="countdown-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{
              display: 'flex',
              gap: 'clamp(12px, 3vw, 32px)',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '48px',
            }}
          >
            {timeUnits.map((unit, index) => (
              <motion.div
                key={unit.label}
                className="countdown-box"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 2.5 + index * 0.1 }}
                style={cardStyle}
              >
                <div style={numberStyle}>
                  {String(unit.value).padStart(2, '0')}
                </div>
                <div style={labelStyle}>{unit.label}</div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* ─── BIRTHDAY REVEAL ──────────────────────────────── */
          <motion.div
            key="birthday"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginTop: '48px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '32px',
              position: 'relative',
            }}
          >
            {/* Glow particles behind the content */}
            <GlowParticles />

            {/* ── Heading ───────────────────────────────── */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 'clamp(1.6rem, 5vw, 2.8rem)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #C8A2C8 0%, #FFFFFF 50%, #C77DFF 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 18px rgba(200, 162, 200, 0.45))',
                textAlign: 'center',
                lineHeight: 1.2,
                position: 'relative',
                zIndex: 1,
              }}
            >
              🎉 Congratulations Arju 🎉
            </motion.h2>

            {/* ── Age cards ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'flex',
                gap: 'clamp(8px, 2vw, 16px)',
                justifyContent: 'center',
                flexWrap: 'wrap',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {ageUnits.map((unit, index) => (
                <motion.div
                  key={unit.label}
                  initial={{ opacity: 0, scale: 0.8, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.7 + index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    ...cardStyle,
                    width: 'clamp(90px, 28vw, 120px)',
                    padding: 'clamp(16px, 3vw, 24px) 4px',
                    boxShadow:
                      'inset 0 0 15px rgba(200, 162, 200, 0.05), 0 0 20px rgba(200,162,200,0.08)',
                  }}
                >
                  <div
                    style={{
                      ...numberStyle,
                      fontSize: 'clamp(1.5rem, 5vw, 2.8rem)',
                    }}
                  >
                    {String(unit.value).padStart(2, '0')}
                  </div>
                  <div style={labelStyle}>{unit.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* ── Formatted age text ────────────────────── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 'clamp(0.85rem, 2.5vw, 1.15rem)',
                fontWeight: 500,
                color: '#EAEAEA',
                opacity: 0.75,
                letterSpacing: '0.04em',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {age.years} Years • {age.months} Months • {age.days} Days • {age.hours} Hours •{' '}
              {age.minutes} Minutes • {age.seconds} Seconds
            </motion.p>

            {/* ── Tagline with typing effect ────────────── */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.6 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 'clamp(1rem, 3vw, 1.35rem)',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.85)',
                fontStyle: 'italic',
                textAlign: 'center',
                minHeight: '2em',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {typedTagline}
              {!taglineDone && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '1em',
                    background: '#C8A2C8',
                    marginLeft: '2px',
                    verticalAlign: 'text-bottom',
                    animation: 'cursorBlink 0.7s steps(2) infinite',
                  }}
                />
              )}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cursor blink keyframes */}
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default CountdownTimer
