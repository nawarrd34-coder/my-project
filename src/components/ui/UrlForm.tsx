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
    <form onSubmit={submit} noValidate id={id} className="w-full" data-testid="url-form">
      <label htmlFor={inputId} className="sr-only">
        {t.hero.inputLabel}
      </label>
      <div
        className={`glass flex flex-col gap-2 rounded-[22px] p-2 transition-colors sm:flex-row sm:items-center sm:rounded-full ${
          error ? '!border-crit/70' : 'focus-within:!border-white/30'
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
            className="h-12 w-full min-w-0 bg-transparent text-left text-[16px] text-ink outline-none placeholder:text-faint"
          />
        </div>
        <StarBorder
          type="submit"
          color="#b9b0ff"
          trailColor="#4aa3ff"
          duration={5}
          radius={999}
          thickness={1.2}
          glow={0.7}
          hover="lap"
          backgroundColor="#f5f5f7"
          textColor="#0a0a0f"
          borderColor="rgba(255,255,255,0.4)"
          className="h-12 shrink-0 whitespace-nowrap !px-6 text-[15px] !font-semibold"
        >
          {t.hero.cta}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100" aria-hidden="true">
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
