'use client';

import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import SwarmCursor from '@/components/reactbits/SwarmCursor';
import { SiteFooter, SiteHeader } from '@/components/ui/Chrome';
import { CategoryIcon, Chevron } from '@/components/ui/icons';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { UrlForm } from '@/components/ui/UrlForm';
import { CATEGORY_ORDER, CATEGORY_WEIGHTS } from '@/features/scoring/engine';
import { SEVERITY_COLOR, scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import type { CategoryId, Severity } from '@/types/audit';

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-[40px] md:leading-[1.1]">{title}</h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">{subtitle}</p>}
    </Reveal>
  );
}

function Hero() {
  const { t } = useI18n();
  // Fewer particles on small screens keeps the background light on phones.
  const [count, setCount] = useState(520);
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setCount(240);
  }, []);

  return (
    <section className="relative h-[calc(100dvh-64px)] max-h-[820px] min-h-[640px]">
      <SwarmCursor
        count={count}
        size={1.9}
        spread={110}
        swirl={0.55}
        tail={0.55}
        trail={0.5}
        wander={0.45}
        depth={0.8}
        color="#9a90ff"
        accentColor="#6fc0ff"
        clickEffect="pulse"
        idle="roam"
        className="[&_.swarm-cursor-canvas]:opacity-70"
      >
        <div className="container-page flex h-full flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
            </span>
            {t.hero.eyebrow}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            className="text-gradient mt-7 max-w-4xl text-balance text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl rtl:leading-[1.3]"
          >
            {t.hero.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
            className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted md:text-xl"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.24 }}
            className="mt-10 w-full max-w-2xl"
          >
            <UrlForm id="analyze" />
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-faint">
              {t.hero.notes.map((note) => (
                <li key={note} className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {note}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </SwarmCursor>
    </section>
  );
}

function WhatWeAnalyze() {
  const { t } = useI18n();
  return (
    <section id="what" className="container-page scroll-mt-24 py-20 md:py-28">
      <SectionHead title={t.what.title} subtitle={t.what.subtitle} />
      <div className="mt-12 grid overflow-hidden rounded-[18px] border border-line sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_ORDER.map((id, i) => (
          <Reveal key={id} delay={i * 0.05} className="border-line p-7 max-sm:[&:not(:last-child)]:border-b sm:border-b sm:border-e lg:[&:nth-child(3n)]:border-e-0 lg:[&:nth-last-child(-n+3)]:border-b-0 sm:max-lg:[&:nth-child(2n)]:border-e-0 sm:max-lg:[&:nth-last-child(-n+2)]:border-b-0">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white/[0.03] text-silver">
                <CategoryIcon id={id} />
              </span>
              <span className="text-xs text-faint">
                <span className="num text-sm text-ink">{CATEGORY_WEIGHTS[id]}</span> {t.what.points}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-medium text-ink">{t.categories[id].name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.categories[id].desc}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  return (
    <section id="how" className="container-page scroll-mt-24 py-20 md:py-28">
      <SectionHead title={t.how.title} />
      <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-8">
        {t.how.steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.07}>
            <li className="relative">
              <div className="flex items-center gap-4">
                <span className="num text-sm text-accent">0{i + 1}</span>
                <span className="hairline flex-1" />
              </div>
              <h3 className="mt-5 text-lg font-medium text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

// Numbers below are illustrative only and labelled as such in the UI.
const SAMPLE_SCORES: Record<CategoryId, number> = { performance: 58, mobile: 66, seo: 84, security: 70, accessibility: 91, ux: 75 };
const SAMPLE_OVERALL = 71;

function SampleReport() {
  const { t } = useI18n();
  const issues: { label: string; severity: Severity }[] = [
    { label: t.sample.issueA, severity: 'high' },
    { label: t.sample.issueB, severity: 'medium' },
    { label: t.sample.issueC, severity: 'medium' },
  ];
  return (
    <section id="sample" className="container-page scroll-mt-24 py-20 md:py-28">
      <SectionHead title={t.sample.title} subtitle={t.sample.subtitle} />
      <Reveal className="mt-12">
        <div className="panel relative overflow-hidden p-6 md:p-10" aria-label={t.sample.badge}>
          <div className="pointer-events-none absolute -top-40 start-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-accent/15 blur-[100px] rtl:translate-x-1/2" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <span className="num text-sm text-muted">{t.sample.site}</span>
            <span className="rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-xs text-warn">{t.sample.badge}</span>
          </div>
          <div className="relative mt-8 grid items-center gap-10 md:grid-cols-[auto_1fr] md:gap-14">
            <div className="flex flex-col items-center">
              <ScoreGauge score={SAMPLE_OVERALL} size={210} label={t.results.overall} sublabel={t.results.outOf} still />
              <span className="mt-1 text-sm font-medium" style={{ color: scoreColor(SAMPLE_OVERALL) }}>
                {t.grades.needs_improvement}
              </span>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <ul className="space-y-4">
                {CATEGORY_ORDER.map((id) => (
                  <li key={id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted">{t.categories[id].name}</span>
                      <span className="num text-ink">{SAMPLE_SCORES[id]}</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div className="h-full rounded-full" style={{ width: `${SAMPLE_SCORES[id]}%`, background: scoreColor(SAMPLE_SCORES[id]) }} />
                    </div>
                  </li>
                ))}
              </ul>
              <ul className="space-y-3">
                {issues.map((issue) => (
                  <li key={issue.label} className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] p-4">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[issue.severity] }} />
                    <div>
                      <p className="text-sm text-ink">{issue.label}</p>
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
    <section className="container-page py-20 md:py-28">
      <SectionHead title={t.benefits.title} />
      <div className="mt-12 grid gap-x-16 gap-y-10 md:grid-cols-2">
        {t.benefits.items.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.05} className="border-t border-line pt-6">
            <h3 className="text-lg font-medium text-ink">{item.title}</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{item.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="container-page scroll-mt-24 py-20 md:py-28">
      <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
        <SectionHead title={t.faq.title} />
        <div className="divide-y divide-line border-y border-line">
          {t.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                  className="flex w-full items-center justify-between gap-6 py-5 text-start text-base font-medium text-ink"
                >
                  {item.q}
                  <Chevron open={isOpen} />
                </button>
                <motion.div
                  id={`faq-${i}`}
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                  inert={!isOpen}
                >
                  <p className="pb-6 text-sm leading-relaxed text-muted">{item.a}</p>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  const { t } = useI18n();
  return (
    <section className="container-page py-10 md:py-16">
      <Reveal>
        <div className="panel relative overflow-hidden px-6 py-14 text-center md:px-16 md:py-20">
          <div className="pointer-events-none absolute -bottom-48 start-1/2 h-96 w-[720px] -translate-x-1/2 rounded-full bg-accent-2/15 blur-[110px] rtl:translate-x-1/2" aria-hidden="true" />
          <h2 className="relative mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight text-ink md:text-[40px] md:leading-[1.15]">{t.brand.tagline}</h2>
          <div className="relative mx-auto mt-9 max-w-2xl">
            <UrlForm />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Landing() {
  const { t } = useI18n();
  return (
    <>
      <SiteHeader>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex" aria-label="Sections">
          <a href="#what" className="transition-colors hover:text-ink">{t.nav.what}</a>
          <a href="#how" className="transition-colors hover:text-ink">{t.nav.how}</a>
          <a href="#sample" className="transition-colors hover:text-ink">{t.nav.sample}</a>
          <a href="#faq" className="transition-colors hover:text-ink">{t.nav.faq}</a>
        </nav>
      </SiteHeader>
      <main>
        <Hero />
        <div className="hairline" />
        <WhatWeAnalyze />
        <HowItWorks />
        <SampleReport />
        <Benefits />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
