import Scene from '../components/Scene'
import FilmVideo from '../components/FilmVideo'

function CaseStudySarah() {
  return (
    <section className="relative w-full">
      <div className="relative h-screen w-full flex flex-col items-center justify-center px-6 text-center">
        <Scene>
          <span className="text-white/40 text-xs tracking-[0.4em] uppercase">
            Case Study 02
          </span>
          <h2 className="onset-display italic text-white text-4xl sm:text-6xl md:text-7xl mt-6 leading-tight">
            البطلة سارة الصالح
          </h2>
          <p className="text-white/50 text-sm sm:text-base tracking-[0.15em] uppercase mt-4">
            Sarah Al-Salih — Padel Champion, East Riyadh
          </p>
        </Scene>
      </div>

      <div className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        <FilmVideo src="/videos/sarah-transition.mp4" className="onset-drift" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.15) 65%, rgba(0,0,0,0.85) 100%)',
          }}
        />
        <Scene className="relative z-10 text-center px-6">
          <p className="onset-display italic text-white text-3xl sm:text-5xl md:text-6xl leading-tight">
            Discipline is the only opponent
            <br />
            that never takes a day off.
          </p>
        </Scene>
      </div>

      <div className="relative min-h-[70vh] w-full flex items-center justify-center px-6 py-32">
        <Scene className="max-w-2xl text-center">
          <p className="onset-display italic text-white text-2xl sm:text-4xl leading-[1.4]">
            The idea started with Sarah Al-Salih, a professional padel
            champion from East Riyadh.
          </p>
          <p className="text-white/60 text-base sm:text-lg mt-6 leading-relaxed">
            We built a product inspired by her journey — Sarah's Protein
            Shake. This was never just a drink. It was community, daily
            training, discipline, morning routines, preparation, and
            competition, told one frame at a time.
          </p>
        </Scene>
      </div>

      <div className="relative h-screen w-full overflow-hidden flex items-end">
        <FilmVideo src="/videos/sarah-broll.mp4" className="onset-drift" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.5) 100%)',
          }}
        />
        <Scene className="relative z-10 w-full px-6 sm:px-14 pb-20 max-w-xl">
          <p className="text-white text-xl sm:text-3xl leading-snug">
            The audience followed her journey until the shake became a
            symbol of local pride.
          </p>
        </Scene>
      </div>

      <div className="relative h-[70vh] w-full flex items-center justify-center px-6 text-center">
        <Scene>
          <p className="onset-display italic text-white text-3xl sm:text-5xl md:text-6xl leading-tight">
            East Riyadh trained a champion.
            <br />
            The champion trained a movement.
          </p>
        </Scene>
      </div>
    </section>
  )
}

export default CaseStudySarah
