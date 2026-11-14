'use client';

import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GlassOrb, StaticOrb } from '@/components/brand/GlassOrb';
import AnimatedContent from '@/components/reactbits/AnimatedContent';
import MagicBento from '@/components/reactbits/MagicBento';
import RotatingText from '@/components/reactbits/RotatingText';
import { StudioSection } from '@/components/results/StudioCta';
import { CountUp } from '@/components/ui/CountUp';
import { SiteFooter, SiteHeader } from '@/components/ui/Chrome';
import { CategoryIcon, Chevron } from '@/components/ui/icons';
import { UrlForm } from '@/components/ui/UrlForm';
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from '@/features/scoring/engine';
import { SEVERITY_COLOR, scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CategoryId, Severity } from '@/types/audit';

const EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, className, stagger = 0, delay = 0 }: { children: ReactNode; className?: string; stagger?: number; delay?: number }) {
  return (
    <AnimatedContent distance={40} duration={0.9} ease="power3.out" threshold={0.12} stagger={stagger} delay={delay} className={className}>
      {children}
    </AnimatedContent>
  );
}

function SectionHead({ eyebrow, title, subtitle, center = false }: { eyebrow: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <Reveal stagger={0.08} className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display mt-5 text-balance text-[38px] text-ink sm:text-5xl md:text-[64px]">{title}</h2>
      {subtitle ? <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted md:text-lg">{subtitle}</p> : <span />}
    </Reveal>
  );
}

/**
 * Headline reveal. The heading animates as one block (a rise out of blur) so the
 * browser sees it as the page's largest content from the very first paint.
 */
function MaskedHeadline({ text }: { text: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.h1
      className="display-black mx-auto max-w-[15ch] text-balance text-[44px] text-white sm:text-[60px] md:text-[76px] lg:text-[88px]"
      initial={reduce ? false : { y: 28, filter: 'blur(10px)' }}
      animate={{ y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1.1, ease: EASE, delay: 0.05 }}
    >
      {text}
    </motion.h1>
  );
}

function Hero() {
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();
  const [orbSize, setOrbSize] = useState(220);
  useEffect(() => {
    const fit = () => setOrbSize(window.innerWidth < 640 ? 170 : window.innerWidth < 1024 ? 200 : 230);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const rise = (d: number) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: EASE, delay: d },
  });

  return (
    <section className="relative overflow-hidden pb-20 pt-[84px] md:pb-28 md:pt-[88px]">
      <div className="top-light" aria-hidden="true" />
      <div className="grain-lines" aria-hidden="true" />
      <div className="container-page relative flex flex-col items-center text-center">
        <motion.div
          initial={reduce ? false : { clipPath: 'circle(0% at 50% 50%)', scale: 0.92 }}
          animate={{ clipPath: 'circle(75% at 50% 50%)', scale: 1 }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.05 }}
          className="-mb-6"
        >
          <GlassOrb size={orbSize} energy={0.18} />
        </motion.div>

        <motion.span {...rise(0.25)} className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-[#4f86ff] shadow-[0_0_10px_#4f86ff]" />
          {t.hero.eyebrow}
        </motion.span>

        <MaskedHeadline key={locale} text={t.hero.title} />

        <motion.div {...rise(0.75)} className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-lg font-medium text-muted md:text-2xl">
          <span>{t.hero.rotatePrefix}</span>
          <RotatingText
            key={locale}
            texts={CATEGORY_ORDER.map((id) => t.categories[id].name)}
            splitBy={locale === 'ar' ? 'words' : 'characters'}
            staggerDuration={locale === 'ar' ? 0.06 : 0.02}
            staggerFrom="last"
            rotationInterval={2400}
            animatePresenceMode="popLayout"
            highlight
            highlightColor="#3d4bf0"
            mainClassName="heading rounded-xl text-white"
            splitLevelClassName="overflow-hidden pb-1"
          />
        </motion.div>

        <motion.p {...rise(0.85)} className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted md:text-lg">
          {t.hero.subtitle}
        </motion.p>

        <motion.div {...rise(0.95)} className="mt-9 w-full max-w-[760px]">
          <UrlForm id="analyze" />
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-faint">
            {t.hero.notes.map((note) => (
              <li key={note} className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6f8dff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {note}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const { t } = useI18n();
  return (
    <div className="border-y border-line bg-white/[0.015]">
      <Reveal stagger={0.06} className="container-page flex flex-wrap items-center justify-center gap-x-10 gap-y-3 py-6 text-[13px] font-medium text-muted">
        {t.trust.map((item) => (
          <span key={item} className="flex items-center gap-2.5">
            <span className="h-1 w-1 rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7c4dff]" />
            {item}
          </span>
        ))}
      </Reveal>
    </div>
  );
}

const BENTO_SPAN: Record<CategoryId, number> = { performance: 2, mobile: 1, seo: 1, security: 1, accessibility: 1, ux: 2 };

function Axes() {
  const { t } = useI18n();
  const items = CATEGORY_ORDER.map((id) => ({
    id,
    colSpan: BENTO_SPAN[id],
    content: (
      <div className="flex h-full flex-col justify-between gap-6 text-start" data-axis={id}>
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#b9c4ff]">
            <CategoryIcon id={id} size={21} />
          </span>
          <span className="flex items-baseline gap-1.5 text-muted">
            <span className="num-display text-[34px] leading-none text-ink">{CATEGORY_WEIGHTS[id]}</span>
            <span className="text-xs">{t.what.points}</span>
          </span>
        </div>
        <div>
          <h3 className="heading text-xl text-ink md:text-[22px]">{t.categories[id].name}</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{t.what.detail[id]}</p>
          <div className="mt-4 h-[3px] overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
            <div className="h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7c4dff] rtl:bg-gradient-to-l" style={{ width: `${CATEGORY_WEIGHTS[id] * 4}%` }} />
          </div>
        </div>
      </div>
    ),
  }));

  return (
    <section id="what" className="container-page scroll-mt-24 py-24 md:py-36">
      <SectionHead eyebrow={t.what.eyebrow} title={t.what.title} subtitle={t.what.subtitle} />
      <Reveal className="mt-14">
        <MagicBento
          items={items}
          columns={4}
          rowHeight={236}
          gap={12}
          radius={22}
          glowColor="#6f86ff"
          enableBorderGlow
          enableSpotlight
          spotlightRadius={320}
          clickEffect={false}
          enableStars={false}
          enableTilt={false}
          enableMagnetism={false}
          textAutoHide={false}
          intro={false}
        />
      </Reveal>
    </section>
  );
}

const STEP_ORB = [
  { energy: 0.12, tint: '#2f6bff', tintAmount: 0 },
  { energy: 1, tint: '#2f6bff', tintAmount: 0 },
  { energy: 0.55, tint: '#7c4dff', tintAmount: 0.6 },
  { energy: 0.3, tint: '#3ddc97', tintAmount: 0.75 },
];

/** Pinned scroll story: the orb stays put while the four steps pass by. */
function HowItWorks() {
  const { t } = useI18n();
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [pinned, setPinned] = useState(true);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  useEffect(() => {
    const check = () => setPinned(window.innerWidth >= 900 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // The pinned section changes the page height; reveal triggers below it must be re-measured.
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pinned]);

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setStep(Math.min(3, Math.max(0, Math.floor(v * 4 * 0.999))));
  });

  const steps = t.how.steps;

  if (!pinned) {
    return (
      <section id="how" className="container-page scroll-mt-24 py-24">
        <SectionHead eyebrow={t.how.eyebrow} title={t.how.title} />
        <Reveal stagger={0.08} className="mt-12 space-y-4">
          {steps.map((s, i) => (
            <div key={s.title}>
              <div className="panel flex items-start gap-5 p-6">
                <StaticOrb size={64} tint={STEP_ORB[i].tint} tintAmount={STEP_ORB[i].tintAmount} />
                <div>
                  <span className="num text-sm text-[#8fa6ff]">0{i + 1}</span>
                  <h3 className="heading mt-1 text-xl text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </Reveal>
      </section>
    );
  }

  const orb = STEP_ORB[step];
  return (
    <section id="how" ref={ref} className="relative scroll-mt-0" style={{ height: '400vh' }} data-testid="how-pinned">
      <div className="sticky top-0 flex h-[100dvh] items-center overflow-hidden">
        <div className="top-light opacity-60" aria-hidden="true" />
        <div className="container-page relative grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow">{t.how.eyebrow}</p>
            <h2 className="display mt-5 text-5xl text-ink md:text-[64px]">{t.how.title}</h2>
            <ol className="mt-12 space-y-2">
              {steps.map((s, i) => {
                const active = i === step;
                return (
                  <li key={s.title} data-step={i} data-active={active} className="relative ps-14">
                    <span className={`num absolute start-0 top-1 text-sm transition-colors duration-500 ${active ? 'text-[#8fa6ff]' : 'text-faint'}`}>0{i + 1}</span>
                    <span className="absolute start-8 top-0 h-full w-px bg-line" aria-hidden="true">
                      <motion.span className="absolute inset-x-0 top-0 block bg-gradient-to-b from-[#2f6bff] to-[#7c4dff]" animate={{ height: i < step ? '100%' : active ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
                    </span>
                    <h3 className={`heading py-2 text-2xl transition-colors duration-500 md:text-[28px] ${active ? 'text-ink' : 'text-white/25'}`}>{s.title}</h3>
                    <motion.div initial={false} animate={{ height: active ? 'auto' : 0, opacity: active ? 1 : 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden">
                      <p className="max-w-md pb-5 text-base leading-relaxed text-muted">{s.body}</p>
                    </motion.div>
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute h-[420px] w-[420px] rounded-full border border-white/[0.05]" aria-hidden="true" />
            <div className="absolute h-[560px] w-[560px] rounded-full border border-white/[0.03]" aria-hidden="true" />
            <GlassOrb size={460} energy={orb.energy} tint={orb.tint} tintAmount={orb.tintAmount} />
            <span className="num absolute bottom-6 text-xs text-faint">0{step + 1} / 04</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Illustrative numbers, labelled as such in the UI.
const SAMPLE_SCORES: Record<CategoryId, number> = { performance: 58, mobile: 66, seo: 84, security: 70, accessibility: 91, ux: 75 };
const SAMPLE_OVERALL = 71;

function SampleReport() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-120px' });
  const issues: { label: string; severity: Severity }[] = [
    { label: t.sample.issueA, severity: 'high' },
    { label: t.sample.issueB, severity: 'medium' },
    { label: t.sample.issueC, severity: 'medium' },
  ];
  return (
    <section id="sample" className="container-page scroll-mt-24 py-24 md:py-36">
      <SectionHead eyebrow={t.sample.eyebrow} title={t.sample.title} subtitle={t.sample.subtitle} />
      <Reveal className="mt-14">
        <div ref={ref} className="panel relative overflow-hidden p-6 md:p-12" aria-label={t.sample.badge}>
          <div className="pointer-events-none absolute -top-48 start-1/2 h-96 w-[680px] -translate-x-1/2 rounded-full bg-[#2f6bff]/15 blur-[110px] rtl:translate-x-1/2" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <span className="num text-sm text-muted">{t.sample.site}</span>
            <span className="rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-xs text-warn">{t.sample.badge}</span>
          </div>
          <div className="relative mt-10 grid items-center gap-12 lg:grid-cols-[auto_1fr] lg:gap-16">
            <div className="flex items-center gap-6">
              <GlassOrb size={150} energy={0.2} tint={scoreColor(SAMPLE_OVERALL)} tintAmount={0.7} />
              <div>
                <p className="text-sm text-muted">{t.results.overall}</p>
                <p className="num-display mt-1 text-[96px] leading-[0.9] text-ink">{inView ? <CountUp to={SAMPLE_OVERALL} /> : 0}</p>
                <span className="mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold" style={{ color: scoreColor(SAMPLE_OVERALL), background: `${scoreColor(SAMPLE_OVERALL)}1f` }}>
                  {t.grades.needs_improvement}
                </span>
              </div>
            </div>
            <div className="grid gap-10 xl:grid-cols-2">
              <ul className="space-y-4">
                {CATEGORY_ORDER.map((id, i) => (
                  <li key={id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted">{t.categories[id].name}</span>
                      <span className="num text-ink">{SAMPLE_SCORES[id]}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.div className="h-full rounded-full" style={{ background: scoreColor(SAMPLE_SCORES[id]) }} initial={{ width: 0 }} animate={{ width: inView ? `${SAMPLE_SCORES[id]}%` : 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 + i * 0.07 }} />
                    </div>
                  </li>
                ))}
              </ul>
              <ul className="space-y-3">
                {issues.map((issue) => (
                  <li key={issue.label} className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[issue.severity] }} />
                    <div>
                      <p className="text-sm font-medium text-ink">{issue.label}</p>
                      <p className="mt-1 text-xs" style={{ color: SEVERITY_COLOR[issue.severity] }}>
                        {t.severity[issue.severity]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Benefits() {
  const { t } = useI18n();
  return (
    <section className="container-page py-24 md:py-32">
      <SectionHead eyebrow={t.benefits.eyebrow} title={t.benefits.title} />
      <Reveal stagger={0.08} className="mt-14 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line md:grid-cols-2">
        {t.benefits.items.map((item, i) => (
          <div key={item.title} className="bg-bg p-8 md:p-10">
            <span className="num text-sm text-[#8fa6ff]">0{i + 1}</span>
            <h3 className="heading mt-4 text-2xl text-ink">{item.title}</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">{item.body}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="container-page scroll-mt-24 py-24 md:py-32">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <SectionHead eyebrow={t.faq.eyebrow} title={t.faq.title} />
        <Reveal className="divide-y divide-line border-y border-line">
          {t.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} aria-controls={`faq-${i}`} className="flex w-full items-center justify-between gap-6 py-6 text-start">
                  <span className="heading text-lg text-ink md:text-xl">{item.q}</span>
                  <span className="text-muted">
                    <Chevron open={isOpen} />
                  </span>
                </button>
                <motion.div id={`faq-${i}`} initial={false} animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden" inert={!isOpen}>
                  <p className="pb-7 text-[15px] leading-relaxed text-muted">{item.a}</p>
                </motion.div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

function Closing() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden py-24 md:py-36">
      <div className="top-light opacity-70" aria-hidden="true" />
      <div className="container-page relative text-center">
        <Reveal stagger={0.1}>
          <p className="eyebrow justify-center">{t.closing.cta}</p>
          <h2 className="display-black text-gradient mx-auto mt-6 max-w-4xl text-balance text-[40px] sm:text-6xl md:text-[80px]">{t.brand.tagline}</h2>
          <div className="mx-auto mt-12 max-w-[760px]">
            <UrlForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Landing() {
  const { t, locale } = useI18n();
  useEffect(() => {
    // Fonts and images change heights after first layout; re-measure reveals once things settle.
    let id = 0;
    const refresh = () => {
      window.clearTimeout(id);
      id = window.setTimeout(() => ScrollTrigger.refresh(), 250);
    };
    if (document.readyState === 'complete') refresh();
    else window.addEventListener('load', refresh, { once: true });
    return () => {
      window.removeEventListener('load', refresh);
      window.clearTimeout(id);
    };
  }, [locale]);
  const links = [
    { href: '#what', label: t.nav.what },
    { href: '#how', label: t.nav.how },
    { href: '#sample', label: t.nav.sample },
    { href: '#faq', label: t.nav.faq },
  ];
  return (
    <>
      <SiteHeader links={links} />
      <main>
        <Hero />
        <TrustStrip />
        <Axes />
        <HowItWorks />
        <SampleReport />
        <Benefits />
        <Faq />
        <div className="container-page">
          <StudioSection />
        </div>
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}
