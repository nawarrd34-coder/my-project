import { resolveRecommendations, REC_GROUPS } from '@/features/business/content';
import { SEVERITY_COLOR } from '@/lib/format';
import type { Dict } from '@/lib/i18n/en';
import { bizDicts } from '@/lib/i18n/biz';
import type { BizDict } from '@/lib/i18n/biz.en';
import type { AuditReport, CategoryId, Finding, Locale } from '@/types/audit';
import type { BusinessAnalysis, Confidence, RecGroup } from '@/types/business';

/**
 * Business sections of the printable report. Every value is escaped; only
 * data: images produced by our own scanner are embedded (third-party image
 * URLs are never loaded while rendering the PDF).
 */
export const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const ltr = (value: unknown) => `<bdi dir="ltr">${esc(value)}</bdi>`;

const DATA_IMG = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const safeImg = (src: string | null | undefined) => (src && DATA_IMG.test(src) ? src : null);
const HEX = /^#[0-9a-f]{6}$/i;

const CONF_COLOR: Record<Confidence, string> = { high: '#12915a', medium: '#a77b06', low: '#c25a12' };
const GROUP_COLOR: Record<RecGroup, string> = { critical: '#d92d43', high: '#d9661f', design: '#6b55e0', conversion: '#1f7fd1', seo: '#12915a', longterm: '#6d6d7c' };

export const BUSINESS_CSS = `
.chips { margin: 2mm 0 0; }
.chip { display: inline-block; border: 1px solid #dcdce4; border-radius: 99px; padding: 0.6mm 3mm; font-size: 8.4pt; margin: 0 1.5mm 1.5mm 0; }
html[dir='rtl'] .chip { margin: 0 0 1.5mm 1.5mm; }
.chip.accent { border-color: #cfc9ff; background: #f6f5ff; color: #4a3bd0; }
.brand { display: flex; gap: 6mm; align-items: center; }
.brand .logo { width: 24mm; height: 24mm; border: 1px solid #e3e3ea; border-radius: 6px; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; background: #fff; }
.brand .logo img { max-width: 21mm; max-height: 21mm; }
.brand .logo span { font-family: 'Display', 'Display Arabic', sans-serif; font-size: 22pt; font-weight: 900; }
.brand h1 { margin: 0; font-family: 'Display', 'Display Arabic', 'Geist', sans-serif; font-size: 20pt; font-weight: 800; line-height: 1.3; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 5mm 0 3mm; }
.stat { border: 1px solid #e3e3ea; border-radius: 8px; padding: 3mm 3.5mm; break-inside: avoid; }
.stat .k { margin-bottom: 1mm; }
.stat b { font-family: 'Display', 'Display Arabic', 'Geist', sans-serif; font-size: 16pt; font-weight: 800; display: block; line-height: 1.2; }
.stat .small { margin-top: 1mm; }
.kv { width: 100%; }
.kv td { padding: 1.8mm 2mm; }
.kv td:first-child { color: #5d5d6b; width: 45%; }
.yes { color: #12915a; font-weight: 600; }
.no { color: #d92d43; font-weight: 600; }
.na { color: #8d8d9c; }
.conf { display: inline-block; border: 1px solid; border-radius: 99px; padding: 0 2.4mm; font-size: 7.8pt; font-weight: 600; margin-inline-start: 2mm; }
.sw { display: inline-block; width: 3.6mm; height: 3.6mm; border-radius: 99px; border: 1px solid #d5d5de; vertical-align: -0.6mm; margin-inline-end: 1mm; }
.swl { display: inline-block; margin-inline-end: 3mm; font-size: 8.2pt; }
.evl { margin: 1.5mm 0 0; padding: 0; list-style: none; }
.evl li { font-size: 8.2pt; background: #f5f5f8; border-radius: 4px; padding: 1mm 2.2mm; margin-bottom: 1mm; overflow-wrap: anywhere; }
.shots { display: flex; gap: 4mm; align-items: flex-start; margin-top: 4mm; break-inside: avoid; }
.shots img { border: 1px solid #e3e3ea; border-radius: 6px; display: block; }
.shots .d { width: 128mm; } .shots .m { width: 42mm; }
.compact { border: 1px solid #e3e3ea; border-radius: 6px; padding: 2.4mm 3.5mm; margin-bottom: 2mm; break-inside: avoid; border-inline-start-width: 3px; }
.compact b { font-size: 9.6pt; }
.compact .ev { margin-top: 1.2mm; }
.group-h { display: flex; align-items: center; gap: 2.5mm; font-family: 'Display', 'Display Arabic', 'Geist', sans-serif; font-size: 12.5pt; font-weight: 800; margin: 6mm 0 3mm; break-after: avoid; }
.group-h i { width: 3mm; height: 3mm; border-radius: 99px; display: inline-block; }
.score-note { border-color: #cfd7ff; background: #f4f6ff; font-size: 9pt; }
td.wrap { overflow-wrap: anywhere; word-break: break-word; }
`;

const yn = (b: BizDict, v: boolean | null | undefined) =>
  v === null || v === undefined ? `<span class="na">${esc(b.notTested)}</span>` : v ? `<span class="yes">✓ ${esc(b.yes)}</span>` : `<span class="no">✗ ${esc(b.no)}</span>`;
const conf = (b: BizDict, c: Confidence | null | undefined) =>
  c && CONF_COLOR[c] ? `<span class="conf" style="color:${CONF_COLOR[c]};border-color:${CONF_COLOR[c]}66">${esc(b.confidence[c])}</span>` : '';
const evList = (items: string[]) => (items.length ? `<ul class="evl">${items.map((e) => `<li class="mono" dir="auto">${esc(e)}</li>`).join('')}</ul>` : '');
const row = (k: string, v: string) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`;
const swatches = (colors: string[]) => colors.filter((c) => HEX.test(c)).map((c) => `<span class="swl mono" dir="ltr"><span class="sw" style="background:${c}"></span>${esc(c)}</span>`).join('');
const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname) + u.search;
    return p.length > 70 ? `${p.slice(0, 69)}…` : p || '/';
  } catch {
    return url.slice(0, 70);
  }
};
const kb = (bytes: number | null) => (bytes === null ? '—' : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
const lookup = (map: Record<string, string>, key: string) => map[key] ?? key;

function section(n: number, title: string, sub: string | null, body: string) {
  return `<section><h2><span class="mono small muted" style="font-weight:400">${String(n).padStart(2, '0')}</span>&nbsp; ${esc(title)}</h2>${sub ? `<p class="small muted">${esc(sub)}</p>` : ''}${body}</section>`;
}

function overview(b: BizDict, biz: BusinessAnalysis, report: AuditReport, t: Dict, locale: Locale) {
  const id = biz.identity;
  const name = id.brandName?.value ?? report.host;
  const logo = safeImg(id.logo?.dataUri);
  const c = biz.catalog;
  const products = c ? (c.catalogTotal?.verified ? c.catalogTotal.value : c.productUrlsDiscovered) : null;
  const contacts = (['phone', 'email', 'whatsapp', 'contactPage', 'form'] as const).filter((k) => id.contact[k]).map((k) => b.channels[k]);
  const shotD = safeImg(biz.design.screenshots.desktop);
  const shotM = safeImg(biz.design.screenshots.mobile);
  return `
  <div class="brand">
    <div class="logo">${logo ? `<img src="${logo}" alt="">` : `<span>${esc(name.slice(0, 1))}</span>`}</div>
    <div>
      <div class="k">${esc(b.fields.brand)}</div>
      <h1 dir="auto">${esc(name)}</h1>
      <div class="chips">
        <span class="chip">${esc(lookup(b.websiteTypes, id.websiteType.value))}</span>
        ${id.industry ? `<span class="chip">${esc(lookup(b.industries, id.industry.value))}</span>` : ''}
        <span class="chip accent">${esc(lookup(b.platforms, biz.platform.id))}</span>
        ${id.country ? `<span class="chip">${esc(b.countries[id.country.code] ?? id.country.code)}</span>` : ''}
      </div>
    </div>
  </div>
  ${id.description ? `<p class="muted" style="margin-top:3mm" dir="auto">${esc(id.description)}</p>` : ''}
  <div class="stats">
    <div class="stat"><div class="k">${esc(b.fields.products)}</div><b>${products === null ? '—' : products}</b><div class="small muted">${esc(c ? (c.catalogTotal?.verified ? b.products.totalVerified(c.catalogTotal.value) : b.products.totalUnknown) : b.products.notStore)}</div></div>
    <div class="stat"><div class="k">${esc(b.fields.categories)}</div><b>${c ? c.categories.count : '—'}</b></div>
    <div class="stat"><div class="k">${esc(b.fields.banners)}</div><b>${biz.banners.count}</b></div>
    <div class="stat"><div class="k">${esc(b.fields.pages)}</div><b>${biz.coverage.pagesAnalyzed}</b><div class="small muted">${esc(b.coverage.requests(biz.coverage.requests))}</div></div>
  </div>
  <table class="kv"><tbody>
    ${row(b.fields.contact, contacts.length ? esc(contacts.join(' · ')) + (id.contact.social.length ? ` <span class="small muted">(${ltr(id.contact.social.join(', '))})</span>` : '') : `<span class="na">${esc(b.none)}</span>`)}
    ${row(b.fields.language, id.language.primary ? esc(b.languages[id.language.primary] ?? id.language.primary) : `<span class="na">${esc(b.notDetected)}</span>`)}
    ${row(b.fields.colors, id.colors.length ? swatches(id.colors.slice(0, 5).map((x) => x.hex)) : `<span class="na">${esc(b.notDetected)}</span>`)}
    ${row(t.results.overall, report.overall.score === null ? esc(t.results.noOverall) : `<b>${report.overall.score}/100</b> <span class="small muted">— ${esc(b.sections.score)}</span>`)}
  </tbody></table>
  ${report.ai ? `<div class="box ai" style="margin-top:4mm"><p>${esc(report.ai[locale])}</p><p class="small muted" style="margin:0">${esc(t.results.aiLabel)}</p></div>` : ''}
  ${shotD || shotM ? `<div class="k" style="margin-top:5mm">${esc(b.design.screenshots)}</div><div class="shots" dir="ltr">${shotD ? `<img class="d" src="${shotD}" alt="">` : ''}${shotM ? `<img class="m" src="${shotM}" alt="">` : ''}</div>` : ''}`;
}

function platform(b: BizDict, biz: BusinessAnalysis) {
  const p = biz.platform;
  const id = biz.identity;
  return `
  <div class="box" style="break-inside:avoid">
    <div class="k">${esc(b.fields.platform)}</div>
    <p style="font-size:13pt;font-weight:600;margin:0">${esc(lookup(b.platforms, p.id))}${conf(b, p.confidence)}</p>
    ${p.id === 'unknown' ? `<p class="small muted" style="margin-top:2mm">${esc(b.platformUnknownNote)}</p>` : ''}
    ${p.evidence.length ? `<div class="k" style="margin-top:2mm">${esc(b.evidence)}</div>${evList(p.evidence)}` : ''}
    ${p.frameworks.length ? `<p class="small muted" style="margin-top:2mm">${esc(b.frameworks)}: ${ltr(p.frameworks.join(' · '))}</p>` : ''}
  </div>
  <table class="kv" style="margin-top:3mm"><tbody>
    ${row(b.fields.brand, id.brandName ? `${esc(id.brandName.value)} <span class="small muted">(${esc(id.brandName.source)})</span>` : `<span class="na">${esc(b.notDetected)}</span>`)}
    ${row(b.fields.title, id.siteTitle ? esc(id.siteTitle) : `<span class="na">${esc(b.notDetected)}</span>`)}
    ${row(b.fields.logo, id.logo ? `<span class="small">${esc(id.logo.source)}</span>` : `<span class="na">${esc(b.notDetected)}</span>`)}
    ${row(b.fields.type, esc(lookup(b.websiteTypes, id.websiteType.value)) + conf(b, id.websiteType.confidence))}
    ${row(b.fields.industry, id.industry ? esc(lookup(b.industries, id.industry.value)) + conf(b, id.industry.confidence) : `<span class="na">${esc(b.notDetected)}</span>`)}
    ${row(b.fields.country, id.country ? esc(b.countries[id.country.code] ?? id.country.code) : `<span class="na">${esc(b.notDetected)}</span>`)}
  </tbody></table>
  ${evList([...id.websiteType.evidence, ...(id.industry?.evidence ?? []).map((e) => `keyword ${e}`), ...(id.country?.evidence ?? [])].slice(0, 8))}`;
}

function structure(b: BizDict, biz: BusinessAnalysis) {
  const c = biz.coverage;
  const lines = [
    b.coverage.pages(c.pagesAnalyzed),
    b.coverage.requests(c.requests),
    c.robots === 'found' ? b.coverage.robotsFound : c.robots === 'missing' ? b.coverage.robotsMissing : b.coverage.robotsError,
    c.robotsBlocked ? b.coverage.robotsBlocked(c.robotsBlocked) : '',
    c.sitemap.found ? b.coverage.sitemap(c.sitemap.urls, c.sitemap.productUrls) : b.coverage.noSitemap,
    c.budgetReached ? b.coverage.budget : '',
  ].filter(Boolean);
  return `
  <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
  ${biz.limits.length ? biz.limits.map((l) => `<div class="box notice" style="margin-top:2mm">${esc(b.limits[l] ?? l)}</div>`).join('') : ''}
  <h3>${esc(b.coverage.pageList)}</h3>
  <table><tbody>${c.pages
    .map((p) => `<tr><td class="small muted" style="width:24mm">${esc(b.coverage.kinds[p.kind] ?? p.kind)}</td><td class="mono small wrap" dir="ltr">${esc(pathOf(p.url))}</td><td class="n mono small" style="color:${p.ok ? '#12915a' : '#d92d43'}">${p.status ?? '—'}</td></tr>`)
    .join('')}</tbody></table>`;
}

function products(b: BizDict, biz: BusinessAnalysis) {
  const c = biz.catalog;
  if (!c) return `<p class="muted">${esc(b.products.notStore)}</p>`;
  const total = c.catalogTotal;
  return `
  <div class="stats" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat"><div class="k">${esc(b.products.discovered)}</div><b>${c.productUrlsDiscovered}</b></div>
    <div class="stat"><div class="k">${esc(b.products.analysed)}</div><b>${c.productPagesAnalyzed}</b></div>
    <div class="stat"><div class="k">${esc(b.products.total)}</div><b>${total ? total.value : '—'}</b><div class="small muted">${esc(total ? (total.verified ? b.products.totalVerified(total.value) : b.products.totalSitemap(total.value)) : b.products.totalUnknown)}</div></div>
  </div>
  <p class="small muted">${esc(b.products.discoveredNote)}</p>
  ${c.categories.names.length ? `<div class="k" style="margin-top:3mm">${esc(b.products.categories)}: ${c.categories.count}</div><div class="chips">${c.categories.names.map((n) => `<span class="chip" dir="auto">${esc(n)}</span>`).join('')}</div>` : ''}
  ${
    c.products.length
      ? `<h3>${esc(b.products.sample)}</h3><table>
    <thead><tr>${Object.values(b.products.cols).map((h, i) => `<th${i ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${c.products
      .map(
        (p) => `<tr>
      <td class="wrap" dir="auto">${esc(p.name ?? pathOf(p.url))}</td>
      <td class="n mono small">${p.price ? ltr(`${p.price} ${p.currency ?? ''}`.trim()) : '<span class="no">—</span>'}</td>
      <td class="n mono small"${p.imageCount <= 1 ? ' style="color:#c25a12"' : ''}>${p.imageCount}</td>
      <td class="n small"${p.descriptionLength < 120 ? ' style="color:#c25a12"' : ''}>${esc(b.products.chars(p.descriptionLength))}</td>
      <td class="n small">${esc(p.availability ?? '—')}</td>
      <td class="n small">${p.source === 'platform-json' ? '—' : yn(b, p.addToCart)}</td>
    </tr>`,
      )
      .join('')}</tbody></table>`
      : `<p class="muted">${esc(b.products.noProducts)}</p>`
  }`;
}

function visual(b: BizDict, biz: BusinessAnalysis) {
  const { banners, design: d } = biz;
  const bannerTable = banners.count
    ? `<p class="small muted">${esc(b.banners.count)}: ${banners.count} · ${esc(b.banners.sliders)}: ${banners.sliders}</p>
    <table><thead><tr><th>${esc(b.banners.cols.image)}</th><th class="n">${esc(b.banners.cols.size)}</th><th class="n">${esc(b.banners.cols.file)}</th><th class="n">${esc(b.banners.cols.ratio)}</th><th class="n">${esc(b.banners.cols.mobile)}</th><th class="n">${esc(b.banners.cols.link)}</th></tr></thead>
    <tbody>${banners.banners
      .map(
        (x) => `<tr><td class="mono small wrap" dir="ltr">${esc(pathOf(x.src))}</td>
        <td class="n mono small">${x.width && x.height ? `${x.width}×${x.height}` : '—'}<div class="small muted" style="font-family:inherit">${esc(x.measured ? b.banners.measured : b.banners.attr)}</div></td>
        <td class="n mono small"${(x.bytes ?? 0) > 450000 ? ' style="color:#d92d43"' : ''}>${kb(x.bytes)}</td>
        <td class="n mono small">${x.ratio ? `${x.ratio}:1` : '—'}</td>
        <td class="n small">${yn(b, x.mobileVariant)}</td>
        <td class="n small">${yn(b, x.linked)}</td></tr>`,
      )
      .join('')}</tbody></table>`
    : `<p class="muted">${esc(b.banners.none)}</p>`;
  const design = d.rendered
    ? `<h3>${esc(b.sections.banners)}</h3><table class="kv"><tbody>
      ${row(b.design.fonts, d.fonts.length ? ltr(d.fonts.map((f) => `${f.family} ${Math.round(f.share * 100)}%`).join(' · ')) : '—')}
      ${(['h1', 'h2', 'body', 'mobileBody'] as const).map((k) => row(`${b.design.sizes} · ${b.design.sizeLabels[k]}`, d.sizes[k] ? `<span class="mono">${d.sizes[k]}px</span>` : '—')).join('')}
      ${row(b.design.palette, d.palette.length ? swatches(d.palette) : '—')}
      ${row(b.design.cta, d.primaryCta ? `«${esc(d.primaryCta.text)}»${d.primaryCta.contrast !== null ? ` <span class="small" style="color:${d.primaryCta.contrast < 3 ? '#d92d43' : '#12915a'}">${esc(b.design.ctaContrast(d.primaryCta.contrast))}</span>` : ''}` : `<span class="na">${esc(b.notDetected)}</span>`)}
      ${d.primaryCta ? row(b.design.aboveFoldDesktop, yn(b, d.primaryCta.aboveFoldDesktop)) + row(b.design.aboveFoldMobile, yn(b, d.primaryCta.aboveFoldMobile)) : ''}
      ${row(`${b.design.mobileChecks} · ${b.design.overflow}`, yn(b, d.mobile ? !d.mobile.horizontalOverflow : null))}
      ${row(`${b.design.mobileChecks} · ${b.design.smallTargets}`, d.mobile ? `<span class="mono">${d.mobile.smallTapTargets}</span>` : '—')}
    </tbody></table><p class="small muted" style="margin-top:2mm">${esc(b.design.observedNote)}</p>`
    : `<div class="box notice">${esc(b.design.notRendered)}</div>`;
  return bannerTable + design;
}

function search(b: BizDict, biz: BusinessAnalysis) {
  const s = biz.search;
  const src = s.source === 'html' ? b.search.sourceHtml : s.source === 'component' ? b.search.sourceComponent : s.source === 'rendered' ? b.search.sourceRendered : '';
  return `
  <table class="kv"><tbody>
    ${row(b.search.present, yn(b, s.present) + (s.present && src ? ` <span class="small muted">${esc(src)}</span>` : ''))}
    ${row(b.search.visibleDesktop, yn(b, s.visibleDesktop))}
    ${row(b.search.visibleMobile, yn(b, s.visibleMobile))}
    ${row(b.search.autocomplete, yn(b, s.autocomplete))}
  </tbody></table>
  <h3>${esc(b.search.tests)}</h3>
  <p class="small muted">${esc(b.search.testsNote)}</p>
  ${
    s.tests.length
      ? `<table><thead><tr>${Object.values(b.search.cols).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.tests
          .map(
            (x) => `<tr><td class="mono small" dir="auto">${esc(x.query)}</td><td class="small">${esc(b.search.kinds[x.kind])}</td><td class="small">${
              x.status === 'ok'
                ? `${esc(b.search.results(x.resultCount ?? 0, x.relevantCount))}${x.kind === 'no_result' ? `<div class="${x.noResultMessage ? 'yes' : 'no'}" style="font-weight:400">${esc(x.noResultMessage ? b.search.noResultMessage : b.search.noMessage)}</div>` : ''}`
                : `<span style="color:#a77b06">${esc(b.search.status[x.status])}</span>`
            }</td><td class="small muted">${esc(b.search.via[x.via])}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : `<p class="muted">${esc(b.search.noTests)}</p>`
  }`;
}

function journey(b: BizDict, biz: BusinessAnalysis) {
  const j = biz.journey;
  return `
  <div class="grid">
    <table class="kv"><tbody>
      ${row(b.journey.cart, yn(b, j.cartLink))}
      ${row(b.journey.account, yn(b, j.accountLink))}
      ${row(b.journey.delivery, yn(b, j.deliveryInfo))}
      ${row(b.journey.returns, yn(b, j.returnPolicy))}
      ${row(b.journey.privacy, yn(b, j.privacyPolicy))}
      ${row(b.journey.reviews, yn(b, j.reviews))}
    </tbody></table>
    <div>
      <div class="k">${esc(b.journey.payments)}</div>
      <div class="chips">${j.paymentMethods.length ? j.paymentMethods.map((m) => `<span class="chip" dir="ltr">${esc(m)}</span>`).join('') : `<span class="na">${esc(b.none)}</span>`}</div>
      <div class="k" style="margin-top:3mm">${esc(b.journey.trust)}</div>
      <table class="kv"><tbody>${(Object.keys(j.trust) as (keyof typeof j.trust)[]).map((k) => row(b.journey.trustItems[k], yn(b, j.trust[k]))).join('')}</tbody></table>
    </div>
  </div>`;
}

/** Short form of technical findings for the technical sections; full detail is under Recommendations. */
export function compactFindings(findings: Finding[], cats: CategoryId[], locale: Locale, t: Dict, resolve: (f: Finding, l: Locale) => { title: string; evidence: string } | null) {
  const items = findings
    .filter((f) => cats.includes(f.category))
    .map((f) => ({ f, c: resolve(f, locale) }))
    .filter((x) => x.c);
  if (!items.length) return `<p class="muted small">${esc(t.results.counts(0, 0, 0))}</p>`;
  return items
    .map(
      ({ f, c }) => `<div class="compact" style="border-inline-start-color:${SEVERITY_COLOR[f.severity]}">
      <b>${esc(c!.title)}</b> <span class="small" style="color:${SEVERITY_COLOR[f.severity]}">· ${esc(t.severity[f.severity])}</span> <span class="small muted">· ${esc(t.categories[f.category].name)} · ${esc(t.basis[f.basis])}</span>
      <div class="ev mono" dir="auto">${esc(c!.evidence)}</div></div>`,
    )
    .join('');
}

function recommendations(b: BizDict, biz: BusinessAnalysis | null, findings: Finding[], locale: Locale, t: Dict) {
  const recs = resolveRecommendations(biz?.recommendations ?? [], findings, locale, (c) => b.categoryWhere[c] ?? c);
  if (!recs.length) return `<p class="muted">${esc(t.results.counts(0, 0, 0))}</p>`;
  return REC_GROUPS.map((g) => {
    const items = recs.filter((r) => r.group === g);
    if (!items.length) return '';
    return `<div class="group-h"><i style="background:${GROUP_COLOR[g]}"></i>${esc(b.recs.groups[g])} <span class="small muted" style="font-family:inherit;font-weight:400">${esc(b.recs.count(items.length))}</span></div>
    ${items
      .map((r) => {
        const color = SEVERITY_COLOR[r.priority];
        return `<div class="finding" style="border-inline-start-color:${color}">
        <h4>${esc(r.title)}</h4>
        <div class="tags"><span><b style="color:${color}">${esc(b.recs.priority)}: ${esc(t.severity[r.priority])}</b></span><span>${esc(b.recs.effort)}: ${esc(b.recs.complexity[r.complexity])}</span><span>${esc(r.source === 'business' ? b.recs.sourceBusiness : b.recs.sourceTechnical)}</span><span>${esc(t.basis[r.basis])}</span></div>
        <div class="grid">
          <div><div class="k">${esc(b.recs.where)}</div><div class="v" dir="auto">${esc(r.where)}</div></div>
          <div><div class="k">${esc(b.recs.evidence)}</div><div class="ev mono" dir="auto">${esc(r.evidence)}</div></div>
          <div><div class="k">${esc(b.recs.why)}</div><div class="v">${esc(r.why)}</div></div>
          <div><div class="k">${esc(b.recs.fix)}</div><div class="v">${esc(r.fix)}</div></div>
        </div></div>`;
      })
      .join('')}`;
  }).join('');
}

export interface BusinessHtml {
  b: BizDict;
  front: string;
  recommendations: (index: number) => string;
  section: typeof section;
}

/** Sections 1–7 (business) plus a builder for section 11 (recommendations). */
export function businessHtml(report: AuditReport, locale: Locale, t: Dict, journeyExtra = ''): BusinessHtml {
  const b = bizDicts[locale];
  const biz = report.business ?? null;
  const s = b.sections;
  const front = biz
    ? [
        section(1, s.overview, s.overviewSub, overview(b, biz, report, t, locale)),
        section(2, s.platform, s.platformSub, platform(b, biz)),
        section(3, s.structure, s.structureSub, structure(b, biz)),
        section(4, s.products, s.productsSub, products(b, biz)),
        section(5, s.banners, s.bannersSub, visual(b, biz)),
        section(6, s.search, s.searchSub, search(b, biz)),
        section(7, s.journey, s.journeySub, journey(b, biz) + journeyExtra),
      ].join('\n')
    : '';
  return { b, front, section, recommendations: (index) => section(index, s.recs, s.recsSub, recommendations(b, biz, report.findings, locale, t)) };
}
