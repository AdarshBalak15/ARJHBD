import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const questions = [
  "Are you secretly smiling right now?",
  "Will you remember me in future?",
  "Did I manage to surprise you?",
  "Will you miss me a little after closing this page?",
  "Can we at least promise to never hate each other?",
  "Can we keep creating memories together?",
]

const noTexts = [
  "NO",
  "Are you sure? 🥺",
  "Think again 💭",
  "Really sure? 💔",
  "I’ll be sad… 😢",
  "Please? 💜",
  "Last chance 😔",
  "You can’t say no 😌"
]

function Questionnaire({ onComplete }) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [showBurst, setShowBurst] = useState(false)
  const cardRef = useRef(null)

  // NO Button States
  const [noClicks, setNoClicks] = useState(0)
  const [isShaking, setIsShaking] = useState(false)
  const [pulseScale, setPulseScale] = useState(1)

  const handleYes = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
      setNoClicks(0) // Reset behavior for new question
    } else {
      setIsComplete(true)
      setShowBurst(true)
      setTimeout(() => {
        onComplete()
      }, 4000)
    }
  }

  const handleNoClick = () => {
    const isLastClick = noClicks === noTexts.length - 2;
    const isAlreadyDisabled = noClicks >= noTexts.length - 1;

    if (isAlreadyDisabled) return;

    if (!isLastClick) {
      setPulseScale(1.05);
      setTimeout(() => setPulseScale(1), 300);
    }

    if (isLastClick) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }

    setNoClicks(prev => prev + 1);
  }

  const isNoDisabled = noClicks >= noTexts.length - 1;

  return (
    <section
      id="questionnaire"
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="questionnaire-container" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        position: 'relative',
        zIndex: 1,
        width: '100%',
      }}>
      <style>{`
        @media (max-width: 768px) {
          .questionnaire-container {
            min-height: auto !important;
            padding: 48px 16px !important;
          }
        }
      `}</style>
      <AnimatePresence mode="wait">
        {!isComplete ? (
          <motion.div
            key={currentQuestion}
            ref={cardRef}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
              maxWidth: '600px',
              width: '100%',
              background: 'linear-gradient(145deg, #1E3A8A, #8E2DE2)',
              backdropFilter: 'blur(15px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              padding: 'clamp(48px, 6vw, 64px)',
              boxShadow: '0 25px 50px rgba(142, 45, 226, 0.3)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                fontFamily: "'Inter', 'Poppins', sans-serif",
                fontSize: '0.82rem',
                fontWeight: 400,
                color: '#C8A2C8',
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                marginBottom: '32px',
                opacity: 0.9,
              }}
            >
              Question {currentQuestion + 1} of {questions.length}
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 'clamp(1.5rem, 4.5vw, 2rem)',
                fontWeight: 600,
                color: '#fff',
                lineHeight: 1.5,
                marginBottom: '48px',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)',
                minHeight: '80px', // Prevent height jumping internally
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {questions[currentQuestion]}
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'clamp(1rem, 2vw, 2rem)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <motion.button
                onClick={handleYes}
                whileHover={{ scale: 1.05, background: '#C77DFF', boxShadow: '0 0 25px rgba(157, 78, 221, 0.7)' }}
                whileTap={{ scale: 0.95 }}
                style={{
                  fontFamily: "'Inter', 'Poppins', sans-serif",
                  fontSize: 'clamp(1.1rem, 2.5vw, 1.25rem)',
                  fontWeight: 600,
                  color: '#fff',
                  letterSpacing: '0.06em',
                  background: '#9D4EDD',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '1rem',
                  minWidth: '160px',
                  cursor: 'pointer',
                  transition: 'all 0.4s ease',
                  boxShadow: '0 5px 15px rgba(157, 78, 221, 0.4)',
                }}
              >
                YES
              </motion.button>

              <motion.button
                onClick={handleNoClick}
                disabled={isNoDisabled}
                animate={
                  isShaking
                    ? { x: [-8, 8, -8, 8, -8, 8, 0], scale: 1, boxShadow: '0 0 25px rgba(157, 78, 221, 0.8)' }
                    : isNoDisabled
                      ? {
                        scale: 1,
                        boxShadow: ['0 0 10px rgba(157,78,221,0.3)', '0 0 30px rgba(157,78,221,0.7)', '0 0 10px rgba(157,78,221,0.3)']
                      }
                      : {
                        scale: pulseScale,
                        boxShadow: pulseScale > 1 ? '0 0 20px rgba(157, 78, 221, 0.5)' : '0 0 0px rgba(157, 78, 221, 0)'
                      }
                }
                transition={
                  isNoDisabled && !isShaking
                    ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.3 }
                }
                whileHover={!isNoDisabled ? { scale: 1.03, background: 'rgba(255, 255, 255, 0.1)' } : {}}
                whileTap={!isNoDisabled ? { scale: 0.95 } : {}}
                style={{
                  fontFamily: "'Inter', 'Poppins', sans-serif",
                  fontSize: 'clamp(1rem, 2vw, 1.15rem)',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: isNoDisabled ? '#E0B0FF' : 'rgba(255, 255, 255, 0.9)',
                  background: isNoDisabled ? 'rgba(157, 78, 221, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: isNoDisabled ? '1px solid rgba(157, 78, 221, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '1rem',
                  minWidth: '230px', /* Pre-allocate space for longer texts */
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isNoDisabled ? 'not-allowed' : 'pointer',
                  backdropFilter: 'blur(10px)',
                  transition: 'background 0.4s ease, border 0.4s ease, color 0.4s ease',
                  overflow: 'hidden'
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={noClicks}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      display: 'inline-block',
                      width: '100%',
                      textAlign: 'center'
                    }}
                  >
                    {noTexts[noClicks]}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            style={{
              textAlign: 'center',
              position: 'relative',
            }}
          >
            {showBurst && <ParticleBurst />}

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-gradient"
              style={{
                fontFamily: "'Playfair Display', 'Georgia', serif",
                fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                fontWeight: 700,
                textShadow: '0 0 30px rgba(200, 162, 200, 0.4)',
              }}
            >
              That means everything to me.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              style={{
                fontFamily: "'Inter', 'Poppins', sans-serif",
                fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                fontWeight: 400,
                color: '#EAEAEA',
                marginTop: '32px',
                opacity: 0.9,
              }}
            >
              Thank You for going through all this, Arju 😊
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </section>
  )
}

function ParticleBurst() {
  const particles = Array.from({ length: 45 }, (_, i) => i)

  const burstParticles = useMemo(() => {
    return particles.map((_, i) => {
      const angle = (i / particles.length) * 360
      const seed = (i * 73856093) ^ 19349663
      const pseudo1 = Math.sin(seed) * 10000
      const pseudo2 = Math.sin(seed * 2) * 10000
      const distance = 150 + (pseudo1 - Math.floor(pseudo1)) * 150
      const delay = (pseudo2 - Math.floor(pseudo2)) * 0.5
      return { angle, distance, delay }
    })
  }, [particles])

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '400px',
      height: '400px',
      pointerEvents: 'none',
    }}>
      {burstParticles.map(({ angle, distance, delay }, i) => {

      return (
        <motion.div
          key={i}
          initial={{
            x: 0,
            y: 0,
            opacity: 1,
            scale: 1
          }}
          animate={{
            x: Math.cos(angle * Math.PI / 180) * distance,
            y: Math.sin(angle * Math.PI / 180) * distance,
            opacity: 0,
            scale: 0
          }}
          transition={{
            duration: 3,
            delay: delay,
            ease: "easeOut"
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: i % 3 === 0 ? '6px' : '4px',
            height: i % 3 === 0 ? '6px' : '4px',
            borderRadius: '50%',
            background: i % 3 === 0
              ? '#9D4EDD'
              : i % 3 === 1 ? '#C8A2C8' : '#F5F7FA',
            boxShadow: '0 0 15px rgba(157, 78, 221, 0.8)',
          }}
        />
      )
    })}
    </div>
  )
}

export default Questionnaire
