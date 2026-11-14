# Business Health Check — by Youth Studio

> Know Your Digital Health. Unlock Your Growth. · اعرف صحة حضورك الرقمي، وافتح الطريق لنموّك.

A free website audit and digital consultant for Saudi business owners. Enter a
URL and the app:

- identifies the **business**: brand name, logo, colours, category, website type, market, language and contact channels;
- detects the **platform** (Salla, Zid, Shopify, WooCommerce, Magento and others) with a confidence level and the evidence, and says "Unknown / custom platform not confirmed" instead of guessing;
- runs a **small crawl** of public pages (homepage first, then categories, products, about and contact), respecting robots.txt, to analyse products, categories, banners, internal search and the customer journey;
- renders the homepage in headless Chromium on desktop and phone for screenshots and measured design checks;
- runs Google Lighthouse (PageSpeed Insights) on mobile and desktop and returns the existing 0–100 **Digital Health Score** (technical);
- turns everything into **business recommendations** in six groups, each with where, evidence, why it matters, the fix, priority and effort;
- gives a downloadable **PDF** of the same 12-section report, in Arabic (default, RTL) or English.

## Run locally

```bash
npm install
cp .env.example .env.local   # add PAGESPEED_API_KEY at minimum
npm run dev                  # http://localhost:3000
```

Other commands: `npm test` (unit tests), `npm run typecheck`, `npm run build`,
`npx tsx scripts/audit-cli.mts https://example.com` (full audit from the terminal),
`npx tsx scripts/business-cli.mts https://example.com out.json` (business analysis only).

**Synthetic test stores.** `python3 scripts/build-fixture-stores.py` generates three
made-up sites (a Salla-style perfume store, a Shopify-style linen store and an
Arabic corporate site) and `node scripts/serve-fixture-stores.mjs` serves them on
ports 4811–4813. With `AUDIT_ALLOW_PRIVATE_HOSTS=1` you can scan them end to end.
They exist for testing only and are not real businesses.

**No PageSpeed quota?** `npm run psi:local` starts a PageSpeed-compatible
endpoint that runs real Lighthouse in a local Chrome. Point the app at it with
`PAGESPEED_API_BASE=http://localhost:4802`. Add `AUDIT_ALLOW_PRIVATE_HOSTS=1`
to scan a site on localhost (both are ignored in production).

## Environment variables

| Variable | Needed | Purpose |
|---|---|---|
| `PAGESPEED_API_KEY` | Yes | Server-side key for the PageSpeed Insights API. Without it Google's shared anonymous quota is usually exhausted and Lighthouse categories show "Not tested". Get one: Google Cloud Console → enable **PageSpeed Insights API** → Credentials → API key ([guide](https://developers.google.com/speed/docs/insights/v5/get-started)). |
| `NEXT_PUBLIC_WHATSAPP_URL` | Optional | Overrides the built-in Youth Studio WhatsApp link (`wa.me/966533896219` with a pre-filled Arabic message), used by the floating button, CTA, footer and PDF. |
| `NEXT_PUBLIC_CONTACT_URL` | Recommended | Contact / booking page (https). Used as the primary CTA. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional | Overrides the built-in email `youthstudio2026@outlook.com`. |
| `NEXT_PUBLIC_STUDIO_URL` | Optional | Youth Studio website (footer logo link). |
| `AUDIT_RENDER` | Optional | `off` skips the headless-browser pass (screenshots, design and mobile-layout checks, in-browser search). |
| `ANTHROPIC_API_KEY` | Optional | Enables the AI executive summary (Claude). Without it the deterministic rules engine is used alone. `AI_RECOMMENDATIONS=off` disables it. |

The official Youth Studio WhatsApp number and email are built in (`src/lib/config.ts`); the variables above only override them.

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel (framework: Next.js, no build settings to change).
2. Add the environment variables above in **Project → Settings → Environment Variables**.
3. Deploy. The audit route allows up to 180 s and the PDF route 60 s. On Vercel both the PDF and the rendered business checks use `@sparticuz/chromium`; `next.config.ts` traces its `bin/` folder into the function (without it the PDF route fails on Vercel with "input directory … /bin does not exist").
4. Recommended before a public launch: add a Vercel Firewall rate-limit rule on `/api/audit` (the built-in limiter is per instance).

## How it works

```
src/
  app/                    pages (/, /scan) and API routes (/api/audit, /api/report/pdf)
  components/             landing, scan, results, ui, reactbits (StarBorder, SwarmCursor, SpringCheck)
  features/
    audit/                probe (own fetch of the page), on-page HTML analysis, orchestrator
    business/             identity, platform, robots, crawler + catalogue, banners, journey,
                          rendered design/search pass, business recommendations (+ ar/en copy)
    scoring/engine.ts     weights, check shares, normalisation, grade bands
    recommendations/      rules engine, bilingual finding copy, optional AI summary
    reports/              PDF HTML template (+ business sections), request schema, Chromium renderer
  lib/
    pagespeed/            PSI client + response parser
    security/             SSRF guard, pinned-IP fetch, rate limiter
    i18n/                 Arabic and English dictionaries
  types/audit.ts, types/business.ts
```

### Report structure

1 Business overview · 2 Brand & platform detection · 3 Website structure (coverage) ·
4 Products & categories · 5 Banners & visual design · 6 Internal search · 7 Customer journey ·
8 Performance & mobile · 9 SEO & accessibility · 10 Security · 11 Business improvement
recommendations · 12 Digital Health Score (technical). Reports saved before this
version (no business data) fall back to the technical layout.

### Business analysis rules

- **Crawl limits:** at most 12 pages, 45 requests, 5 product pages, 2 category pages and 75 s; robots.txt is read first and obeyed (also for in-browser navigations); same site only; no login, cart or checkout actions; every request goes through the same SSRF/DNS-pinning guard as the main scan.
- **Platform:** weighted public signatures (asset hosts, theme objects, platform web components, response headers). A single weak hint is not enough; front-end frameworks (Next.js, Nuxt…) are reported separately and never mistaken for a platform.
- **Products:** "discovered" means unique product URLs seen in links, sitemaps or the platform feed. A catalogue total is shown as *verified* only when the full list was enumerated (Shopify's public `products.json`); a sitemap count is shown as a sitemap count; otherwise "could not be verified".
- **Search:** one query built from a real product name and one nonsense query. Results are counted on the results page; interface observations (field present, visible on phone, suggestions) are listed separately from test results. Searches that robots.txt disallows are not run.
- **Design:** measured from the rendered page (fonts, sizes, colours, CTA contrast and position, tap targets, sideways scrolling). Judgement-based recommendations are marked *Inferred*.
- **Score:** the Digital Health Score is unchanged (same weights and checks). It measures technical health only; business findings feed recommendations, not the score.

- **Real progress.** `/api/audit` streams newline-delimited JSON events as each task really starts and finishes (connect, on-page, security, PSI mobile, PSI desktop, scoring). The progress dial is the weighted share of settled tasks and never shows 100% before the report exists.
- **Scoring.** Performance 25 · Mobile 20 · SEO 20 · Security 15 · Accessibility 10 · UX 10. Each category is a weighted average of its checks; checks that could not run are excluded, never scored as zero. A category needs 40% of its checks to be scored; the overall score needs categories worth 60 points. The full breakdown is shown in the report and PDF. Grade bands (90 / 75 / 60 / 40) are product-defined.
- **PDF.** The browser checks the response is really a PDF (`%PDF-` signature) before saving it, shows a success message with an "Open PDF" link, or a specific error (rate limit, too large, invalid report, render failure, connection) with a printable-HTML fallback (`POST /api/report/pdf?format=html`) the browser can save as PDF.
- **Honesty.** Every finding carries the measured value it is based on, and is marked *Verified* (measured) or *Inferred* (heuristic over HTML). Missing data is listed under "Checks that could not be completed".
- **Security.** Only http/https on default ports; no IP literals, credentials, or internal/reserved names; every DNS answer must be public unicast; the connection is pinned to the validated IP (DNS-rebinding safe); every redirect hop is re-validated (max 5); 15 s timeout; 2 MB body cap (also guards decompression bombs); per-IP rate limits; API keys stay server-side; the PDF page renders with JavaScript disabled and all network requests blocked.

## Visual system

- **Type:** Alexandria 700–900 for display (Arabic and Latin subsets), IBM Plex Sans Arabic and Geist for text, Geist Mono for figures. All self-hosted from `assets/fonts` (SIL OFL).
- **Signature visual:** `GlassOrb`, a single WebGL2 fragment shader (no models or video). It creates its context only near the viewport, starts animating after the page is idle, and draws one still frame on software renderers or with reduced motion.
- **React Bits** (`src/components/reactbits`): StarBorder (primary buttons), RotatingText (hero line; whole-word split in Arabic so letters stay joined), MagicBento (six areas), AnimatedContent (scroll reveals), ElectricBorder (Youth Studio card, mounted only when near view), SpringCheck (action plan).
- **Brand:** `public/brand/youth-studio-mark.png` is a transparent cut-out of the Youth Studio mark, used in the header, the studio section, the footer and the PDF.
- **Own score:** a production build of the landing page measured 100 performance on desktop and ~90 on mobile in a local Lighthouse 13 run, with 100 accessibility and SEO.

## Limitations

- Lighthouse audits one page (the URL entered). The business crawl reads up to 12 public pages, so large stores are only sampled; the report says how many pages were read.
- Product totals are verified only where the platform publishes a complete public list; otherwise the report says the total could not be verified.
- Platform detection relies on public signatures; heavily customised or headless stores may show as "Unknown / custom platform not confirmed".
- Stores that block automated visitors, require a login, or hide content behind a CAPTCHA are not bypassed; those checks show as not tested.
- Search relevance is judged from two test queries only; it is not a full evaluation of the search engine.
- Lab metrics vary run to run; real-visitor (CrUX) data appears only when Google has it.
- UX indicators read server HTML; sites that render entirely in JavaScript skip those checks and say so.
- Security checks are public indicators only — not a penetration test.
- The in-memory rate limiter does not span serverless instances.
