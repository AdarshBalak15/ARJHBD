import { createContext, useContext, useRef, useState, useCallback } from 'react'

const AudioCtx = createContext(null)

/**
 * Global audio context provider.
 * Exposes isMuted, toggleMute(), and audioRef for the background music.
 * Audio instance is created once inside AudioPlayer — this context
 * only manages the mute state and provides a stable ref.
 */
export function AudioProvider({ children }) {
  const audioRef = useRef(null)
  const [isMuted, setIsMuted] = useState(false)

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      if (audioRef.current) {
        audioRef.current.muted = next
      }
      return next
    })
  }, [])

  return (
    <AudioCtx.Provider value={{ audioRef, isMuted, toggleMute }}>
      {children}
    </AudioCtx.Provider>
  )
}

export function useAudio() {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudio must be used within AudioProvider')
  return ctx
}
