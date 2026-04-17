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
      <motion.h1
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 1.2,
          ease: [0.22, 1, 0.36, 1]
        }}
        className="text-gradient"
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 'clamp(3rem, 10vw, 5.5rem)',
          fontWeight: 800,
          marginBottom: '1rem',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}
      >
        Happy Birthday Arju
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="subtext"
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 'clamp(1rem, 3.5vw, 1.6rem)',
          fontWeight: 400,
          minHeight: '3rem',
          maxWidth: '800px',
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
