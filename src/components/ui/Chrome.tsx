'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import { studio } from '@/lib/config';

/** Product mark: a pulse line, the "health check" reading. */
export function PulseMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="27" height="27" rx="8.5" fill="url(#pm-fill)" stroke="rgba(255,255,255,0.16)" />
      <path d="M5 15h4.2l2-5.5 3.6 10 2.4-6.5 1.3 2H23" stroke="url(#pm-line)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="pm-fill" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#1a1830" />
          <stop offset="1" stopColor="#0b0b12" />
        </linearGradient>
        <linearGradient id="pm-line" x1="5" y1="14" x2="23" y2="14">
          <stop stopColor="#a79cff" />
          <stop offset="1" stopColor="#6fb8ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Brand() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={`${t.brand.name} — ${t.brand.by}`}>
      <PulseMark />
      <span className="flex flex-col leading-none" dir="ltr">
        <span className="text-[13px] font-semibold tracking-[0.14em] uppercase text-ink">Business Health Check</span>
        <span className="mt-1 text-[10px] tracking-[0.2em] uppercase text-faint">By Youth Studio</span>
      </span>
    </Link>
  );
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      aria-label={t.nav.switchLabel}
      className="btn-ghost h-9 px-3.5 text-[13px]"
      data-testid="lang-switch"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" />
      </svg>
      <span>{t.nav.switchTo}</span>
    </button>
  );
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40">
      <div className="glass border-x-0 border-t-0">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-2 md:gap-6">
            {children}
            <LanguageSwitch />
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const logo = (
    <Image
      src="/brand/youth-studio.jpg"
      alt="Youth Studio"
      width={1206}
      height={642}
      className="h-auto w-[220px] brand-logo md:w-[260px]"
    />
  );
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-page flex flex-col items-center gap-6 py-14 text-center">
        {studio.website ? (
          <a href={studio.website} target="_blank" rel="noopener noreferrer">
            {logo}
          </a>
        ) : (
          logo
        )}
        <div dir="ltr" className="eyebrow !tracking-[0.24em]">
          Business Health Check · By Youth Studio · Saudi Digital Studio
        </div>
        <p className="max-w-md text-sm text-muted">{t.brand.tagline}</p>
        <p className="max-w-xl text-xs leading-relaxed text-faint">{t.footer.disclaimer}</p>
        <p className="text-xs text-faint">
          <span className="num">© {year}</span> Youth Studio. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
