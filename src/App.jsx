import { LanguageProvider } from './i18n/LanguageContext'
import Header from './components/Header'
import CinematicTour from './components/CinematicTour'
import ProjectShowcase from './components/ProjectShowcase'
import Warranties from './components/Warranties'
import LocationMap from './components/LocationMap'
import Footer from './components/Footer'

function App() {
  return (
    <LanguageProvider>
      <div id="top" className="bg-[#0b0806]">
        <Header />
        <CinematicTour />
        <ProjectShowcase />
        <Warranties />
        <LocationMap />
        <Footer />
      </div>
    </LanguageProvider>
  )
}

export default App
