import { useEffect, useRef, useState } from 'react'

interface IntroSequenceProps {
  onComplete: () => void
}

type Phase = 'logo' | 'video' | 'done'

function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [phase, setPhase] = useState<Phase>('logo')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const toVideo = setTimeout(() => setPhase('video'), 1900)
    return () => clearTimeout(toVideo)
  }, [])

  useEffect(() => {
    if (phase !== 'video') return
    const fallback = setTimeout(finish, 4200)
    return () => clearTimeout(fallback)
    function finish() {
      setPhase('done')
      setTimeout(onComplete, 900)
    }
  }, [phase, onComplete])

  if (phase === 'done') return null

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      style={{
        opacity: 1,
        transition: 'opacity 0.9s ease',
        ...(phase === 'video' ? {} : {}),
      }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
        style={{ opacity: phase === 'logo' ? 1 : 0 }}
      >
        <div
          className="flex flex-col items-center gap-3"
          style={{
            animation: 'onsetLogoIn 1.6s cubic-bezier(0.16,1,0.3,1) forwards',
          }}
        >
          <span className="text-white text-4xl sm:text-6xl font-semibold tracking-[0.35em] uppercase">
            On Set
          </span>
          <span className="text-white/50 text-xs sm:text-sm tracking-[0.5em] uppercase">
            Creative Studio
          </span>
        </div>
      </div>

      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ opacity: phase === 'video' ? 1 : 0 }}
        src="/videos/opening-transition.mp4"
        autoPlay
        muted
        playsInline
        onEnded={() => {
          setPhase('done')
          setTimeout(onComplete, 900)
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)',
        }}
      />
    </div>
  )
}

export default IntroSequence
