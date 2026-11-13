'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export function Section({ title, subtitle, children, id }: { title: string; subtitle?: string; children: ReactNode; id?: string }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mt-16 md:mt-20"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-ink md:text-[28px]">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
      <div className="mt-7">{children}</div>
    </motion.section>
  );
}
