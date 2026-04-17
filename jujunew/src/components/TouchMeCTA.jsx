import { useState, useCallback, useRef, useEffect, useMemo } from 'react'

/* ═══════════════════════════════════════════════════
   AUDIO FADE UTILITY — smooth volume transitions
   ═══════════════════════════════════════════════════ */
function fadeAudio(audio, targetVolume, duration = 1500, onDone) {
  if (!audio) return null

  const stepTime = 50
  const steps = Math.max(1, duration / stepTime)
  const startVolume = audio.volume
  const volumeStep = (targetVolume - startVolume) / steps

  let currentStep = 0

  const intervalId = setInterval(() => {
    currentStep++
    const newVol = startVolume + volumeStep * currentStep
    audio.volume = Math.min(Math.max(newVol, 0), 1)

    if (currentStep >= steps) {
      clearInterval(intervalId)
      audio.volume = targetVolume

      if (targetVolume === 0) {
        audio.pause()
        // ❗ DO NOT reset currentTime here — callers control position
      }
      if (onDone) onDone()
    }
  }, stepTime)

  return intervalId
}

/* ═══════════════════════════════════════════════════
   CONFETTI UTILITY — lightweight canvas-based
   ═══════════════════════════════════════════════════ */
function launchConfetti(canvas, intensity = 'light') {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = canvas.parentElement?.getBoundingClientRect()
  if (!rect) return
  canvas.width = rect.width
  canvas.height = rect.height
  const count = intensity === 'heavy' ? 150 : 45
  const particles = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: rect.width * 0.5 + (Math.random() - 0.5) * rect.width * 0.4,
      y: rect.height * 0.35,
      vx: (Math.random() - 0.5) * (intensity === 'heavy' ? 14 : 7),
      vy: -(Math.random() * 6 + 2),
      w: Math.random() * 8 + 3,
      h: Math.random() * 5 + 3,
      color: `hsl(${Math.random() * 360}, 80%, 65%)`,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 14,
      g: 0.1 + Math.random() * 0.06,
      opacity: 1,
      decay: 0.01 + Math.random() * 0.007,
    })
  }
  let frameId
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    for (const p of particles) {
      if (p.opacity <= 0) continue
      alive = true
      p.x += p.vx; p.vy += p.g; p.y += p.vy
      p.rot += p.rotV; p.opacity -= p.decay
      ctx.save()
      ctx.globalAlpha = Math.max(0, p.opacity)
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rot * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.6)
      ctx.restore()
    }
    if (alive) frameId = requestAnimationFrame(frame)
    else ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  frame()
  return () => cancelAnimationFrame(frameId)
}

/* ═══════════════════════════════════════════════════
   BLACK FOREST CAKE — CSS-only premium design
   ═══════════════════════════════════════════════════ */
function BlackForestCake({ candlesLit, candlesBlown }) {
  return (
    <div className="bf-scene">
      {/* Ambient warm glow when candles lit */}
      {candlesLit && !candlesBlown && <div className="bf-glow" />}

      {/* Wind streak on blow */}
      {candlesBlown && <div className="bf-wind" />}

      <div className="bf-cake">
        {/* ── Candles ── */}
        <div className="bf-candles">
          {[0, 1, 2].map(i => (
            <div key={i} className="bf-candle">
              {/* Smoke particles (blown) */}
              {candlesBlown && (
                <div className="bf-smoke-wrap">
                  {[0, 1, 2].map(j => (
                    <div key={j} className="bf-smoke"
                      style={{ animationDelay: `${i * 0.2 + j * 0.1 + 0.25}s` }} />
                  ))}
                </div>
              )}
              {/* Flame */}
              {candlesLit && (
                <div className={`bf-flame ${candlesBlown ? 'out' : ''}`}
                  style={{ animationDelay: candlesBlown ? `${i * 0.15}s` : `${i * 0.3}s` }} />
              )}
              <div className="bf-wick" />
              <div className="bf-stick" style={{ '--ci': i }} />
            </div>
          ))}
        </div>

        {/* ── Top cream surface ── */}
        <div className="bf-top">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
            <div key={`sw${i}`} className="bf-swirl" style={{ '--si': i }} />
          ))}
          {[0, 1, 2, 3, 4].map(i => (
            <div key={`ch${i}`} className="bf-cherry" style={{ '--chi': i }} />
          ))}
        </div>

        {/* ── Cake body ── */}
        <div className="bf-body">
          <div className="bf-cream-line" style={{ top: '35%' }} />
          <div className="bf-cream-line" style={{ top: '68%' }} />
          <div className="bf-shavings" />
          <div className="bf-label">ARJU</div>
        </div>
      </div>

      {/* Ground shadow */}
      <div className="bf-shadow" />
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   BALLOON GAME — infinite spawning mini-game
   ═══════════════════════════════════════════════════ */
let _balloonUid = 0
const MIN_BALLOONS = 6
const MAX_BALLOONS = 12
const GREEN_RATIO = 0.4 // 40 % green

function makeBalloon(forceGreen) {
  const isGreen = forceGreen !== undefined ? forceGreen : Math.random() < GREEN_RATIO
  const speed = 3 + Math.random() * 2           // 3 – 5 s (fast)
  const drift = (Math.random() - 0.5) * 40       // -20 … 20 px side drift
  const scale = 0.8 + Math.random() * 0.4        // 0.8 – 1.2
  return {
    id: ++_balloonUid,
    isGreen,
    x: 4 + Math.random() * 86,                   // 4 % – 90 %
    speed,
    drift,
    scale,
    born: Date.now(),
  }
}

const TARGET_SCORE = 5

function BalloonGame({ onComplete }) {
  const [score, setScore] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [plusFlash, setPlusFlash] = useState(false)
  const [minusFlash, setMinusFlash] = useState(false)
  const [nearWin, setNearWin] = useState(false)
  const completedRef = useRef(false)
  const fieldRef = useRef(null)
  const balloonsRef = useRef([])
  const poppedRef = useRef(new Set())   // guard: prevent double-trigger
  const [, forceRender] = useState(0)

  // ── Seed initial balloons ──
  useEffect(() => {
    const initial = []
    for (let i = 0; i < MAX_BALLOONS; i++) {
      initial.push(makeBalloon(i < Math.ceil(MAX_BALLOONS * GREEN_RATIO)))
    }
    // shuffle
    for (let i = initial.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [initial[i], initial[j]] = [initial[j], initial[i]]
    }
    balloonsRef.current = initial
    poppedRef.current.clear()
    forceRender(n => n + 1)
  }, [])

  // ── Continuous spawn loop via rAF ──
  useEffect(() => {
    let running = true
    function maintain() {
      if (!running) return
      const list = balloonsRef.current
      const now = Date.now()
      // Remove balloons that have exited (animation ended)
      const alive = list.filter(b => {
        const elapsed = (now - b.born) / 1000
        return elapsed < b.speed + 0.15 // small grace
      })
      let changed = alive.length !== list.length
      // Clean up popped set for removed balloon ids
      if (changed) {
        const aliveIds = new Set(alive.map(b => b.id))
        for (const pid of poppedRef.current) {
          if (!aliveIds.has(pid)) poppedRef.current.delete(pid)
        }
      }
      // Ensure we always have >= MIN_BALLOONS and up to MAX_BALLOONS
      while (alive.length < MIN_BALLOONS) {
        alive.push(makeBalloon())
        changed = true
      }
      if (alive.length < MAX_BALLOONS && Math.random() < 0.03) {
        alive.push(makeBalloon())
        changed = true
      }
      if (changed) {
        balloonsRef.current = alive
        forceRender(n => n + 1)
      }
      requestAnimationFrame(maintain)
    }
    requestAnimationFrame(maintain)
    return () => { running = false }
  }, [])

  // ── Pop handler (instant, single-trigger) ──
  const handlePop = useCallback((id, isGreen) => {
    if (completedRef.current) return
    // Guard: only fire once per balloon
    if (poppedRef.current.has(id)) return
    poppedRef.current.add(id)

    const field = fieldRef.current

    if (isGreen) {
      // ── GREEN: burst + remove + score +1 ──
      if (field) {
        const el = field.querySelector(`[data-bid="${id}"]`)
        if (el) {
          const rect = el.getBoundingClientRect()
          const fieldRect = field.getBoundingClientRect()
          const cx = rect.left - fieldRect.left + rect.width / 2
          const cy = rect.top - fieldRect.top + rect.height / 2
          for (let i = 0; i < 8; i++) {
            const p = document.createElement('span')
            p.className = 'te-burst'
            p.style.left = cx + 'px'
            p.style.top = cy + 'px'
            p.style.setProperty('--angle', `${i * 45}deg`)
            p.style.setProperty('--clr', '#22c55e')
            field.appendChild(p)
            setTimeout(() => p.remove(), 500)
          }
        }
      }
      // Remove balloon and immediately spawn replacement
      balloonsRef.current = balloonsRef.current.filter(b => b.id !== id)
      balloonsRef.current.push(makeBalloon())
      forceRender(n => n + 1)

      setPlusFlash(true)
      setTimeout(() => setPlusFlash(false), 500)
      setScore(prev => {
        const next = prev + 1
        if (next === TARGET_SCORE - 1) {
          setNearWin(true)
        }
        if (next >= TARGET_SCORE && !completedRef.current) {
          completedRef.current = true
          setCompleted(true)
          setTimeout(() => onComplete(), 1800)
        }
        return next
      })
    } else {
      // ── RED: score -1, shake animation, DO NOT remove ──
      if (field) {
        const el = field.querySelector(`[data-bid="${id}"]`)
        if (el) {
          // Shake + red glow animation
          el.style.animation = 'none'
          // Force reflow
          void el.offsetWidth
          el.classList.add('te-balloon-shake')
          setTimeout(() => {
            el.classList.remove('te-balloon-shake')
            // Re-allow popping after shake ends
            poppedRef.current.delete(id)
            // Restore float animation
            el.style.animation = ''
          }, 500)

          // Burst particles (red)
          const rect = el.getBoundingClientRect()
          const fieldRect = field.getBoundingClientRect()
          const cx = rect.left - fieldRect.left + rect.width / 2
          const cy = rect.top - fieldRect.top + rect.height / 2
          for (let i = 0; i < 8; i++) {
            const p = document.createElement('span')
            p.className = 'te-burst'
            p.style.left = cx + 'px'
            p.style.top = cy + 'px'
            p.style.setProperty('--angle', `${i * 45}deg`)
            p.style.setProperty('--clr', '#ef4444')
            field.appendChild(p)
            setTimeout(() => p.remove(), 500)
          }
        }
      }

      setMinusFlash(true)
      setTimeout(() => setMinusFlash(false), 500)
      setScore(prev => Math.max(0, prev - 1))
    }
  }, [onComplete])

  return (
    <div className="te-game" key="game">
      <div className="te-game-header">
        🎯 Pop the GREEN balloons ({score}/{TARGET_SCORE})
        <span className={`te-game-score${nearWin ? ' te-game-score--near' : ''}`}>
          Score: {score}<span className="te-game-target">/{TARGET_SCORE}</span>
        </span>
        {plusFlash && <span className="te-game-plus"> ✨+1!</span>}
        {minusFlash && <span className="te-game-minus"> ❌-1</span>}
      </div>
      <div className="te-game-field" ref={fieldRef}>
        {balloonsRef.current.map(b => (
          <div key={b.id}
            data-bid={b.id}
            className={`te-game-balloon ${b.isGreen ? 'green' : 'red'}`}
            style={{
              left: `${b.x}%`,
              '--gb-speed': `${b.speed}s`,
              '--gb-drift': `${b.drift}px`,
              '--gb-scale': b.scale,
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handlePop(b.id, b.isGreen)
            }}
          />
        ))}
      </div>
      {completed && (
        <div className="te-game-success">
          🎉 You did it!
          <div className="te-game-success-sub">All {TARGET_SCORE} green balloons popped!</div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   STEP CONFIGURATION
   ═══════════════════════════════════════════════════ */
const STEP_BUTTONS = [
  'Touch Me 🥳',          // 0  – initial
  'Balloons 🎈',          // 1  – after decorating
  'Cake 🎂',              // 2  – after balloons
  'Light Candle 🕯️',     // 3  – cake shown, candles off
  'Blow Candle 💨',       // 4  – candles lit
  'Release Balloons 🎈',  // 5  – candles blown
  'Play Game 🎮',         // 6  – balloons released
  null,                    // 7  – game active
  'Next 💖',              // 8  – message
  'Restart 🔄',           // 9  – final card
]

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
function TouchMeCTA() {
  const [step, setStep] = useState(0)
  const [btnState, setBtnState] = useState('idle')
  const confettiRef = useRef(null)

  /* ── HBD ARJ Audio Refs ── */
  const hbdAudioRef = useRef(null)
  const hbdFadeRef = useRef(null)      // current fade interval id
  const bgFadeRef = useRef(null)       // current bg fade interval id
  const isHbdPlayingRef = useRef(false) // rapid-click guard
  const bgTimeRef = useRef(0)          // 🔥 STORE background music timestamp

  /* ── Resume background music with fade-in from SAVED position ── */
  const resumeBgMusic = useCallback((duration = 1500) => {
    const bgAudio = window.__bgAudio
    if (!bgAudio) return
    // Clear any running bg fade first
    if (bgFadeRef.current) clearInterval(bgFadeRef.current)

    // 🔥 RESUME FROM SAVED TIMESTAMP (never reset to 0)
    bgAudio.currentTime = bgTimeRef.current || 0
    bgAudio.volume = 0
    bgAudio.play()
      .then(() => {
        setTimeout(() => {
          // Fade to 0.5 (matches AudioPlayer's target volume)
          bgFadeRef.current = fadeAudio(bgAudio, 0.5, duration, () => {
            bgFadeRef.current = null
          })
        }, 100)
      })
      .catch(() => { /* blocked until gesture — expected */ })
  }, [])

  /* ── Initialise HBD audio element (once) ── */
  useEffect(() => {
    const audio = new Audio('/HBD ARJ.mpeg')
    audio.preload = 'auto'
    audio.volume = 0
    hbdAudioRef.current = audio

    // 🎯 Auto-resume background when HBD ARJ ends naturally
    const handleEnded = () => {
      isHbdPlayingRef.current = false
      resumeBgMusic(1500)
    }
    audio.addEventListener('ended', handleEnded)

    return () => {
      // Cleanup on unmount
      audio.removeEventListener('ended', handleEnded)
      if (hbdFadeRef.current) clearInterval(hbdFadeRef.current)
      if (bgFadeRef.current) clearInterval(bgFadeRef.current)
      if (hbdAudioRef.current) {
        hbdAudioRef.current.pause()
        hbdAudioRef.current = null
      }
      isHbdPlayingRef.current = false
    }
  }, [resumeBgMusic])

  /* ── Stop HBD audio (with fade) — reusable ── */
  const stopHbdWithFade = useCallback((duration = 1500) => {
    const audio = hbdAudioRef.current
    if (!audio || audio.paused) {
      isHbdPlayingRef.current = false
      return
    }
    // Clear any existing fade
    if (hbdFadeRef.current) clearInterval(hbdFadeRef.current)
    hbdFadeRef.current = fadeAudio(audio, 0, duration, () => {
      isHbdPlayingRef.current = false
      hbdFadeRef.current = null
      audio.currentTime = 0  // Reset HBD to start (always replays from beginning)
    })
  }, [])

  /* ── Start HBD ARJ (with bg fade-out + HBD fade-in) ── */
  const startHbd = useCallback(() => {
    if (isHbdPlayingRef.current) return
    isHbdPlayingRef.current = true

    // 1. 🔥 SAVE current background time BEFORE fading out
    const bgAudio = window.__bgAudio
    if (bgAudio && !bgAudio.paused) {
      bgTimeRef.current = bgAudio.currentTime  // 🔥 SAVE POSITION
      if (bgFadeRef.current) clearInterval(bgFadeRef.current)
      bgFadeRef.current = fadeAudio(bgAudio, 0, 1200, () => {
        bgFadeRef.current = null
      })
    }

    // 2. Start HBD ARJ with fade-in
    const hbd = hbdAudioRef.current
    if (hbd) {
      // Clear any existing fade
      if (hbdFadeRef.current) clearInterval(hbdFadeRef.current)
      hbd.currentTime = 0
      hbd.volume = 0
      hbd.play()
        .then(() => {
          // Slight delay before fade-in so the play() settles
          setTimeout(() => {
            hbdFadeRef.current = fadeAudio(hbd, 1, 1500, () => {
              hbdFadeRef.current = null
            })
          }, 100)
        })
        .catch(() => {
          // Autoplay may be blocked until user gesture — expected
          isHbdPlayingRef.current = false
        })
    }
  }, [])

  /* ── Pre-generated balloon data ── */
  const balloonData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      hue: (i * 32 + 15) % 360,
      x: 4 + ((i * 8.2) % 88),
      sway: (i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 5),
      delay: i * 0.13,
      duration: 2.8 + (i % 4) * 0.45,
    })), [])

  /* ── Step advancement with loading → success → next ── */
  const advanceTo = useCallback((nextStep) => {
    setBtnState('loading')
    setTimeout(() => {
      setBtnState('success')
      setTimeout(() => {
        setStep(nextStep)
        setBtnState('idle')
      }, 380)
    }, 520)
  }, [])

  const handleClick = useCallback(() => {
    if (btnState !== 'idle') return
    if (step === 9) {
      window.dispatchEvent(new CustomEvent('timeline:hideFiller'))
      stopHbdWithFade(800)
      return advanceTo(0)
    }
    // Dispatch filler event when "Touch Me 🥳" is first clicked (step 0 → 1)
    if (step === 0) {
      window.dispatchEvent(new CustomEvent('timeline:showFiller'))
    }

    // 🎈 Balloon click (step 1): fade out bg, fade in HBD ARJ
    if (step === 1) {
      startHbd()
    }

    // 🎮 Play Game click (step 6 → 7): fade out HBD ARJ + resume bg music
    if (step === 6) {
      stopHbdWithFade(1500)
      // Resume background music after HBD ARJ fades (~1.6s delay)
      setTimeout(() => resumeBgMusic(1500), 1600)
    }

    advanceTo(step + 1)
  }, [step, btnState, advanceTo, startHbd, stopHbdWithFade, resumeBgMusic])

  const handleGameComplete = useCallback(() => {
    setStep(8)
    setBtnState('idle')
  }, [])

  const handleCelebrate = useCallback(() => {
    launchConfetti(confettiRef.current, 'heavy')
  }, [])

  const handleRestart = useCallback(() => {
    // Remove filler photo from timeline before resetting
    window.dispatchEvent(new CustomEvent('timeline:hideFiller'))
    // Stop HBD ARJ if still playing
    stopHbdWithFade(800)
    setStep(0)
    setBtnState('idle')
  }, [stopHbdWithFade])

  /* ── Confetti triggers ── */
  useEffect(() => {
    if (step === 4) {
      const t = setTimeout(() => launchConfetti(confettiRef.current, 'light'), 600)
      return () => clearTimeout(t)
    }
    if (step === 5) {
      const t = setTimeout(() => launchConfetti(confettiRef.current, 'light'), 700)
      return () => clearTimeout(t)
    }
  }, [step])

  /* ── Button content by state ── */
  const renderBtnContent = () => {
    if (btnState === 'loading') return <span className="te-btn-spinner" />
    if (btnState === 'success') return <span className="te-btn-check">✓</span>
    return <span className="te-btn-label">{STEP_BUTTONS[step]}</span>
  }

  return (
    <>
      <style>{experienceStyles}</style>
      <div className="te-wrapper">
        <canvas ref={confettiRef} className="te-confetti" />

        {/* ════════ STEP CONTENT ════════ */}
        <div className="te-content">



          {/* STEP 1 — Decorating */}
          {step === 1 && (
            <div className="te-step" key="s1">
              <div className="te-banner">
                {Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="te-flag"
                    style={{ '--fhue': (i * 40) % 360, animationDelay: `${i * 0.08}s` }} />
                ))}
              </div>
              <h3 className="te-heading">Decorating... ✨</h3>
            </div>
          )}

          {/* STEP 2 — Balloons */}
          {step === 2 && (
            <div className="te-step" key="s2">
              <div className="te-balloon-field">
                {balloonData.map((b, i) => (
                  <div key={i} className="te-balloon"
                    style={{
                      '--bhue': b.hue, '--sway': `${b.sway}px`,
                      left: `${b.x}%`,
                      animationDelay: `${b.delay}s`,
                      animationDuration: `${b.duration}s`,
                    }} />
                ))}
              </div>
              <h3 className="te-heading">🎈 Here they come!</h3>
            </div>
          )}

          {/* STEPS 3-5 — Cake experience (persists across these steps) */}
          {step >= 3 && step <= 5 && (
            <div className="te-step" key="cake">
              <BlackForestCake candlesLit={step >= 4} candlesBlown={step >= 5} />
              <h3 className="te-heading te-heading--glow" key={`ch${step}`}>
                {step === 3 && 'Think of a wish... 💫'}
                {step === 4 && 'Make a wish... then blow 💨'}
                {step === 5 && 'Happy Birthday Beautiful ❤️'}
              </h3>
              {step === 5 && <p className="te-subtext">Wish granted 💖</p>}
            </div>
          )}

          {/* STEP 6 — Release balloons */}
          {step === 6 && (
            <div className="te-step" key="s6">
              <div className="te-balloon-field">
                {balloonData.map((b, i) => (
                  <div key={i} className="te-balloon te-balloon--release"
                    style={{ '--bhue': b.hue, left: `${b.x}%`, animationDelay: `${i * 0.06}s` }} />
                ))}
              </div>
              <h3 className="te-heading">Goodbye balloons! 👋</h3>
            </div>
          )}

          {/* STEP 7 — Game */}
          {step === 7 && <BalloonGame key="s7" onComplete={handleGameComplete} />}

          {/* STEP 8 — Message */}
          {step === 8 && (
            <div className="te-step" key="s8">
              <h3 className="te-heading te-heading--glow te-heading--lg">
                Once Again Happy Birthday Madam !!🤗
              </h3>
            </div>
          )}

          {/* STEP 9 — Final card */}
          {step === 9 && (
            <div className="te-step" key="s9">
              <div className="te-glass-card">
                <h3 className="te-card-title">From Diary 💖</h3>
                <p className="te-card-text">
                  “Ek arzoo hai ki us arju ki sab arzoo puri ho,
                  Jis arzoo ko hasil karne mein usne sab arzooein pichhe chhodi ho.”
                  <br /> Something between us needs attention… before it turns into complete silence.
                  <br />Happy Birthday, Madam. 💕
                </p>
                <div className="te-card-btns">
                  <button className="te-card-btn te-card-btn--celebrate" onClick={handleCelebrate}>
                    Celebrate 🎉
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════════ CTA BUTTON ════════ */}
        {STEP_BUTTONS[step] !== null && (
          <div className="te-btn-wrap">
            <button
              className={`te-btn te-btn--${btnState}`}
              id="touch-me-cta"
              onClick={handleClick}
              type="button"
              disabled={btnState !== 'idle'}
              aria-label={STEP_BUTTONS[step]}
            >
              <span className="te-btn-ripple" />
              {renderBtnContent()}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default TouchMeCTA

/* ═══════════════════════════════════════════════════
   SCOPED STYLES — all .te- / .bf- prefixed
   ═══════════════════════════════════════════════════ */
const experienceStyles = `

/* ═══════ LAYOUT ═══════ */
.te-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: clamp(30px, 5vw, 60px) auto;
  padding: 0 1rem;
  box-sizing: border-box;
  z-index: 5;
}
.te-confetti {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 60;
}
.te-content {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
.te-step {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 1.5rem 0;
  animation: teFadeIn 0.65s ease-out;
  position: relative;
}

/* ═══════ TYPOGRAPHY ═══════ */
.te-heading {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(1.15rem, 3vw, 1.7rem);
  font-weight: 700;
  color: #fff;
  text-align: center;
  margin: 1rem 0 0;
  text-shadow: 0 2px 10px rgba(0,0,0,0.35);
  animation: teFadeIn 0.7s ease-out 0.25s both;
}
.te-heading--glow {
  text-shadow:
    0 0 18px rgba(168,85,247,0.55),
    0 0 40px rgba(124,58,237,0.3),
    0 2px 10px rgba(0,0,0,0.35);
}
.te-heading--lg { font-size: clamp(1.35rem, 4vw, 2.1rem); }

.te-subtext {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  font-weight: 500;
  color: rgba(200,162,200,0.85);
  text-align: center;
  margin-top: 0.4rem;
  font-style: italic;
  animation: teFadeIn 0.6s ease-out 0.3s both;
  text-shadow: 0 0 10px rgba(200,162,200,0.3);
}

/* ═══════ STEP 1 — BANNERS ═══════ */
.te-banner {
  display: flex;
  justify-content: center;
  gap: clamp(6px, 1.8vw, 14px);
  flex-wrap: wrap;
  margin-bottom: 0.8rem;
}
.te-flag {
  width: 0; height: 0;
  border-left: clamp(10px, 2vw, 16px) solid transparent;
  border-right: clamp(10px, 2vw, 16px) solid transparent;
  border-top: clamp(18px, 3vw, 28px) solid hsl(var(--fhue, 270), 72%, 62%);
  filter: drop-shadow(0 3px 8px rgba(0,0,0,0.25));
  animation: teFlagDrop 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
  transform-origin: top center;
}

/* ═══════ STEPS 2 & 6 — BALLOONS ═══════ */
.te-balloon-field {
  position: relative;
  width: 100%;
  height: clamp(220px, 35vw, 310px);
  overflow: visible;
}
.te-balloon {
  position: absolute;
  bottom: 0;
  width: clamp(32px, 5.5vw, 48px);
  height: clamp(42px, 7.5vw, 62px);
  background: hsl(var(--bhue, 270), 78%, 62%);
  border-radius: 50% 50% 50% 50% / 58% 58% 42% 42%;
  box-shadow:
    inset -7px -3px 10px rgba(0,0,0,0.15),
    inset 5px 5px 8px rgba(255,255,255,0.22),
    0 4px 14px rgba(0,0,0,0.2);
  animation: teBalloonFloat ease-in-out both;
  will-change: transform;
  transform: translateZ(0);
}
.te-balloon::after {
  content: '';
  position: absolute;
  bottom: -14px; left: 50%;
  width: 1px; height: 14px;
  background: rgba(255,255,255,0.35);
  transform: translateX(-50%);
}
.te-balloon--release {
  animation: teBalloonRelease 1.8s ease-in both !important;
}

/* ═══════════════════════════════════════════
   BLACK FOREST CAKE
   ═══════════════════════════════════════════ */

.bf-scene {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0 0;
  animation: teFadeIn 0.8s ease-out;
}

/* Ambient glow when candles are lit */
.bf-glow {
  position: absolute;
  top: -10%;
  left: 50%;
  transform: translateX(-50%);
  width: 180%;
  height: 180%;
  background: radial-gradient(
    ellipse at 50% 25%,
    rgba(255,180,50,0.1) 0%,
    rgba(255,120,0,0.04) 35%,
    transparent 65%
  );
  pointer-events: none;
  animation: teWarmGlow 2s ease-in-out infinite alternate;
  z-index: 0;
}

/* Wind streak on blow */
.bf-wind {
  position: absolute;
  top: 8%;
  left: 0;
  width: 100%;
  height: 30%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(200,225,255,0.07) 30%,
    rgba(200,225,255,0.12) 50%,
    rgba(200,225,255,0.07) 70%,
    transparent 100%
  );
  border-radius: 50%;
  animation: teWindStreak 0.85s ease-out forwards;
  pointer-events: none;
  z-index: 10;
}

/* Cake wrapper — floats gently */
.bf-cake {
  position: relative;
  width: clamp(200px, 52vw, 280px);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: teCakeFloat 3.5s ease-in-out infinite;
  z-index: 2;
}

/* ── Candle row ── */
.bf-candles {
  display: flex;
  justify-content: center;
  gap: clamp(22px, 9vw, 55px);
  padding-bottom: 2px;
}
.bf-candle {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bf-stick {
  width: clamp(7px, 1.8vw, 10px);
  height: clamp(28px, 7vw, 40px);
  border-radius: 2px 2px 1px 1px;
  background: linear-gradient(
    90deg,
    hsl(calc(var(--ci) * 115 + 330), 65%, 62%) 0%,
    hsl(calc(var(--ci) * 115 + 330), 65%, 78%) 45%,
    hsl(calc(var(--ci) * 115 + 330), 65%, 62%) 100%
  );
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.bf-wick {
  width: 1.5px;
  height: 5px;
  background: #333;
  border-radius: 0 0 1px 1px;
}

/* ── Flame ── */
.bf-flame {
  width: clamp(8px, 2.2vw, 12px);
  height: clamp(16px, 4vw, 22px);
  position: relative;
  animation: teFlameIn 0.5s ease-out both;
}
.bf-flame::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    #ff4500 0%, #ff7b00 30%, #ffd700 70%, rgba(255,250,220,0.7) 100%
  );
  border-radius: 50% 50% 50% 50% / 65% 65% 35% 35%;
  animation: teFlicker 0.18s ease-in-out infinite alternate;
  filter: blur(0.4px);
  box-shadow:
    0 0 6px rgba(255,165,0,0.7),
    0 0 16px rgba(255,100,0,0.35),
    0 0 30px rgba(255,80,0,0.12);
}
.bf-flame::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 35%;
  height: 42%;
  background: linear-gradient(to top, #6495ED, rgba(200,220,255,0.8));
  border-radius: 50% 50% 50% 50% / 55% 55% 45% 45%;
  filter: blur(0.3px);
}

/* Blown flame exit */
.bf-flame.out {
  animation: teFlameOut 0.5s ease-in both;
}
.bf-flame.out::before {
  animation: none;
}

/* ── Smoke particles ── */
.bf-smoke-wrap {
  display: flex;
  gap: 3px;
  height: 0;
  position: relative;
}
.bf-smoke {
  width: 5px;
  height: 5px;
  background: rgba(180,180,180,0.5);
  border-radius: 50%;
  position: absolute;
  bottom: 0;
  opacity: 0;
  animation: teSmokeRise 1.2s ease-out both;
}
.bf-smoke:nth-child(2) { left: -4px; }
.bf-smoke:nth-child(3) { left: 4px; }

/* ── Cream top surface ── */
.bf-top {
  position: relative;
  width: 100%;
  height: clamp(15px, 3.5vw, 22px);
  background: linear-gradient(
    180deg,
    #FFF8E7 0%, #FDF1D5 50%, #F5E6C0 100%
  );
  border-radius: 3px 3px 0 0;
  box-shadow:
    inset 0 -2px 4px rgba(0,0,0,0.08),
    0 -1px 3px rgba(255,255,255,0.08);
  z-index: 1;
}
/* Cream swirls */
.bf-swirl {
  position: absolute;
  width: clamp(11px, 2.8vw, 16px);
  height: clamp(11px, 2.8vw, 16px);
  background: radial-gradient(circle at 40% 35%, #FFFDF5 35%, #FFF3D9 100%);
  border-radius: 50%;
  top: -45%;
  left: calc(6% + var(--si) * 11.5%);
  box-shadow:
    0 1px 3px rgba(0,0,0,0.12),
    inset 0 -1px 2px rgba(0,0,0,0.04);
  z-index: 2;
}
/* Cherries */
.bf-cherry {
  position: absolute;
  width: clamp(9px, 2.2vw, 13px);
  height: clamp(9px, 2.2vw, 13px);
  background: radial-gradient(circle at 35% 35%, #EF5350, #C62828);
  border-radius: 50%;
  top: -55%;
  left: calc(14% + var(--chi) * 17%);
  box-shadow:
    0 1px 3px rgba(0,0,0,0.3),
    inset 0 1px 2px rgba(255,255,255,0.15);
  z-index: 3;
}
.bf-cherry::after {
  content: '';
  position: absolute;
  top: 18%;
  left: 28%;
  width: 22%;
  height: 22%;
  background: rgba(255,255,255,0.5);
  border-radius: 50%;
}

/* ── Cake body ── */
.bf-body {
  position: relative;
  width: 100%;
  height: clamp(95px, 24vw, 135px);
  background: linear-gradient(
    180deg,
    #4E2A0E 0%, #3B1E08 12%,
    #4A2710 48%, #3B1E08 52%,
    #4A2710 88%, #3B1E08 100%
  );
  border-radius: 0 0 10px 10px;
  overflow: hidden;
  box-shadow:
    0 10px 30px rgba(0,0,0,0.45),
    inset 0 1px 3px rgba(255,255,255,0.05);
}
/* Gloss highlight */
.bf-body::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 28%;
  background: linear-gradient(180deg, rgba(255,255,255,0.06), transparent);
  pointer-events: none;
  z-index: 1;
}
/* Cream layer lines */
.bf-cream-line {
  position: absolute;
  left: 0;
  width: 100%;
  height: 6px;
  background: linear-gradient(
    90deg,
    transparent 3%,
    #FFF8E7 5%, #FFF3D9 50%, #FFF8E7 95%,
    transparent 97%
  );
  opacity: 0.8;
}
/* Chocolate shavings texture */
.bf-shavings {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(
      -50deg, transparent, transparent 3px,
      rgba(75,38,12,0.25) 3px, rgba(75,38,12,0.25) 4px
    ),
    repeating-linear-gradient(
      40deg, transparent, transparent 5px,
      rgba(85,45,18,0.18) 5px, rgba(85,45,18,0.18) 6px
    );
  pointer-events: none;
  z-index: 0;
}
/* "Arju" cream piped text */
.bf-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Georgia', 'Palatino Linotype', 'Times New Roman', serif;
  font-style: italic;
  font-size: clamp(1.1rem, 3.2vw, 1.6rem);
  font-weight: 700;
  color: #FFF5E1;
  text-shadow:
    1px 1px 0 rgba(200,170,120,0.55),
    0 2px 4px rgba(0,0,0,0.35),
    0 0 10px rgba(255,248,231,0.2);
  letter-spacing: 2px;
  z-index: 3;
  user-select: none;
}

/* Ground shadow */
.bf-shadow {
  width: 82%;
  max-width: 240px;
  height: 12px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.22), transparent 70%);
  border-radius: 50%;
  margin-top: 5px;
  animation: teShadowPulse 3.5s ease-in-out infinite;
}

/* ═══════ STEP 7 — GAME (infinite mini-game) ═══════ */
.te-game {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: teFadeIn 0.5s ease-out;
}
.te-game-header {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(0.95rem, 2.5vw, 1.25rem);
  font-weight: 600;
  color: #a855f7;
  text-align: center;
  margin-bottom: 1rem;
  text-shadow: 0 0 12px rgba(168,85,247,0.3);
  min-height: 2em;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5em;
}
.te-game-score {
  display: inline-block;
  background: rgba(168,85,247,0.18);
  border: 1px solid rgba(168,85,247,0.3);
  padding: 0.15em 0.7em;
  border-radius: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 0.95em;
  color: #c084fc;
  text-shadow: 0 0 8px rgba(168,85,247,0.4);
  transition: all 0.4s ease;
}
.te-game-score--near {
  background: rgba(250,204,21,0.2);
  border-color: rgba(250,204,21,0.5);
  color: #fbbf24;
  text-shadow: 0 0 12px rgba(250,204,21,0.5);
  animation: teNearWinPulse 1s ease-in-out infinite;
}
.te-game-target {
  opacity: 0.7;
  font-weight: 600;
  font-size: 0.92em;
  color: rgba(192,132,252,0.75);
}
.te-game-score--near .te-game-target {
  color: rgba(251,191,36,0.8);
}
.te-game-plus {
  color: #22c55e;
  font-weight: 700;
  animation: tePopIn 0.4s ease-out;
}
.te-game-minus {
  color: #ef4444;
  font-weight: 700;
  animation: tePopIn 0.4s ease-out;
}
.te-game-field {
  position: relative;
  width: 100%;
  height: clamp(280px, 42vw, 380px);
  overflow: hidden;
  border-radius: 16px;
  background: rgba(0,0,0,0.12);
  border: 1px solid rgba(168,85,247,0.2);
}
.te-game-balloon {
  position: absolute;
  bottom: -85px;
  width: clamp(48px, 9vw, 64px);
  height: clamp(62px, 12vw, 82px);
  border-radius: 50% 50% 50% 50% / 58% 58% 42% 42%;
  cursor: pointer;
  pointer-events: auto;
  will-change: transform, opacity;
  transform: translateZ(0) scale(var(--gb-scale, 1));
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  animation: teGameFloat var(--gb-speed, 4s) linear both;
  transition: filter 0.08s;
  user-select: none;
}
.te-game-balloon::after {
  content: '';
  position: absolute;
  bottom: -16px; left: 50%;
  width: 1px; height: 16px;
  background: rgba(255,255,255,0.3);
  transform: translateX(-50%);
}
/* Green balloon — pulsing glow hint */
.te-game-balloon.green {
  background: linear-gradient(145deg, #22c55e, #15803d);
  box-shadow:
    inset -5px -3px 8px rgba(0,0,0,0.15),
    inset 4px 4px 7px rgba(255,255,255,0.2),
    0 0 14px rgba(34,197,94,0.35);
  animation:
    teGameFloat var(--gb-speed, 4s) linear both,
    teGreenGlow 1.2s ease-in-out infinite alternate;
}
.te-game-balloon.red {
  background: linear-gradient(145deg, #ef4444, #b91c1c);
  box-shadow:
    inset -5px -3px 8px rgba(0,0,0,0.15),
    inset 4px 4px 7px rgba(255,255,255,0.2),
    0 0 14px rgba(239,68,68,0.3);
}
.te-game-balloon:active { filter: brightness(1.25) !important; }
/* Red balloon shake on wrong click */
.te-balloon-shake {
  animation: teBalloonShake 0.5s ease-in-out !important;
  filter: brightness(1.3) drop-shadow(0 0 12px rgba(239,68,68,0.7)) !important;
}
/* Burst particle */
.te-burst {
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--clr, #fff);
  pointer-events: none;
  z-index: 10;
  animation: teBurst 0.45s ease-out forwards;
  transform: translate(-50%,-50%) rotate(var(--angle, 0deg));
}
.te-game-success {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(1.2rem, 3vw, 1.7rem);
  font-weight: 700;
  color: #22c55e;
  text-align: center;
  margin-top: 1rem;
  animation: tePopIn 0.5s cubic-bezier(0.34,1.56,0.64,1), teWinGlow 1.5s ease-in-out 0.5s infinite alternate;
  text-shadow: 0 0 18px rgba(34,197,94,0.5);
}
.te-game-success-sub {
  font-size: clamp(0.75rem, 2vw, 0.95rem);
  font-weight: 500;
  color: rgba(34,197,94,0.7);
  margin-top: 0.35rem;
  animation: teFadeIn 0.6s ease-out 0.4s both;
}

/* ═══════ STEP 9 — GLASS CARD ═══════ */
.te-glass-card {
  width: 92%;
  max-width: 440px;
  background: rgba(255,255,255,0.07);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 24px;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  text-align: center;
  animation: teCardAppear 0.8s cubic-bezier(0.22,1,0.36,1);
  box-shadow:
    0 20px 60px rgba(0,0,0,0.3),
    0 0 40px rgba(168,85,247,0.12);
}
.te-card-title {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(1.3rem, 3.5vw, 1.9rem);
  font-weight: 800;
  background: linear-gradient(135deg, #a855f7, #ec4899, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 1rem;
}
.te-card-text {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(0.82rem, 1.8vw, 0.98rem);
  font-weight: 400;
  color: rgba(255,255,255,0.85);
  line-height: 1.75;
  margin: 0 0 1.5rem;
}
.te-card-btns {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}
.te-card-btn {
  font-family: 'Poppins', sans-serif;
  font-size: clamp(0.82rem, 1.8vw, 0.95rem);
  font-weight: 600;
  border: none;
  border-radius: 14px;
  padding: 0.75rem 1.4rem;
  cursor: pointer;
  min-height: 44px;
  will-change: transform;
  transition: all 0.25s ease;
  -webkit-tap-highlight-color: transparent;
}
.te-card-btn--celebrate {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #fff;
  box-shadow: 0 4px 18px rgba(168,85,247,0.4);
}

.te-card-btn:active { transform: scale(0.95); }
@media (hover: hover) and (pointer: fine) {
  .te-card-btn--celebrate:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 28px rgba(168,85,247,0.6);
  }

}

/* ═══════ CTA BUTTON ═══════ */
.te-btn-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: clamp(16px, 3vw, 32px);
}
.te-btn {
  appearance: none;
  border: none;
  outline: none;
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
  font-size: clamp(14px, 2.5vw, 18px);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fff;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  min-height: 48px;
  padding: clamp(12px, 2vw, 18px) clamp(28px, 5vw, 52px);
  border-radius: 999px;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  box-shadow:
    0 0 20px rgba(168,85,247,0.35),
    0 0 50px rgba(124,58,237,0.15),
    0 8px 32px rgba(0,0,0,0.25);
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
  will-change: transform;
  transform: translateZ(0);
  transition:
    transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
    box-shadow 0.35s ease,
    background 0.35s ease;
  position: relative;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}
/* Shimmer */
.te-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(
    120deg,
    transparent 0%, rgba(255,255,255,0.15) 40%,
    rgba(255,255,255,0.28) 50%, rgba(255,255,255,0.15) 60%,
    transparent 100%
  );
  border-radius: inherit;
  animation: teShimmer 4s ease-in-out infinite 1.5s;
  pointer-events: none;
}
/* Ripple layer */
.te-btn-ripple {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  overflow: hidden;
}
.te-btn:active .te-btn-ripple::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 120%; padding-top: 120%;
  border-radius: 50%;
  background: rgba(255,255,255,0.22);
  transform: translate(-50%,-50%) scale(0);
  animation: teRipple 0.55s ease-out;
}
/* States */
.te-btn--idle { animation: teBtnPulse 3s ease-in-out infinite; }
.te-btn--loading { pointer-events: none; animation: none; }
.te-btn--loading::before { animation: none; opacity: 0; }
.te-btn--success {
  pointer-events: none;
  animation: none;
  background: linear-gradient(135deg, #22c55e, #15803d);
}
.te-btn--success::before { animation: none; opacity: 0; }
.te-btn[disabled] { pointer-events: none; }
/* Spinner */
.te-btn-spinner {
  display: block;
  width: 20px; height: 20px;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: teSpin 0.55s linear infinite;
}
/* Checkmark */
.te-btn-check {
  font-size: 1.2em;
  font-weight: 800;
  animation: tePopIn 0.35s cubic-bezier(0.34,1.56,0.64,1);
}
/* Label text */
.te-btn-label { animation: teLabelIn 0.3s ease-out; }
/* Hover desktop only */
@media (hover: hover) and (pointer: fine) {
  .te-btn--idle:hover {
    transform: scale(1.05) translateZ(0);
    box-shadow:
      0 0 30px rgba(168,85,247,0.55),
      0 0 70px rgba(124,58,237,0.25),
      0 12px 40px rgba(0,0,0,0.3);
    animation: none;
  }
}
.te-btn:active { transform: scale(0.96) translateZ(0); transition-duration: 0.1s; }
.te-btn:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(168,85,247,0.6),
    0 0 30px rgba(168,85,247,0.45),
    0 0 60px rgba(124,58,237,0.2);
  animation: none;
}
/* Responsive widths */
@media (max-width: 480px) { .te-btn { width: 85%; max-width: 340px; } }
@media (min-width: 481px) and (max-width: 768px) { .te-btn { width: auto; min-width: 60%; max-width: 400px; } }
@media (min-width: 769px) { .te-btn { width: fit-content; } }

/* ═══════════════════════════════════════════
   KEYFRAMES
   ═══════════════════════════════════════════ */

@keyframes teFadeIn {
  from { opacity: 0; transform: translateY(18px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
@keyframes teFlagDrop {
  from { opacity: 0; transform: scaleY(0) translateY(-18px); }
  to   { opacity: 1; transform: scaleY(1) translateY(0); }
}
@keyframes teBalloonFloat {
  0%   { transform: translateY(30px)   translateX(0);                               opacity: 0; }
  8%   {                                                                            opacity: 1; }
  25%  { transform: translateY(-55px)  translateX(var(--sway, 12px));                           }
  50%  { transform: translateY(-135px) translateX(calc(var(--sway, 12px) * -0.65));             }
  75%  { transform: translateY(-215px) translateX(calc(var(--sway, 12px) * 0.8));               }
  100% { transform: translateY(-275px) translateX(0);                               opacity: 1; }
}
@keyframes teBalloonRelease {
  0%   { opacity: 1; transform: translateY(0)     scale(1);    }
  100% { opacity: 0; transform: translateY(-500px) scale(0.45); }
}

/* ── Cake ── */
@keyframes teCakeFloat {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-7px); }
}
@keyframes teShadowPulse {
  0%, 100% { transform: scaleX(1);   opacity: 1;   }
  50%      { transform: scaleX(0.88); opacity: 0.65; }
}

/* ── Flame ── */
@keyframes teFlameIn {
  0%   { transform: scaleY(0) scaleX(0.4); opacity: 0; }
  60%  { transform: scaleY(1.15) scaleX(0.85); opacity: 1; }
  100% { transform: scaleY(1) scaleX(1); opacity: 1; }
}
@keyframes teFlameOut {
  0%   { transform: scaleY(1) scaleX(1); opacity: 1; }
  40%  { transform: scaleY(1.2) scaleX(0.3); opacity: 0.6; }
  100% { transform: scaleY(0) scaleX(0); opacity: 0; }
}
@keyframes teFlicker {
  0%   { transform: scaleY(1)    scaleX(1);    }
  25%  { transform: scaleY(1.06) scaleX(0.95); }
  50%  { transform: scaleY(0.94) scaleX(1.03); }
  75%  { transform: scaleY(1.04) scaleX(0.97); }
  100% { transform: scaleY(0.97) scaleX(1.02); }
}

/* ── Smoke ── */
@keyframes teSmokeRise {
  0%   { transform: translateY(0)     scale(1);   opacity: 0;   }
  15%  {                                           opacity: 0.6; }
  100% { transform: translateY(-35px) scale(2.2);  opacity: 0;   }
}

/* ── Wind streak ── */
@keyframes teWindStreak {
  0%   { transform: translateX(-120%); opacity: 0.7; }
  100% { transform: translateX(120%);  opacity: 0;   }
}
@keyframes teWarmGlow {
  0%   { opacity: 0.6; }
  100% { opacity: 1;   }
}

/* ── Game (infinite) ── */
@keyframes teGameFloat {
  0%   {
    transform: translateY(0) translateX(0) scale(var(--gb-scale, 1));
    opacity: 0;
  }
  5%   { opacity: 1; }
  50%  {
    transform: translateY(-240px) translateX(var(--gb-drift, 0px)) scale(var(--gb-scale, 1));
  }
  90%  { opacity: 1; }
  100% {
    transform: translateY(-520px) translateX(0px) scale(var(--gb-scale, 1));
    opacity: 0;
  }
}
@keyframes teGreenGlow {
  0%   { box-shadow: inset -5px -3px 8px rgba(0,0,0,0.15), inset 4px 4px 7px rgba(255,255,255,0.2), 0 0 14px rgba(34,197,94,0.35); }
  100% { box-shadow: inset -5px -3px 8px rgba(0,0,0,0.15), inset 4px 4px 7px rgba(255,255,255,0.2), 0 0 26px rgba(34,197,94,0.65), 0 0 42px rgba(34,197,94,0.2); }
}
@keyframes teBurst {
  0%   { opacity: 1; transform: translate(-50%,-50%) rotate(var(--angle, 0deg)) translateY(0); }
  100% { opacity: 0; transform: translate(-50%,-50%) rotate(var(--angle, 0deg)) translateY(-38px); }
}
@keyframes teNearWinPulse {
  0%, 100% {
    box-shadow: 0 0 8px rgba(250,204,21,0.3);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 18px rgba(250,204,21,0.6), 0 0 30px rgba(250,204,21,0.2);
    transform: scale(1.04);
  }
}
@keyframes teWinGlow {
  0%   { text-shadow: 0 0 18px rgba(34,197,94,0.5); }
  100% { text-shadow: 0 0 28px rgba(34,197,94,0.8), 0 0 50px rgba(34,197,94,0.3); }
}
@keyframes teBalloonPop {
  0%   { transform: scale(1);    opacity: 1; }
  40%  { transform: scale(1.45); opacity: 0.7; }
  100% { transform: scale(0);    opacity: 0; }
}
@keyframes teBalloonShake {
  0%, 100% { transform: translateX(0); }
  15%  { transform: translateX(-9px); }
  35%  { transform: translateX(9px); }
  55%  { transform: translateX(-6px); }
  75%  { transform: translateX(6px); }
}

/* ── Card ── */
@keyframes teCardAppear {
  from { opacity: 0; transform: translateY(28px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}

/* ── Button ── */
@keyframes teBtnPulse {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(168,85,247,0.35),
      0 0 50px rgba(124,58,237,0.15),
      0 8px 32px rgba(0,0,0,0.25);
  }
  50% {
    box-shadow:
      0 0 32px rgba(168,85,247,0.55),
      0 0 72px rgba(124,58,237,0.25),
      0 8px 32px rgba(0,0,0,0.25);
  }
}
@keyframes teShimmer {
  0%       { left: -100%; }
  50%, 100% { left: 200%; }
}
@keyframes teRipple {
  0%   { transform: translate(-50%,-50%) scale(0);   opacity: 1; }
  100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0; }
}
@keyframes teSpin { to { transform: rotate(360deg); } }
@keyframes tePopIn {
  0%   { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes teLabelIn {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}
`
