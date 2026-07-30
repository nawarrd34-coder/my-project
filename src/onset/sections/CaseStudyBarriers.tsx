import Scene from '../components/Scene'
import FilmVideo from '../components/FilmVideo'

function CaseStudyBarriers() {
  return (
    <section className="relative w-full">
      <div className="relative h-screen w-full flex flex-col items-center justify-center px-6 text-center">
        <Scene>
          <span className="text-white/40 text-xs tracking-[0.4em] uppercase">
            Case Study 01
          </span>
          <h2 className="onset-display italic text-white text-4xl sm:text-6xl md:text-7xl mt-6 leading-tight">
            عزيمة الصبات
          </h2>
          <p className="text-white/50 text-sm sm:text-base tracking-[0.15em] uppercase mt-4">
            The Concrete Barriers Campaign
          </p>
        </Scene>
      </div>

      <div className="relative min-h-[70vh] w-full flex items-center justify-center px-6 py-32">
        <Scene className="max-w-2xl text-center">
          <p className="onset-display italic text-white text-2xl sm:text-4xl leading-[1.4]">
            For 65 days, concrete barriers blocked the road leading to THE IT
            café.
          </p>
          <p className="text-white/60 text-base sm:text-lg mt-6 leading-relaxed">
            Everyone expected the business to suffer. Instead, customers kept
            searching for different routes just to reach their coffee.
          </p>
        </Scene>
      </div>

      <div className="relative h-screen w-full overflow-hidden flex items-end">
        <FilmVideo src="/videos/barriers-broll.mp4" className="onset-drift" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.5) 100%)',
          }}
        />
        <Scene className="relative z-10 w-full px-6 sm:px-14 pb-20 max-w-xl">
          <p className="text-white text-xl sm:text-3xl leading-snug">
            Over time, the barriers became part of the story rather than the
            problem.
          </p>
        </Scene>
      </div>

      <div className="relative min-h-[70vh] w-full flex items-center justify-center px-6 py-32">
        <Scene className="max-w-2xl text-center">
          <p className="text-white/60 text-base sm:text-lg leading-relaxed">
            We celebrated them with the campaign{' '}
            <span className="text-white">عزيمة الصبات</span> — products,
            content, experiences, and visual storytelling. The barriers
            became a symbol of determination. People experienced the
            campaign before they ever saw the advertisement.
          </p>
        </Scene>
      </div>

      <div className="relative h-[70vh] w-full flex items-center justify-center px-6 text-center">
        <Scene>
          <p className="onset-display italic text-white text-3xl sm:text-5xl md:text-6xl leading-tight">
            The barriers closed the road,
            <br />
            but opened an unforgettable story.
          </p>
        </Scene>
      </div>
    </section>
  )
}

export default CaseStudyBarriers
