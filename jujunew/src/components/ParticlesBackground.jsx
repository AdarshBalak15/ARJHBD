import { useMemo, useState, useEffect, memo } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'

function ParticlesBackground() {
  const [init, setInit] = useState(false)

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => {
      setInit(true)
    }).catch(() => {
      // Silently fail if particles engine can't initialize
    })
  }, [])

  const options = useMemo(() => ({
    particles: {
      number: { value: 20 },
      color: { value: '#3B82F6' },
      opacity: {
        value: 0.4,
      },
      size: {
        value: { min: 1, max: 3 },
      },
      move: {
        enable: true,
        speed: 0.3,
        direction: 'none',
        outModes: { default: 'bounce' },
        random: true,
        attract: {
          enable: false,
        },
      },
      links: {
        enable: true,
        color: '#3B82F6',
        distance: 150,
        opacity: 0.15,
        width: 1,
      },
    },
    interactivity: {
      detectOn: 'canvas',
      events: {
        onHover: { enable: false },
        onClick: { enable: false },
        resize: true,
      },
    },
    smooth: true,
    background: {
      color: 'transparent',
    },
    fpsLimit: 30,
  }), [])

  if (!init) return null

  return (
    <Particles
      id="tsparticles"
      options={options}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  )
}

export default memo(ParticlesBackground)
