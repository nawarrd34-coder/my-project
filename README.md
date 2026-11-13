# Business Health Check — by Youth Studio

> Know Your Digital Health. Unlock Your Growth. · اعرف صحة حضورك الرقمي، وافتح الطريق لنموّك.

A free website audit for Saudi business owners. Enter a URL and the app runs
Google Lighthouse (through the PageSpeed Insights API) on mobile and desktop,
reads the page's own headers and HTML, and returns a 0–100 Digital Health
Score with evidence-backed recommendations and a downloadable PDF, in Arabic
(default, RTL) or English.

## Run locally

```bash
npm install
cp .env.example .env.local   # add PAGESPEED_API_KEY at minimum
npm run dev                  # http://localhost:3000
```

Other commands: `npm test` (unit tests), `npm run typecheck`, `npm run build`,
`npx tsx scripts/audit-cli.mts https://example.com` (audit from the terminal).

**No PageSpeed quota?** `npm run psi:local` starts a PageSpeed-compatible
endpoint that runs real Lighthouse in a local Chrome. Point the app at it with
`PAGESPEED_API_BASE=http://localhost:4802`. Add `AUDIT_ALLOW_PRIVATE_HOSTS=1`
to scan a site on localhost (both are ignored in production).

## Environment variables

| Variable | Needed | Purpose |
|---|---|---|
| `PAGESPEED_API_KEY` | Yes | Server-side key for the PageSpeed Insights API. Without it Google's shared anonymous quota is usually exhausted and Lighthouse categories show "Not tested". Get one: Google Cloud Console → enable **PageSpeed Insights API** → Credentials → API key ([guide](https://developers.google.com/speed/docs/insights/v5/get-started)). |
| `NEXT_PUBLIC_WHATSAPP_URL` | Recommended | e.g. `https://wa.me/9665XXXXXXXX`. Shown in the report CTA and PDF. |
| `NEXT_PUBLIC_CONTACT_URL` | Recommended | Contact / booking page (https). Used as the primary CTA. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional | Contact email. |
| `NEXT_PUBLIC_STUDIO_URL` | Optional | Youth Studio website (footer logo link). |
| `ANTHROPIC_API_KEY` | Optional | Enables the AI executive summary (Claude). Without it the deterministic rules engine is used alone. `AI_RECOMMENDATIONS=off` disables it. |

No contact details are hard-coded; any link left empty is simply not shown.

## Deploy to Vercel

1. Push this repository to GitHub and import it in Vercel (framework: Next.js, no build settings to change).
2. Add the environment variables above in **Project → Settings → Environment Variables**.
3. Deploy. The audit route allows up to 180 s and the PDF route 60 s; PDFs are rendered with `@sparticuz/chromium` on Vercel.
4. Recommended before a public launch: add a Vercel Firewall rate-limit rule on `/api/audit` (the built-in limiter is per instance).

## How it works

```
src/
  app/                    pages (/, /scan) and API routes (/api/audit, /api/report/pdf)
  components/             landing, scan, results, ui, reactbits (StarBorder, SwarmCursor, SpringCheck)
  features/
    audit/                probe (own fetch of the page), on-page HTML analysis, orchestrator
    scoring/engine.ts     weights, check shares, normalisation, grade bands
    recommendations/      rules engine, bilingual finding copy, optional AI summary
    reports/              PDF HTML template, request schema, Chromium renderer
  lib/
    pagespeed/            PSI client + response parser
    security/             SSRF guard, pinned-IP fetch, rate limiter
    i18n/                 Arabic and English dictionaries
  types/audit.ts
```

- **Real progress.** `/api/audit` streams newline-delimited JSON events as each task really starts and finishes (connect, on-page, security, PSI mobile, PSI desktop, scoring). The progress dial is the weighted share of settled tasks and never shows 100% before the report exists.
- **Scoring.** Performance 25 · Mobile 20 · SEO 20 · Security 15 · Accessibility 10 · UX 10. Each category is a weighted average of its checks; checks that could not run are excluded, never scored as zero. A category needs 40% of its checks to be scored; the overall score needs categories worth 60 points. The full breakdown is shown in the report and PDF. Grade bands (90 / 75 / 60 / 40) are product-defined.
- **Honesty.** Every finding carries the measured value it is based on, and is marked *Verified* (measured) or *Inferred* (heuristic over HTML). Missing data is listed under "Checks that could not be completed".
- **Security.** Only http/https on default ports; no IP literals, credentials, or internal/reserved names; every DNS answer must be public unicast; the connection is pinned to the validated IP (DNS-rebinding safe); every redirect hop is re-validated (max 5); 15 s timeout; 2 MB body cap (also guards decompression bombs); per-IP rate limits; API keys stay server-side; the PDF page renders with JavaScript disabled and all network requests blocked.

## Visual system

- **Type:** Alexandria 700–900 for display (Arabic and Latin subsets), IBM Plex Sans Arabic and Geist for text, Geist Mono for figures. All self-hosted from `assets/fonts` (SIL OFL).
- **Signature visual:** `GlassOrb`, a single WebGL2 fragment shader (no models or video). It creates its context only near the viewport, starts animating after the page is idle, and draws one still frame on software renderers or with reduced motion.
- **React Bits** (`src/components/reactbits`): StarBorder (primary buttons), RotatingText (hero line; whole-word split in Arabic so letters stay joined), MagicBento (six areas), AnimatedContent (scroll reveals), ElectricBorder (Youth Studio card, mounted only when near view), SpringCheck (action plan).
- **Brand:** `public/brand/youth-studio-mark.png` is a transparent cut-out of the Youth Studio mark, used in the header, the studio section, the footer and the PDF.
- **Own score:** a production build of the landing page measured 100 performance on desktop and ~90 on mobile in a local Lighthouse 13 run, with 100 accessibility and SEO.

## Limitations

- One page (the URL entered) is audited, not the whole site.
- Lab metrics vary run to run; real-visitor (CrUX) data appears only when Google has it.
- UX indicators read server HTML; sites that render entirely in JavaScript skip those checks and say so.
- Security checks are public indicators only — not a penetration test.
- The in-memory rate limiter does not span serverless instances.
