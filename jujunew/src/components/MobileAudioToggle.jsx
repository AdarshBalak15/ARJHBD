import { useState, useEffect, useRef } from 'react'
import { useAudio } from '../contexts/AudioContext'
import { useFullscreenState } from '../hooks/useFullscreenState'

function MobileAudioToggle() {
  const { isMuted, toggleMute } = useAudio()
  const [isSmallDevice, setIsSmallDevice] = useState(false)
  const isFullscreen = useFullscreenState()
  
  const [isHeroVisible, setIsHeroVisible] = useState(true)
  const [isFooterVisible, setIsFooterVisible] = useState(false)

  const heroRef = useRef(null)
  const footerRef = useRef(null)

  useEffect(() => {
    const check = () => setIsSmallDevice(window.innerWidth <= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!isSmallDevice) return

    let observersDisconnect = null

    const setupObservers = () => {
      heroRef.current = document.getElementById('hero')
      footerRef.current = document.querySelector('.minimal-footer')

      if (!heroRef.current || !footerRef.current) return false

      const heroObserver = new IntersectionObserver(
        ([entry]) => setIsHeroVisible(entry.isIntersecting),
        { threshold: 0.3 }
      )

      const footerObserver = new IntersectionObserver(
        ([entry]) => setIsFooterVisible(entry.isIntersecting),
        { threshold: 0, rootMargin: '0px 0px -120px 0px' }
      )

      heroObserver.observe(heroRef.current)
      footerObserver.observe(footerRef.current)

      observersDisconnect = () => {
        heroObserver.disconnect()
        footerObserver.disconnect()
      }

      return true
    }

    if (!setupObservers()) {
      const interval = setInterval(() => {
        if (setupObservers()) {
          clearInterval(interval)
        }
      }, 500)
      return () => {
        clearInterval(interval)
        if (observersDisconnect) observersDisconnect()
      }
    }

    return () => {
      if (observersDisconnect) observersDisconnect()
    }
  }, [isSmallDevice])

  if (!isSmallDevice) return null

  /* Hide when Hero or Footer is visible, OR when any fullscreen mode is active */
  const showButton = !(isHeroVisible || isFooterVisible || isFullscreen)

  return (
    <>
      <style>{`
        .mobile-audio-toggle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
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

          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
        }

        .mobile-audio-toggle:active {
          transform: scale(0.95);
        }

        @media (max-width: 768px) {
          .mobile-audio-toggle {
            width: 40px;
            height: 40px;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .mobile-audio-toggle {
            width: 56px;
            height: 56px;
          }
        }

        .mobile-audio-toggle svg {
          width: 20px;
          height: 20px;
          transition: fill 0.25s ease, filter 0.25s ease;
        }

        .mobile-audio-toggle .icon-unmuted {
          fill: rgba(200, 162, 200, 0.9);
          filter: drop-shadow(0 0 4px rgba(200, 162, 200, 0.4));
        }

        .mobile-audio-toggle .icon-muted {
          fill: rgba(234, 234, 234, 0.5);
        }
      `}</style>
      
      <button
        className="mobile-audio-toggle"
        onClick={toggleMute}
        type="button"
        aria-label={isMuted ? 'Unmute background music' : 'Mute background music'}
        style={{
          opacity: showButton ? 1 : 0,
          pointerEvents: showButton ? 'auto' : 'none'
        }}
      >
        {isMuted ? (
          <svg className="icon-muted" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
          </svg>
        ) : (
          <svg className="icon-unmuted" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-3.02zM14 3.23v.06c0 .38.25.71.61.85C17.18 5.18 19 7.56 19 12s-1.82 6.82-4.39 7.86c-.36.14-.61.47-.61.85v.06c0 .63.63 1.08 1.22.85C18.6 20.11 21 16.53 21 12s-2.4-8.11-5.78-9.61c-.59-.24-1.22.21-1.22.84z" />
          </svg>
        )}
      </button>
    </>
  )
}

export default MobileAudioToggle
