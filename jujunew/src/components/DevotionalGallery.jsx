import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import './DevotionalGallery.css';

const images = [
    { src: '/ganesh.webp', alt: 'Ganesh' },
    { src: '/ganeshlord.webp', alt: 'Ganesh Lord' },
    { src: '/krish.webp', alt: 'Krish' },
    { src: '/krishna.webp', alt: 'Krishna' },
];

const MOBILE_BREAKPOINT = 768;
const PAUSE_DURATION_MS = 5000;
const AUTO_SCROLL_SPEED = 0.8; // px per frame (~48px/s at 60fps)

export default function DevotionalGallery() {
    const [activeIndex, setActiveIndex] = useState(null); // tapped image index
    const scrollRef = useRef(null);       // .gallery-scroll element
    const trackRef = useRef(null);        // .gallery-track element
    const rafRef = useRef(null);          // requestAnimationFrame id
    const resumeTimerRef = useRef(null);  // 5-second resume timer
    const isPausedRef = useRef(false);    // mutable pause flag (avoids stale closures)
    const scrollDirectionRef = useRef(-1); // -1 = right→left (default), 1 = left→right
    const touchStartXRef = useRef(0);
    const touchStartScrollRef = useRef(0);
    const isTouchingRef = useRef(false);
    const lastTouchTimeRef = useRef(0);
    const isMobileRef = useRef(false);

    /* ── Helpers ────────────────────────────────────────── */

    const isMobile = useCallback(() => {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }, []);

    const getSetWidth = useCallback(() => {
        /* Width of one full image set (4 items + gaps) */
        const itemWidth = window.innerWidth <= 500 ? 260 : 300;
        const gap = 30;
        return images.length * itemWidth + images.length * gap; // 4 items + 4 gaps (including trailing)
    }, []);

    const clearResumeTimer = useCallback(() => {
        if (resumeTimerRef.current) {
            clearTimeout(resumeTimerRef.current);
            resumeTimerRef.current = null;
        }
    }, []);

    const stopAutoScroll = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    /* ── Auto-scroll loop (rAF) ────────────────────────── */

    const startAutoScroll = useCallback(() => {
        stopAutoScroll();
        if (!isMobileRef.current) return;

        const el = scrollRef.current;
        if (!el) return;

        const tick = () => {
            if (isPausedRef.current || !isMobileRef.current) {
                rafRef.current = null;
                return;
            }

            const setWidth = getSetWidth();
            let scrollLeft = el.scrollLeft;

            /* Move in current direction */
            scrollLeft += AUTO_SCROLL_SPEED * (-scrollDirectionRef.current);
            // direction: -1 means scroll content right→left → scrollLeft increases
            // direction:  1 means scroll content left→right → scrollLeft decreases

            /* Seamless loop: wrap around when we've scrolled past one full set */
            if (scrollLeft >= setWidth) {
                scrollLeft -= setWidth;
            } else if (scrollLeft <= 0) {
                scrollLeft += setWidth;
            }

            el.scrollLeft = scrollLeft;
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
    }, [stopAutoScroll, getSetWidth]);

    /* ── Pause + schedule resume ───────────────────────── */

    const pauseAndScheduleResume = useCallback(() => {
        isPausedRef.current = true;
        stopAutoScroll();
        clearResumeTimer();

        resumeTimerRef.current = setTimeout(() => {
            resumeTimerRef.current = null;
            if (!isMobileRef.current) return;
            isPausedRef.current = false;
            setActiveIndex(null);
            startAutoScroll();
        }, PAUSE_DURATION_MS);
    }, [stopAutoScroll, clearResumeTimer, startAutoScroll]);

    /* ── Tap handler: center the clicked image ─────────── */

    const handleImageTap = useCallback((index) => {
        if (!isMobile()) return;

        const el = scrollRef.current;
        if (!el) return;

        /* Determine the actual DOM item to center */
        const items = el.querySelectorAll('.gallery-item-wrapper');
        const targetItem = items[index];
        if (!targetItem) return;

        /* Pause immediately */
        pauseAndScheduleResume();

        /* Set active for glow + scale */
        setActiveIndex(index);

        /* Calculate scroll position to center the item in the viewport */
        const containerRect = el.getBoundingClientRect();
        const itemRect = targetItem.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;
        const containerCenter = containerRect.left + containerRect.width / 2;
        const scrollAdjustment = itemCenter - containerCenter;

        el.scrollTo({
            left: el.scrollLeft + scrollAdjustment,
            behavior: 'smooth',
        });
    }, [isMobile, pauseAndScheduleResume]);

    /* ── Touch event handlers (passive) ────────────────── */

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onTouchStart = (e) => {
            if (!isMobile()) return;
            isTouchingRef.current = true;
            touchStartXRef.current = e.touches[0].clientX;
            touchStartScrollRef.current = el.scrollLeft;

            /* Pause auto-scroll on any touch */
            isPausedRef.current = true;
            stopAutoScroll();
            clearResumeTimer();
        };

        const onTouchMove = (e) => {
            if (!isMobile() || !isTouchingRef.current) return;

            const deltaX = touchStartXRef.current - e.touches[0].clientX;
            el.scrollLeft = touchStartScrollRef.current + deltaX;

            /* Detect swipe direction for auto-scroll override */
            if (Math.abs(deltaX) > 10) {
                // deltaX > 0: user swiped left → content should scroll right → direction = -1
                // deltaX < 0: user swiped right → content should scroll left → direction = 1
                scrollDirectionRef.current = deltaX > 0 ? -1 : 1;
            }
        };

        const onTouchEnd = () => {
            if (!isMobile()) return;
            isTouchingRef.current = false;
            lastTouchTimeRef.current = Date.now();

            /* Snap to nearest image center */
            snapToNearest(el);

            /* Schedule resume */
            pauseAndScheduleResume();
        };

        const snapToNearest = (scrollEl) => {
            const items = scrollEl.querySelectorAll('.gallery-item-wrapper');
            const containerCenter = scrollEl.getBoundingClientRect().left + scrollEl.clientWidth / 2;
            let closestItem = null;
            let closestDistance = Infinity;

            items.forEach((item) => {
                const rect = item.getBoundingClientRect();
                const itemCenter = rect.left + rect.width / 2;
                const distance = Math.abs(itemCenter - containerCenter);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestItem = item;
                }
            });

            if (closestItem) {
                const itemRect = closestItem.getBoundingClientRect();
                const itemCenter = itemRect.left + itemRect.width / 2;
                const scrollAdjust = itemCenter - containerCenter;

                scrollEl.scrollTo({
                    left: scrollEl.scrollLeft + scrollAdjust,
                    behavior: 'smooth',
                });
            }
        };

        /* Use passive listeners for performance */
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [isMobile, stopAutoScroll, clearResumeTimer, pauseAndScheduleResume]);

    /* ── Initialize mobile auto-scroll & handle resize ─── */

    useEffect(() => {
        const el = scrollRef.current;

        const initMobile = () => {
            const mobile = isMobile();
            isMobileRef.current = mobile;

            if (mobile && el) {
                /* Enable JS-driven scrolling: allow overflow for scrollLeft control */
                el.style.overflowX = 'hidden';
                isPausedRef.current = false;
                setActiveIndex(null);
                startAutoScroll();
            } else {
                /* Desktop: clean up */
                stopAutoScroll();
                clearResumeTimer();
                isPausedRef.current = false;
                setActiveIndex(null);
                if (el) {
                    el.style.overflowX = '';
                    el.scrollLeft = 0;
                }
            }
        };

        initMobile();

        const onResize = () => initMobile();
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            stopAutoScroll();
            clearResumeTimer();
        };
    }, [isMobile, startAutoScroll, stopAutoScroll, clearResumeTimer]);

    /* ── Render a single gallery card ──────────────────── */

    const renderCard = (img, index, keyPrefix, isDuplicate = false) => {
        const globalIndex = isDuplicate ? images.length + index : index;
        const isActive = activeIndex === globalIndex;

        return (
            <motion.div
                key={`${keyPrefix}-${index}`}
                className={`gallery-item-wrapper${isDuplicate ? ' gallery-item-duplicate' : ''}${isActive ? ' gallery-item-active' : ''}`}
                animate={{ y: [0, -12, 0] }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.4,
                }}
            >
                <div
                    className={`gallery-item${isActive ? ' gallery-item-focused' : ''}`}
                    onClick={() => handleImageTap(globalIndex)}
                >
                    <img src={img.src} alt={img.alt} loading="lazy" decoding="async" />
                    <div className="shine-overlay" />
                </div>
            </motion.div>
        );
    };

    return (
        <motion.div
            className="devotional-gallery-container"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
        >
            <div className="ambient-glow" />

            <div className="glass-container">
                <div className="music-indicator">
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span className="music-text">Devotional Aura</span>
                </div>

                <div className="particle-container">
                    {[...Array(15)].map((_, i) => (
                        <div key={i} className={`particle p-${i}`} />
                    ))}
                </div>

                {/* Edge gradient fades — visible only on mobile via CSS */}
                <div className="gallery-fade gallery-fade-left" />
                <div className="gallery-fade gallery-fade-right" />

                {/* 
                  DESKTOP: .gallery-scroll shows original 4 items centered, duplicates hidden.
                  MOBILE:  JS controls scrollLeft for smooth auto-scroll + user interaction.
                */}
                <div className="gallery-scroll" ref={scrollRef}>
                    <div className="gallery-track" ref={trackRef}>
                        {/* Original set */}
                        {images.map((img, i) => renderCard(img, i, 'orig', false))}
                        {/* Duplicate set for seamless loop (hidden on desktop via CSS) */}
                        {images.map((img, i) => renderCard(img, i, 'dupe', true))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
