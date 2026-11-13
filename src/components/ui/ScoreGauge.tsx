'use client';

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useId } from 'react';
import { scoreColor } from '@/lib/format';

const START = 135; // degrees; the arc sweeps 270° clockwise from bottom-left
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  // Rounded so server and browser floating-point results are identical.
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(cx + r * Math.cos(rad)), round(cy + r * Math.sin(rad))];
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

interface Props {
  score: number | null;
  size?: number;
  label?: string;
  sublabel?: string;
  /** Skip the entrance animation (used for static previews). */
  still?: boolean;
}

/** 270° score dial. The arc and the number animate together to the measured value. */
export function ScoreGauge({ score, size = 240, label, sublabel, still = false }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const progress = useMotionValue(still || reduce ? (score ?? 0) : 0);
  const text = useTransform(progress, (v) => String(Math.round(v)));
  const color = scoreColor(score);
  const cx = 120;
  const cy = 120;
  const r = 98;
  const track = arcPath(cx, cy, r, START, START + SWEEP);

  useEffect(() => {
    if (score === null) return;
    if (still || reduce) {
      progress.set(score);
      return;
    }
    const controls = animate(progress, score, { duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 });
    return () => controls.stop();
  }, [score, still, reduce, progress]);

  const pathLength = useTransform(progress, (v) => Math.max(0.0001, v / 100));

  return (
    <div className="relative" style={{ width: size, height: size }} dir="ltr">
      <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label={score === null ? label : `${label ?? ''} ${score}/100`}>
        <defs>
          <linearGradient id={`${id}-g`} x1="20" y1="200" x2="220" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor={color} stopOpacity="0.55" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {/* tick ring */}
        {Array.from({ length: 41 }, (_, i) => {
          const deg = START + (SWEEP / 40) * i;
          const [x1, y1] = polar(cx, cy, 112, deg);
          const [x2, y2] = polar(cx, cy, i % 10 === 0 ? 117 : 115, deg);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.22)" strokeWidth={i % 10 === 0 ? 1.4 : 0.8} />;
        })}
        <path d={track} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" strokeLinecap="round" />
        {score !== null && (
          <>
            <motion.path d={track} fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="12" strokeLinecap="round" filter={`url(#${id}-glow)`} style={{ pathLength }} />
            <motion.path d={track} fill="none" stroke={`url(#${id}-g)`} strokeWidth="12" strokeLinecap="round" style={{ pathLength }} />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score === null ? (
          <span className="text-5xl font-semibold text-faint">—</span>
        ) : (
          <motion.span className="num text-[72px] font-semibold leading-none tracking-tight text-ink" style={{ fontSize: size * 0.3 }} data-testid="overall-score">
            {text}
          </motion.span>
        )}
        {sublabel && <span className="mt-2 text-xs text-faint">{sublabel}</span>}
      </div>
    </div>
  );
}

/** Small ring used for Lighthouse category scores. */
export function MiniRing({ score, size = 56 }: { score: number | null; size?: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} dir="ltr">
      <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        {score !== null && (
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * c} ${c}`}
            transform="rotate(-90 28 28)"
          />
        )}
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[15px] font-medium" style={{ color: score === null ? '#747482' : '#f5f5f7' }}>
        {score === null ? '—' : score}
      </span>
    </div>
  );
}
