import fs from 'node:fs';
import path from 'node:path';
import type { Browser } from 'puppeteer-core';
import type { AuditReport, Locale } from '@/types/audit';
import { buildReportHtml, type ReportAssets } from './template';

const FONT_FILES = [
  'Geist-Regular',
  'Geist-Medium',
  'Geist-SemiBold',
  'PlexArabic-400',
  'PlexArabic-500',
  'PlexArabic-600',
  'GeistMono-Regular',
  'Alexandria-Latin-800',
  'Alexandria-Latin-900',
  'Alexandria-Arabic-800',
  'Alexandria-Arabic-900',
];

let cachedAssets: ReportAssets | null = null;

function loadAssets(): ReportAssets {
  if (cachedAssets) return cachedAssets;
  const read = (file: string) => {
    try {
      return fs.readFileSync(file).toString('base64');
    } catch {
      return '';
    }
  };
  // Paths are scoped to two folders so the deployment bundle traces only those files.
  const fontDir = path.join(process.cwd(), 'assets', 'fonts');
  const fonts: Record<string, string> = {};
  for (const name of FONT_FILES) fonts[name] = read(path.join(fontDir, `${name}.woff2`));
  cachedAssets = { fonts, logo: read(path.join(process.cwd(), 'public', 'brand', 'youth-studio-mark.png')) };
  return cachedAssets;
}

const LOCAL_CHROME = [
  process.env.CHROME_EXECUTABLE_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

async function launch(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default;
  const local = process.env.VERCEL ? undefined : LOCAL_CHROME.find((p) => p && fs.existsSync(p));
  if (local) {
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
    });
  }
  // Serverless (Vercel): a Chromium build packaged for Lambda-style runtimes.
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
}

const FOOTER = `<div style="width:100%;padding:0 15mm;font-family:Arial,Helvetica,sans-serif;font-size:7px;letter-spacing:0.12em;color:#8d8d9c;display:flex;justify-content:space-between;direction:ltr;">
  <span>BUSINESS HEALTH CHECK · BY YOUTH STUDIO</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

/**
 * Render the report to PDF in headless Chromium, which shapes Arabic and
 * handles right-to-left layout correctly. The page runs with JavaScript off
 * and every network request blocked: it can only show what we put in it.
 */
export async function renderReportPdf(report: AuditReport, locale: Locale): Promise<Uint8Array> {
  const html = buildReportHtml(report, locale, loadAssets());
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url === 'about:blank') void req.continue();
      else void req.abort();
    });
    await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
    await page.evaluateHandle('document.fonts.ready').catch(() => undefined);
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: FOOTER,
      timeout: 30_000,
    });
  } finally {
    await browser.close().catch(() => undefined);
  }
}
