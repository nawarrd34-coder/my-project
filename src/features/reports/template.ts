import { resolveFinding, resolveStrength } from '@/features/recommendations/content';
import { studio } from '@/lib/config';
import { formatDate, formatMetric, GRADE_COLOR, SEVERITY_COLOR, scoreColor } from '@/lib/format';
import { ar } from '@/lib/i18n/ar';
import { en, type Dict } from '@/lib/i18n/en';
import type { AuditReport, Locale, MetricId, StrategyData } from '@/types/audit';

export interface ReportAssets {
  /** base64 woff2 payloads keyed by file name (without extension). */
  fonts: Record<string, string>;
  /** base64 JPEG of the Youth Studio mark. */
  logo: string;
}

/** Everything interpolated into the document goes through this. */
const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ltr = (value: unknown) => `<bdi dir="ltr">${esc(value)}</bdi>`;

function fontFaces(fonts: Record<string, string>): string {
  const face = (family: string, file: string, weight: number) =>
    fonts[file]
      ? `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${fonts[file]}) format('woff2');}`
      : '';
  return [
    face('Geist', 'Geist-Regular', 400),
    face('Geist', 'Geist-Medium', 500),
    face('Geist', 'Geist-SemiBold', 600),
    face('Plex Arabic', 'PlexArabic-400', 400),
    face('Plex Arabic', 'PlexArabic-500', 500),
    face('Plex Arabic', 'PlexArabic-600', 600),
    face('Geist Mono', 'GeistMono-Regular', 400),
  ].join('');
}

function gauge(score: number | null, color: string): string {
  const cx = 120;
  const cy = 120;
  const r = 98;
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
  };
  const arc = (to: number) => `M ${pt(135)} A ${r} ${r} 0 ${to - 135 > 180 ? 1 : 0} 1 ${pt(to)}`;
  const value = score === null ? '' : `<path d="${arc(135 + Math.max(1, (270 * score) / 100))}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 240 240" width="210" height="210" xmlns="http://www.w3.org/2000/svg">
    <path d="${arc(405)}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="12" stroke-linecap="round"/>
    ${value}
    <text x="120" y="${score === null ? 132 : 138}" text-anchor="middle" font-family="Geist, sans-serif" font-weight="600" font-size="${score === null ? 40 : 70}" fill="#f5f5f7">${score === null ? '—' : score}</text>
  </svg>`;
}

const CSS = `
@page { size: A4; margin: 17mm 15mm 19mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Geist', 'Plex Arabic', sans-serif; font-size: 10.2pt; line-height: 1.55; color: #17171c; }
html[lang='ar'] body { line-height: 1.8; }
.mono { font-family: 'Geist Mono', 'Plex Arabic', monospace; }
bdi { unicode-bidi: isolate; }

.cover { height: 297mm; background: #050507; color: #f5f5f7; padding: 22mm 20mm 18mm; display: flex; flex-direction: column; position: relative; overflow: hidden; break-after: page; }
.cover::before { content: ''; position: absolute; inset: 0; background: radial-gradient(520px 320px at 50% 0%, rgba(123,108,255,0.32), transparent 70%), radial-gradient(420px 300px at 100% 30%, rgba(74,163,255,0.14), transparent 70%); }
.cover > * { position: relative; }
.wordmark { font-size: 9pt; letter-spacing: 0.22em; text-transform: uppercase; font-weight: 600; direction: ltr; }
.wordmark small { display: block; margin-top: 5px; font-size: 7pt; letter-spacing: 0.26em; color: #8d8d9c; font-weight: 400; }
.cover-main { margin-top: 34mm; }
.cover-kicker { font-size: 10pt; color: #a6a6b4; }
.cover-title { font-size: 34pt; line-height: 1.15; font-weight: 600; margin: 10px 0 0; letter-spacing: -0.01em; }
html[lang='ar'] .cover-title { letter-spacing: 0; line-height: 1.4; }
.cover-host { margin-top: 14px; font-size: 15pt; color: #c9c4ff; word-break: break-all; }
.cover-meta { margin-top: 8px; font-size: 9.5pt; color: #8d8d9c; }
.cover-score { margin-top: 20mm; display: flex; align-items: center; gap: 12mm; }
.cover-score h3 { margin: 0; font-size: 10pt; font-weight: 400; color: #a6a6b4; }
.cover-grade { display: inline-block; margin-top: 8px; padding: 5px 14px; border-radius: 99px; font-size: 12pt; font-weight: 600; }
.cover-note { margin-top: 10px; max-width: 80mm; font-size: 8.5pt; color: #8d8d9c; }
.cover-foot { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; gap: 10mm; }
.cover-foot img { width: 52mm; height: auto; display: block; }
.cover-foot p { margin: 0; font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: #8d8d9c; direction: ltr; }

h2 { font-size: 15pt; font-weight: 600; margin: 0 0 4mm; padding-bottom: 2.5mm; border-bottom: 1px solid #e3e3ea; break-after: avoid; }
h3 { font-size: 10.5pt; font-weight: 600; margin: 6mm 0 2mm; break-after: avoid; }
section { margin-bottom: 9mm; }
p { margin: 0 0 2.5mm; }
.muted { color: #5d5d6b; }
.small { font-size: 8.6pt; }
.lead { font-size: 11.5pt; }
.box { border: 1px solid #e3e3ea; border-radius: 8px; padding: 4mm 5mm; }
.ai { border-color: #cfc9ff; background: #f6f5ff; }
.notice { border-color: #f0d898; background: #fffaf0; margin-bottom: 2.5mm; font-size: 9.2pt; }

table { width: 100%; border-collapse: collapse; }
th { text-align: start; font-weight: 500; font-size: 8.2pt; color: #5d5d6b; padding: 2mm 2mm; border-bottom: 1px solid #d5d5de; }
td { padding: 2.2mm 2mm; border-bottom: 1px solid #ececf1; vertical-align: middle; }
td.n, th.n { text-align: end; white-space: nowrap; }
.bar { height: 5px; border-radius: 99px; background: #ececf1; overflow: hidden; min-width: 34mm; }
.bar i { display: block; height: 100%; border-radius: 99px; }
.score { font-weight: 600; font-size: 11pt; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 99px; margin-inline-end: 5px; }

.finding { border: 1px solid #e3e3ea; border-radius: 8px; padding: 4mm 5mm 3.2mm; margin-bottom: 3.5mm; break-inside: avoid; border-inline-start-width: 4px; }
.finding h4 { margin: 0; font-size: 11pt; font-weight: 600; }
.tags { margin: 1.2mm 0 2.8mm; font-size: 8.2pt; color: #5d5d6b; }
.tags b { font-weight: 600; }
.tags span { margin-inline-end: 8px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; }
.k { font-size: 7.8pt; font-weight: 600; color: #7a7a88; margin-bottom: 0.8mm; }
.v { font-size: 9.2pt; }
.ev { font-size: 8.4pt; background: #f5f5f8; border-radius: 5px; padding: 1.6mm 2.4mm; overflow-wrap: anywhere; }
ul { margin: 0; padding-inline-start: 5mm; }
li { margin-bottom: 1.4mm; }
.cta { background: #050507; color: #f5f5f7; border-radius: 10px; padding: 9mm 10mm; break-inside: avoid; }
.cta h2 { border: 0; color: #fff; font-size: 17pt; margin-bottom: 2mm; padding: 0; }
.cta p { color: #b9b9c6; }
.cta a { color: #c9c4ff; text-decoration: none; }
.cta .links { margin-top: 4mm; font-size: 9.6pt; }
.cta .links div { margin-bottom: 1.2mm; }
`;

function metricsTable(t: Dict, mobile: StrategyData | null, desktop: StrategyData | null): string {
  const ids: MetricId[] = ['fcp', 'lcp', 'si', 'tbt', 'cls'];
  const cell = (d: StrategyData | null, id: MetricId) => `<td class="n mono">${esc(formatMetric(id, d?.metrics[id].value ?? null))}</td>`;
  return `<table>
    <thead><tr><th></th><th class="n">${esc(t.results.mobile)}</th><th class="n">${esc(t.results.desktop)}</th></tr></thead>
    <tbody>${ids
      .map((id) => `<tr><td>${ltr(t.metrics[id].name)}<div class="small muted">${esc(t.metrics[id].desc)}</div></td>${cell(mobile, id)}${cell(desktop, id)}</tr>`)
      .join('')}</tbody></table>`;
}

function lighthouseTable(t: Dict, mobile: StrategyData | null, desktop: StrategyData | null): string {
  const keys = ['performance', 'accessibility', 'seo', 'bestPractices'] as const;
  const cell = (d: StrategyData | null, k: (typeof keys)[number]) => {
    const v = d ? d.scores[k] : null;
    return `<td class="n mono" style="color:${v === null ? '#8d8d9c' : '#17171c'}">${v === null ? esc(t.results.notTested) : `<span class="dot" style="background:${scoreColor(v)}"></span>${v}`}</td>`;
  };
  return `<table>
    <thead><tr><th>Google Lighthouse</th><th class="n">${esc(t.results.mobile)}</th><th class="n">${esc(t.results.desktop)}</th></tr></thead>
    <tbody>${keys.map((k) => `<tr><td>${esc(t.results.lhCategories[k])}</td>${cell(mobile, k)}${cell(desktop, k)}</tr>`).join('')}</tbody></table>`;
}

/** Build the printable report as a self-contained HTML document (no scripts, no external requests). */
export function buildReportHtml(report: AuditReport, locale: Locale, assets: ReportAssets): string {
  const t = locale === 'ar' ? ar : en;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const mobile = report.psi.mobile.ok ? report.psi.mobile.data : null;
  const desktop = report.psi.desktop.ok ? report.psi.desktop.data : null;
  const { overall } = report;
  const gradeColor = overall.grade ? GRADE_COLOR[overall.grade] : '#8d8d9c';
  const critical = report.findings.filter((f) => f.severity === 'critical').length;
  const high = report.findings.filter((f) => f.severity === 'high').length;
  const lhVersion = mobile?.lighthouseVersion ?? desktop?.lighthouseVersion ?? null;

  const notices: string[] = [];
  const psiErr = (o: AuditReport['psi']['mobile']) => (o.ok ? '' : ` (${t.psiErrors[o.error]})`);
  if (!mobile && !desktop) notices.push(t.results.psiFailed.both + psiErr(report.psi.mobile));
  else if (!mobile) notices.push(t.results.psiFailed.mobile + psiErr(report.psi.mobile));
  else if (!desktop) notices.push(t.results.psiFailed.desktop + psiErr(report.psi.desktop));
  if (!report.site.ok && report.site.error && report.site.error !== 'tls_error') {
    const why = report.site.error === 'http_error' ? t.siteErrors.http_error(report.site.errorDetail ?? '') : t.siteErrors[report.site.error];
    notices.push(`${t.results.siteFailed} (${why})`);
  }
  if (report.site.onPage?.likelyClientRendered) notices.push(t.results.clientRendered);

  const categoryRows = report.categories
    .map((c) => {
      const color = scoreColor(c.score);
      return `<tr>
        <td>${esc(t.categories[c.id].name)}${c.status === 'partial' ? ` <span class="small muted">· ${esc(t.results.partial)}</span>` : ''}<div class="small muted">${esc(t.categories[c.id].desc)}</div></td>
        <td class="n small muted">${esc(t.results.weight(c.weight))}</td>
        <td style="width:38mm"><div class="bar">${c.score === null ? '' : `<i style="width:${c.score}%;background:${color}"></i>`}</div></td>
        <td class="n score mono" style="color:${c.score === null ? '#8d8d9c' : color}">${c.score === null ? `<span class="small" style="font-weight:400">${esc(t.results.notTested)}</span>` : c.score}</td>
      </tr>`;
    })
    .join('');

  const findings = report.findings
    .map((f) => ({ f, copy: resolveFinding(f, locale) }))
    .filter((x) => x.copy)
    .map(({ f, copy }) => {
      const color = SEVERITY_COLOR[f.severity];
      return `<div class="finding" style="border-inline-start-color:${color}">
        <h4>${esc(copy!.title)}</h4>
        <div class="tags"><span><b style="color:${color}">${esc(t.severity[f.severity])}</b></span><span>${esc(t.categories[f.category].name)}</span><span>${esc(t.basis[f.basis])}</span></div>
        <div class="grid">
          <div><div class="k">${esc(t.results.explanation)}</div><div class="v">${esc(copy!.explanation)}</div></div>
          <div><div class="k">${esc(t.results.business)}</div><div class="v">${esc(copy!.business)}</div></div>
          <div><div class="k">${esc(t.results.evidence)}</div><div class="ev mono" dir="auto">${esc(copy!.evidence)}</div></div>
          <div><div class="k">${esc(t.results.fix)}</div><div class="v">${esc(copy!.fix)}</div></div>
        </div>
      </div>`;
    })
    .join('');

  const strengths = report.strengths
    .map((s) => resolveStrength(s, locale))
    .filter(Boolean)
    .map((s) => `<li>${esc(s)}</li>`)
    .join('');

  const gaps = report.categories
    .flatMap((c) => c.checks.filter((k) => k.score === null).map((k) => ({ c, k })))
    .map(({ c, k }) => `<tr><td>${esc(t.checks[k.id as keyof Dict['checks']] ?? k.id)} <span class="small muted">· ${esc(t.categories[c.id].name)}</span></td><td class="n small">${esc(t.reasons[k.reason ?? 'not_reported'])}</td></tr>`)
    .join('');

  const methodRows = report.categories
    .map(
      (c) => `<tr><td colspan="4" style="background:#f5f5f8;font-weight:600">${esc(t.categories[c.id].name)} <span class="small muted" style="font-weight:400">· ${esc(t.results.weight(c.weight))} · ${c.score === null ? esc(t.results.notTested) : `${c.score}/100`}</span></td></tr>${c.checks
        .map(
          (k) => `<tr><td>${esc(t.checks[k.id as keyof Dict['checks']] ?? k.id)}</td><td class="n mono small">${k.weight}%</td><td class="n mono small">${k.score === null ? `<span style="font-family:inherit">${esc(t.reasons[k.reason ?? 'not_reported'])}</span>` : k.score}</td><td class="n small muted">${esc(t.basis[k.basis])}</td></tr>`,
        )
        .join('')}`,
    )
    .join('');

  const links = [
    studio.contact ? `<div><a href="${esc(studio.contact)}">${ltr(studio.contact)}</a></div>` : '',
    studio.whatsapp ? `<div>${esc(t.cta.whatsapp)}: <a href="${esc(studio.whatsapp)}">${ltr(studio.whatsapp)}</a></div>` : '',
    studio.email ? `<div>${esc(t.cta.email)}: <a href="mailto:${esc(studio.email)}">${ltr(studio.email)}</a></div>` : '',
  ].join('');

  const coverNote = overall.score === null ? t.results.noOverallBody(overall.coveredWeight) : overall.coveredWeight < 100 ? t.results.partialNote(overall.coveredWeight) : '';

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${esc(t.results.title)} — ${esc(report.host)}</title>
<style>${fontFaces(assets.fonts)}${CSS}</style>
</head>
<body>
<div class="cover">
  <div class="wordmark">Business Health Check<small>By Youth Studio</small></div>
  <div class="cover-main">
    <div class="cover-kicker">${esc(t.pdf.reportFor)}</div>
    <h1 class="cover-title">${esc(t.results.title)}</h1>
    <div class="cover-host mono">${ltr(report.host)}</div>
    <div class="cover-meta">${esc(t.pdf.date)}: ${esc(formatDate(report.generatedAt, locale))}</div>
  </div>
  <div class="cover-score">
    <div dir="ltr">${gauge(overall.score, gradeColor)}</div>
    <div>
      <h3>${esc(t.results.overall)}</h3>
      ${overall.grade ? `<span class="cover-grade" style="color:${gradeColor};background:${gradeColor}26">${esc(t.grades[overall.grade])}</span>` : `<span class="cover-grade" style="color:#f2c14e;background:#f2c14e22">${esc(t.results.noOverall)}</span>`}
      ${coverNote ? `<p class="cover-note">${esc(coverNote)}</p>` : ''}
    </div>
  </div>
  <div class="cover-foot">
    ${assets.logo ? `<img src="data:image/jpeg;base64,${assets.logo}" alt="Youth Studio">` : '<span></span>'}
    <p>Saudi Digital Studio</p>
  </div>
</div>

<section>
  <h2>${esc(t.pdf.summary)}</h2>
  <p class="lead">${esc(t.results.counts(critical, high, report.findings.length))}</p>
  ${report.ai ? `<div class="box ai"><p>${esc(report.ai[locale])}</p><p class="small muted" style="margin:0">${esc(t.results.aiLabel)}</p></div>` : ''}
  ${notices.map((n) => `<div class="box notice">${esc(n)}</div>`).join('')}
</section>

<section>
  <h2>${esc(t.pdf.scores)}</h2>
  <table><tbody>${categoryRows}</tbody></table>
</section>

${
  mobile || desktop
    ? `<section>
  <h2>${esc(t.results.compareTitle)}</h2>
  ${lighthouseTable(t, mobile, desktop)}
  <h3>${esc(t.results.metricsTitle)}</h3>
  ${metricsTable(t, mobile, desktop)}
  <p class="small muted" style="margin-top:2mm">${esc(t.results.metricsNote)} ${esc(t.results.vitalsTbtNote)}</p>
</section>`
    : ''
}

${strengths ? `<section><h2>${esc(t.results.strengthsTitle)}</h2><ul>${strengths}</ul></section>` : ''}

<section>
  <h2>${esc(t.pdf.findings)}</h2>
  ${findings || `<p class="muted">${esc(t.results.counts(0, 0, 0))}</p>`}
</section>

${gaps ? `<section><h2>${esc(t.results.gapsTitle)}</h2><p class="small muted">${esc(t.results.gapsSubtitle)}</p><table><tbody>${gaps}</tbody></table></section>` : ''}

<section>
  <h2>${esc(t.pdf.method)}</h2>
  <p>${esc(t.results.methodIntro)}</p>
  <p>${esc(t.results.methodBands)}</p>
  <table>
    <thead><tr><th></th><th class="n">${esc(t.results.methodShare)}</th><th class="n">${esc(t.results.methodResult)}</th><th class="n">${esc(t.results.methodBasis)}</th></tr></thead>
    <tbody>${methodRows}</tbody>
  </table>
  <h3>${esc(t.results.limitsTitle)}</h3>
  <ul>${t.results.limits.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
  <p class="small muted" style="margin-top:3mm">${esc(t.results.dataSources(lhVersion))}</p>
</section>

<div class="cta">
  <h2>${esc(t.cta.title)}</h2>
  <p>${esc(t.cta.body)}</p>
  ${links ? `<div class="links">${links}</div>` : ''}
</div>
</body>
</html>`;
}
