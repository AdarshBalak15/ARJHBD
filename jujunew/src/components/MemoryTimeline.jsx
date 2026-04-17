import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { rgbShift } from 'three/examples/jsm/tsl/display/RGBShiftNode.js'

gsap.registerPlugin(ScrollTrigger)

const memories = [
  {
    id: 1,
    title: "First Step",
    description:
      "The day where we showed trust for first time, and everything changed. You shared Birthday pictures with me.",
    date: "05/05/2019",
    image: "1.jpeg",
  },
  {
    id: 2,
    title: "Shared Memories",
    description:
      "Moments filled with pure joy and laughter from 2018 that still make me happy today.",
    date: "Cherished Times",
    image: "15.jpeg",
  },
  {
    id: 3,
    title: "Together Through It All",
    description:
      "Standing by each other through every challenge and celebration, growing stronger.",
    date: "Always There",
    image: "13.jpeg",
  },
  {
    id: 4,
    title: "Unspoken Bond",
    description:
      "A connection where there is no fight till now, only a mutual understanding.",
    date: "Our Connection",
    image: "5.jpeg",
  },
  {
    id: 5,
    title: "Unexpected Meeting",
    description:
      "When we made eye contact with each other near Durga temple, where we have not thought for this moment.",
    date: "02/07/2024",
    image: "7.jpeg",
  },
  {
    id: 6,
    title: "First call in 6yrs",
    description:
      "On 26th Aug 2024, Janmastmi you called me but i couldn't pick up the call. Nearly after one month 24 Sept we had our first call.",
    date: "24/09/2024",
    image: "11.jpeg",
  },
]

/* ─── Floating keyframes (CSS injected once) ─── */
const floatKeyframes = `
@keyframes memoryFloat {
  0%, 100% { transform: translateY(0px); }
  50%      { transform: translateY(-10px); }
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}
@keyframes stemGrow {
  from { height: 0; }
  to   { height: 100%; }
}
`

/* ─── Glowing timeline node ─── */
const TimelineNode = () => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 5,
    }}
  >
    {/* Outer glow ring */}
    <div
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(31,175,109,0.35), transparent 70%)',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'glowPulse 3s ease-in-out infinite',
      }}
    />
    {/* Core dot */}
    <div
      style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #22C55E, #1FAF6D)',
        boxShadow: '0 0 12px rgba(34,197,94,0.6), 0 0 24px rgba(34,197,94,0.25)',
        border: '2px solid rgba(255,255,255,0.25)',
      }}
    />
  </div>
)

/* ─── Single memory row ─── */
const MemoryRow = ({ memory, index }) => {
  return (
    <div
      className="memory-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 60px 1fr',
        alignItems: 'center',
        gap: 0,
        marginBottom: '80px',
        position: 'relative',
      }}
    >
      {/* ── LEFT: Portrait Image ── */}
      <motion.div
        initial={{ opacity: 0, x: -80 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingRight: 'clamp(16px, 3vw, 40px)',
        }}
      >
        <motion.div
          whileHover={{
            scale: 1.03,
            boxShadow:
              '0 12px 50px rgba(31,175,109,0.35), 0 0 80px rgba(31,175,109,0.12)',
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            position: 'relative',
            width: 'min(280px, 70vw)',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow:
              '0 8px 35px rgba(31,175,109,0.2), 0 2px 12px rgba(0,0,0,0.25)',
            animation: 'memoryFloat 6s ease-in-out infinite',
            animationDelay: `${index * 0.8}s`,
          }}
        >
          {/* Green glow behind image */}
          <div
            style={{
              position: 'absolute',
              inset: '-20px',
              background:
                'radial-gradient(ellipse at center, rgba(31,175,109,0.25), transparent 70%)',
              zIndex: -1,
              filter: 'blur(20px)',
            }}
          />

          {/* Portrait image (4:5 ratio) */}
          <div
            style={{
              aspectRatio: '4 / 5',
              overflow: 'hidden',
              borderRadius: '20px',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <img
              src={memory.image}
              alt={memory.title}
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                filter: 'saturate(1.05) contrast(1.05)',
              }}
            />
          </div>

          {/* Soft green border glow overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '20px',
              boxShadow:
                'inset 0 0 30px rgba(31,175,109,0.12), inset 0 0 60px rgba(31,175,109,0.06)',
              pointerEvents: 'none',
            }}
          />

          {/* Gradient fade at bottom edge */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '40%',
              background:
                'linear-gradient(to top, rgba(20,40,80,0.5), transparent)',
              borderRadius: '0 0 20px 20px',
              pointerEvents: 'none',
            }}
          />
        </motion.div>
      </motion.div>

      {/* ── CENTER: Timeline stem node ── */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <TimelineNode />
      </div>

      {/* ── RIGHT: Text content card ── */}
      <motion.div
        initial={{ opacity: 0, x: 80 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          paddingLeft: 'clamp(16px, 3vw, 50px)',
        }}
      >
        <motion.div
          whileHover={{
            scale: 1.03,
            boxShadow:
              '0 12px 45px rgba(31,175,109,0.2), 0 0 60px rgba(31,175,109,0.08)',
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            background: 'linear-gradient(135deg, #1B4332, #142850)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: '20px',
            padding: 'clamp(1.5rem, 3.5vw, 2.5rem)',
            maxWidth: '420px',
            boxShadow:
              '0 6px 30px rgba(27,67,50,0.3), 0 0 50px rgba(31,175,109,0.06)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Green-to-blue gradient blending at borders */}
          <div
            style={{
              position: 'absolute',
              top: '-30%',
              left: '-20%',
              width: '70%',
              height: '70%',
              background:
                'radial-gradient(ellipse, rgba(34,197,94,0.1), transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-20%',
              right: '-15%',
              width: '60%',
              height: '60%',
              background:
                'radial-gradient(ellipse, rgba(31,175,109,0.08), transparent 70%)',
              filter: 'blur(35px)',
              pointerEvents: 'none',
            }}
          />

          {/* Date */}
          <div
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#4ade80',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              marginBottom: '0.6rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {memory.date}
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(1.25rem, 3vw, 1.7rem)',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '0.8rem',
              position: 'relative',
              zIndex: 1,
              lineHeight: 1.3,
            }}
          >
            {memory.title}
          </h3>

          {/* Description */}
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(0.85rem, 1.8vw, 1rem)',
              color: 'rgba(245,247,250,0.75)',
              lineHeight: 1.85,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {memory.description}
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

/* ─── Main Component ─── */
function MemoryTimeline() {
  const sectionRef = useRef(null)
  const stemRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate stem height
      if (stemRef.current) {
        gsap.fromTo(
          stemRef.current,
          { height: '0%' },
          {
            height: '100%',
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top 60%',
              end: 'bottom 40%',
              scrub: 1,
            },
          }
        )
      }
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="memories"
      ref={sectionRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="memories-container"
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          padding: 'clamp(4rem, 8vw, 8rem) clamp(1rem, 3vw, 2rem)',
        }}
      >
        {/* Inject keyframes */}
        <style>{floatKeyframes}</style>

        {/* Ambient green glow blobs */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '-5%',
            width: '400px',
            height: '400px',
            background:
              'radial-gradient(circle, rgba(31,175,109,0.06), transparent 70%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '55%',
            right: '-5%',
            width: '350px',
            height: '350px',
            background:
              'radial-gradient(circle, rgba(34,197,94,0.05), transparent 70%)',
            filter: 'blur(70px)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Section Title ── */}
        <motion.h2
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="text-gradient"
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 'clamp(2.5rem, 7vw, 3.5rem)',
            fontWeight: 800,
            textAlign: 'center',
            marginBottom: 'clamp(3rem, 6vw, 5rem)',
          }}
        >
          Our Journey
        </motion.h2>

        {/* ── Timeline Container ── */}
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            position: 'relative',
          }}
        >
          {/* ── Vertical Stem Line ── */}
          <div
            className="timeline-stem-line"
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              transform: 'translateX(-50%)',
              width: '2px',
              zIndex: 3,
            }}
          >
            {/* Background track (faint) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '2px',
                background:
                  'linear-gradient(180deg, transparent 0%, rgba(34,197,94,0.15) 10%, rgba(34,197,94,0.15) 90%, transparent 100%)',
              }}
            />
            {/* Animated fill */}
            <div
              ref={stemRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '2px',
                height: '0%',
                background:
                  'linear-gradient(180deg, rgba(34,197,94,0.8), rgba(31,175,109,0.6))',
                boxShadow:
                  '0 0 8px rgba(34,197,94,0.4), 0 0 20px rgba(34,197,94,0.15)',
                filter: 'blur(0.5px)',
              }}
            />
          </div>

          {/* ── Memory Rows ── */}
          {memories.map((memory, index) => (
            <MemoryRow key={memory.id} memory={memory} index={index} />
          ))}
        </div>

        {/* ── Responsive mobile override ── */}
        <style>{`
        @media (max-width: 768px) {
          .memories-container {
            min-height: auto !important;
            padding-bottom: 2rem !important;
          }
          .memory-row {
            margin-bottom: 3rem !important;
          }
          .memory-row:last-child {
            margin-bottom: 0 !important;
          }
          .timeline-stem-line {
            display: none !important;
          }
          #memories > div:last-of-type > div:last-of-type > div {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
          #memories > div:last-of-type > div:last-of-type > div > div:nth-child(1) {
            justify-content: center !important;
            padding-right: 0 !important;
          }
          #memories > div:last-of-type > div:last-of-type > div > div:nth-child(2) {
            display: none !important;
          }
          #memories > div:last-of-type > div:last-of-type > div > div:nth-child(3) {
            padding-left: 0 !important;
          }
        }
      `}</style>
      </div>
    </section>
  )
}

export default MemoryTimeline
