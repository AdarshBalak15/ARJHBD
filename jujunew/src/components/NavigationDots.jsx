import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'

const sections = [
  { id: 'hero', label: 'Home' },
  { id: 'memories', label: 'Memories' },
  { id: 'special', label: 'Special' },
  { id: 'questionnaire', label: 'Quiz' },
]

// Static array — never recreated, never causes useEffect to re-fire
const SECTION_IDS = sections.map((s) => s.id)

/**
 * Determines which section is closest to the viewport center.
 * Directly queries the DOM — immune to stale cached state.
 */
function computeActiveSection() {
  const viewportCenter = window.innerHeight / 2
  let bestId = null
  let bestDistance = Infinity

  for (const id of SECTION_IDS) {
    const el = document.getElementById(id)
    if (!el) continue

    const rect = el.getBoundingClientRect()

    // Skip sections completely off-screen
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue

    const sectionCenter = rect.top + rect.height / 2
    const distance = Math.abs(sectionCenter - viewportCenter)

    if (distance < bestDistance) {
      bestDistance = distance
      bestId = id
    }
  }

  return bestId
}

/**
 * Robust active-section hook that handles:
 * - Lazy-loaded sections (Suspense) that mount AFTER this hook
 * - Very tall sections that can't satisfy high intersection thresholds
 * - Accurate viewport-center tracking without lag
 *
 * Strategy:
 * 1. IntersectionObserver triggers re-evaluation when ANY section enters/leaves viewport
 * 2. rAF-throttled scroll listener as continuous backup for smooth tracking
 * 3. Periodic scan to catch lazy-loaded sections that appear later
 * 4. computeActiveSection() uses live getBoundingClientRect — no stale cache
 */
function useActiveSection() {
  const [activeSection, setActiveSection] = useState(SECTION_IDS[0])
  const observerRef = useRef(null)
  const observedIdsRef = useRef(new Set())

  const updateActive = useCallback(() => {
    const best = computeActiveSection()
    if (best) {
      setActiveSection((prev) => (prev === best ? prev : best))
    }
  }, [])

  useEffect(() => {
    // ─── 1. IntersectionObserver ───
    // Fires whenever a section crosses ANY threshold boundary.
    // We don't track isIntersecting — we just use it as a trigger to re-compute.
    const observer = new IntersectionObserver(
      () => updateActive(),
      {
        rootMargin: '-20% 0px -20% 0px',
        threshold: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0],
      }
    )
    observerRef.current = observer

    // Observe any section elements currently in the DOM
    const scanAndObserve = () => {
      let allFound = true
      for (const id of SECTION_IDS) {
        if (observedIdsRef.current.has(id)) continue
        const el = document.getElementById(id)
        if (el) {
          observer.observe(el)
          observedIdsRef.current.add(id)
        } else {
          allFound = false
        }
      }
      return allFound
    }

    // Initial scan
    scanAndObserve()

    // ─── 2. Periodic re-scan for lazy-loaded sections ───
    // Checks every 300ms until ALL sections are found, then stops.
    const rescanTimer = setInterval(() => {
      const allFound = scanAndObserve()
      if (allFound) {
        clearInterval(rescanTimer)
        // Trigger a fresh computation now that all sections exist
        updateActive()
      }
    }, 300)

    // ─── 3. Scroll listener (rAF-throttled) ───
    // Provides continuous, frame-perfect tracking as the user scrolls.
    // IntersectionObserver alone can't do this — it only fires on threshold crossings.
    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          updateActive()
          ticking = false
        })
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    // ─── 4. Initial computation ───
    requestAnimationFrame(updateActive)

    // ─── Cleanup ───
    return () => {
      observer.disconnect()
      clearInterval(rescanTimer)
      window.removeEventListener('scroll', onScroll)
      observedIdsRef.current.clear()
    }
  }, [updateActive])

  return activeSection
}

/* ─── NavDot ─── */
function NavDot({ label, isActive, onClick }) {
  return (
    <motion.button
      className="nav-dot-btn"
      onClick={onClick}
      title={label}
      aria-label={`Scroll to ${label}`}
      aria-current={isActive ? 'true' : undefined}
      initial={false}
      animate={{
        scale: isActive ? 1.35 : 1,
        background: isActive
          ? 'rgba(200, 162, 200, 1)'
          : 'rgba(255, 255, 255, 0.2)',
        boxShadow: isActive
          ? '0 0 14px rgba(200, 162, 200, 0.9), 0 0 28px rgba(200, 162, 200, 0.4)'
          : '0 0 0px rgba(200, 162, 200, 0)',
      }}
      transition={{
        type: 'spring',
        stiffness: 350,
        damping: 25,
        mass: 0.6,
      }}
      whileHover={{
        scale: 1.5,
        background: 'rgba(200, 162, 200, 1)',
        boxShadow:
          '0 0 20px rgba(200, 162, 200, 1), 0 0 40px rgba(200, 162, 200, 0.5)',
      }}
      whileTap={{ scale: 0.9 }}
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
        position: 'relative',
      }}
    />
  )
}

/* ─── NavigationDots ─── */
function NavigationDots() {
  const activeSection = useActiveSection()

  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <>
      <style>{`
        .nav-dot-btn {
          -webkit-tap-highlight-color: transparent;
          will-change: transform, box-shadow;
        }
        .nav-dot-btn:focus-visible {
          outline: 2px solid rgba(200, 162, 200, 0.8);
          outline-offset: 4px;
        }
        /* ─── Coordinated spacing system with audio-toggle-btn ─── */
        /* Uses --floating-safe-inset defined in AudioPlayer.jsx :root */
        .nav-dots-container {
          right: var(--floating-safe-inset, clamp(0.75rem, 2.5vw, 1.75rem)) !important;
        }

        /* ─── Mobile: hide nav dots smoothly ─── */
        @media (max-width: 768px) {
          .nav-dots-container {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            transform: translateY(-50%) translateX(20px) !important;
            transition:
              opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              visibility 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
        }
      `}</style>

      <motion.nav
        className="nav-dots-container"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 4.5, duration: 0.6 }}
        style={{
          position: 'fixed',
          right: '1.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          zIndex: 150,
        }}
      >
        {sections.map(({ id, label }) => (
          <NavDot
            key={id}
            label={label}
            isActive={activeSection === id}
            onClick={() => scrollToSection(id)}
          />
        ))}
      </motion.nav>
    </>
  )
}

export default NavigationDots
