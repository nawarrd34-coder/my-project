#!/usr/bin/env node
/**
 * Serves the SYNTHETIC fixture websites from tests/fixtures/stores for local
 * end-to-end runs: 4811 = Salla-style store, 4812 = Shopify-style store,
 * 4813 = corporate site, 4814 = law firm, 4815 = menu-only restaurant,
 * 4816 = SaaS product, 4817 = tourism, 4818 = real estate, 4819 = clinic,
 * 4820 = custom-built store, 4821 = complete law firm, 4822 = thin generic site. Supports Range requests and a server-rendered search.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const SITES = { 4811: 'salla', 4812: 'shopify', 4813: 'corporate', 4814: 'law', 4815: 'restaurant', 4816: 'saas', 4817: 'tourism', 4818: 'realestate', 4819: 'clinic', 4820: 'customstore', 4821: 'lawrich', 4822: 'thin' };
const ROOT = path.resolve('tests/fixtures/stores');
const TYPES = { '.html': 'text/html; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json', '.txt': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const norm = (s) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

for (const [port, name] of Object.entries(SITES)) {
  const dir = path.join(ROOT, name);
  http
    .createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      let pathname = decodeURIComponent(u.pathname);
      if (name === 'salla' && pathname === '/search') {
        const q = u.searchParams.get('q') || '';
        const catalog = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
        const hits = catalog.filter((p) => norm(p.name).includes(norm(q)));
        const body = hits.length
          ? hits.map((p) => `<div class="product-card"><a href="${p.url}">${p.name}</a> ${p.price} ر.س</div>`).join('')
          : '<p>لا توجد نتائج مطابقة لبحثك</p>';
        res.writeHead(200, { 'content-type': TYPES['.html'] });
        return res.end(`<!doctype html><html lang="ar"><head><title>نتائج البحث</title><script src="https://cdn.salla.network/js/twilight.js"></script></head><body><header><a href="/">الرئيسية</a></header><main>${body}</main></body></html>`);
      }
      let file = path.join(dir, pathname);
      if (!file.startsWith(dir)) {
        res.writeHead(403);
        return res.end();
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/html' });
        return res.end('<h1>404</h1>');
      }
      const type = TYPES[path.extname(file)] || 'application/octet-stream';
      const size = fs.statSync(file).size;
      const headers = { 'content-type': type, 'accept-ranges': 'bytes' };
      if (name === 'shopify') headers['x-shopid'] = '1234567';
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      if (range && type.startsWith('image/')) {
        const start = Number(range[1]);
        const end = Math.min(range[2] ? Number(range[2]) : size - 1, size - 1);
        res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, { ...headers, 'content-length': size });
      fs.createReadStream(file).pipe(res);
    })
    .listen(Number(port), () => console.log(`[fixtures] ${name} on http://127.0.0.1:${port}`));
}
