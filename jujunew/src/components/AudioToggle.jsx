import { useState, useEffect } from 'react'
import { useAudio } from '../contexts/AudioContext'
import { useFullscreenState } from '../hooks/useFullscreenState'

/**
 * Floating mute/unmute button — purple glassmorphism style.
 * Matches the Questionnaire card + Touch Me button aesthetic.
 * Uses the global AudioContext — zero audio logic here.
 * Visibility is controlled by the parent (App.jsx).
 *
 * ⛔ Completely removed on mobile (≤768px) — returns null,
 *    so zero DOM footprint, zero layout impact.
 */
function AudioToggle() {
  const { isMuted, toggleMute } = useAudio()
  const [showTooltip, setShowTooltip] = useState(false)
  const isFullscreen = useFullscreenState()

  /* ── Mobile gate: completely unmount on small screens ── */
  const [isSmallDevice, setIsSmallDevice] = useState(false)

  useEffect(() => {
    const check = () => setIsSmallDevice(window.innerWidth <= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ⛔ Return null on mobile — component is fully removed from DOM
  if (isSmallDevice) return null

  return (
    <>
      <style>{`
        /* ═══════════════════════════════════════════════════
           AudioToggle — Purple Glass + Soft Neon
           Matches: Questionnaire cards, CTA buttons,
           overall purple–blue gradient theme.
           ═══════════════════════════════════════════════════ */

        .audio-toggle-wrap {
          position: fixed;
          bottom: 80px;
          right: 24px;
          z-index: 50;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;

          /* Smooth fade-in on mount */
          animation: audioToggleFadeIn 0.5s ease-out both;
        }

        @keyframes audioToggleFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ── Ambient halo behind button ── */
        .audio-toggle-halo {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(168, 85, 247, 0.12) 0%,
            rgba(157, 78, 221, 0.06) 50%,
            transparent 70%
          );
          filter: blur(10px);
          pointer-events: none;
          z-index: -1;
        }

        /* ── Button base: glass + purple border ── */
        .audio-toggle-btn {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 1px solid rgba(200, 162, 200, 0.2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          outline: none;

          /* Glass effect */
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);

          /* Soft purple glow */
          box-shadow:
            0 0 15px rgba(168, 85, 247, 0.35),
            0 4px 12px rgba(0, 0, 0, 0.25),
            inset 0 1px 1px rgba(255, 255, 255, 0.08);

          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .audio-toggle-btn:hover {
          transform: scale(1.1);
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(200, 162, 200, 0.35);
          box-shadow:
            0 0 25px rgba(168, 85, 247, 0.6),
            0 6px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 1px rgba(255, 255, 255, 0.12);
        }

        .audio-toggle-btn:active {
          transform: scale(0.95);
          box-shadow:
            0 0 12px rgba(168, 85, 247, 0.4),
            0 2px 8px rgba(0, 0, 0, 0.3);
        }

        /* ── Icon styling ── */
        .audio-toggle-btn svg {
          width: 20px;
          height: 20px;
          transition: fill 0.25s ease, filter 0.25s ease;
        }
        .audio-toggle-btn .icon-unmuted {
          fill: rgba(200, 162, 200, 0.9);
          filter: drop-shadow(0 0 4px rgba(200, 162, 200, 0.4));
        }
        .audio-toggle-btn .icon-muted {
          fill: rgba(234, 234, 234, 0.5);
          filter: none;
        }

        .audio-toggle-btn:hover .icon-unmuted {
          fill: rgba(200, 162, 200, 1);
          filter: drop-shadow(0 0 8px rgba(200, 162, 200, 0.6));
        }
        .audio-toggle-btn:hover .icon-muted {
          fill: rgba(234, 234, 234, 0.75);
          filter: drop-shadow(0 0 4px rgba(200, 162, 200, 0.3));
        }

        /* ── Tooltip — glass style ── */
        .audio-toggle-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-family: 'Poppins', sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 4px 8px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          transform: translateX(-50%) translateY(4px);
        }
        .audio-toggle-tooltip.visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        /* Small arrow */
        .audio-toggle-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 4px;
          border-style: solid;
          border-color: rgba(0, 0, 0, 0.4) transparent transparent transparent;
        }

        /* Mobile media queries removed — component returns null on ≤768px,
           so these styles are unreachable. See isMobile gate above. */
      `}</style>

      <div
        className="audio-toggle-wrap"
        style={{
          /* Smooth hide during fullscreen — no abrupt unmount */
          opacity: isFullscreen ? 0 : 1,
          pointerEvents: isFullscreen ? 'none' : 'auto',
          transition: 'opacity 0.35s ease',
        }}
      >
        {/* Glass tooltip */}
        <div className={`audio-toggle-tooltip${showTooltip ? ' visible' : ''}`}>
          {isMuted ? 'Unmute' : 'Mute'}
        </div>

        <button
          className="audio-toggle-btn"
          onClick={toggleMute}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          type="button"
          aria-label={isMuted ? 'Unmute background music' : 'Mute background music'}
        >
          {/* Ambient halo */}
          <div className="audio-toggle-halo" />

          {isMuted ? (
            /* Volume Mute icon */
            <svg className="icon-muted" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
            </svg>
          ) : (
            /* Volume Up icon */
            <svg className="icon-unmuted" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.02zM14 3.23v.06c0 .38.25.71.61.85C17.18 5.18 19 7.56 19 12s-1.82 6.82-4.39 7.86c-.36.14-.61.47-.61.85v.06c0 .63.63 1.08 1.22.85C18.6 20.11 21 16.53 21 12s-2.4-8.11-5.78-9.61c-.59-.24-1.22.21-1.22.84z" />
            </svg>
          )}
        </button>
      </div>
    </>
  )
}

export default AudioToggle
