'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export function Section({ title, subtitle, children, id, index }: { title: string; subtitle?: string; children: ReactNode; id?: string; index?: number }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mt-20 scroll-mt-28 md:mt-28"
      data-section={id}
    >
      {index !== undefined && <p className="num mb-3 text-xs font-semibold tracking-[0.2em] text-faint">{String(index).padStart(2, '0')}</p>}
      <h2 className="display text-[30px] text-ink md:text-[44px]">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
      <div className="mt-7">{children}</div>
    </motion.section>
  );
}
