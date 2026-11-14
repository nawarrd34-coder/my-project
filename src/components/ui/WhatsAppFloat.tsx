'use client';

import { studio } from '@/lib/config';
import { useI18n } from '@/lib/i18n';

/**
 * Floating WhatsApp button, fixed bottom-right in both directions (as
 * requested). It opens a chat with a pre-filled message; nothing is sent
 * until the visitor presses send in WhatsApp.
 */
export function WhatsAppFloat() {
  const { t } = useI18n();
  if (!studio.whatsapp) return null;
  return (
    <a
      href={studio.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.cta.whatsappFloat}
      title={t.cta.whatsappFloat}
      data-testid="whatsapp-float"
      className="wa-float fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-6px_rgba(37,211,102,0.55)] transition-transform duration-300 hover:scale-110 hover:shadow-[0_14px_36px_-6px_rgba(37,211,102,0.7)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      style={{ right: 'max(16px, env(safe-area-inset-right))', bottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.38 9.38 0 0 1-1.44-5.01c0-5.19 4.23-9.41 9.42-9.41 2.51 0 4.88.98 6.65 2.76a9.35 9.35 0 0 1 2.75 6.66c0 5.19-4.23 9.41-9.41 9.41zm8.01-17.42A11.27 11.27 0 0 0 12.05.75C5.81.75.73 5.83.73 12.07c0 2 .52 3.94 1.51 5.66L.64 23.25l5.66-1.48a11.3 11.3 0 0 0 5.75 1.47h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.02-1.18-5.87-3.32-8.01z" />
      </svg>
    </a>
  );
}
