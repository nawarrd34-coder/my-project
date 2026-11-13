import * as cheerio from 'cheerio';

export type Doc = cheerio.CheerioAPI;

export const load = (html: string): Doc => cheerio.load(html);

export const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t ? t : null;
};

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Resolve a link against the page; only http(s) results are returned. */
export function absUrl(href: string | undefined | null, base: string): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith('#') || /^(javascript|mailto|tel|data|blob):/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, '');

export function sameSite(url: string, origin: string): boolean {
  try {
    return bareHost(new URL(url).hostname) === bareHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

const TRACKING = /^(utm_|fbclid$|gclid$|ref$|_pos$|_sid$|_ss$|variant$|mc_|srsltid$)/i;

/** Normalise a URL for de-duplication: no hash, no tracking params, no trailing slash. */
export function canonicalKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.hostname = bareHost(u.hostname);
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    let p = u.pathname.replace(/\/+$/, '') || '/';
    try {
      p = decodeURI(p);
    } catch {
      /* keep */
    }
    return `${u.hostname}${p}${u.searchParams.toString() ? `?${u.searchParams.toString()}` : ''}`.toLowerCase();
  } catch {
    return url;
  }
}

/** All JSON-LD objects on the page, flattened (@graph and arrays expanded). */
export function jsonLd($: Doc): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      out.push(o);
      if (o['@graph']) visit(o['@graph']);
    }
  };
  $('script[type="application/ld+json" i]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw || raw.length > 400_000) return;
    try {
      visit(JSON.parse(raw));
    } catch {
      /* malformed JSON-LD is common; ignore it */
    }
  });
  return out;
}

export const ldTypes = (o: Record<string, unknown>): string[] => {
  const t = o['@type'];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string').map((x) => x.toLowerCase());
};

export const str = (v: unknown): string | null => {
  if (typeof v === 'string') return clean(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return str(v[0]);
  if (v && typeof v === 'object' && 'name' in (v as object)) return str((v as { name: unknown }).name);
  if (v && typeof v === 'object' && 'url' in (v as object)) return str((v as { url: unknown }).url);
  return null;
};

/** Normalise Arabic and Latin text for matching (diacritics, alef/yaa/taa forms, case). */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[̀-ͯ]/g, '');
}

/** Visible-ish text of the body, without scripts and styles. */
export function bodyText($: Doc): string {
  const c = $.root().clone();
  c.find('script, style, noscript, template, svg').remove();
  return clean(c.find('body').text() || c.text()) ?? '';
}

export const ARABIC = /[؀-ۿ]/g;
export const LATIN = /[A-Za-z]/g;

export function arabicShare(text: string): number | null {
  const a = (text.match(ARABIC) ?? []).length;
  const l = (text.match(LATIN) ?? []).length;
  return a + l < 40 ? null : a / (a + l);
}
