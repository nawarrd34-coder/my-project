import { useState } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

function Plate({ label, src, placeholder }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col items-center rounded-xl border border-[#b8894f]/25 bg-[#0f0b08] p-4 shadow-2xl">
      <div className="relative mb-4 flex h-64 w-full items-center justify-center overflow-hidden rounded-lg bg-black/30 sm:h-72">
        {!failed ? (
          <img
            src={src}
            alt={label}
            className="h-full w-full object-contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-[#7a5a34]">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <rect x="3" y="3" width="18" height="18" rx="1.5" />
              <path d="M3 16l5-5 4 4 5-6 4 5" />
              <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
            </svg>
            <span className="text-xs tracking-wide text-[#8a7d6b]">{placeholder}</span>
          </div>
        )}
      </div>
      <h4 className="text-center text-sm font-medium text-[#d9b579] sm:text-base">{label}</h4>
    </div>
  )
}

export default function StructuralModels() {
  const { t } = useLanguage()
  const [activeModel, setActiveModel] = useState('A')

  return (
    <div>
      <div className="mb-10 text-center">
        <h3 className="font-display text-xs tracking-[0.4em] text-[#b8894f] uppercase">
          {t.models.title}
        </h3>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#c9bba3]/70">{t.models.subtitle}</p>
      </div>

      <div className="mb-10 flex items-center justify-center gap-3">
        {t.models.tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveModel(tab.key)}
            className={`rounded-full border px-6 py-2.5 text-sm transition ${
              activeModel === tab.key
                ? 'border-[#d9b579] bg-[#d9b579]/15 text-[#d9b579]'
                : 'border-[#3a2c1c] text-[#8a7d6b] hover:border-[#b8894f]/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        key={activeModel}
        className="animate-fade-up grid grid-cols-1 gap-8 md:grid-cols-3"
      >
        {t.models.plates.map((label, i) => (
          <Plate
            key={label}
            label={label}
            src={`/models/${activeModel}/${i + 1}.jpg`}
            placeholder={t.models.placeholder}
          />
        ))}
      </div>
    </div>
  )
}
