import { useLanguage } from '../i18n/LanguageContext'

export default function Warranties() {
  const { t } = useLanguage()

  return (
    <section id="warranties" className="relative bg-[#120d0a] px-6 py-24 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center animate-fade-up">
          <p className="font-display text-xs tracking-[0.5em] text-[#b8894f] uppercase">
            {t.nav.warranties}
          </p>
          <h2 className="font-display text-gradient-bronze mt-4 text-4xl font-semibold sm:text-5xl">
            {t.warranties.title}
          </h2>
          <p className="font-ar mx-auto mt-4 max-w-2xl text-sm text-[#c9bba3]/70 sm:text-base">
            {t.warranties.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.warranties.items.map((item, i) => (
            <div
              key={item.label}
              className="animate-fade-up group flex items-center justify-between gap-4 rounded-xl border border-[#b8894f]/20 bg-[#1c140f] px-6 py-5 transition hover:border-[#d9b579]/50 hover:bg-[#221810]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-sm font-medium text-[#f3ead9] sm:text-base">
                {item.label}
              </span>
              <span className="font-display shrink-0 rounded-full border border-[#b8894f]/30 bg-[#0f0b08] px-4 py-1.5 text-xs font-semibold text-[#d9b579] sm:text-sm">
                {item.duration}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
