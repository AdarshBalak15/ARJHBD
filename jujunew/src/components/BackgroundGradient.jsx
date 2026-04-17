import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

function BackgroundGradient() {
  const bgRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(bgRef.current, {
        background: 'radial-gradient(circle at 30% 30%, #1E3A8A, #142850 60%)',
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
        }
      })
    }, bgRef)

    return () => ctx.revert()
  }, [])

  return (
    <>
      <div
        ref={bgRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -3,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at 30% 30%, #1E3A8A, #142850 60%)',
        }}
      />
      <div className="bg-circles">
        <div className="circle" style={{ width: '400px', height: '400px', top: '10%', left: '10%', animationDelay: '0s' }}></div>
        <div className="circle" style={{ width: '300px', height: '300px', top: '60%', left: '70%', animationDelay: '-5s' }}></div>
        <div className="circle" style={{ width: '500px', height: '500px', top: '20%', left: '50%', animationDelay: '-10s' }}></div>
      </div>
    </>
  )
}

export default BackgroundGradient
