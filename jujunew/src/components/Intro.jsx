import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function Intro({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0B0F1A 0%, #111827 50%, #1E293B 100%)',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{
            position: 'relative',
            width: 'min(90vw, 600px)',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 0 50px rgba(0,0,0,0.5)',
            border: '1px solid rgba(200, 162, 200, 0.2)'
          }}
        >
          <img
            src="/eyes.jpg.jpeg"
            alt="Her Eyes"
            style={{
              width: '100%',
              display: 'block',
              maskImage: 'radial-gradient(ellipse at center, black 60%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 60%, transparent 100%)',
            }}
          />
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              inset: 0,
              boxShadow: 'inset 0 0 60px rgba(200, 162, 200, 0.3)',
              pointerEvents: 'none'
            }}
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{
            opacity: 1,
            y: 0,
            textShadow: '0 0 20px rgba(200, 162, 200, 0.8), 0 0 40px rgba(200, 162, 200, 0.4)'
          }}
          transition={{
            duration: 1.2,
            delay: 0.5,
            ease: "easeOut"
          }}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 'clamp(1.2rem, 3.5vw, 2rem)',
            fontWeight: 500,
            color: '#F5F7FA',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          04 May — Arju's Special Day
        </motion.h1>
      </div>
    </motion.section>
  )
}

export default Intro
