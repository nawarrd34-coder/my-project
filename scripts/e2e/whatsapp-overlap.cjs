// Run with the dev server on :3000: node scripts/e2e/whatsapp-overlap.cjs [site-url-for-report-page]
// Floating WhatsApp button: at every scroll position, it is either hidden or covers no control / fixed element.
const { chromium, devices } = require('playwright');
const DEVICES = process.env.DEVICES ? process.env.DEVICES.split(',') : ['iPhone SE', 'iPhone 13', 'Pixel 7', 'Galaxy S9+', 'iPhone 14 Pro Max'];
const PAGES = [
  ['landing-ar', '/', 'ar'],
  ['landing-en', '/', 'en'],
  ['compare-ar', '/compare', 'ar'],
];
const probe = () => {
  const wrap = document.querySelector('[data-testid="whatsapp-float-wrap"]');
  const cs = getComputedStyle(wrap);
  const visible = cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.5;
  if (!visible) return { visible, hits: [] };
  const r = wrap.getBoundingClientRect();
  const g = 4;
  const box = { l: r.left - g, t: r.top - g, r: r.right + g, b: r.bottom + g };
  const hits = [];
  const cand = document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [data-float-avoid], *');
  for (const el of cand) {
    if (wrap.contains(el)) continue;
    const st = getComputedStyle(el);
    const fixed = st.position === 'fixed' || st.position === 'sticky';
    const control = el.matches('a[href], button, input, select, textarea, [role="button"], [data-float-avoid]');
    if (!fixed && !control) continue;
    if (st.visibility === 'hidden' || st.display === 'none') continue;
    // Effective opacity including ancestors: invisible (fading-in) elements are not "covered content".
    let op = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) op *= parseFloat(getComputedStyle(n).opacity);
    if (op < 0.3) continue;
    const e = el.getBoundingClientRect();
    if (!e.width || !e.height) continue;
    if (e.right <= box.l || e.left >= box.r || e.bottom <= box.t || e.top >= box.b) continue;
    // Is the element actually painted at the overlap (not clipped / covered)? Check the overlap centre.
    const x = (Math.max(e.left, box.l) + Math.min(e.right, box.r)) / 2;
    const y = (Math.max(e.top, box.t) + Math.min(e.bottom, box.b)) / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const top = document.elementsFromPoint(x, y).find((n) => !wrap.contains(n));
    // The element must itself be painted at that point (not just "inside" <html>/<body>, and not pointer-events:none).
    if (st.pointerEvents === 'none' || !top || top === document.documentElement || top === document.body) continue;
    if (!(top === el || el.contains(top) || top.contains(el))) continue;
    hits.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}${el.dataset.testid ? '#' + el.dataset.testid : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"${fixed ? ' [fixed]' : ''}`);
  }
  return { visible, hits };
};
(async () => {
  const [, , extra] = process.argv;
  const pages = [...PAGES];
  if (extra) pages.push(['report-ar', `/scan?url=${encodeURIComponent(extra)}`, 'ar']);
  const b = await chromium.launch();
  let fails = 0;
  for (const dev of DEVICES) {
    const ctx = await b.newContext({ ...devices[dev] });
    const pg = await ctx.newPage();
    for (const [name, path, loc] of pages) {
      await ctx.addCookies([{ name: 'bhc_locale', value: loc, url: 'http://localhost:3000' }]);
      await pg.goto('http://localhost:3000' + path, { waitUntil: 'load' });
      if (name.startsWith('report')) await pg.waitForSelector('[data-testid="report"]', { timeout: 240000 });
      await pg.waitForTimeout(1600);
      const height = await pg.evaluate(() => document.documentElement.scrollHeight);
      const vh = pg.viewportSize().height;
      let shown = 0, hidden = 0;
      const bad = [];
      for (let y = 0; y <= height - vh + 1; y += 140) {
        await pg.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
        await pg.waitForTimeout(1500);
        let res = await pg.evaluate(probe);
        // Something may have moved under the button this very moment: give the button its reaction time once.
        if (res.hits.length) {
          await pg.waitForTimeout(300);
          res = await pg.evaluate(probe);
        }
        if (res.visible) shown++; else hidden++;
        if (res.hits.length) bad.push(`y=${y}: ${res.hits.join(', ')}`);
      }
      fails += bad.length;
      console.log(`${dev.padEnd(18)} ${name.padEnd(11)} positions=${shown + hidden} visible=${shown} hidden=${hidden} overlaps=${bad.length}${bad.length ? '\n    ' + bad.slice(0, 4).join('\n    ') : ''}`);
    }
    await ctx.close();
  }
  console.log('TOTAL overlaps:', fails);
  await b.close();
})();
