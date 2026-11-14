'use client';

import { animate, useMotionValue, useReducedMotion, useTransform, motion } from 'motion/react';
import { useEffect } from 'react';

/** Counts from 0 to `to` once mounted. */
export function CountUp({ to, duration = 1.4, delay = 0.1 }: { to: number; duration?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : 0);
  const text = useTransform(value, (v) => String(Math.round(v)));
  useEffect(() => {
    if (reduce) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, { duration, delay, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [to, duration, delay, reduce, value]);
  return <motion.span>{text}</motion.span>;
}
