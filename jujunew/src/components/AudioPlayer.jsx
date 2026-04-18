import { useState, useRef, useEffect } from 'react'
import { useAudio } from '../contexts/AudioContext'

function AudioPlayer({ isUnlocked }) {
  const { audioRef, isMuted } = useAudio()
  const fadeIntervalRef = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)

  // Initialize the audio instance only once when the component mounts
  // This ensures it survives lifecycle re-renders without restarting
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio("/maula-mere-maula.mp3")
      audio.loop = true
      audio.volume = 0 // Starts at 0, ready for fade-in
      audio.muted = isMuted // Sync initial mute state
      audioRef.current = audio
      // Expose globally so other components (e.g. portrait video) can pause/resume
      window.__bgAudio = audio
    }

    return () => {
      // Cleanup on unmount
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
        window.__bgAudio = null
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle the play logic directly when the app is unlocked
  useEffect(() => {
    // Wait until the app is unlocked to play
    if (isUnlocked && audioRef.current && !isPlaying) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true)

          // Smooth fade-in logic
          let currentVolume = 0
          const targetVolume = 0.5
          const fadeDuration = 2000 // 2 seconds
          const steps = 40 // 40 steps over 2 seconds (updates every 50ms)
          const volumeStep = targetVolume / steps
          const intervalTime = fadeDuration / steps

          fadeIntervalRef.current = setInterval(() => {
            currentVolume += volumeStep

            // Protect against floating point errors
            if (currentVolume >= targetVolume) {
              currentVolume = targetVolume
              clearInterval(fadeIntervalRef.current)
            }

            if (audioRef.current) {
              audioRef.current.volume = currentVolume
            }
          }, intervalTime)
        })
        .catch(() => {
          // Autoplay blocked until user interaction — expected behavior
        })
    }
  }, [isUnlocked, isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mute state from context to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted
    }
  }, [isMuted]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export default AudioPlayer
