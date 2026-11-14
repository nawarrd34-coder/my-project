import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { cookies } from 'next/headers';
import { LocaleProvider } from '@/lib/i18n';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import type { Locale } from '@/types/audit';
import './globals.css';

const geist = localFont({
  variable: '--font-geist',
  display: 'swap',
  src: [
    { path: '../../assets/fonts/Geist-Regular.woff2', weight: '400' },
    { path: '../../assets/fonts/Geist-Medium.woff2', weight: '500' },
    { path: '../../assets/fonts/Geist-SemiBold.woff2', weight: '600' },
    { path: '../../assets/fonts/Geist-Bold.woff2', weight: '700' },
  ],
});

const geistMono = localFont({
  variable: '--font-geist-mono',
  display: 'swap',
  src: [
    { path: '../../assets/fonts/GeistMono-Regular.woff2', weight: '400' },
    { path: '../../assets/fonts/GeistMono-Medium.woff2', weight: '500' },
  ],
});

const plexArabic = localFont({
  variable: '--font-plex',
  display: 'swap',
  src: [
    { path: '../../assets/fonts/PlexArabic-400.woff2', weight: '400' },
    { path: '../../assets/fonts/PlexArabic-500.woff2', weight: '500' },
    { path: '../../assets/fonts/PlexArabic-600.woff2', weight: '600' },
    { path: '../../assets/fonts/PlexArabic-700.woff2', weight: '700' },
  ],
});

// Alexandria ships as separate Arabic and Latin subsets; the stack below lets
// each script fall through to the file that contains it.
const displayLatin = localFont({
  variable: '--font-display-latin',
  display: 'swap',
  src: [
    { path: '../../assets/fonts/Alexandria-Latin-700.woff2', weight: '700' },
    { path: '../../assets/fonts/Alexandria-Latin-800.woff2', weight: '800' },
    { path: '../../assets/fonts/Alexandria-Latin-900.woff2', weight: '900' },
  ],
});

const displayArabic = localFont({
  variable: '--font-display-arabic',
  display: 'swap',
  src: [
    { path: '../../assets/fonts/Alexandria-Arabic-700.woff2', weight: '700' },
    { path: '../../assets/fonts/Alexandria-Arabic-800.woff2', weight: '800' },
    { path: '../../assets/fonts/Alexandria-Arabic-900.woff2', weight: '900' },
  ],
});

export const metadata: Metadata = {
  title: 'Business Health Check — by Youth Studio',
  description:
    'افحص موقعك مجاناً واعرف صحة حضورك الرقمي. Free website audit for Saudi businesses: performance, mobile, SEO, security and accessibility in one score.',
  applicationName: 'Business Health Check',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0b0b11',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  // Arabic is the primary market language and the default.
  const locale: Locale = stored === 'en' ? 'en' : 'ar';

  return (
    <html lang={locale} data-scroll-behavior="smooth" dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${geist.variable} ${geistMono.variable} ${plexArabic.variable} ${displayLatin.variable} ${displayArabic.variable}`}>
      <body>
        <div className="page-bg" aria-hidden="true" />
        <LocaleProvider initial={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
