import { useRef, memo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'

function AnimatedStars() {
  const starsRef = useRef()
  
  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += delta * 0.02
      starsRef.current.rotation.x += delta * 0.01
    }
  })

  return (
    <Stars
      ref={starsRef}
      radius={100}
      depth={50}
      count={1000}
      factor={4}
      saturation={0}
      fade
      speed={0.5}
    />
  )
}

function StarField() {
  return (
    <div className="starfield-container" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      pointerEvents: 'none',
      transform: 'translateZ(0)',
      willChange: 'transform',
      backfaceVisibility: 'hidden',
    }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 1], fov: 75 }}
        gl={{
          powerPreference: 'high-performance',
          antialias: false,
          alpha: true,
          stencil: false,
          depth: false,
        }}
        style={{ background: 'transparent' }}
      >
        <AnimatedStars />
      </Canvas>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.5) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

export default memo(StarField)

