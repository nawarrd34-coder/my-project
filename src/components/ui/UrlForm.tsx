'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import StarBorder from '@/components/reactbits/StarBorder';
import { useI18n } from '@/lib/i18n';

/** Light client-side check; the server performs the real validation. */
export function looksLikeUrl(value: string): boolean {
  const v = value.trim();
  if (!v || /\s/.test(v)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return url.hostname.includes('.') && url.hostname.length > 3;
  } catch {
    return false;
  }
}

export function UrlForm({ autoFocus = false, id }: { autoFocus?: boolean; id?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!looksLikeUrl(value)) {
      setError(true);
      return;
    }
    router.push(`/scan?url=${encodeURIComponent(value.trim())}`);
  };

  return (
    <form onSubmit={submit} noValidate id={id} className="w-full scroll-mt-32" data-testid="url-form">
      <label htmlFor={inputId} className="sr-only">
        {t.hero.inputLabel}
      </label>
      <div
        className={`hairline-frame flex flex-col gap-2 rounded-[20px] p-2 shadow-[0_24px_80px_-24px_rgba(47,107,255,.45)] transition-[box-shadow] duration-300 sm:flex-row sm:items-center ${
          error ? '!border-crit/80 [background:linear-gradient(#111118,#111118)_padding-box,linear-gradient(#ff5468,#ff5468)_border-box]' : 'focus-within:shadow-[0_24px_90px_-18px_rgba(90,76,245,.6)]'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0 text-faint" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" />
          </svg>
          <input
            id={inputId}
            dir="ltr"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(false);
            }}
            placeholder={t.hero.placeholder}
            aria-invalid={error}
            aria-describedby={error ? `${inputId}-err` : undefined}
            className="h-14 w-full min-w-0 bg-transparent text-left text-[17px] text-ink outline-none placeholder:text-[#7d8aa8]"
          />
        </div>
        <StarBorder
          type="submit"
          color="#9fb4ff"
          trailColor="#7c4dff"
          duration={5}
          radius={14}
          thickness={1.2}
          glow={0.7}
          hover="lap"
          backgroundColor="#ffffff"
          textColor="#0b0b11"
          borderColor="rgba(255,255,255,0.5)"
          className="h-14 shrink-0 whitespace-nowrap !px-7 font-[family-name:var(--font-display)] text-[16px] !font-bold"
        >
          {t.hero.cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </StarBorder>
      </div>
      <p id={`${inputId}-err`} role="alert" className={`mt-3 text-sm text-crit ${error ? '' : 'hidden'}`}>
        {t.hero.invalid}
      </p>
    </form>
  );
}
