import { useState } from 'react'
import CinematicBackground from './components/CinematicBackground'
import IntroSequence from './sections/IntroSequence'
import Hero from './sections/Hero'
import About from './sections/About'
import ChairTransition from './sections/ChairTransition'
import CaseStudyBarriers from './sections/CaseStudyBarriers'
import CaseStudySarah from './sections/CaseStudySarah'
import Footer from './sections/Footer'

function OnSetApp() {
  const [introDone, setIntroDone] = useState(false)

  return (
    <div className="onset-body relative min-h-screen w-full bg-black overflow-x-hidden">
      <CinematicBackground />

      {!introDone && <IntroSequence onComplete={() => setIntroDone(true)} />}

      <div
        className="relative z-10"
        style={{
          opacity: introDone ? 1 : 0,
          transition: 'opacity 1.2s ease',
        }}
      >
        <Hero />
        <About />
        <ChairTransition />
        <CaseStudyBarriers />
        <CaseStudySarah />
        <Footer />
      </div>
    </div>
  )
}

export default OnSetApp
