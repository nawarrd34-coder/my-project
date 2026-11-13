import type { CategoryId } from '@/types/audit';

const paths: Record<CategoryId, React.ReactNode> = {
  performance: (
    <>
      <path d="M4.5 16a8 8 0 1 1 15 0" />
      <path d="M12 13l4-5" />
      <circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  seo: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  security: (
    <>
      <path d="M12 3l7 2.8v5.4c0 4.3-2.9 7.6-7 9.3-4.1-1.7-7-5-7-9.3V5.8L12 3z" />
      <path d="M9 12l2.2 2.2L15.2 10" />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="5" r="1.6" />
      <path d="M5 9h14M12 9v5m0 0l-3.5 6M12 14l3.5 6" />
    </>
  ),
  ux: (
    <>
      <path d="M6 3.5l12.5 6.2-5.3 1.7-1.7 5.3L6 3.5z" />
      <path d="M14 14l5 5" />
    </>
  ),
};

export function CategoryIcon({ id, size = 20 }: { id: CategoryId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[id]}
    </svg>
  );
}

export function Chevron({ open }: { open?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
