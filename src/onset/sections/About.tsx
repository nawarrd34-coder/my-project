import Scene from '../components/Scene'

function About() {
  return (
    <section
      id="about"
      className="relative min-h-screen w-full flex items-center justify-center px-6 sm:px-10 py-32"
    >
      <div className="max-w-3xl w-full">
        <Scene className="flex items-center gap-4 mb-10">
          <span className="text-white/40 text-xs tracking-[0.4em] uppercase">
            نبذة
          </span>
          <span className="h-px flex-1 bg-white/20" />
          <span className="text-white/40 text-xs tracking-[0.4em] uppercase">
            About On Set
          </span>
        </Scene>

        <Scene delay={0.15}>
          <p className="onset-display italic text-white text-2xl sm:text-4xl md:text-5xl leading-[1.35]">
            We don't make advertisements. We make things worth talking about
            — long before the camera ever rolls.
          </p>
        </Scene>

        <Scene delay={0.3} className="mt-10">
          <p className="text-white/60 text-sm sm:text-base leading-relaxed max-w-2xl">
            ON SET builds documentary-grade brand stories: products born
            from real people, real routines, and real determination.
            Every case study below started as a problem on the street —
            and became a story the street couldn't stop talking about.
          </p>
        </Scene>
      </div>
    </section>
  )
}

export default About
