#!/usr/bin/env node
/**
 * Local PageSpeed-compatible endpoint for development.
 *
 * Runs real Lighthouse in a local Chrome and answers in the same shape as
 * Google's PageSpeed Insights v5 API ({ lighthouseResult }). Use it when you
 * have no PageSpeed quota, or to audit a site running on localhost:
 *
 *   npm run psi:local
 *   PAGESPEED_API_BASE=http://localhost:4802 AUDIT_ALLOW_PRIVATE_HOSTS=1 npm run dev
 *
 * It returns lab data only (no Chrome UX Report field data) and is not
 * intended for production.
 */
import http from 'node:http';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import * as chromeLauncher from 'chrome-launcher';

const PORT = Number(process.env.LOCAL_PSI_PORT || 4802);
const CATEGORY_IDS = { PERFORMANCE: 'performance', ACCESSIBILITY: 'accessibility', SEO: 'seo', BEST_PRACTICES: 'best-practices' };

let queue = Promise.resolve();
const enqueue = (job) => {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
};

async function run(url, strategy, categories) {
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || undefined,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  try {
    const flags = { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: categories };
    const result = await lighthouse(url, flags, strategy === 'desktop' ? desktopConfig : undefined);
    return result.lhr;
  } finally {
    await chrome.kill();
  }
}

const server = http.createServer(async (req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (!u.pathname.endsWith('/runPagespeed')) return reply(404, { error: { code: 404, message: 'Not found' } });
  const target = u.searchParams.get('url');
  if (!target) return reply(400, { error: { code: 400, message: 'Missing url parameter' } });
  const strategy = (u.searchParams.get('strategy') || 'mobile').toLowerCase() === 'desktop' ? 'desktop' : 'mobile';
  const categories = u.searchParams.getAll('category').map((c) => CATEGORY_IDS[c.toUpperCase()]).filter(Boolean);
  const started = Date.now();
  try {
    const lhr = await enqueue(() => run(target, strategy, categories.length ? categories : ['performance']));
    console.log(`[local-psi] ${strategy} ${target} → ${Date.now() - started}ms`);
    if (lhr.runtimeError && lhr.runtimeError.code !== 'NO_ERROR') {
      return reply(500, { error: { code: 500, message: `Lighthouse returned error: ${lhr.runtimeError.code}. ${lhr.runtimeError.message}` } });
    }
    reply(200, { kind: 'pagespeedonline#result', id: target, lighthouseResult: lhr });
  } catch (err) {
    console.error('[local-psi] failed', err);
    reply(500, { error: { code: 500, message: String(err && err.message ? err.message : err) } });
  }
});

server.listen(PORT, () => console.log(`[local-psi] Lighthouse endpoint on http://localhost:${PORT}/runPagespeed`));
