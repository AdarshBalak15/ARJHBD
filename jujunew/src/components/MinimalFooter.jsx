/* MinimalFooter */
import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════
   PRIVACY POLICY — SPLIT LAYER ARCHITECTURE
   Backdrop and modal content render as SEPARATE portal
   layers with different z-indexes. This lets the footer
   sit between them (backdrop < footer < modal content),
   keeping the footer hoverable even when the modal is open.
   ═══════════════════════════════════════════════════ */

/* ── Shared hooks for both layers ── */
function useModalLifecycle(onClose) {
  /* Escape key to close */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /* Lock body scroll while modal is open */
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])
}

/* ── Layer 1: Backdrop (z-index: 9998) — VISUAL ONLY ──
   pointer-events: none so it never blocks the footer or
   any element above z-index 9998.  Close-on-click is
   handled by the modal wrapper instead. */
function PrivacyBackdrop({ onClose }) {
  useModalLifecycle(onClose)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }}
    />
  )
}

/* ── Layer 2: Modal wrapper + content (z-index: 10000) ──
   The outer wrapper is pointer-events: none so it doesn't
   block the footer.  A dedicated "close zone" inside handles
   click-outside-to-close, and the modal card itself is
   pointer-events: auto for full interactivity. */
function PrivacyModalContent({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="pp-modal-wrapper"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        pointerEvents: 'none',
      }}
    >
      {/* Invisible click-close zone — fills the wrapper but stays
          pointer-events: auto only where the modal card ISN'T.
          Because the wrapper itself is pointer-events: none, this
          zone won't block anything outside the modal (like footer). */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'auto',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'linear-gradient(160deg, rgba(20, 30, 60, 0.97), rgba(30, 20, 50, 0.97))',
          border: '1px solid rgba(167, 139, 250, 0.2)',
          borderRadius: '20px',
          padding: 'clamp(24px, 4vw, 48px)',
          boxShadow:
            '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 40px rgba(142, 45, 226, 0.12)',
          fontFamily: "'Poppins', sans-serif",
          color: '#dbeafe',
          pointerEvents: 'auto',
          zIndex: 1,
        }}
        className="pp-modal-body"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close privacy policy"
          style={{
            position: 'sticky',
            top: 0,
            float: 'right',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#dbeafe',
            fontSize: '18px',
            transition: 'all 0.25s ease',
            zIndex: 2,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
          }}
        >
          ✕
        </button>

        {/* Title */}
        <h2 style={{
          fontSize: 'clamp(1.4rem, 3.5vw, 1.8rem)',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #a78bfa, #c084fc, #e879f9)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: '0 0 24px',
          textAlign: 'center',
        }}>
          🔐 Privacy Policy
        </h2>

        {/* Content */}
        <div className="pp-content" style={{ lineHeight: 1.8, fontSize: 'clamp(0.82rem, 1.8vw, 0.95rem)' }}>
          <p style={ppMeta}>Effective Date: April 2026</p>
          <p>We respect your privacy and are committed to maintaining security, accountability, and protection against unauthorized access.</p>

          <h3 style={ppH3}>📌 What We Collect</h3>
          <p>We collect limited technical information only when you:</p>
          <ul style={ppUl}>
            <li>Log in successfully, and</li>
            <li>Click the "Unlock" button</li>
          </ul>
          <p>The data may include:</p>
          <ul style={ppUl}>
            <li>IP address</li>
            <li>Approximate location (city, region, country)</li>
            <li>Timezone</li>
            <li>Device and browser details</li>
          </ul>

          <h3 style={ppH3}>🎯 Why We Collect This Data</h3>
          <p>We collect this information only for:</p>
          <ul style={ppUl}>
            <li>Improving security</li>
            <li>Preventing unauthorized access</li>
            <li>Maintaining system accountability</li>
            <li>Monitoring misuse and protecting the platform</li>
          </ul>

          <h3 style={ppH3}>⏱️ When Data is Collected</h3>
          <p>✔ Only after login<br />✔ Only when you click "Unlock"</p>
          <p>❌ No data is collected during normal browsing<br />❌ No hidden tracking</p>

          <h3 style={ppH3}>🔐 Security & Protection</h3>
          <p>We take appropriate measures to:</p>
          <ul style={ppUl}>
            <li>Protect your data from unauthorized access</li>
            <li>Maintain system security</li>
            <li>Ensure proper accountability of user activity</li>
          </ul>

          <h3 style={ppH3}>🚫 What We Do NOT Do</h3>
          <ul style={ppUl}>
            <li>❌ We do NOT collect sensitive personal data</li>
            <li>❌ We do NOT track you without your action</li>
            <li>❌ We do NOT sell or share your data</li>
          </ul>

          <h3 style={ppH3}>🌍 Third-Party Use</h3>
          <p>We may use a trusted service to determine your approximate location from your IP address, only for security, unauthorized access and accountability purposes.</p>

          <h3 style={ppH3}>⏳ Data Retention</h3>
          <p>We keep data only as long as necessary for:</p>
          <ul style={ppUl}>
            <li>Security monitoring</li>
            <li>Preventing unauthorized access</li>
          </ul>

          <h3 style={ppH3}>✅ Your Control</h3>
          <p>You are in control:</p>
          <ul style={ppUl}>
            <li>Data is collected only when you click "Unlock"</li>
            <li>If you do not click, no data is recorded</li>
          </ul>

          <h3 style={ppH3}>🔄 Updates</h3>
          <p>We may update this policy to improve security and accountability. Changes will be posted on this page.</p>

          <h3 style={ppH3}>📩 Contact</h3>
          <p>For any questions, contact us at:<br />
            <a href="mailto:adarshsingh3553@gmail.com" style={{ color: '#a78bfa', textDecoration: 'none' }}>
              adarshsingh3553@gmail.com
            </a>
          </p>
        </div>
      </motion.div>

      <style>{`
        .pp-modal-body::-webkit-scrollbar {
          width: 6px;
        }
        .pp-modal-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .pp-modal-body::-webkit-scrollbar-thumb {
          background: rgba(167, 139, 250, 0.3);
          border-radius: 3px;
        }
        .pp-modal-body::-webkit-scrollbar-thumb:hover {
          background: rgba(167, 139, 250, 0.5);
        }
      `}</style>
    </motion.div>
  )
}

/* Shared heading / list styles for policy content */
const ppH3 = {
  fontSize: 'clamp(1rem, 2.5vw, 1.15rem)',
  fontWeight: 600,
  color: '#c4b5fd',
  margin: '24px 0 8px',
  textShadow: '0 0 10px rgba(167,139,250,0.3)',
}
const ppUl = {
  margin: '4px 0 12px 16px',
  padding: 0,
  listStyleType: "'▸ '",
  lineHeight: 1.9,
}
const ppMeta = {
  fontSize: '0.85rem',
  opacity: 0.7,
  fontStyle: 'italic',
  margin: '0 0 1rem',
}

/* ═══════════════════════════════════════════════════
   MINIMAL FOOTER — BULLETPROOF RESPONSIVE LAYOUT
   ═══════════════════════════════════════════════════
   WHY this structure:
   • The outer <footer> uses width:100% + box-sizing:border-box
     with symmetric padding so it never shifts left/right.
   • The inner wrapper uses flexbox column with align-items:center
     for true horizontal centering regardless of content width.
   • All <motion.p> elements use text-align:center and margin:0
     — no default browser margins can push content off-center.
   • Contact info uses inline text (not display:flex) so it
     wraps naturally at the center rather than unevenly.
   • A max-width on the tagline prevents edge-to-edge stretching
     on large screens while staying readable on small ones.
   ═══════════════════════════════════════════════════ */
export default function MinimalFooter() {
  const [showPolicy, setShowPolicy] = useState(false)
  const openPolicy = useCallback(() => setShowPolicy(true), [])
  const closePolicy = useCallback(() => setShowPolicy(false), [])

  return (
    <>
      <footer
        className="minimal-footer"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '24px 16px',
          textAlign: 'center',
          background: 'transparent',
          position: 'relative',
          zIndex: 9999,
          pointerEvents: 'auto',
          marginTop: 0,
        }}
      >
        <div
          className="minimal-footer__inner"
          style={{
            maxWidth: '800px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {/* ── Line 1: Developer credit ── */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="minimal-footer__line"
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#dbeafe',
              fontFamily: "'Inter', 'Poppins', sans-serif",
              fontWeight: 400,
              textAlign: 'center',
              width: '100%',
              textShadow: '0 0 8px rgba(255,255,255,0.3)',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            ✨ Developed and Designed by{' '}
            <span
              className="footer-name"
              style={{
                color: '#a78bfa',
                fontWeight: 600,
                transition: 'text-shadow 0.3s ease',
              }}
            >
              Adarsh Ranjan
            </span>
          </motion.p>

          {/* ── Line 2: Contact info — uses inline text for natural centering ── */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="minimal-footer__line minimal-footer__contact"
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#dbeafe',
              fontFamily: "'Inter', 'Poppins', sans-serif",
              fontWeight: 400,
              textAlign: 'center',
              width: '100%',
              textShadow: '0 0 8px rgba(255,255,255,0.3)',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            <span>
              Contact:{' '}
              <a
                href="mailto:adarshsingh3553@gmail.com"
                style={{ color: '#dbeafe', textDecoration: 'none' }}
              >
                adarshsingh3553@gmail.com
              </a>
            </span>
            <span
              className="footer-separator"
              style={{ opacity: 0.5, margin: '0 8px' }}
            >
              |
            </span>
            <span>+91 90769 02080</span>
          </motion.p>

          {/* ── Line 3: Copyright + Privacy Policy ── */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="minimal-footer__line"
            style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: 1.6,
              color: '#dbeafe',
              fontFamily: "'Inter', 'Poppins', sans-serif",
              fontWeight: 400,
              opacity: 0.8,
              textAlign: 'center',
              width: '100%',
              textShadow: '0 0 6px rgba(255,255,255,0.2)',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            © 2026 Adarsh Ranjan • All Rights Reserved
            <span style={{ opacity: 0.5, margin: '0 8px' }}>|</span>
            <span
              className="footer-privacy-link"
              onClick={openPolicy}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openPolicy()
              }}
              style={{
                cursor: 'pointer',
                color: '#a78bfa',
                fontWeight: 500,
                transition: 'all 0.3s ease',
                textDecoration: 'none',
                position: 'relative',
                zIndex: 1,
                pointerEvents: 'auto',
              }}
            >
              Privacy Policy
            </span>
          </motion.p>

          {/* ── Line 4: Tagline — constrained width for readability ── */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="minimal-footer__line minimal-footer__tagline"
            style={{
              margin: '4px 0 0',
              fontSize: '18px',
              lineHeight: 1.75,
              color: 'rgba(255, 255, 255, 0.82)',
              fontFamily: "'Caveat', 'Patrick Hand', sans-serif",
              fontWeight: 800,
              fontStyle: 'normal',
              letterSpacing: '0.4px',
              textAlign: 'center',
              maxWidth: '480px',
              width: '100%',
              textShadow: '0 0 10px rgba(167, 139, 250, 0.25), 0 1px 3px rgba(0, 0, 0, 0.4)',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            Some pages on the internet are just pages. This one is a memory.<br />
            Sometimes The Simplest Gestures Leave The Deepest Imprints.
          </motion.p>
        </div>

        {/* ── Embedded responsive styles ── */}
        <style>{`
          /* ── Desktop hover effects ── */
          .footer-name:hover {
            text-shadow: 0 0 12px rgba(167,139,250,0.8) !important;
          }
          .footer-privacy-link:hover {
            text-shadow: 0 0 12px rgba(167,139,250,0.7);
            color: #c4b5fd !important;
          }

          /* ── Tablet / Mobile ≤768px: stack contact items vertically ── */
          @media (max-width: 768px) {
            .footer-separator {
              display: none !important;
            }
            .minimal-footer {
              margin-top: 0 !important;
            }
            .minimal-footer__contact {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 2px !important;
            }
          }

          /* ── Mobile ≤480px: tighter typography + layout ── */
          @media (max-width: 480px) {
            .minimal-footer {
              padding: 16px 16px !important;
            }
            .minimal-footer__line {
              font-size: 12px !important;
            }
            .minimal-footer__tagline {
              font-size: 16px !important;
              line-height: 1.7 !important;
              max-width: 320px !important;
              padding: 0 8px;
            }
            .minimal-footer__contact {
              font-size: 12px !important;
            }
          }
        `}</style>
      </footer>

      {/* ── Privacy Policy Modal — TWO separate portal layers ──
          Layer 1 (Backdrop):  z-index 9998 — below footer
          Footer:              z-index 9999 — hoverable between layers
          Layer 2 (Content):   z-index 10000 — above footer */}
      {createPortal(
        <AnimatePresence>
          {showPolicy && <PrivacyBackdrop key="pp-backdrop" onClose={closePolicy} />}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {showPolicy && <PrivacyModalContent key="pp-content" onClose={closePolicy} />}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
