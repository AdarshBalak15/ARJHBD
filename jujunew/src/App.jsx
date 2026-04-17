import { useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Intro from './components/Intro'
import PasswordScreen from './components/PasswordScreen'
import Hero from './components/Hero'
import NavigationDots from './components/NavigationDots'
import AudioPlayer from './components/AudioPlayer'
import ParticlesBackground from './components/ParticlesBackground'
import BackgroundGradient from './components/BackgroundGradient'
import CustomCursor from './components/CustomCursor'
import StarField from './components/StarField'

const HangingTimeline = lazy(() => import('./components/HangingTimeline'))
const MemoryTimeline = lazy(() => import('./components/MemoryTimeline'))
const SpecialMessage = lazy(() => import('./components/SpecialMessage'))
const Questionnaire = lazy(() => import('./components/Questionnaire'))
const TouchMeCTA = lazy(() => import('./components/TouchMeCTA'))
const MinimalFooter = lazy(() => import('./components/MinimalFooter'))

function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [isPasswordUnlocked, setIsPasswordUnlocked] = useState(false)

  return (
    <>
      <CustomCursor />
      <BackgroundGradient />
      <ParticlesBackground />
      <AudioPlayer isUnlocked={isPasswordUnlocked} showIntro={showIntro} />

      <AnimatePresence mode="wait">
        {!isPasswordUnlocked && (
          <PasswordScreen key="password" onUnlock={() => setIsPasswordUnlocked(true)} />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showIntro && isPasswordUnlocked && (
          <Intro key="intro" onComplete={() => setShowIntro(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showIntro && isPasswordUnlocked && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <StarField />
            <NavigationDots />
            <Hero />

            <style>{`
              .content-split {
                display: flex;
                width: 100%;
                position: relative;
              }
              .column-left {
                width: 25%;
                min-width: 320px;
                background: linear-gradient(180deg, #021a16 0%, #064e3b 50%, #065f46 100%);
                position: relative;
              }
              .column-right {
                width: 75%;
                flex-grow: 1;
                position: relative;
                overflow: hidden;
              }
              @media (max-width: 992px) {
                .content-split {
                  flex-direction: column;
                }
                .column-left {
                  width: 100%;
                  min-width: 100%;
                }
                .column-right {
                  width: 100%;
                }
              }
            `}</style>

            <div className="content-split">
              <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
                <div className="column-left">
                  <HangingTimeline />
                </div>
                <div className="column-right">
                  <MemoryTimeline />
                  <SpecialMessage />
                  <TouchMeCTA />
                  <Questionnaire onComplete={() => { }} />
                </div>
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer rendered OUTSIDE motion.div to escape its stacking context.
          This lets the footer's z-index compete at the root level, so it can
          sit between the modal backdrop and modal content layers. */}
      {!showIntro && isPasswordUnlocked && (
        <Suspense fallback={null}>
          <MinimalFooter />
        </Suspense>
      )}
    </>
  )
}

export default App
