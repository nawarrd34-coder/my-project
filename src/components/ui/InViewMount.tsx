'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Renders `fallback` until the box comes near the viewport, then mounts
 * `children` for good. Keeps heavy effects (WebGL, canvases) out of the
 * initial page load.
 */
export function InViewMount({ children, fallback, margin = '300px', className }: { children: ReactNode; fallback: ReactNode; margin?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || mounted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, margin]);
  return (
    <div ref={ref} className={className}>
      {mounted ? children : fallback}
    </div>
  );
}
