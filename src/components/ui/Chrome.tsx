'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { studio } from '@/lib/config';
import { useI18n } from '@/lib/i18n';

/** Product mark: a pulse line inside a glass tile. */
export function PulseMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="29" height="29" rx="9" fill="url(#pm-fill)" stroke="rgba(255,255,255,0.16)" />
      <path d="M5.5 16h4.4l2.1-5.8 3.8 10.6 2.6-6.9 1.3 2.1h4.8" stroke="url(#pm-line)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="pm-fill" x1="0" y1="0" x2="30" y2="30">
          <stop stopColor="#1c1a3a" />
          <stop offset="1" stopColor="#0d0d16" />
        </linearGradient>
        <linearGradient id="pm-line" x1="5" y1="15" x2="25" y2="15">
          <stop stopColor="#5f8bff" />
          <stop offset="1" stopColor="#8f66ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function YouthStudioMark({ width = 120, className = '', priority = false }: { width?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/youth-studio-mark.png"
      alt="Youth Studio"
      width={732}
      height={238}
      sizes={`${width}px`}
      preload={priority}
      loading={priority ? 'eager' : 'lazy'}
      style={{ width, height: 'auto' }}
      className={`brand-mark ${className}`}
    />
  );
}

export function Brand() {
  const { t } = useI18n();
  return (
    <Link href="/" className="flex items-center gap-3">
      <PulseMark />
      <span className="flex flex-col leading-none" dir="ltr">
        <span className="whitespace-nowrap font-[family-name:var(--font-display-latin)] text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink sm:text-[13px] sm:tracking-[0.08em]">Business Health Check</span>
        <span className="mt-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-faint">
          By <YouthStudioMark width={86} className="-my-2" priority />
        </span>
      </span>
    </Link>
  );
}

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <button type="button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} title={t.nav.switchLabel} className={`btn-ghost text-[13px] ${compact ? 'h-10 px-3' : 'h-10 px-4'}`} data-testid="lang-switch">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" />
      </svg>
      <span lang={locale === 'ar' ? 'en' : 'ar'}>{t.nav.switchTo}</span>
    </button>
  );
}

export interface NavLink {
  href: string;
  label: string;
}

/** Fixed glass header. Section links collapse into a panel on small screens. */
export function SiteHeader({ links = [], cta = true }: { links?: NavLink[]; cta?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className={`border-b transition-colors duration-300 ${scrolled || open ? 'glass border-x-0 border-t-0' : 'border-transparent'}`}>
        <div className="container-page flex h-[68px] items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-2 md:gap-3">
            {links.length > 0 && (
              <nav className="me-4 hidden items-center gap-8 text-sm font-medium text-[#c8c8d4] lg:flex" aria-label="Sections">
                {links.map((l) => (
                  <a key={l.href} href={l.href} className="transition-colors hover:text-white">
                    {l.label}
                  </a>
                ))}
              </nav>
            )}
            <LanguageSwitch compact />
            {cta && (
              <Link href="/#analyze" className="btn-solid hidden sm:inline-flex">
                {t.nav.cta}
              </Link>
            )}
            {links.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={t.nav.menu}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.06] lg:hidden"
              >
                <span className={`absolute h-[1.6px] w-4 bg-white transition-transform duration-200 ${open ? 'rotate-45' : '-translate-y-[5px]'}`} />
                <span className={`absolute h-[1.6px] w-4 bg-white transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
                <span className={`absolute h-[1.6px] w-4 bg-white transition-transform duration-200 ${open ? '-rotate-45' : 'translate-y-[5px]'}`} />
              </button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="container-page lg:hidden">
          <nav className="mt-2 flex flex-col rounded-[18px] border border-line bg-[#14151e]/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur-xl">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3.5 font-medium text-[#c8c8d4] hover:bg-white/5 hover:text-white">
                {l.label}
              </a>
            ))}
            {cta && (
              <Link href="/#analyze" onClick={() => setOpen(false)} className="btn-solid m-2 sm:hidden">
                {t.nav.cta}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const mark = <YouthStudioMark width={200} />;
  return (
    <footer className="relative mt-10 border-t border-line">
      <div className="container-page flex flex-col items-center gap-6 py-16 text-center">
        {studio.website ? (
          <a href={studio.website} target="_blank" rel="noopener noreferrer" aria-label="Youth Studio">
            {mark}
          </a>
        ) : (
          mark
        )}
        <div dir="ltr" className="font-mono text-[11px] uppercase tracking-[0.24em] text-faint">
          Business Health Check · By Youth Studio · Saudi Digital Studio
        </div>
        <p className="heading max-w-md text-base text-ink/90">{t.brand.tagline}</p>
        {(studio.email || studio.whatsapp) && (
          <nav aria-label={t.cta.contactTitle} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm" data-testid="footer-contact">
            {studio.whatsapp && (
              <a href={studio.whatsapp} target="_blank" rel="noopener noreferrer" className="text-muted transition-colors hover:text-ink">
                {t.cta.whatsapp}
                {studio.whatsappDisplay && ' · '}
                {studio.whatsappDisplay && (
                  <span dir="ltr" className="num text-faint">
                    {studio.whatsappDisplay}
                  </span>
                )}
              </a>
            )}
            {studio.email && (
              <a href={`mailto:${studio.email}`} dir="ltr" className="font-mono text-[13px] text-muted transition-colors hover:text-ink" data-testid="footer-email">
                {studio.email}
              </a>
            )}
          </nav>
        )}
        <p className="max-w-xl text-xs leading-relaxed text-faint">{t.footer.disclaimer}</p>
        <p className="text-xs text-faint">
          <span className="num">© {year}</span> Youth Studio. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
