import { useState, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'

const MinimalFooter = lazy(() => import('./MinimalFooter'))

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY: Password is NEVER stored in frontend code.
// The password is sent to the backend API which validates it using bcrypt.
// ─────────────────────────────────────────────────────────────────────────────

function PasswordScreen({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleUnlockFlow = async (e) => {
    if (e) e.preventDefault()
    if (loading) return // Prevent double-submit

    setLoading(true)

    try {
      // Send password to backend API for secure validation
      const response = await fetch('/.netlify/functions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await response.json()

      if (data.success) {
        // ✅ Backend confirmed password is correct — unlock UI
        onUnlock()
      } else {
        // ❌ Wrong password — show error
        setError(true)
        setShake(true)
        setTimeout(() => {
          setShake(false)
          setError(false)
        }, 500)
      }
    } catch (err) {
      // Network error — show error state
      console.error('Login request failed:', err.message)
      setError(true)
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setError(false)
      }, 500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #0a1628 0%, #0f2044 40%, #132a5e 100%)',
        zIndex: 1000,
        padding: 0,
        overflowY: 'auto',
      }}
    >
      {/* ── Content area — fills remaining space, centers card ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: '1rem',
        }}
      >
        {/* ── Glassmorphism Card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            maxWidth: '420px',
            width: 'calc(100% - 2rem)',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.06)',
            padding: 'clamp(2rem, 5vw, 3rem)',
            borderRadius: '24px',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow:
              '0 8px 32px rgba(0, 0, 0, 0.35), 0 0 60px rgba(99, 60, 180, 0.08)',
          }}
        >
          {/* ── Title ── */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(1.85rem, 5vw, 2.6rem)',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '0.4rem',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome
          </motion.h1>

          {/* ── Subtitle ── */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(0.85rem, 2vw, 1rem)',
              color: 'rgba(255, 255, 255, 0.55)',
              marginBottom: '2rem',
              lineHeight: 1.5,
            }}
          >
            Enter the password to continue
          </motion.p>

          {/* ── Form ── */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            onSubmit={handleUnlockFlow}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <motion.input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlockFlow(e);
                }}
                animate={shake ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                transition={{ duration: 0.4 }}
                disabled={loading}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '1rem',
                  color: '#ffffff',
                  background: 'rgba(255, 255, 255, 0.07)',
                  border: error
                    ? '1px solid rgba(239, 68, 68, 0.7)'
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '14px',
                  padding: '1rem 3rem 1rem 1.25rem',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  textAlign: 'center',
                  letterSpacing: '0.08em',
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => {
                  e.target.style.boxShadow = '0 0 20px rgba(157, 78, 221, 0.35)'
                  e.target.style.borderColor = 'rgba(157, 78, 221, 0.6)'
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
                onBlur={(e) => {
                  if (!error) {
                    e.target.style.boxShadow = 'none'
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                    e.target.style.background = 'rgba(255, 255, 255, 0.07)'
                  }
                }}
              />
              
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.55)',
                  transition: 'color 0.2s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)')}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" x2="22" y1="2" y2="22"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.82rem',
                  color: '#ff8a8a',
                  marginTop: '-0.25rem',
                }}
              >
                Oops, try again.
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{
                scale: loading ? 1 : 1.04,
                boxShadow: loading ? undefined : '0 0 28px rgba(157, 78, 221, 0.55), 0 4px 16px rgba(0,0,0,0.3)',
              }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '1rem',
                fontWeight: 600,
                color: '#ffffff',
                background: '#7c3aed',
                border: 'none',
                borderRadius: '14px',
                padding: '1rem',
                cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.3s ease',
                marginTop: '0.5rem',
                boxShadow: '0 0 20px rgba(124, 58, 237, 0.35), 0 4px 12px rgba(0,0,0,0.25)',
                letterSpacing: '0.04em',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </motion.button>
          </motion.form>
        </motion.div>
      </div>

      {/* ── Footer — plain wrapper to avoid stacking context from transform ──
           The footer component handles its own entrance animations internally.
           Using a plain div here prevents Framer Motion's transform from
           creating a new stacking context that can shift footer alignment. */}
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          flexShrink: 0,
          pointerEvents: 'auto',
        }}
      >
        <Suspense fallback={null}>
          <MinimalFooter />
        </Suspense>
      </div>
    </motion.div>
  )
}

export default PasswordScreen
