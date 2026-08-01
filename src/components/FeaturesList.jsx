import { useLanguage } from '../i18n/LanguageContext'

export default function FeaturesList() {
  const { t, lang } = useLanguage()
  const arrow = lang === 'ar' ? '←' : '→'

  return (
    <div className="animate-fade-up">
      <h3 className="font-display mb-6 text-center text-xs tracking-[0.4em] text-[#b8894f] uppercase">
        {t.showcase.featuresTitle}
      </h3>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-4">
        {t.showcase.features.map((feature, i) => (
          <span key={feature} className="flex items-center gap-2">
            <span className="rounded-full border border-[#b8894f]/30 bg-[#1c140f] px-5 py-2.5 text-sm text-[#f3ead9] sm:text-base">
              {feature}
            </span>
            {i < t.showcase.features.length - 1 && (
              <span className="text-[#7a5a34] select-none">{arrow}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
