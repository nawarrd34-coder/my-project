'use client';

import ElectricBorder from '@/components/reactbits/ElectricBorder';
import StarBorder from '@/components/reactbits/StarBorder';
import AnimatedContent from '@/components/reactbits/AnimatedContent';
import { YouthStudioMark } from '@/components/ui/Chrome';
import { InViewMount } from '@/components/ui/InViewMount';
import { hasContact, studio } from '@/lib/config';
import { useI18n } from '@/lib/i18n';

/**
 * Youth Studio: who built the product, and the conversion card.
 * Links come from configuration; none are invented.
 */
export function StudioSection() {
  const { t } = useI18n();
  const primary = studio.contact || studio.whatsapp || (studio.email ? `mailto:${studio.email}` : '');
  const external = primary.startsWith('https://');
  const card = (
          <div className="relative overflow-hidden rounded-[28px] bg-[#0f0f16] px-6 py-14 text-center md:px-16 md:py-20">
            <div className="pointer-events-none absolute -top-40 start-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-[#5a4cf5]/20 blur-[110px] rtl:translate-x-1/2" aria-hidden="true" />
            <h3 className="display relative mx-auto max-w-2xl text-balance text-[34px] text-ink md:text-[52px]">{t.cta.title}</h3>
            <p className="relative mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">{t.cta.body}</p>
            {hasContact() ? (
              <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
                <StarBorder
                  as="a"
                  href={primary}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  color="#9fb4ff"
                  trailColor="#7c4dff"
                  radius={999}
                  thickness={1.2}
                  glow={0.7}
                  backgroundColor="#ffffff"
                  textColor="#0b0b11"
                  className="h-14 !px-8 font-[family-name:var(--font-display)] text-[16px] !font-bold"
                  data-testid="cta-primary"
                >
                  {t.cta.button}
                </StarBorder>
                {studio.whatsapp && studio.whatsapp !== primary && (
                  <a href={studio.whatsapp} target="_blank" rel="noopener noreferrer" className="btn-ghost h-14 px-7">
                    {t.cta.whatsapp}
                  </a>
                )}
                {studio.email && `mailto:${studio.email}` !== primary && (
                  <a href={`mailto:${studio.email}`} className="btn-ghost h-14 px-7">
                    {t.cta.email}
                  </a>
                )}
              </div>
            ) : (
              process.env.NODE_ENV !== 'production' && (
                <p className="relative mx-auto mt-8 max-w-md rounded-xl border border-dashed border-line-strong px-4 py-3 text-xs text-faint">{t.cta.unset}</p>
              )
            )}
          </div>
  );

  return (
    <section className="py-20 md:py-28" data-testid="studio-cta">
      <AnimatedContent distance={40} duration={0.9} stagger={0.1} threshold={0.12} className="flex flex-col items-center text-center">
        <p className="eyebrow">{t.studio.eyebrow}</p>
        <div className="mt-10">
          <YouthStudioMark width={340} className="max-w-[78vw]" />
        </div>
        <h2 className="heading mt-8 max-w-2xl text-balance text-2xl text-ink md:text-3xl">{t.studio.title}</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{t.studio.body}</p>
      </AnimatedContent>

      <AnimatedContent distance={40} duration={0.9} threshold={0.15} className="mx-auto mt-14 max-w-4xl">
        <InViewMount
          margin="200px"
          fallback={<div className="rounded-[28px] border border-[#7c6cff]/40">{card}</div>}
        >
        <ElectricBorder color="#7c6cff" glowColor="#5a4cf5" speed={0.7} chaos={0.35} spread={0.5} thickness={1.4} strands={2} glow={0.5} intensity={0.65} borderRadius={28}>
          {card}
        </ElectricBorder>
        </InViewMount>
      </AnimatedContent>
    </section>
  );
}

/** Kept for the results page. */
export const StudioCta = StudioSection;
