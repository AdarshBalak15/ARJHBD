import { useState, useEffect, useRef, useMemo, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import Typed from 'typed.js'

/* ─── CSS Keyframes ─── */
const keyframes = `
@keyframes heartBeat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.08); }
  30% { transform: scale(1); }
  45% { transform: scale(1.05); }
  60% { transform: scale(1); }
}
@keyframes floatParticle {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
  25% { transform: translate(15px, -20px) scale(1.2); opacity: 1; }
  50% { transform: translate(-10px, -35px) scale(0.8); opacity: 0.4; }
  75% { transform: translate(20px, -15px) scale(1.1); opacity: 0.8; }
}
@keyframes radialPulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.15); }
}
@keyframes vignetteIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
}
@keyframes buttonGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(157,78,221,0.3), 0 0 40px rgba(142,45,226,0.15); }
  50% { box-shadow: 0 0 35px rgba(157,78,221,0.5), 0 0 70px rgba(142,45,226,0.25); }
}
@keyframes videoGlowPulse {
  0%, 100% { box-shadow: 0 0 30px rgba(157,78,221,0.2), 0 0 60px rgba(15,48,87,0.3); }
  50% { box-shadow: 0 0 50px rgba(157,78,221,0.35), 0 0 90px rgba(15,48,87,0.45); }
}
@keyframes videoPlayBtnPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 30px rgba(157,78,221,0.4); }
  50% { transform: translate(-50%, -50%) scale(1.08); box-shadow: 0 0 50px rgba(157,78,221,0.6); }
}
@keyframes cinematicGlow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
@keyframes heartGlowPulse {
  0%   { box-shadow: 0 0 20px rgba(255, 60, 120, 0.55), 0 0 50px rgba(255, 0, 80, 0.3); }
  50%  { box-shadow: 0 0 40px rgba(255, 60, 120, 0.85), 0 0 90px rgba(255, 0, 80, 0.5); }
  100% { box-shadow: 0 0 20px rgba(255, 60, 120, 0.55), 0 0 50px rgba(255, 0, 80, 0.3); }
}
@keyframes emojiFloat {
  0%   { opacity: 1; transform: translate(var(--ex), var(--ey)) scale(1) rotate(var(--er)); }
  70%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(calc(var(--ex) * 1.6), calc(var(--ey) * 1.6)) scale(0.4) rotate(calc(var(--er) * 2)); }
}

canvas {
  pointer-events: none !important;
}

/* ─── Mobile-Only Antigravity Video Reveal ─── */
@media (max-width: 768px) {
  /* Initial hidden state — video wrapper starts offset */
  .video-antigravity-wrapper {
    opacity: 0;
    transform: translateY(60px) scale(0.92) rotate3d(1, 0, 0, 4deg);
    filter: blur(6px);
    will-change: transform, opacity, filter;
    transition: none; /* Transitions are added only when animating */
  }

  /* Animated state — triggered by IntersectionObserver */
  .video-antigravity-wrapper.antigravity-revealed {
    opacity: 1;
    transform: translateY(0) scale(1) rotate3d(1, 0, 0, 0deg);
    filter: blur(0px);
    transition:
      opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1),
      transform 1.2s cubic-bezier(0.16, 1, 0.3, 1),
      filter 0.9s cubic-bezier(0.33, 1, 0.68, 1);
  }

  /* Soft glow bloom behind video during reveal */
  .video-antigravity-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 140%;
    height: 140%;
    transform: translate(-50%, -50%) scale(0.6);
    background: radial-gradient(
      ellipse,
      rgba(157, 78, 221, 0.25),
      rgba(142, 45, 226, 0.1) 40%,
      transparent 70%
    );
    filter: blur(40px);
    opacity: 0;
    pointer-events: none;
    z-index: 0;
    transition: none;
  }

  .video-antigravity-wrapper.antigravity-revealed .video-antigravity-glow {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    transition:
      opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s,
      transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
  }

  /* After reveal completes — gentle play button pulse enhancement */
  .video-antigravity-wrapper.antigravity-complete .video-play-btn-mobile {
    animation: mobilePlayPulse 2.2s ease-in-out infinite 0.3s;
  }

  @keyframes mobilePlayPulse {
    0%, 100% {
      transform: translate(-50%, -50%) scale(1);
      box-shadow:
        0 0 30px rgba(157, 78, 221, 0.4),
        0 0 60px rgba(142, 45, 226, 0.15);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.12);
      box-shadow:
        0 0 45px rgba(157, 78, 221, 0.65),
        0 0 80px rgba(142, 45, 226, 0.3);
    }
  }

  /* Video label float-up after reveal */
  .video-antigravity-label {
    opacity: 0;
    transform: translateY(16px);
    transition: none;
  }

  .video-antigravity-wrapper.antigravity-revealed .video-antigravity-label {
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.7s,
      transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.7s;
  }
}

/* Desktop: ensure wrapper classes have no effect */
@media (min-width: 769px) {
  .video-antigravity-wrapper,
  .video-antigravity-wrapper.antigravity-revealed,
  .video-antigravity-wrapper.antigravity-complete {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    transition: none !important;
  }
  .video-antigravity-glow {
    display: none !important;
  }
  .video-antigravity-label {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
`

/* ─── 3D Heart Shape Geometry ─── */
function createHeartShape() {
  const shape = new THREE.Shape()
  const x = 0, y = 0
  shape.moveTo(x, y + 0.5)
  shape.bezierCurveTo(x, y + 0.5, x - 0.1, y + 1.1, x - 0.65, y + 1.1)
  shape.bezierCurveTo(x - 1.3, y + 1.1, x - 1.3, y + 0.5, x - 1.3, y + 0.5)
  shape.bezierCurveTo(x - 1.3, y, x, y - 0.7, x, y - 1.3)
  shape.bezierCurveTo(x, y - 0.7, x + 1.3, y, x + 1.3, y + 0.5)
  shape.bezierCurveTo(x + 1.3, y + 0.5, x + 1.3, y + 1.1, x + 0.65, y + 1.1)
  shape.bezierCurveTo(x + 0.1, y + 1.1, x, y + 0.5, x, y + 0.5)
  return shape
}

/* ─── 3D Rotating Glowing Heart — phase-driven cinematic ─── */
// heartAnimPhase: 'idle' | 'grow' | 'burst' | 'hidden'
function GlowingHeart({ heartAnimPhase }) {
  const meshRef = useRef()
  const matRef = useRef()
  const heartShape = useMemo(() => createHeartShape(), [])

  const geometry = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.45,
      bevelEnabled: true,
      bevelSegments: 12,
      bevelSize: 0.12,
      bevelThickness: 0.08,
      curveSegments: 32,
    })
    geo.center()
    return geo
  }, [heartShape])

  // Track grow/burst start time
  const phaseStartRef = useRef(null)
  const prevPhaseRef = useRef('idle')

  useFrame((state) => {
    if (!meshRef.current || !matRef.current) return
    const mesh = meshRef.current
    const mat = matRef.current
    const now = state.clock.elapsedTime

    // Record when phase changed
    if (prevPhaseRef.current !== heartAnimPhase) {
      phaseStartRef.current = now
      prevPhaseRef.current = heartAnimPhase
    }
    const elapsed = phaseStartRef.current !== null ? now - phaseStartRef.current : 0

    if (heartAnimPhase === 'idle') {
      // Gentle two-beat heartbeat, constant scale ~1
      const cycleDuration = 1.4
      const t = (now % cycleDuration) / cycleDuration
      let s = 1
      if (t < 0.12) s = 1 + (t / 0.12) * 0.09
      else if (t < 0.22) s = 1.09 - ((t - 0.12) / 0.10) * 0.07
      else if (t < 0.32) s = 1.02 + ((t - 0.22) / 0.10) * 0.07
      else if (t < 0.48) s = 1.09 - ((t - 0.32) / 0.16) * 0.09
      mesh.scale.setScalar(s)
      mat.emissiveIntensity = 1.1
      mat.opacity = 0.97

    } else if (heartAnimPhase === 'grow') {
      // Ease-in-out grow: scale 1 → 2.5 over 1.8s, emissive rises
      const dur = 1.8
      const p = Math.min(elapsed / dur, 1)
      // Ease-in-out cubic
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      const s = 1 + ease * 1.5   // 1 → 2.5
      mesh.scale.setScalar(s)
      mat.emissiveIntensity = 1.1 + ease * 1.4
      mat.opacity = 0.97

    } else if (heartAnimPhase === 'burst') {
      // Quick scale jump 2.5 → 3.8 then fade out over 0.5s
      const dur = 0.45
      const p = Math.min(elapsed / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      const s = 2.5 + ease * 1.3
      mesh.scale.setScalar(s)
      mat.emissiveIntensity = 2.5 + ease * 1.5
      mat.opacity = 1 - ease         // fade out

    } else if (heartAnimPhase === 'hidden') {
      mat.opacity = 0
      mesh.scale.setScalar(0.001)
    }
  })

  return (
    <Float speed={1.2} rotationIntensity={0} floatIntensity={0}>
      <mesh ref={meshRef} rotation={[Math.PI, 0, Math.PI]} position={[0, -0.05, 0]}>
        <primitive object={geometry} attach="geometry" />
        <MeshDistortMaterial
          ref={matRef}
          color="#ff2d6b"
          emissive="#ff0050"
          emissiveIntensity={1.1}
          roughness={0.15}
          metalness={0.25}
          distort={0.04}
          speed={2}
          transparent
          opacity={0.97}
        />
      </mesh>
    </Float>
  )
}

/* ─── 3D Scene Wrapper — fullscreen canvas ─── */
function HeartScene({ heartAnimPhase }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 55 }}
      style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 5]} intensity={1.8} color="#ff4d7d" />
      <pointLight position={[-3, -2, 4]} intensity={1.0} color="#ff0050" />
      <pointLight position={[0, 2, 3]} intensity={0.7} color="#ffaacc" />
      <Suspense fallback={null}>
        <GlowingHeart heartAnimPhase={heartAnimPhase} />
      </Suspense>
    </Canvas>
  )
}

/* ─── Emoji Explosion (HTML overlay, positioned at viewport center) ─── */
const BURST_EMOJIS = ['✨', '🎉', '🎂', '😊', '💕', '👌', '🙂', '✨', '💕', '🎉', '🌟', '💖']
function EmojiExplosion({ active }) {
  const [emojis, setEmojis] = useState([])
  const hasRun = useRef(false)

  useEffect(() => {
    if (!active || hasRun.current) return
    hasRun.current = true
    const items = BURST_EMOJIS.map((emoji, i) => {
      const angle = (i / BURST_EMOJIS.length) * 2 * Math.PI + (Math.random() - 0.5) * 0.4
      const dist = 90 + Math.random() * 80
      const ex = Math.cos(angle) * dist
      const ey = Math.sin(angle) * dist
      const rot = (Math.random() - 0.5) * 40
      const delay = Math.random() * 0.15
      const dur = 1.4 + Math.random() * 0.4
      return { id: i, emoji, ex, ey, rot, delay, dur }
    })
    setEmojis(items)
    // Clean up after longest animation
    const cleanup = setTimeout(() => setEmojis([]), 2200)
    return () => clearTimeout(cleanup)
  }, [active])

  if (!emojis.length) return null

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      width: 0,
      height: 0,
      zIndex: 10010,
      pointerEvents: 'none',
      overflow: 'visible',
    }}>
      {emojis.map(({ id, emoji, ex, ey, rot, delay, dur }) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
            lineHeight: 1,
            willChange: 'transform, opacity',
            '--ex': `${ex}px`,
            '--ey': `${ey}px`,
            '--er': `${rot}deg`,
            animation: `emojiFloat ${dur}s ease-out ${delay}s forwards`,
            opacity: 0,
          }}
        >
          {emoji}
        </div>
      ))}
    </div>
  )
}

/* ─── Floating Particles ─── */
const FloatingParticle = ({ delay, size, left, top, color }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: color || 'rgba(157,78,221,0.6)',
      filter: `blur(${size > 5 ? 2 : 1}px)`,
      animation: `floatParticle ${4 + (size - 3) * 0.5}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      pointerEvents: 'none',
    }}
  />
)

/* ─── Sparkle Effect ─── */
const Sparkle = ({ delay, left, top }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      width: '4px',
      height: '4px',
      background: '#C8A2C8',
      borderRadius: '1px',
      boxShadow: '0 0 6px #C8A2C8, 0 0 12px rgba(200,162,200,0.5)',
      animation: `sparkle ${2 + (delay % 1) * 2}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      pointerEvents: 'none',
    }}
  />
)

/* ─── Typed Message Component ─── */
function TypedMessage({ show }) {
  const typedRef = useRef(null)
  const typedInstance = useRef(null)

  useEffect(() => {
    if (show && typedRef.current && !typedInstance.current) {
      typedInstance.current = new Typed(typedRef.current, {
        strings: [
          'Inside this message…<br/>there are memories…<br/>smiles…<br/>and something very special 💜',
        ],
        typeSpeed: 45,
        showCursor: true,
        cursorChar: '|',
        contentType: 'html',
      })
    }
    return () => {
      if (typedInstance.current) {
        typedInstance.current.destroy()
        typedInstance.current = null
      }
    }
  }, [show])

  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 25 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      style={{
        textAlign: 'center',
        marginTop: '1.5rem',
        minHeight: '120px',
      }}
    >
      <span
        ref={typedRef}
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
          color: '#C8A2C8',
          lineHeight: 2,
          fontWeight: 400,
          letterSpacing: '0.02em',
        }}
      />
    </motion.div>
  )
}

/* ─── Letter Card (Message Content) ─── */
function LetterCard({ show, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 40 }}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.9, y: show ? 0 : 40 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
      style={{
        maxWidth: '820px',
        width: '92%',
        height: 'auto',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(30,58,138,0.95), rgba(142,45,226,0.85))',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '20px',
        padding: '25px 35px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(142,45,226,0.15)',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Ambient glow blob */}
      <div style={{
        position: 'absolute',
        top: '-25%',
        right: '-15%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(200,162,200,0.12), transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        left: '-10%',
        width: '250px',
        height: '250px',
        background: 'radial-gradient(circle, rgba(142,45,226,0.1), transparent 70%)',
        filter: 'blur(50px)',
        pointerEvents: 'none',
      }} />

      <motion.h3
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="text-gradient"
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
          fontWeight: 800,
          marginBottom: '1.2rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Dear Tanu ✨
      </motion.h3>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {[
          { text: "On this special day, I hope you’re doing well and growing beautifully in your life. I want you to know how genuinely grateful I am for the part you’ve played in my journey. Whenever I felt alone or went through difficult phases, you were there sometimes with advice, sometimes with scolding, sometimes just with your presence but always in a way that helped me stand up again.", delay: 0.4 },
          { text: "I still remember the first time you said your iconic dialogue, “Kisi ke kehne se nahi karti hu, jab mann karega tab karungi”😂. We laughed so much over that line. There is a time when I used to wait every day for your text, after that once you teased me and calling me your “Sakhi”🤭 These moments are pure gem and wonderful gift to me", delay: 0.55 },
          { text: "Happy Birthday, Madam! and  a life filled with peace, growth, success, and the kind of happiness that truly stays. No matter where life takes us, I will always respect your journey and be happy for you.", delay: 0.7 },
        ].map((item, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: item.delay, duration: 0.8 }}
            className="subtext"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(0.9rem, 1.8vw, 1.05rem)',
              fontWeight: 400,
              lineHeight: 1.75,
              marginBottom: '1rem',
              color: 'rgba(255, 255, 255, 0.95)',
            }}
          >
            {item.text}
          </motion.p>
        ))}

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.8 }}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 'clamp(1rem, 2.2vw, 1.2rem)',
            fontWeight: 700,
            color: '#C8A2C8',
            marginTop: '1.5rem',
            fontStyle: 'italic',
            letterSpacing: '0.05em',
            textShadow: '0 0 15px rgba(200,162,200,0.5)',
          }}
        >
          🎂🎉Happy Birthday Tanu✨😊
        </motion.p>
      </div>

      {/* Close button */}
      <motion.button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1.2rem',
          right: '1.5rem',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '1.2rem',
          cursor: 'pointer',
          zIndex: 2,
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
        }}
        whileHover={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }}
      >
        ✕
      </motion.button>
    </motion.div>
  )
}

/* ─────────────── MAIN COMPONENT ─────────────── */
function SpecialMessage() {
  const [phase, setPhase] = useState('idle') // idle → cinematic → letter
  const [showTyped, setShowTyped] = useState(false)
  const [showLetter, setShowLetter] = useState(false)
  const [videoCinematic, setVideoCinematic] = useState(false)
  const [bgWasPaused, setBgWasPaused] = useState(false)
  const [videoOverlayVisible, setVideoOverlayVisible] = useState(false)
  // Heart cinematic sub-phase: 'idle' | 'grow' | 'burst' | 'hidden'
  const [heartAnimPhase, setHeartAnimPhase] = useState('idle')
  const [showEmojis, setShowEmojis] = useState(false)
  const cinematicVideoRef = useRef(null)

  /* ─── Mobile Antigravity Video Reveal ─── */
  const videoAntigravityRef = useRef(null)
  const [antigravityRevealed, setAntigravityRevealed] = useState(false)
  const [antigravityComplete, setAntigravityComplete] = useState(false)

  useEffect(() => {
    const wrapper = videoAntigravityRef.current
    if (!wrapper) return

    // Only observe on mobile — desktop gets instant visibility via CSS overrides
    const isMobile = window.innerWidth <= 768
    if (!isMobile) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Trigger the reveal
          setAntigravityRevealed(true)
          observer.disconnect()

          // Mark animation complete after transition duration (1.2s + small buffer)
          setTimeout(() => {
            setAntigravityComplete(true)
          }, 1400)
        }
      },
      {
        threshold: 0.25,
        rootMargin: '0px 0px -10% 0px', // trigger slightly before fully in view
      }
    )

    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [phase]) // Re-observe when phase changes back to idle

  const handleReveal = () => {
    if (phase !== 'idle') return
    setPhase('cinematic')
  }

  useEffect(() => {
    const timers = []
    if (phase === 'cinematic') {
      document.body.style.overflow = 'hidden'
      // Reset heart anim
      setHeartAnimPhase('idle')
      setShowEmojis(false)

      // Phase timeline:
      // 0.8s  — heart has appeared, start grow
      // 2.6s  — grow complete (~1.8s), trigger burst
      // 3.1s  — burst done (~0.5s), fire emojis + hide heart
      // 3.3s  — show typed message
      // 9s    — advance to letter
      timers.push(setTimeout(() => setHeartAnimPhase('grow'), 800))
      timers.push(setTimeout(() => setHeartAnimPhase('burst'), 2600))
      timers.push(setTimeout(() => {
        setHeartAnimPhase('hidden')
        setShowEmojis(true)
      }, 3100))
      timers.push(setTimeout(() => setShowTyped(true), 3300))
      timers.push(setTimeout(() => {
        setPhase('letter')
        setShowLetter(true)
      }, 9000))
    }
    return () => timers.forEach(clearTimeout)
  }, [phase])

  /* ─── Portrait Video: Enter Cinematic Mode ─── */
  const enterCinematicVideo = () => {
    // Pause background music
    const bgAudio = window.__bgAudio
    if (bgAudio && !bgAudio.paused) {
      bgAudio.pause()
      setBgWasPaused(true)
    }

    // Lock scroll
    document.body.style.overflow = 'hidden'

    // Hide custom cursor during video playback
    document.body.classList.add('video-playing')

    // Show overlay with fade
    setVideoCinematic(true)
    // Small delay to trigger CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVideoOverlayVisible(true)
      })
    })

    // Start playing the video after the fade completes
    setTimeout(() => {
      if (cinematicVideoRef.current) {
        cinematicVideoRef.current.play().catch(() => { })
      }
    }, 800)
  }

  /* ─── Portrait Video: Exit Cinematic Mode ─── */
  const exitCinematicVideo = () => {
    // Pause the video
    if (cinematicVideoRef.current) {
      cinematicVideoRef.current.pause()
      cinematicVideoRef.current.currentTime = 0
    }

    // Restore custom cursor
    document.body.classList.remove('video-playing')

    // Fade out overlay
    setVideoOverlayVisible(false)

    // After fade completes, fully unmount overlay
    setTimeout(() => {
      setVideoCinematic(false)

      // Restore scroll
      // Only restore if we're not in a message phase that also locks scroll
      if (phase === 'idle') {
        document.body.style.overflow = ''
      }

      // Resume background music
      const bgAudio = window.__bgAudio
      if (bgAudio && bgWasPaused) {
        bgAudio.play().catch(() => { })
        setBgWasPaused(false)
      }
    }, 800)
  }

  /* ─── Handle video ended naturally ─── */
  const handleVideoEnded = () => {
    exitCinematicVideo()
  }

  /* ─── Handle video play/pause for cursor visibility ─── */
  const handleVideoPlay = () => {
    document.body.classList.add('video-playing')
  }

  const handleVideoPause = () => {
    document.body.classList.remove('video-playing')
  }

  const handleClose = () => {
    setPhase('idle')
    setShowTyped(false)
    setShowLetter(false)
    document.body.style.overflow = 'auto'
  }

  // Particle data with deterministic randomness to avoid purity violations
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => {
      const seed = (i * 73856093) ^ 19349663
      const pseudo1 = Math.sin(seed) * 10000
      const pseudo2 = Math.sin(seed * 2) * 10000
      const pseudo3 = Math.sin(seed * 3) * 10000
      const pseudo4 = Math.sin(seed * 4) * 10000
      return {
        id: i,
        delay: (pseudo1 - Math.floor(pseudo1)) * 4,
        size: 3 + (pseudo2 - Math.floor(pseudo2)) * 6,
        left: `${10 + (pseudo3 - Math.floor(pseudo3)) * 80}%`,
        top: `${10 + (pseudo4 - Math.floor(pseudo4)) * 80}%`,
        color: i % 3 === 0
          ? 'rgba(200,162,200,0.5)'
          : i % 3 === 1
            ? 'rgba(157,78,221,0.5)'
            : 'rgba(199,125,255,0.4)',
      }
    })
  }, [])

  const sparkles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const seed = (i * 73856093) ^ 19349663
      const pseudo1 = Math.sin(seed) * 10000
      const pseudo2 = Math.sin(seed * 2) * 10000
      return {
        id: i,
        delay: (pseudo1 - Math.floor(pseudo1)) * 5,
        left: `${5 + (pseudo2 - Math.floor(pseudo2)) * 90}%`,
        top: `${5 + (Math.sin(seed * 3) * 10000 - Math.floor(Math.sin(seed * 3) * 10000)) * 90}%`,
      }
    })
  }, [])

  const buttonParticles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const seed = (i * 73856093) ^ 19349663
      const pseudo1 = Math.sin(seed) * 10000
      const pseudo2 = Math.sin(seed * 2) * 10000
      return {
        id: i,
        delay: i * 0.5,
        size: 2 + (pseudo1 - Math.floor(pseudo1)) * 4,
        left: `${20 + (pseudo2 - Math.floor(pseudo2)) * 60}%`,
        top: `${20 + (Math.sin(seed * 3) * 10000 - Math.floor(Math.sin(seed * 3) * 10000)) * 60}%`,
        color: 'rgba(157,78,221,0.4)',
      }
    })
  }, [])

  return (
    <section
      id="special"
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="special-container" style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        position: 'relative',
        zIndex: 1,
        width: '100%',
      }}>
        <style>
          {keyframes}
          {`
          @media (max-width: 768px) {
            .special-container {
              min-height: auto !important;
              padding: 2rem 1rem !important;
            }
          }
        `}
        </style>

        {/* ────── BUTTON (idle state) ────── */}
        <AnimatePresence>
          {phase === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{ position: 'relative', display: 'inline-block', zIndex: 10 }}
            >
              {/* Floating particles around button */}
              {buttonParticles.map((p) => (
                <FloatingParticle key={p.id} {...p} />
              ))}

              <motion.button
                onClick={handleReveal}
                whileHover={{
                  scale: 1.08,
                  boxShadow: '0 0 40px rgba(157,78,221,0.6), 0 0 80px rgba(142,45,226,0.3)',
                }}
                whileTap={{ scale: 0.95 }}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #9D4EDD, #8E2DE2)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '50px',
                  padding: '1.3rem 3.8rem',
                  cursor: 'pointer',
                  letterSpacing: '0.1em',
                  animation: 'buttonGlow 3s ease-in-out infinite',
                  transition: 'all 0.4s ease-in-out',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                💌 A Message From Me
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ────── PORTRAIT VIDEO SECTION (always visible below button) ────── */}
        {phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: '2.5rem',
            }}
          >
            {/* Video container with 9:16 preview — antigravity wrapper for mobile */}
            <div
              ref={videoAntigravityRef}
              className={[
                'video-antigravity-wrapper',
                antigravityRevealed ? 'antigravity-revealed' : '',
                antigravityComplete ? 'antigravity-complete' : '',
              ].filter(Boolean).join(' ')}
              style={{
                width: '100%',
                maxWidth: '320px',
                position: 'relative',
              }}
            >
              {/* Antigravity bloom glow (mobile only — hidden on desktop via CSS) */}
              <div className="video-antigravity-glow" />

              {/* Ambient glow behind video */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '130%',
                height: '130%',
                background: 'radial-gradient(ellipse, rgba(157,78,221,0.15), rgba(15,48,87,0.1) 50%, transparent 70%)',
                filter: 'blur(50px)',
                pointerEvents: 'none',
                zIndex: 0,
              }} />

              {/* Video wrapper with 9:16 aspect ratio */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '177.78%', /* 9:16 portrait */
                  borderRadius: '20px',
                  overflow: 'hidden',
                  border: '1px solid rgba(200,162,200,0.2)',
                  animation: 'videoGlowPulse 4s ease-in-out infinite',
                  background: 'linear-gradient(145deg, rgba(15,48,87,0.6), rgba(30,58,138,0.4))',
                  zIndex: 1,
                }}
              >
                {/* Preview video element — NO autoplay, shows poster/first frame */}
                <video
                  src="/Dialogue_zoo.mp4"
                  poster="/thumbnail.jpg"
                  playsInline
                  preload="none"
                  muted
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    borderRadius: '20px',
                    background: '#000',
                  }}
                />

                {/* Custom play button overlay */}
                {!videoCinematic && (
                  <div
                    onClick={enterCinematicVideo}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 2,
                      background: 'rgba(0,0,0,0.25)',
                      transition: 'background 0.3s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.15)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.25)' }}
                  >
                    <div
                      className="video-play-btn-mobile"
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(157,78,221,0.85), rgba(142,45,226,0.9))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        animation: 'videoPlayBtnPulse 2.5s ease-in-out infinite',
                        backdropFilter: 'blur(8px)',
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      {/* Play triangle icon */}
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
                        <polygon points="6,3 20,12 6,21" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Video label — with antigravity delayed reveal on mobile */}
              <motion.p
                className="video-antigravity-label"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, duration: 0.6 }}
                style={{
                  textAlign: 'center',
                  marginTop: '1rem',
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'clamp(0.8rem, 1.5vw, 0.95rem)',
                  color: 'rgba(200,162,200,0.7)',
                  fontWeight: 400,
                  letterSpacing: '0.05em',
                  fontStyle: 'italic',
                }}
              >
                🎥 A Glimpse of Last Words 💜
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* ────── CINEMATIC VIDEO OVERLAY (fullscreen) ────── */}
        {videoCinematic && typeof document !== 'undefined' && createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: videoOverlayVisible ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0)',
              transition: 'background 0.8s ease-in-out',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              // Close if clicking the dark backdrop (not the video)
              if (e.target === e.currentTarget) {
                exitCinematicVideo()
              }
            }}
          >
            {/* Close button */}
            <button
              onClick={exitCinematicVideo}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                zIndex: 310,
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '1.3rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                opacity: videoOverlayVisible ? 1 : 0,
                transition: 'opacity 0.8s ease, background 0.3s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            >
              ✕
            </button>

            {/* Ambient cinematic glow */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '60vw',
              height: '60vh',
              background: 'radial-gradient(ellipse, rgba(157,78,221,0.08), transparent 70%)',
              filter: 'blur(80px)',
              pointerEvents: 'none',
              animation: 'cinematicGlow 4s ease-in-out infinite',
            }} />

            {/* Cinematic video container — portrait 9:16 */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 'min(85vw, 420px)',
                maxHeight: '90vh',
                aspectRatio: '9 / 16',
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 0 60px rgba(157,78,221,0.2), 0 30px 80px rgba(0,0,0,0.6)',
                border: '1px solid rgba(200,162,200,0.15)',
                opacity: videoOverlayVisible ? 1 : 0,
                transform: videoOverlayVisible ? 'scale(1)' : 'scale(0.85)',
                transition: 'opacity 0.8s ease-in-out, transform 0.8s ease-in-out',
              }}
            >
              <video
                src="/Dialogue_zoo.mp4"
                poster="/thumbnail.jpg"
                controls
                playsInline
                preload="none"
                onEnded={handleVideoEnded}
                onPlay={handleVideoPlay}
                onPause={handleVideoPause}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#000',
                  borderRadius: '16px',
                }}
                ref={cinematicVideoRef}
              />
            </div>
          </div>,
          document.body
        )}

        {/* ────── CINEMATIC OVERLAY ────── */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {phase !== 'idle' && (
              <motion.div
                key="cinematic-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
                onClick={handleClose}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100vh',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  background: 'rgba(10, 10, 30, 0.95)',
                  cursor: 'default',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: 'clamp(2rem, 5vh, 4rem) 0',
                }}
              >
                {/* Dark overlay with blur */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100vh',
                  backdropFilter: 'blur(18px)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }} />

                {/* Vignette effect */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
                  animation: 'vignetteIn 1.5s ease-out forwards',
                  zIndex: 1,
                  pointerEvents: 'none',
                }} />

                {/* Slow animated radial glow */}
                <div style={{
                  position: 'absolute',
                  top: '30%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '500px',
                  height: '500px',
                  background: 'radial-gradient(circle, rgba(142,45,226,0.12), transparent 70%)',
                  filter: 'blur(60px)',
                  animation: 'radialPulse 5s ease-in-out infinite',
                  zIndex: 1,
                  pointerEvents: 'none',
                }} />

                {/* Floating particles in overlay */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
                  {particles.map((p) => (
                    <FloatingParticle key={p.id} {...p} />
                  ))}
                  {sparkles.map((s) => (
                    <Sparkle key={s.id} {...s} />
                  ))}
                </div>

                {/* ── CINEMATIC PHASE: 3D Heart + Typed Message ── */}
                <AnimatePresence>
                  {phase === 'cinematic' && (
                    <motion.div
                      key="cinematic-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.85, y: -40 }}
                      transition={{ duration: 1.2 }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'relative',
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: '500px',
                        margin: 'auto 0',
                      }}
                    >
                      {/* ── Fullscreen Heart Canvas — portaled to body, z above overlay ── */}
                      {typeof document !== 'undefined' && createPortal(
                        <div style={{
                          position: 'fixed',
                          inset: 0,
                          width: '100%',
                          height: '100vh',
                          zIndex: 10005,
                          pointerEvents: 'none',
                          overflow: 'visible',
                        }}>
                          {/* Bloom glow centered behind heart */}
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: '40vw',
                            height: '40vw',
                            transform: 'translate(-50%, -50%)',
                            background: 'radial-gradient(circle, rgba(255,45,107,0.35) 0%, rgba(255,0,80,0.15) 50%, transparent 70%)',
                            filter: 'blur(60px)',
                            animation: 'radialPulse 2.8s ease-in-out infinite',
                            pointerEvents: 'none',
                            opacity: heartAnimPhase === 'hidden' ? 0 : 1,
                            transition: 'opacity 0.4s ease',
                          }} />
                          <HeartScene heartAnimPhase={heartAnimPhase} />
                        </div>,
                        document.body
                      )}

                      {/* Emoji burst — rendered via portal at viewport center */}
                      {typeof document !== 'undefined' && createPortal(
                        <EmojiExplosion active={showEmojis} />,
                        document.body
                      )}

                      {/* Typed message */}
                      <TypedMessage show={showTyped} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── LETTER PHASE: Full Message Card ── */}
                <AnimatePresence>
                  {phase === 'letter' && (
                    <motion.div
                      key="letter-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 1 }}
                      style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center', margin: 'auto 0' }}
                    >
                      <LetterCard show={showLetter} onClose={handleClose} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </section>
  )
}

export default SpecialMessage
