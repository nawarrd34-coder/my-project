'use client';

import { scoreColor } from '@/lib/format';

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
