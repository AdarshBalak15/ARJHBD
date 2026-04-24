import { useEffect, useRef, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import Typed from 'typed.js'
import CountdownTimer from './CountdownTimer'

const DevotionalGallery = lazy(() => import('./DevotionalGallery'))

export default function Hero() {
  const typedRef = useRef(null)

  useEffect(() => {
    const typed = new Typed(typedRef.current, {
      strings: [
        "You are very special to me.",
        "Not just today, always.",
        "A beautiful soul deserves a beautiful day."
      ],
      typeSpeed: 70,
      backSpeed: 50,
      backDelay: 2000,
      startDelay: 500,
      loop: true,
      loopCount: Infinity,
      showCursor: true,
      cursorChar: "|",
    })

    return () => {
      typed.destroy()
    }
  }, [])

  return (
    <motion.section
      id="hero"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2, delay: 0.5 }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div className="hero-title-container">
        <motion.h1
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 1.2,
            ease: [0.22, 1, 0.36, 1]
          }}
          className="text-gradient hero-title hero-glow-pulse"
          style={{
            fontFamily: "'Cinzel Decorative', 'Playfair Display', serif",
            marginBottom: '1rem',
          }}
        >
          <span className="hero-title-line">Happy Birthday</span>{' '}
          <span className="hero-title-name">Arju</span>
        </motion.h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="subtext hero-subtext"
        style={{
          fontFamily: "'Inter', 'Poppins', sans-serif",
          fontSize: 'clamp(1rem, 3.5vw, 1.6rem)',
          fontWeight: 300,
          minHeight: '3rem',
          maxWidth: '800px',
          letterSpacing: '0.02em',
        }}
      >
        <span ref={typedRef}></span>
      </motion.div>

      <CountdownTimer />

      <Suspense fallback={<div style={{ minHeight: '300px' }}></div>}>
        <DevotionalGallery />
      </Suspense>
    </motion.section>
  )
}
