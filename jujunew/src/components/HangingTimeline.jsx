import { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const keyframes = `
@keyframes vineSway {
  0%, 100% { transform: translateX(-50%) rotate(0.5deg); }
  50% { transform: translateX(-50%) rotate(-0.5deg); }
}
@keyframes polaroidSway {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}
@keyframes polaroidFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
@keyframes floatParticleEmerald {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  25% { opacity: 0.6; }
  50% { transform: translateY(-100px) translateX(20px); opacity: 0.4; }
  75% { opacity: 0.6; }
  100% { transform: translateY(-200px) translateX(-20px); opacity: 0; }
}
@keyframes captionFadeIn {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes glowPulse {
  0%, 100% {
    filter: drop-shadow(0 0 16px rgba(200, 162, 255, 0.5))
            drop-shadow(0 0 32px rgba(200, 162, 255, 0.25))
            drop-shadow(0 0 6px rgba(0, 245, 212, 0.2));
  }
  50% {
    filter: drop-shadow(0 0 22px rgba(200, 162, 255, 0.7))
            drop-shadow(0 0 44px rgba(200, 162, 255, 0.35))
            drop-shadow(0 0 10px rgba(0, 245, 212, 0.3));
  }
}

.hanging-timeline .photo-card {
  background: #ffffff;
  padding: 12px 12px 50px 12px;
  border-radius: 4px;
  box-shadow: 0 10px 25px rgba(2, 26, 22, 0.4), 0 0 15px rgba(52, 211, 153, 0.25);
  border: 1px solid rgba(52, 211, 153, 0.2);
  position: relative;
  width: 100%;
}

.hanging-timeline .caption {
  position: absolute;
  bottom: 0px;
  left: 0;
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 12px;
  box-sizing: border-box;
  color: #333;
  font-size: 1.1rem;
  font-weight: 500;
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  text-align: center;
  opacity: 0;
  animation: captionFadeIn 0.8s ease-out forwards;
  animation-delay: 1.0s;
}
`

const photos = [
    { img: "17.jpeg", rotate: -3, caption: "✨Sangam 01/03/25✨" },
    { img: "3.jpeg", rotate: 4, caption: "✨10/07/20✨" },
    { img: "8.jpeg", rotate: -2, caption: "✨MahaKaleshwar✨ ✨09/04/24✨" },
    { img: "25.jpeg", rotate: 5, caption: "✨Teacher's Day✨ ✨05/09/18✨" },
    { img: "12.jpeg", rotate: -4, caption: "✨12/02/22✨" },
    { img: "16.jpeg", rotate: 2, caption: "✨JK Temple✨ ✨26/12/24✨" },
    { img: "22.jpeg", rotate: -5, caption: "✨31/03/25✨" },
    { img: "10.jpeg", rotate: 4, caption: "✨MahaKaleshwar✨ ✨09/04/24✨" },
    { img: "20.jpeg", rotate: -3, caption: "✨27/04/22✨" },
    { img: "4.jpeg", rotate: 4, caption: "😂A A N C H A L 😂 ✨19/01/20✨" },
    { img: "6.jpeg", rotate: -3, caption: "✨Rakshabandhan✨ ✨22/08/21✨" }
]

export default function HangingTimeline() {
    const particles = useMemo(() => {
        // Generate random particles with deterministic seeding to avoid purity violations
        return Array.from({ length: 25 }, (_, i) => {
            // Use index as seed for deterministic randomness
            const seed = (i * 73856093) ^ 19349663;
            const pseudo = Math.sin(seed) * 10000;
            const rand1 = pseudo - Math.floor(pseudo);
            const rand2 = Math.sin(seed * 2) * 10000 - Math.floor(Math.sin(seed * 2) * 10000);
            const rand3 = Math.sin(seed * 3) * 10000 - Math.floor(Math.sin(seed * 3) * 10000);
            const rand4 = Math.sin(seed * 4) * 10000 - Math.floor(Math.sin(seed * 4) * 10000);
            return {
                id: i,
                left: `${rand1 * 100}%`,
                top: `${rand2 * 100}%`,
                delay: rand3 * 5,
                size: 2 + rand4 * 4,
                duration: 6 + Math.sin(seed * 5) * 6,
            };
        });
    }, []);

    // ── State-driven Gap Filler (Touch Me → show / Restart → hide) ──
    const timelineRef = useRef(null);
    const [showGapFiller, setShowGapFiller] = useState(false);

    useEffect(() => {
        const handleShow = () => setShowGapFiller(true);
        const handleHide = () => setShowGapFiller(false);

        window.addEventListener('timeline:showFiller', handleShow);
        window.addEventListener('timeline:hideFiller', handleHide);

        return () => {
            window.removeEventListener('timeline:showFiller', handleShow);
            window.removeEventListener('timeline:hideFiller', handleHide);
        };
    }, []);

    // Smooth seamless curved vine SVG pattern
    const vinePattern = `data:image/svg+xml,%3Csvg width='30' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M15,0 Q0,50 15,100 T15,200' fill='none' stroke='%2334d399' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E`;

    return (
        <div className="hanging-timeline" ref={timelineRef} style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            padding: '4rem 0',
        }}>
            <style>{keyframes}</style>

            {/* Cinematic Vignette */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(transparent 30%, rgba(100, 216, 82, 0.93) 100%)',
                pointerEvents: 'none',
                zIndex: 1,
            }} />

            {/* Subtle Blurred Emerald Glow behind column */}
            <div style={{
                position: 'absolute',
                inset: '20%',
                background: 'rgba(240, 246, 244, 0.05)',
                filter: 'blur(80px)',
                zIndex: 0,
                pointerEvents: 'none',
            }} />

            {/* Floating Emerald Particles */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                {particles.map(p => (
                    <div key={p.id} style={{
                        position: 'absolute',
                        left: p.left,
                        top: p.top,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        background: '#34d399',
                        borderRadius: '50%',
                        boxShadow: '0 0 10px #10b981, 0 0 15px #34d399',
                        animation: `floatParticleEmerald ${p.duration}s infinite linear`,
                        animationDelay: `${p.delay}s`,
                        opacity: 0, // starts at 0 due to animation
                    }} />
                ))}
            </div>

            {/* Main Content Container */}
            <div style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                paddingBottom: '2rem',
            }}>

                {/* ── Section Title ── */}
                <motion.h2
                    className="hanging-gallery-title"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 'clamp(1.1rem, 2vw, 2rem)',
                        fontWeight: 700,
                        textAlign: 'center',
                        whiteSpace: 'normal',
                        marginBottom: 'clamp(2.5rem, 5vw, 4rem)',
                        background: 'linear-gradient(90deg, #E6D6FF 0%, #D4BFFF 30%, #C8A2FF 55%, #7BEAD4 80%, #00F5D4 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'glowPulse 4s ease-in-out infinite',
                        letterSpacing: '1px',
                        paddingLeft: '1px',
                        position: 'relative',
                        zIndex: 10,
                        width: '100%',
                    }}
                >
                    {/* Blurred glow layer behind text for premium neon depth */}
                    <span
                        className="hanging-gallery-title-glow"
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(90deg, #E6D6FF 0%, #D4BFFF 30%, #C8A2FF 55%, #7BEAD4 80%, #00F5D4 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'blur(10px)',
                            opacity: 0.45,
                            pointerEvents: 'none',
                            zIndex: -1,
                            fontFamily: 'inherit',
                            fontSize: 'inherit',
                            fontWeight: 'inherit',
                            letterSpacing: 'inherit',
                        }}
                    >
                        Every Click Holds a Lifetime
                    </span>
                    Every Click Holds a Lifetime
                </motion.h2>



                {/* Render each Polaroid photo hanging on the vine */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5rem',
                    width: '100%',
                    alignItems: 'center',
                    position: 'relative',
                }}>
                    {/* The Continuous Glowing Vine — starts from first image edge */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        bottom: 0,
                        width: '30px',
                        transformOrigin: 'top center',
                        animation: 'vineSway 8s ease-in-out infinite alternate',
                        backgroundImage: `url("${vinePattern}")`,
                        backgroundRepeat: 'repeat-y',
                        backgroundPosition: 'top center',
                        filter: 'drop-shadow(0 0 6px #10b981) drop-shadow(0 0 12px #34d399)',
                        zIndex: -1,
                    }} />
                    {photos.map((ph, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: '-50px' }}
                            transition={{ duration: 0.8, delay: (idx % 2) * 0.15 + 0.1 }}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                position: 'relative',
                                animation: 'polaroidSway 5s ease-in-out infinite alternate',
                                animationDelay: `${idx * 0.6}s`,
                                transformOrigin: 'top center',
                                width: 'min(85%, 220px)',
                            }}
                        >
                            {/* Emerald Clip */}
                            <div style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: '#10b981',
                                boxShadow: '0 0 8px #34d399, 0 0 15px rgba(16, 185, 129, 0.8), inset 0 0 4px #fff',
                                border: '2px solid #34d399',
                                position: 'absolute',
                                top: '-7px',
                                zIndex: 10,
                            }} />

                            {/* Polaroid Frame */}
                            <motion.div
                                className="photo-card"
                                whileHover={{
                                    scale: 1.05,
                                    rotate: 0,
                                    boxShadow: '0 15px 35px rgba(2, 26, 22, 0.6), 0 0 30px rgba(52, 211, 153, 0.5)'
                                }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                                style={{
                                    transform: `rotate(${ph.rotate}deg)`,
                                }}
                            >
                                {/* Inner Emerald Glow overlay */}
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '4px',
                                    boxShadow: 'inset 0 0 25px rgba(16, 185, 129, 0.15)',
                                    pointerEvents: 'none',
                                }} />

                                {/* Sparkling dots array on hover simulates a sparkle effect */}
                                <motion.div
                                    className="hover-sparkles"
                                    initial={{ opacity: 0 }}
                                    whileHover={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
                                >
                                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '6px', height: '6px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 8px #34d399' }} />
                                    <div style={{ position: 'absolute', bottom: '15px', right: '-15px', width: '4px', height: '4px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 8px #34d399' }} />
                                    <div style={{ position: 'absolute', top: '50%', left: '-12px', width: '5px', height: '5px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 8px #34d399' }} />
                                </motion.div>

                                {/* Image Wrapper */}
                                <div style={{
                                    width: '100%',
                                    aspectRatio: '3/4',
                                    overflow: 'hidden',
                                    borderRadius: '2px',
                                    background: '#222',
                                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                                }}>
                                    <img src={ph.img} alt="Memory polaroid" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>

                                {/* Caption Area */}
                                <div className="caption">
                                    {ph.caption}
                                </div>
                            </motion.div>
                        </motion.div>
                    ))}

                    {/* ── Dynamic Gap Filler (Touch Me → show / Restart → remove) ── */}
                    {showGapFiller && (
                        <motion.div
                            id="dynamic-gap-image"
                            className="gap-image"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                position: 'relative',
                                animation: 'polaroidSway 5s ease-in-out infinite alternate',
                                animationDelay: '0.6s',
                                transformOrigin: 'top center',
                                width: 'min(85%, 220px)',
                            }}
                        >
                            {/* Emerald Clip */}
                            <div style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: '#10b981',
                                boxShadow: '0 0 8px #34d399, 0 0 15px rgba(16, 185, 129, 0.8), inset 0 0 4px #fff',
                                border: '2px solid #34d399',
                                position: 'absolute',
                                top: '-7px',
                                zIndex: 10,
                            }} />

                            {/* Filler Polaroid Frame */}
                            <div
                                className="photo-card"
                                style={{ transform: 'rotate(-2deg)' }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '4px',
                                    boxShadow: 'inset 0 0 25px rgba(16, 185, 129, 0.15)',
                                    pointerEvents: 'none',
                                }} />
                                <div style={{
                                    width: '100%',
                                    aspectRatio: '3/4',
                                    overflow: 'hidden',
                                    borderRadius: '2px',
                                    background: '#222',
                                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                                }}>
                                    <img
                                        src="19.jpeg"
                                        alt="Memory polaroid"
                                        loading="lazy"
                                        decoding="async"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                                <div className="caption">
                                    ✨ Bonus Memory ✨
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div >
        </div >
    )
}
