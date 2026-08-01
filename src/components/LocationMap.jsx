import { useLanguage } from '../i18n/LanguageContext'
import { GOOGLE_MAPS_URL } from '../i18n/translations'

export default function LocationMap() {
  const { t, lang } = useLanguage()
  const isAr = lang === 'ar'

  return (
    <section id="location" className="relative bg-[#0b0806] px-6 py-24 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center animate-fade-up">
          <p className="font-display text-xs tracking-[0.5em] text-[#b8894f] uppercase">
            {t.nav.location}
          </p>
          <h2 className="font-display text-gradient-bronze mt-4 text-4xl font-semibold sm:text-5xl">
            {t.location.subtitle}
          </h2>
          <p className="font-ar mx-auto mt-4 max-w-2xl text-sm text-[#c9bba3]/70 sm:text-base">
            {t.location.description}
          </p>
        </div>

        <div className="animate-fade-up overflow-hidden rounded-2xl border border-[#b8894f]/25 bg-[#1c140f] shadow-2xl">
          <div className="relative h-72 w-full sm:h-96">
            <iframe
              title="areeb-location-map"
              className="h-full w-full grayscale-[0.3] contrast-[1.1] sepia-[0.15]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src="https://maps.google.com/maps?q=%D8%AD%D9%8A%20%D8%A7%D9%84%D8%B9%D8%A7%D8%B1%D8%B6%20%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6&t=&z=13&ie=UTF8&iwloc=&output=embed"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0806]/70 via-transparent to-transparent" />
          </div>

          <div className="flex flex-col items-center justify-between gap-6 p-8 sm:flex-row">
            <div className={isAr ? 'text-center sm:text-right' : 'text-center sm:text-left'}>
              <p className="font-display text-xs tracking-[0.3em] text-[#8a7d6b] uppercase">
                {t.location.title}
              </p>
              <p className="font-ar mt-1 text-xl font-semibold text-[#f3ead9]">
                {t.location.subtitle}
              </p>
            </div>

            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex shrink-0 items-center gap-3 rounded-full bg-gradient-to-r from-[#d9b579] to-[#b8894f] px-8 py-4 text-sm font-semibold text-[#0b0806] shadow-lg shadow-[#b8894f]/20 transition hover:shadow-[#b8894f]/40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
              </svg>
              {t.location.cta}
              <span className={`transition-transform group-hover:translate-x-1 ${isAr ? 'rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0' : ''}`}>
                {isAr ? '←' : '→'}
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
