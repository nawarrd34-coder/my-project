import { useLanguage } from '../i18n/LanguageContext'
import FeaturesList from './FeaturesList'
import FloorPlans from './FloorPlans'
import StructuralModels from './StructuralModels'

export default function ProjectShowcase() {
  const { t } = useLanguage()

  return (
    <section id="project" className="relative bg-[#0b0806] px-6 py-24 sm:px-10 lg:px-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 40% at 50% 0%, rgba(184,137,79,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-16 text-center animate-fade-up">
          <p className="font-display text-xs tracking-[0.5em] text-[#b8894f] uppercase">
            {t.showcase.eyebrow}
          </p>
          <h2 className="font-display text-gradient-bronze mt-4 text-4xl font-semibold sm:text-5xl">
            {t.showcase.title}
          </h2>
          <p className="font-ar mt-3 text-lg text-[#f3ead9]/80">{t.showcase.subtitle}</p>
          <p className="font-ar mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-[#c9bba3]/70 sm:text-base">
            {t.showcase.intro}
          </p>
        </div>

        <div className="mb-20 grid grid-cols-1 gap-6 text-center md:grid-cols-3">
          {[t.showcase.developer, t.showcase.owner, t.showcase.office].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[#b8894f]/20 bg-[#1c140f] p-8 shadow-xl"
            >
              <h3 className="mb-2 text-sm tracking-wider text-[#c5a059]">{card.label}</h3>
              <p className="text-lg font-medium text-[#f3ead9]">{card.value}</p>
              {card.sub && <span className="mt-1 block text-xs text-[#8a7d6b]">{card.sub}</span>}
            </div>
          ))}
        </div>

        <div className="mb-24">
          <FeaturesList />
        </div>

        <div id="plans" className="mb-24 border-t border-[#b8894f]/10 pt-20">
          <FloorPlans />
        </div>

        <div className="border-t border-[#b8894f]/10 pt-20">
          <StructuralModels />
        </div>
      </div>
    </section>
  )
}
