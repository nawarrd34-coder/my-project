import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translations } from './translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return 'ar'
    return window.localStorage.getItem('areeb-lang') || 'ar'
  })

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = translations[lang].dir
    window.localStorage.setItem('areeb-lang', lang)
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      dir: translations[lang].dir,
      t: translations[lang],
      toggleLang: () => setLang((l) => (l === 'ar' ? 'en' : 'ar')),
      setLang,
    }),
    [lang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
