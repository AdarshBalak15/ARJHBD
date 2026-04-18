import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AudioProvider } from './contexts/AudioContext'
import Intro from './components/Intro'
import PasswordScreen from './components/PasswordScreen'
import Hero from './components/Hero'
import NavigationDots from './components/NavigationDots'
import AudioPlayer from './components/AudioPlayer'
import AudioToggle from './components/AudioToggle'
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
  const [showAudio, setShowAudio] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)

  // ── Track mobile vs desktop (responsive) ──
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      // Hide audio immediately on desktop
      if (!mobile) setShowAudio(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /*
   * AudioToggle visibility — MOBILE ONLY (≤768px)
   *
   * Visible in: HangingTimeline, MemoryTimeline, SpecialMessage,
   *             TouchMeCTA, Questionnaire
   * Hidden in:  Intro, Hero, MinimalFooter, and on Desktop
   *
   * Uses IntersectionObserver + scroll backup for sections
   * between observed elements.
   */
  useEffect(() => {
    if (showIntro || !isPasswordUnlocked || !isMobile) {
      setShowAudio(false)
      return
    }

    let enterObserver = null
    let footerObserver = null
    let scrollCleanup = null
    let rescanTimer = null

    function setup() {
      const hangingEl = document.querySelector('.hanging-timeline')
      const memoriesEl = document.getElementById('memories')
      const questionnaireEl = document.getElementById('questionnaire')
      const footerEl = document.querySelector('.minimal-footer')

      // Need at least one section to begin
      if (!memoriesEl && !hangingEl) return false

      // ── 1. ENTER observer: memories + questionnaire ──
      enterObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setShowAudio(true)
              return
            }
          }
          // Neither is in view — check if we're between them
          evalScrollPosition(memoriesEl, questionnaireEl, footerEl)
        },
        { threshold: [0, 0.05, 0.3] }
      )

      if (hangingEl) enterObserver.observe(hangingEl)
      if (memoriesEl) enterObserver.observe(memoriesEl)
      if (questionnaireEl) enterObserver.observe(questionnaireEl)

      // ── 2. EXIT observer: footer ──
      if (footerEl) {
        footerObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setShowAudio(false)
            }
          },
          { threshold: 0.15 }
        )
        footerObserver.observe(footerEl)
      }

      // ── 3. Scroll backup for in-between sections ──
      let ticking = false
      const onScroll = () => {
        if (ticking) return
        ticking = true
        requestAnimationFrame(() => {
          evalScrollPosition(memoriesEl, questionnaireEl, footerEl)
          ticking = false
        })
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      scrollCleanup = () => window.removeEventListener('scroll', onScroll)

      return true // setup succeeded
    }

    /**
     * Evaluates whether the viewport center is in the valid zone:
     * below the top of #memories AND above the top of .minimal-footer.
     */
    function evalScrollPosition(memoriesEl, questionnaireEl, footerEl) {
      // Use hanging-timeline as alternate anchor if memories not available yet
      const hangingEl = document.querySelector('.hanging-timeline')
      const anchorEl = memoriesEl || hangingEl
      const anchorRect = anchorEl?.getBoundingClientRect()
      if (!anchorRect) return

      const vh = window.innerHeight
      const viewportCenter = vh / 2

      // Must have scrolled past the top of the first allowed section
      const pastMemories = anchorRect.top < viewportCenter

      // Must not have reached the footer
      let beforeFooter = true
      if (footerEl) {
        const footerRect = footerEl.getBoundingClientRect()
        beforeFooter = footerRect.top > vh * 0.8 // footer not yet 20% in
      }

      // If questionnaire exists, also check we haven't scrolled completely past it
      let notPastQuestionnaire = true
      if (questionnaireEl) {
        const qRect = questionnaireEl.getBoundingClientRect()
        notPastQuestionnaire = qRect.bottom > 0
      }

      setShowAudio(pastMemories && beforeFooter && notPastQuestionnaire)
    }

    // Attempt setup — lazy sections may not be mounted yet
    if (!setup()) {
      // Retry every 500ms until sections mount
      rescanTimer = setInterval(() => {
        if (setup()) clearInterval(rescanTimer)
      }, 500)
    }

    return () => {
      if (enterObserver) enterObserver.disconnect()
      if (footerObserver) footerObserver.disconnect()
      if (scrollCleanup) scrollCleanup()
      if (rescanTimer) clearInterval(rescanTimer)
    }
  }, [showIntro, isPasswordUnlocked, isMobile])

  return (
    <AudioProvider>
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

      {/* Audio toggle — visible only in middle sections */}
      {showAudio && <AudioToggle />}

      {/* Footer rendered OUTSIDE motion.div to escape its stacking context.
          This lets the footer's z-index compete at the root level, so it can
          sit between the modal backdrop and modal content layers. */}
      {!showIntro && isPasswordUnlocked && (
        <Suspense fallback={null}>
          <MinimalFooter />
        </Suspense>
      )}
    </AudioProvider>
  )
}

export default App
