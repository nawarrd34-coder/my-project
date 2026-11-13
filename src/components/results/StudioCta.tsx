'use client';

import Image from 'next/image';
import StarBorder from '@/components/reactbits/StarBorder';
import { hasContact, studio } from '@/lib/config';
import { useI18n } from '@/lib/i18n';

/** Conversion block. Links come from configuration; none are invented. */
export function StudioCta() {
  const { t } = useI18n();
  const primary = studio.contact || studio.whatsapp || (studio.email ? `mailto:${studio.email}` : '');
  const external = primary.startsWith('https://');

  return (
    <section className="mt-20 md:mt-28" data-testid="studio-cta">
      <div className="panel relative overflow-hidden px-6 py-12 text-center md:px-16 md:py-16">
        <div className="pointer-events-none absolute -top-48 start-1/2 h-96 w-[720px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px] rtl:translate-x-1/2" aria-hidden="true" />
        <Image src="/brand/youth-studio.jpg" alt="Youth Studio" width={1206} height={642} className="relative mx-auto h-auto w-[200px] brand-logo" />
        <h2 className="relative mx-auto mt-2 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-ink md:text-[40px] md:leading-[1.15]">{t.cta.title}</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">{t.cta.body}</p>

        {hasContact() ? (
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-3">
            <StarBorder
              as="a"
              href={primary}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              color="#b9b0ff"
              trailColor="#4aa3ff"
              radius={999}
              thickness={1.2}
              glow={0.7}
              backgroundColor="#f5f5f7"
              textColor="#0a0a0f"
              className="h-12 !px-7 text-[15px] !font-semibold"
              data-testid="cta-primary"
            >
              {t.cta.button}
            </StarBorder>
            {studio.whatsapp && studio.whatsapp !== primary && (
              <a href={studio.whatsapp} target="_blank" rel="noopener noreferrer" className="btn-ghost h-12 px-6">
                {t.cta.whatsapp}
              </a>
            )}
            {studio.email && `mailto:${studio.email}` !== primary && (
              <a href={`mailto:${studio.email}`} className="btn-ghost h-12 px-6">
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
    </section>
  );
}
