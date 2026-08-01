import { useEffect, useRef, useState, useCallback } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { TOUR_ZONES, TOTAL_FRAME_COUNT, frameUrl } from '../data/tourSections'
import { useLanguage } from '../i18n/LanguageContext'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

const SCROLL_VH_PER_ZONE = 105 // scroll distance dedicated to each zone, in vh units

function clamp01(n) {
  return Math.min(1, Math.max(0, n))
}

// smooth fade envelope for an overlay across its own zone: in -> hold -> out
function edgeOpacity(localT, fadeIn = 0.12, fadeOut = 0.85) {
  if (localT < fadeIn) return clamp01(localT / fadeIn)
  if (localT > fadeOut) return clamp01((1 - localT) / (1 - fadeOut))
  return 1
}

export default function CinematicTour() {
  const { t, lang } = useLanguage()
  const wrapperRef = useRef(null)
  const pinRef = useRef(null)
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const overlayRefs = useRef({})
  const dotRefs = useRef({})
  const progressBarRef = useRef(null)
  const lastDrawn = useRef({ zone: null, frameIdx: -1 })
  const imagesRef = useRef({})
  const stRef = useRef(null)

  const [loadProgress, setLoadProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [showHint, setShowHint] = useState(true)

  // preload every frame image up front
  useEffect(() => {
    let loaded = 0
    const zones = TOUR_ZONES.filter((z) => z.kind === 'frames')

    zones.forEach((zone) => {
      imagesRef.current[zone.folder] = new Array(zone.frameCount)
      for (let i = 0; i < zone.frameCount; i++) {
        const img = new Image()
        img.decoding = 'async'
        img.src = frameUrl(zone.folder, i)
        const onSettled = () => {
          loaded += 1
          setLoadProgress(Math.round((loaded / TOTAL_FRAME_COUNT) * 100))
        }
        img.onload = onSettled
        img.onerror = onSettled
        imagesRef.current[zone.folder][i] = img
      }
    })
  }, [])

  useEffect(() => {
    if (loadProgress >= 100) {
      const timeout = setTimeout(() => setReady(true), 350)
      return () => clearTimeout(timeout)
    }
  }, [loadProgress])

  useEffect(() => {
    document.body.style.overflow = ready ? '' : 'hidden'
  }, [ready])

  const drawImage = useCallback((img) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx || !img || !img.complete || img.naturalWidth === 0) return
    const cw = canvas.width
    const ch = canvas.height
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const scale = Math.max(cw / iw, ch / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, dx, dy, dw, dh)
  }, [])

  // canvas + ScrollTrigger setup
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctxRef.current = ctx

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      // redraw last frame after a resize so it doesn't blank out
      const { zone, frameIdx } = lastDrawn.current
      if (zone && frameIdx >= 0 && imagesRef.current[zone]) {
        drawImage(imagesRef.current[zone][frameIdx])
      }
    }
    resize()
    window.addEventListener('resize', resize)

    function applyProgress(percent) {
      let active = TOUR_ZONES[0]
      for (const zone of TOUR_ZONES) {
        if (percent >= zone.start && percent <= zone.end) {
          active = zone
          break
        }
        active = zone
      }
      const span = active.end - active.start || 1
      const localT = clamp01((percent - active.start) / span)

      if (active.kind === 'frames') {
        const frameIdx = Math.min(active.frameCount - 1, Math.floor(localT * active.frameCount))
        if (lastDrawn.current.zone !== active.folder || lastDrawn.current.frameIdx !== frameIdx) {
          drawImage(imagesRef.current[active.folder][frameIdx])
          lastDrawn.current = { zone: active.folder, frameIdx }
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        lastDrawn.current = { zone: null, frameIdx: -1 }
      }

      // overlays (imperative, avoids React re-render every scroll tick)
      TOUR_ZONES.forEach((zone) => {
        const el = overlayRefs.current[zone.key]
        if (!el) return
        if (zone.key === active.key) {
          const op = edgeOpacity(localT, zone.start === 0 ? 0 : 0.12)
          el.style.opacity = String(op)
          el.style.transform = `translateY(${(1 - op) * 18}px)`
          el.style.pointerEvents = op > 0.4 ? 'auto' : 'none'
        } else {
          el.style.opacity = '0'
          el.style.pointerEvents = 'none'
        }
        const dot = dotRefs.current[zone.key]
        if (dot) dot.dataset.active = zone.key === active.key ? 'true' : 'false'
      })

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${percent / 100})`
      }
      if (percent > 2 && showHint) setShowHint(false)
    }

    const st = ScrollTrigger.create({
      trigger: wrapperRef.current,
      start: 'top top',
      end: 'bottom bottom',
      pin: pinRef.current,
      scrub: 0.4,
      onUpdate: (self) => applyProgress(self.progress * 100),
    })
    stRef.current = st
    // draw the very first frame immediately
    applyProgress(0)

    return () => {
      window.removeEventListener('resize', resize)
      st.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawImage])

  useEffect(() => {
    ScrollTrigger.refresh()
  }, [ready])

  const jumpToZone = (zone) => {
    const st = stRef.current
    if (!st) return
    const target = st.start + (zone.start / 100) * (st.end - st.start)
    gsap.to(window, { duration: 1.1, scrollTo: target, ease: 'power2.inOut' })
  }

  return (
    <>
      {!ready && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0b0806] transition-opacity duration-500">
          <p className="font-display mb-6 text-sm tracking-[0.35em] text-[#d9b579]/80 uppercase">
            {lang === 'ar' ? 'عريب للتطوير العقاري' : 'Areeb Real Estate Development'}
          </p>
          <div className="h-px w-40 overflow-hidden bg-[#3a2c1c]">
            <div
              className="h-full bg-gradient-to-r from-[#7a5a34] to-[#d9b579] transition-[width] duration-150 ease-out"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <p className="mt-4 font-mono text-xs text-[#8a7d6b]">{loadProgress}%</p>
        </div>
      )}

      <section ref={wrapperRef} style={{ height: `${SCROLL_VH_PER_ZONE * TOUR_ZONES.length}vh` }}>
        <div ref={pinRef} className="relative h-screen w-full overflow-hidden bg-[#0b0806]">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* vignette for text legibility */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 22%, rgba(0,0,0,0.05) 65%, rgba(0,0,0,0.65) 100%)',
            }}
          />

          {/* hero overlay: zone t1 */}
          <div
            ref={(el) => (overlayRefs.current.t1 = el)}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center opacity-0 transition-opacity"
          >
            <p className="font-display mb-3 text-xs tracking-[0.5em] text-[#d9b579]/70 uppercase">
              {t.hero.project}
            </p>
            <h1 className="font-ar text-3xl font-bold text-[#f3ead9] drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-5xl md:text-6xl">
              {t.hero.brand}
            </h1>
            <p className="font-display mt-3 text-sm italic tracking-[0.3em] text-[#b8894f] sm:text-base">
              {t.hero.tagline}
            </p>

            <div className="mt-8 flex max-w-3xl flex-col items-center gap-2 px-4 text-[11px] text-[#c9bba3]/80 sm:mt-10 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3 sm:gap-y-2 sm:text-xs">
              {t.hero.credits.map((c, i) => (
                <span key={i} className="max-w-full text-balance">
                  {c.value ? `${c.label}: ${c.value}` : c.label}
                  {i < t.hero.credits.length - 1 && (
                    <span className="mx-3 hidden text-[#7a5a34] sm:inline">|</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* chapter caption overlays: t2 - t6 */}
          {TOUR_ZONES.filter((z) => z.kind === 'frames').map((zone) => (
            <div
              key={zone.key}
              ref={(el) => (overlayRefs.current[zone.key] = el)}
              className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-col items-center px-6 text-center opacity-0 transition-opacity sm:bottom-20 sm:items-start sm:text-start ltr:sm:items-start rtl:sm:items-end"
            >
              <span className="font-display text-[11px] tracking-[0.4em] text-[#b8894f]/80">
                {t.tour.chapter} {zone.number}
              </span>
              <h2 className="font-ar mt-2 text-2xl font-semibold text-[#f3ead9] drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-3xl">
                {lang === 'ar' ? zone.captionAr : zone.captionEn}
              </h2>
            </div>
          ))}

          {/* scroll hint */}
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 transition-opacity duration-500 ${
              showHint ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span className="text-[11px] tracking-[0.3em] text-[#c9bba3]/70">
              {t.hero.scrollHint}
            </span>
            <span className="h-8 w-px animate-pulse bg-gradient-to-b from-[#d9b579] to-transparent" />
          </div>

          {/* chapter dots */}
          <div className="absolute inset-y-0 end-4 z-10 hidden flex-col items-center justify-center gap-4 sm:flex md:end-8">
            {TOUR_ZONES.map((zone) => (
              <button
                key={zone.key}
                type="button"
                aria-label={zone.number}
                onClick={() => jumpToZone(zone)}
                ref={(el) => (dotRefs.current[zone.key] = el)}
                data-active="false"
                className="group flex items-center gap-2"
              >
                <span className="hidden text-[10px] tracking-widest text-[#c9bba3]/0 transition-colors group-hover:text-[#c9bba3]/80 group-data-[active=true]:text-[#d9b579] md:inline">
                  {zone.number}
                </span>
                <span className="block h-1.5 w-1.5 rounded-full bg-[#8a7d6b]/50 transition-all group-data-[active=true]:h-2.5 group-data-[active=true]:w-2.5 group-data-[active=true]:bg-[#d9b579]" />
              </button>
            ))}
          </div>

          {/* overall progress bar */}
          <div className="absolute inset-x-0 top-0 z-10 h-[2px] bg-[#1c140f]">
            <div
              ref={progressBarRef}
              className="h-full w-full origin-left bg-gradient-to-r from-[#7a5a34] via-[#d9b579] to-[#7a5a34]"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </div>
      </section>
    </>
  )
}
