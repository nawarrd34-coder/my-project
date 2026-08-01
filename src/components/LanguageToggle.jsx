import { useLanguage } from '../i18n/LanguageContext'

export default function LanguageToggle({ className = '' }) {
  const { lang, toggleLang } = useLanguage()
  const isAr = lang === 'ar'

  return (
    <button
      type="button"
      dir="ltr"
      onClick={toggleLang}
      aria-label="Toggle language"
      className={`relative flex h-9 w-[76px] shrink-0 items-center overflow-hidden rounded-full border border-[#b8894f]/40 bg-black/30 backdrop-blur-md transition-colors hover:border-[#d9b579]/70 ${className}`}
    >
      <span
        className="absolute top-0.5 left-0.5 h-8 w-8 rounded-full bg-gradient-to-br from-[#d9b579] to-[#7a5a34] shadow-[0_0_12px_rgba(184,137,79,0.6)] transition-transform duration-300 ease-out"
        style={{ transform: isAr ? 'translateX(38px)' : 'translateX(0)' }}
      />
      <span
        className={`z-10 flex-1 text-center text-[11px] font-semibold tracking-wide transition-colors ${
          !isAr ? 'text-[#0b0806]' : 'text-[#f3ead9]/70'
        }`}
      >
        EN
      </span>
      <span
        className={`z-10 flex-1 text-center text-[11px] font-semibold tracking-wide transition-colors ${
          isAr ? 'text-[#0b0806]' : 'text-[#f3ead9]/70'
        }`}
      >
        عربي
      </span>
    </button>
  )
}
