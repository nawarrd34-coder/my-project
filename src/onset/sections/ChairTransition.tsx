import Scene from '../components/Scene'
import FilmVideo from '../components/FilmVideo'

function ChairTransition() {
  return (
    <section className="relative h-[80vh] w-full overflow-hidden flex items-center justify-center">
      <FilmVideo src="/videos/chair-transition.mp4" className="onset-drift" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.85) 100%)',
        }}
      />
      <Scene className="relative z-10 text-center px-6">
        <p className="onset-display italic text-white text-2xl sm:text-4xl md:text-5xl">
          Two stories. One studio.
        </p>
      </Scene>
    </section>
  )
}

export default ChairTransition
