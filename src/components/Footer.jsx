import { useLanguage } from '../i18n/LanguageContext'

export default function Footer() {
  const { t } = useLanguage()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[#b8894f]/15 bg-[#0b0806] px-6 py-10 text-center">
      <p className="font-display text-sm tracking-[0.3em] text-[#d9b579]">
        {t.hero.brand}
      </p>
      <p className="mt-2 text-xs text-[#7a5a34]">
        © {year} THE STONE — AREEB. {t.footer.rights}.
      </p>
    </footer>
  )
}
