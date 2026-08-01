import { useLanguage } from '../i18n/LanguageContext'
import LanguageToggle from './LanguageToggle'

export default function Header() {
  const { t } = useLanguage()

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-8">
      <a href="#top" className="font-display text-sm tracking-[0.3em] text-[#f3ead9]/90 drop-shadow-md sm:text-base">
        AREEB<span className="text-[#d9b579]"> · THE STONE</span>
      </a>

      <nav className="hidden items-center gap-8 text-xs tracking-wide text-[#f3ead9]/80 md:flex">
        <a href="#project" className="transition hover:text-[#d9b579]">
          {t.nav.project}
        </a>
        <a href="#plans" className="transition hover:text-[#d9b579]">
          {t.nav.plans}
        </a>
        <a href="#warranties" className="transition hover:text-[#d9b579]">
          {t.nav.warranties}
        </a>
        <a href="#location" className="transition hover:text-[#d9b579]">
          {t.nav.location}
        </a>
      </nav>

      <LanguageToggle />
    </header>
  )
}
