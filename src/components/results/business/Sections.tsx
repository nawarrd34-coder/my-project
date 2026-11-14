'use client';

/* eslint-disable @next/next/no-img-element -- third-party store images are shown as-is from their own host */
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CountUp } from '@/components/ui/CountUp';
import { Chevron } from '@/components/ui/icons';
import { resolveRecommendations, REC_GROUPS, type ResolvedRec } from '@/features/business/content';
import { SEVERITY_COLOR, scoreColor } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useBiz } from '@/lib/i18n/useBiz';
import type { AuditReport, Finding } from '@/types/audit';
import type { BusinessAnalysis, RecGroup } from '@/types/business';
import type { ProfessionalScore } from '@/types/professional';
import { proDicts } from '@/features/professional/copy';
import { BasisBadge, ConfidenceBadge, Evidence, kb, Notice, Row, shortPath, Stat, Swatches, YesNo } from './parts';

/* ───────────────────────────── 1. Business overview ───────────────────────────── */

export function BusinessOverview({ business, report, pro }: { business: BusinessAnalysis; report: AuditReport; pro?: ProfessionalScore | null }) {
  const pd = proDicts[useI18n().locale];
  const b = useBiz();
  const { t, locale } = useI18n();
  const { identity: id, platform, catalog, coverage, banners, design } = business;
  const name = id.brandName?.value ?? report.host;
  const contacts = (Object.entries(id.contact) as [keyof typeof id.contact, unknown][])
    .filter(([k, v]) => k !== 'social' && v === true)
    .map(([k]) => b.channels[k as keyof typeof b.channels]);
  const social = id.contact.social;
  const colors = id.colors.map((c) => c.hex);
  const productsValue = catalog ? (catalog.catalogTotal?.verified ? catalog.catalogTotal.value : catalog.productUrlsDiscovered) : null;

  return (
    <div className="space-y-4" data-testid="business-overview">
      <div className="panel relative overflow-hidden p-6 md:p-10">
        <div className="pointer-events-none absolute -top-40 start-0 h-80 w-[520px] rounded-full blur-[110px]" style={{ background: `${colors[0] ?? '#2f6bff'}2a` }} aria-hidden="true" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white p-2 md:h-24 md:w-24">
              {id.logo ? (
                <img src={id.logo.dataUri ?? id.logo.url} alt={b.fields.logo} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <span className="display text-3xl text-[#0b0b11]">{name.slice(0, 1)}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted">{b.fields.brand}</p>
              <h2 className="display mt-1 break-words text-[30px] text-ink md:text-[44px]" data-testid="brand-name">
                {name}
              </h2>
              {!id.brandName && <p className="mt-1 text-xs text-faint">{b.notDetected}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[13px] text-ink" data-testid="website-type">
                  {b.websiteTypes[id.websiteType.value]}
                </span>
                {id.industry && <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[13px] text-ink">{b.industries[id.industry.value]}</span>}
                <span className="rounded-full border border-[#5a4cf5]/50 bg-[#5a4cf5]/15 px-3 py-1 text-[13px] text-[#c9c4ff]" data-testid="platform-chip">
                  {b.platforms[platform.id]}
                </span>
                {id.country && <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[13px] text-muted">{b.countries[id.country.code] ?? id.country.code}</span>}
              </div>
              {id.description && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted" dir="auto">{id.description}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {pro && pro.overall.score !== null && (
              <a href="#professional" className="flex items-center gap-4 rounded-2xl border border-line bg-black/20 px-5 py-4 transition-colors hover:border-line-strong" data-testid="overview-professional">
                <span className="num-display text-5xl leading-none" style={{ color: scoreColor(pro.overall.score) }}>
                  <CountUp to={pro.overall.score} />
                </span>
                <span className="text-xs leading-snug text-muted">
                  {pd.section.overall}
                  <br />
                  <span className="text-faint">{pro.overall.level ? pd.levels[pro.overall.level] : '/100'}</span>
                </span>
              </a>
            )}
            {report.overall.score !== null && (
              <a href="#score" className="flex items-center gap-4 rounded-2xl border border-line bg-black/20 px-5 py-3 transition-colors hover:border-line-strong">
                <span className="num-display text-3xl leading-none" style={{ color: scoreColor(report.overall.score) }}>
                  <CountUp to={report.overall.score} />
                </span>
                <span className="text-xs leading-snug text-muted">
                  {b.sections.score}
                  <br />
                  <span className="text-faint">/100</span>
                </span>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label={b.fields.products}
          value={productsValue === null ? <span className="text-faint">—</span> : <span className="num-display">{productsValue}</span>}
          sub={catalog ? (catalog.catalogTotal?.verified ? b.products.totalVerified(catalog.catalogTotal.value) : b.products.totalUnknown) : b.products.notStore}
          testId="stat-products"
        />
        <Stat label={b.fields.categories} value={catalog ? <span className="num-display">{catalog.categories.count}</span> : <span className="text-faint">—</span>} testId="stat-categories" />
        <Stat label={b.fields.banners} value={<span className="num-display">{banners.count}</span>} sub={banners.sliders ? `${b.banners.sliders}: ${banners.sliders}` : undefined} testId="stat-banners" />
        <Stat label={b.fields.pages} value={<span className="num-display">{coverage.pagesAnalyzed}</span>} sub={b.coverage.requests(coverage.requests)} testId="stat-pages" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-xs text-muted">{b.fields.contact}</p>
          <p className="mt-3 text-sm text-ink">{contacts.length ? contacts.join(' · ') : <span className="text-faint">{b.none}</span>}</p>
          {social.length > 0 && <p className="mt-2 text-xs capitalize text-faint" dir="ltr">{social.join(' · ')}</p>}
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted">{b.fields.language}</p>
          <p className="mt-3 text-sm text-ink">{id.language.primary ? (b.languages[id.language.primary] ?? id.language.primary) : <span className="text-faint">{b.notDetected}</span>}</p>
          {id.language.declared && <p className="mt-2 font-mono text-xs text-faint">lang=&quot;{id.language.declared}&quot;</p>}
        </div>
        <div className="panel p-5">
          <p className="text-xs text-muted">{b.fields.colors}</p>
          <div className="mt-3">{colors.length ? <Swatches colors={colors.slice(0, 5)} /> : <span className="text-sm text-faint">{b.notDetected}</span>}</div>
          {id.colors[0] && <p className="mt-2 text-[11px] text-faint">{b.source}: {id.colors.some((c) => c.source === 'rendered') ? b.design.palette : 'CSS / theme-color'}</p>}
        </div>
      </div>

      {(design.screenshots.desktop || design.screenshots.mobile) && (
        <div className="panel p-5 md:p-6">
          <p className="text-xs text-muted">{b.design.screenshots}</p>
          <div className="mt-4 grid items-start gap-4 md:grid-cols-[1fr_auto]">
            {design.screenshots.desktop && (
              <figure className="overflow-hidden rounded-xl border border-line">
                <img src={design.screenshots.desktop} alt={`${name} — ${b.design.desktop}`} className="block w-full" />
                <figcaption className="border-t border-line px-3 py-2 text-[11px] text-faint">{b.design.desktop} · 1366px</figcaption>
              </figure>
            )}
            {design.screenshots.mobile && (
              <figure className="mx-auto w-[200px] overflow-hidden rounded-[22px] border border-line md:w-[220px]">
                <img src={design.screenshots.mobile} alt={`${name} — ${b.design.mobile}`} className="block w-full" />
                <figcaption className="border-t border-line px-3 py-2 text-[11px] text-faint">{b.design.mobile} · 390px</figcaption>
              </figure>
            )}
          </div>
        </div>
      )}

      {report.ai && (
        <div className="rounded-xl border border-accent/25 bg-accent/[0.06] p-5">
          <p className="text-[15px] leading-relaxed text-ink/90">{report.ai[locale]}</p>
          <p className="mt-2 text-xs text-faint">{t.results.aiLabel}</p>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── 2. Brand & platform ───────────────────────────── */

export function PlatformSection({ business }: { business: BusinessAnalysis }) {
  const b = useBiz();
  const { platform, identity: id } = business;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-6" data-testid="platform-card" data-platform={platform.id}>
        <p className="text-xs text-muted">{b.fields.platform}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h3 className="heading text-2xl text-ink">{b.platforms[platform.id]}</h3>
          <ConfidenceBadge value={platform.confidence} />
        </div>
        {platform.id === 'unknown' && <p className="mt-3 text-sm leading-relaxed text-muted">{b.platformUnknownNote}</p>}
        <Evidence items={platform.evidence} />
        {platform.frameworks.length > 0 && (
          <p className="mt-4 text-xs text-faint">
            {b.frameworks}: <span className="font-mono text-muted">{platform.frameworks.join(' · ')}</span>
          </p>
        )}
      </div>
      <div className="panel p-6">
        <Row label={b.fields.brand}>
          {id.brandName ? (
            <>
              {id.brandName.value} <span className="ms-2 text-[11px] text-faint">({id.brandName.source})</span>
            </>
          ) : (
            <span className="text-faint">{b.notDetected}</span>
          )}
        </Row>
        <Row label={b.fields.title}>{id.siteTitle ?? <span className="text-faint">{b.notDetected}</span>}</Row>
        <Row label={b.fields.logo}>{id.logo ? <span className="text-[12px] text-muted">{id.logo.source}</span> : <span className="text-faint">{b.notDetected}</span>}</Row>
        <Row label={b.fields.type}>
          <span className="inline-flex items-center gap-2">
            {b.websiteTypes[id.websiteType.value]} <ConfidenceBadge value={id.websiteType.confidence} />
          </span>
        </Row>
        <Row label={b.fields.industry}>
          {id.industry ? (
            <span className="inline-flex items-center gap-2">
              {b.industries[id.industry.value]} <ConfidenceBadge value={id.industry.confidence} />
            </span>
          ) : (
            <span className="text-faint">{b.notDetected}</span>
          )}
        </Row>
        <Row label={b.fields.country}>
          {id.country ? `${b.countries[id.country.code] ?? id.country.code}` : <span className="text-faint">{b.notDetected}</span>}
        </Row>
        <Evidence items={[...id.websiteType.evidence, ...(id.industry?.evidence ?? []).map((e) => `keyword ${e}`), ...(id.country?.evidence ?? [])].slice(0, 8)} />
      </div>
    </div>
  );
}

/* ───────────────────────────── 3. Website structure ───────────────────────────── */

export function StructureSection({ business }: { business: BusinessAnalysis }) {
  const b = useBiz();
  const c = business.coverage;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="panel space-y-3 p-6" data-testid="coverage">
        <p className="heading text-xl text-ink">{b.coverage.pages(c.pagesAnalyzed)}</p>
        <ul className="space-y-2 text-sm text-muted">
          <li>{b.coverage.requests(c.requests)}</li>
          <li>{c.robots === 'found' ? b.coverage.robotsFound : c.robots === 'missing' ? b.coverage.robotsMissing : b.coverage.robotsError}</li>
          {c.robotsBlocked > 0 && <li className="text-warn">{b.coverage.robotsBlocked(c.robotsBlocked)}</li>}
          <li>{c.sitemap.found ? b.coverage.sitemap(c.sitemap.urls, c.sitemap.productUrls) : b.coverage.noSitemap}</li>
          {c.budgetReached && <li className="text-warn">{b.coverage.budget}</li>}
          <li className="text-faint">{b.coverage.duration(Math.round(c.durationMs / 100) / 10)}</li>
        </ul>
        {business.limits.length > 0 && (
          <ul className="space-y-2 border-t border-line pt-3">
            {business.limits.map((l) => (
              <li key={l} className="text-xs leading-relaxed text-warn">
                {b.limits[l] ?? l}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel overflow-hidden">
        <p className="px-6 pt-5 text-xs text-muted">{b.coverage.pageList}</p>
        <ul className="mt-2 divide-y divide-line">
          {c.pages.map((p) => (
            <li key={p.url} className="flex items-center gap-3 px-6 py-2.5 text-sm">
              <span className="w-20 shrink-0 text-[11px] text-faint">{b.coverage.kinds[p.kind] ?? p.kind}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink/85" dir="ltr">
                {shortPath(p.url)}
              </span>
              <span className={`num text-[11px] ${p.ok ? 'text-good' : 'text-bad'}`}>{p.status ?? '—'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────────────────────── 4. Products & categories ───────────────────────────── */

export function ProductsSection({ business }: { business: BusinessAnalysis }) {
  const b = useBiz();
  const c = business.catalog;
  if (!c) return <Notice>{b.products.notStore}</Notice>;
  const total = c.catalogTotal;
  return (
    <div className="space-y-4" data-testid="products">
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label={b.products.discovered} value={<span className="num-display">{c.productUrlsDiscovered}</span>} sub={b.products.discoveredNote} />
        <Stat label={b.products.analysed} value={<span className="num-display">{c.productPagesAnalyzed}</span>} />
        <Stat
          label={b.products.total}
          value={total ? <span className="num-display">{total.value}</span> : <span className="text-base text-faint">{b.products.totalUnknown}</span>}
          sub={total ? (total.verified ? b.products.totalVerified(total.value) : b.products.totalSitemap(total.value)) : undefined}
          testId="catalog-total"
        />
      </div>
      <div className="panel p-5">
        <p className="text-xs text-muted">
          {b.products.categories}: <span className="num text-ink">{c.categories.count}</span>
        </p>
        {c.categories.names.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {c.categories.names.map((n) => (
              <span key={n} className="rounded-full border border-line px-3 py-1 text-[13px] text-ink/90" dir="auto">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
      {c.products.length ? (
        <div className="panel overflow-hidden">
          <p className="px-6 pt-5 text-xs text-muted">{b.products.sample}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-xs text-faint">
                  {Object.values(b.products.cols).map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-normal ${i === 0 ? 'text-start ps-6' : 'text-center'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.products.map((p) => (
                  <tr key={p.url} className="border-t border-line">
                    <td className="max-w-[260px] px-4 py-3 ps-6">
                      <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 hover:underline">
                        {p.image ? <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line bg-white object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <span className="h-10 w-10 shrink-0 rounded-md border border-line" />}
                        <span className="line-clamp-2 text-ink/90" dir="auto">
                          {p.name ?? shortPath(p.url)}
                        </span>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">{p.price ? <span className="num">{`${p.price} ${p.currency ?? ''}`.trim()}</span> : <span className="text-bad">—</span>}</td>
                    <td className={`num px-4 py-3 text-center ${p.imageCount <= 1 ? 'text-warn' : 'text-ink'}`}>{p.imageCount}</td>
                    <td className={`px-4 py-3 text-center text-xs ${p.descriptionLength < 120 ? 'text-warn' : 'text-muted'}`}>{b.products.chars(p.descriptionLength)}</td>
                    <td className="px-4 py-3 text-center text-xs text-muted">{p.availability ?? '—'}</td>
                    <td className="px-4 py-3 text-center">{p.source === 'platform-json' ? <span className="text-faint">—</span> : <YesNo value={p.addToCart} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Notice>{b.products.noProducts}</Notice>
      )}
    </div>
  );
}

/* ───────────────────────────── 5. Banners & visual design ───────────────────────────── */

export function VisualSection({ business }: { business: BusinessAnalysis }) {
  const b = useBiz();
  const { banners, design: d } = business;
  return (
    <div className="space-y-4" data-testid="visual">
      {banners.count ? (
        <div className="panel overflow-hidden">
          <p className="px-6 pt-5 text-xs text-muted">
            {b.banners.count}: <span className="num text-ink">{banners.count}</span> · {b.banners.sliders}: <span className="num text-ink">{banners.sliders}</span>
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-xs text-faint">
                  {Object.values(b.banners.cols).map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-normal ${i === 0 ? 'text-start ps-6' : 'text-center'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {banners.banners.map((x) => (
                  <tr key={x.src} className="border-t border-line">
                    <td className="px-4 py-3 ps-6">
                      <img src={x.src} alt={x.alt ?? ''} className="h-12 w-28 rounded-md border border-line object-cover" referrerPolicy="no-referrer" loading="lazy" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="num">{x.width && x.height ? `${x.width}×${x.height}` : '—'}</span>
                      <span className="block text-[10px] text-faint">{x.measured ? b.banners.measured : b.banners.attr}</span>
                    </td>
                    <td className={`num px-4 py-3 text-center ${(x.bytes ?? 0) > 450_000 ? 'text-bad' : ''}`}>{kb(x.bytes)}</td>
                    <td className="num px-4 py-3 text-center">{x.ratio ? `${x.ratio}:1` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <YesNo value={x.mobileVariant} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <YesNo value={x.linked} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <Notice>{b.banners.none}</Notice>
      )}

      {d.rendered ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-6">
            <Row label={b.design.fonts}>
              <span className="font-mono text-[12px]" dir="ltr">
                {d.fonts.map((f) => `${f.family} ${Math.round(f.share * 100)}%`).join(' · ') || '—'}
              </span>
            </Row>
            {(['h1', 'h2', 'body', 'mobileBody'] as const).map((k) => (
              <Row key={k} label={`${b.design.sizes} · ${b.design.sizeLabels[k]}`}>
                <span className="num">{d.sizes[k] ? `${d.sizes[k]}px` : '—'}</span>
              </Row>
            ))}
            <Row label={b.design.palette}>{d.palette.length ? <Swatches colors={d.palette} /> : '—'}</Row>
          </div>
          <div className="panel p-6">
            <Row label={b.design.cta}>
              {d.primaryCta ? (
                <span dir="auto">
                  «{d.primaryCta.text}»{' '}
                  {d.primaryCta.contrast !== null && <span className={`ms-2 text-xs ${d.primaryCta.contrast < 3 ? 'text-bad' : 'text-good'}`}>{b.design.ctaContrast(d.primaryCta.contrast)}</span>}
                </span>
              ) : (
                <span className="text-faint">{b.notDetected}</span>
              )}
            </Row>
            {d.primaryCta && (
              <>
                <Row label={b.design.aboveFoldDesktop}>
                  <YesNo value={d.primaryCta.aboveFoldDesktop} />
                </Row>
                <Row label={b.design.aboveFoldMobile}>
                  <YesNo value={d.primaryCta.aboveFoldMobile} />
                </Row>
              </>
            )}
            <Row label={`${b.design.mobileChecks} · ${b.design.overflow}`}>
              <YesNo value={d.mobile ? !d.mobile.horizontalOverflow : null} />
            </Row>
            <Row label={`${b.design.mobileChecks} · ${b.design.smallTargets}`}>
              <span className="num">{d.mobile?.smallTapTargets ?? '—'}</span>
            </Row>
            <p className="mt-4 text-[11px] leading-relaxed text-faint">{b.design.observedNote}</p>
          </div>
        </div>
      ) : (
        <Notice>{b.design.notRendered}</Notice>
      )}
    </div>
  );
}

/* ───────────────────────────── 6. Internal search ───────────────────────────── */

export function SearchSection({ business }: { business: BusinessAnalysis }) {
  const b = useBiz();
  const s = business.search;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]" data-testid="search">
      <div className="panel p-6">
        <Row label={b.search.present}>
          {s.present ? (
            <span className="inline-flex items-center gap-2">
              <YesNo value />
              <span className="text-[11px] text-faint">{s.source === 'html' ? b.search.sourceHtml : s.source === 'component' ? b.search.sourceComponent : b.search.sourceRendered}</span>
            </span>
          ) : (
            <YesNo value={false} />
          )}
        </Row>
        <Row label={b.search.visibleDesktop}>
          <YesNo value={s.visibleDesktop} />
        </Row>
        <Row label={b.search.visibleMobile}>
          <YesNo value={s.visibleMobile} />
        </Row>
        <Row label={b.search.autocomplete}>
          <YesNo value={s.autocomplete} />
        </Row>
      </div>
      <div className="panel overflow-hidden">
        <div className="px-6 pt-5">
          <p className="text-xs text-muted">{b.search.tests}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">{b.search.testsNote}</p>
        </div>
        {s.tests.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-xs text-faint">
                  {Object.values(b.search.cols).map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-normal ${i === 0 ? 'text-start ps-6' : 'text-start'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.tests.map((tst) => (
                  <tr key={`${tst.kind}-${tst.query}`} className="border-t border-line align-top" data-search-test={tst.kind} data-status={tst.status}>
                    <td className="px-4 py-3 ps-6 font-mono text-[12px]" dir="auto">
                      {tst.query}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{b.search.kinds[tst.kind]}</td>
                    <td className="px-4 py-3 text-xs">
                      {tst.status === 'ok' ? (
                        <>
                          <span className="text-ink">{b.search.results(tst.resultCount ?? 0, tst.relevantCount)}</span>
                          {tst.kind === 'no_result' && <span className={`block ${tst.noResultMessage ? 'text-good' : 'text-warn'}`}>{tst.noResultMessage ? b.search.noResultMessage : b.search.noMessage}</span>}
                        </>
                      ) : (
                        <span className="text-warn">{b.search.status[tst.status]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-faint">{b.search.via[tst.via]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-5 text-sm text-muted">{b.search.noTests}</p>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── 7. Customer journey ───────────────────────────── */

export function JourneySection({ business }: { business: BusinessAnalysis }) {
  const b = useBiz();
  const j = business.journey;
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="journey">
      <div className="panel p-6">
        <Row label={b.journey.cart}>
          <YesNo value={j.cartLink} />
        </Row>
        <Row label={b.journey.account}>
          <YesNo value={j.accountLink} />
        </Row>
        <Row label={b.journey.delivery}>
          <YesNo value={j.deliveryInfo} />
        </Row>
        <Row label={b.journey.returns}>
          <YesNo value={j.returnPolicy} />
        </Row>
        <Row label={b.journey.privacy}>
          <YesNo value={j.privacyPolicy} />
        </Row>
        <Row label={b.journey.reviews}>
          <YesNo value={j.reviews} />
        </Row>
      </div>
      <div className="panel p-6">
        <p className="text-xs text-muted">{b.journey.payments}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {j.paymentMethods.length ? (
            j.paymentMethods.map((m) => (
              <span key={m} className="rounded-full border border-line bg-white/[0.03] px-3 py-1 text-[13px] text-ink" dir="ltr">
                {m}
              </span>
            ))
          ) : (
            <span className="text-sm text-faint">{b.none}</span>
          )}
        </div>
        <p className="mt-6 text-xs text-muted">{b.journey.trust}</p>
        <div className="mt-2">
          {(Object.keys(j.trust) as (keyof typeof j.trust)[]).map((k) => (
            <Row key={k} label={b.journey.trustItems[k]}>
              <YesNo value={j.trust[k]} />
            </Row>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── 11. Recommendations ───────────────────────────── */

const GROUP_COLOR: Record<RecGroup, string> = { critical: '#ff5468', high: '#ff8f4a', design: '#b9a8ff', conversion: '#5fb8ff', seo: '#3ddc97', longterm: '#8d8d9c' };

export function Recommendations({ business, findings, extra = [] }: { business: BusinessAnalysis | null; findings: Finding[]; extra?: ResolvedRec[] }) {
  const b = useBiz();
  const { t, locale } = useI18n();
  const recs = useMemo(
    () => resolveRecommendations(business?.recommendations ?? [], findings, locale, (c) => b.categoryWhere[c] ?? c, extra),
    [business, findings, locale, b, extra],
  );
  const [open, setOpen] = useState<string | null>(null);
  const groups = REC_GROUPS.map((g) => ({ g, items: recs.filter((r) => r.group === g) })).filter((x) => x.items.length);

  if (!recs.length) return <Notice>{t.results.counts(0, 0, 0)}</Notice>;
  return (
    <div className="space-y-8" data-testid="recommendations">
      <div className="flex flex-wrap gap-2">
        {groups.map(({ g, items }) => (
          <a key={g} href={`#rec-${g}`} className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-[13px] text-muted hover:text-ink">
            <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />
            {b.recs.groups[g]}
            <span className="num text-faint">{items.length}</span>
          </a>
        ))}
      </div>
      {groups.map(({ g, items }) => (
        <div key={g} id={`rec-${g}`} className="scroll-mt-28" data-rec-group={g}>
          <h3 className="heading flex items-center gap-3 text-xl text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLOR[g] }} />
            {b.recs.groups[g]}
            <span className="text-sm font-normal text-faint">{b.recs.count(items.length)}</span>
          </h3>
          <ul className="mt-4 space-y-2.5">
            {items.map((r) => {
              const isOpen = open === r.key;
              const color = SEVERITY_COLOR[r.priority];
              return (
                <li key={r.key} className="panel overflow-hidden" data-rec={r.key}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : r.key)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-4 text-start">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-ink">{r.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="font-medium" style={{ color }}>
                          {t.severity[r.priority]}
                        </span>
                        <span className="text-faint">{b.recs.complexity[r.complexity]}</span>
                        <span className="text-faint">{r.source === 'business' ? b.recs.sourceBusiness : r.source === 'professional' ? b.recs.sourceProfessional : b.recs.sourceTechnical}</span>
                        <BasisBadge basis={r.basis} />
                      </span>
                    </span>
                    <span className="text-faint">
                      <Chevron open={isOpen} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <dl className="grid gap-5 border-t border-line px-5 py-5 md:grid-cols-2 md:ps-10">
                          <div>
                            <dt className="text-xs font-medium text-faint">{b.recs.where}</dt>
                            <dd className="mt-1.5 text-sm text-ink/90" dir="auto">{r.where}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-faint">{b.recs.evidence}</dt>
                            <dd className="mt-1.5 rounded-lg border border-line bg-black/30 px-3 py-2 font-mono text-[13px] text-ink/90 [overflow-wrap:anywhere]" dir="auto">
                              {r.evidence}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-faint">{b.recs.why}</dt>
                            <dd className="mt-1.5 text-sm leading-relaxed text-ink/90">{r.why}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-faint">{b.recs.fix}</dt>
                            <dd className="mt-1.5 text-sm leading-relaxed text-ink/90">{r.fix}</dd>
                          </div>
                        </dl>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
