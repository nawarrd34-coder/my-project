function Hero() {
  return (
    <section className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 sm:px-10 py-6">
        <span className="text-white text-lg font-semibold tracking-[0.3em] uppercase">
          On Set
        </span>
        <a
          href="#about"
          className="text-white/70 hover:text-white text-xs tracking-[0.2em] uppercase transition-colors"
        >
          Enter
        </a>
      </nav>

      <div
        className="flex flex-col items-center text-center px-6"
        style={{ animation: 'onsetFadeIn 1.4s ease forwards', animationDelay: '0.2s', opacity: 0 }}
      >
        <span className="onset-display italic text-white text-3xl sm:text-5xl md:text-6xl leading-tight">
          Every frame tells
        </span>
        <span className="onset-display italic text-white text-3xl sm:text-5xl md:text-6xl leading-tight -mt-1 sm:-mt-2">
          a story worth keeping
        </span>
        <p className="mt-6 max-w-md text-white/60 text-sm sm:text-base tracking-wide">
          ON SET is a creative studio crafting cinematic brand experiences —
          products, content, and moments that people live before they ever
          see the advertisement.
        </p>
      </div>

      <div className="absolute bottom-10 flex flex-col items-center gap-2 text-white/40">
        <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
        <div className="w-px h-10 bg-white/30" />
      </div>
    </section>
  )
}

export default Hero
