import { useState, useEffect } from 'react'

/**
 * useFullscreenState — Centralized fullscreen detection hook.
 *
 * Tracks two independent sources of "fullscreen" state:
 *
 *   1. Browser Fullscreen API  (native fullscreen via <video> controls, etc.)
 *      - Handles vendor-prefixed events for cross-browser support:
 *        fullscreenchange | webkitfullscreenchange | mozfullscreenchange | MSFullscreenChange
 *
 *   2. Custom cinematic video overlay  (SpecialMessage.jsx portal-based overlay)
 *      - Listens for a 'cinematicVideoChange' CustomEvent dispatched by SpecialMessage
 *      - detail.active: true  → cinematic overlay entered
 *      - detail.active: false → cinematic overlay exited
 *
 * Returns `true` if EITHER fullscreen source is active.
 *
 * Performance:
 *   - Event-driven, no polling or rAF loops
 *   - Single effect with clean teardown
 *   - Handles rapid toggle (debounce-free — state coalesces naturally in React)
 *
 * Edge cases handled:
 *   - Multiple videos (Fullscreen API fires once per element change)
 *   - Hot-reload / already-fullscreen on mount (initial state check)
 *   - Mobile fullscreen inconsistencies (vendor-prefixed detection)
 *
 * @returns {boolean} isFullscreen — true when any fullscreen mode is active
 */
export function useFullscreenState() {
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isCinematicFullscreen, setIsCinematicFullscreen] = useState(false)

  useEffect(() => {
    /* ── 1. Native Fullscreen API detection ── */
    const handleFullscreenChange = () => {
      const el =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement

      setIsNativeFullscreen(!!el)
    }

    // Attach listeners for all vendor prefixes
    const fsEvents = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ]
    fsEvents.forEach((evt) => document.addEventListener(evt, handleFullscreenChange))

    /* ── 2. Custom cinematic overlay detection ── */
    const handleCinematicChange = (e) => {
      setIsCinematicFullscreen(!!e.detail?.active)
    }
    document.addEventListener('cinematicVideoChange', handleCinematicChange)

    // Check initial state in case fullscreen was already active on mount
    handleFullscreenChange()

    return () => {
      fsEvents.forEach((evt) => document.removeEventListener(evt, handleFullscreenChange))
      document.removeEventListener('cinematicVideoChange', handleCinematicChange)
    }
  }, [])

  // Either source being active → audio toggles should hide
  return isNativeFullscreen || isCinematicFullscreen
}
