import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

export default function FloorPlans() {
  const { t, lang } = useLanguage()
  const floors = t.plans.floors
  const [active, setActive] = useState(0)
  const isAr = lang === 'ar'
  const prevArrow = isAr ? '›' : '‹'
  const nextArrow = isAr ? '‹' : '›'

  const go = (delta) => {
    setActive((cur) => (cur + delta + floors.length) % floors.length)
  }

  return (
    <div>
      <div className="mb-10 text-center">
        <h3 className="font-display text-xs tracking-[0.4em] text-[#b8894f] uppercase">
          {t.plans.title}
        </h3>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#c9bba3]/70">{t.plans.subtitle}</p>
      </div>

      <div className="mx-auto flex max-w-3xl items-center justify-center gap-4 sm:gap-6">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="previous floor"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#b8894f]/30 text-lg text-[#d9b579] transition hover:border-[#d9b579] hover:bg-[#d9b579]/10"
        >
          {prevArrow}
        </button>

        <div className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:gap-3">
          {floors.map((floor, i) => (
            <button
              key={floor.key}
              type="button"
              onClick={() => setActive(i)}
              className={`rounded-full border px-4 py-2 text-xs transition sm:text-sm ${
                i === active
                  ? 'border-[#d9b579] bg-[#d9b579]/15 text-[#d9b579]'
                  : 'border-[#3a2c1c] text-[#8a7d6b] hover:border-[#b8894f]/40'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="next floor"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#b8894f]/30 text-lg text-[#d9b579] transition hover:border-[#d9b579] hover:bg-[#d9b579]/10"
        >
          {nextArrow}
        </button>
      </div>

      <div
        key={floors[active].key}
        className="animate-fade-up mx-auto mt-10 max-w-3xl rounded-2xl border border-[#b8894f]/20 bg-[#1c140f] p-8 shadow-2xl sm:p-10"
      >
        <h4 className="font-ar mb-6 text-center text-xl font-semibold text-[#d9b579] sm:text-2xl">
          {floors[active].name}
        </h4>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {floors[active].items.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-[#f3ead9] sm:text-base">
              <span className="text-[#b8894f]">{isAr ? '←' : '→'}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
