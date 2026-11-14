#!/usr/bin/env node
/** Serves tests/fixtures/site on localhost so the scanner has a real page to audit in tests. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.TEST_SITE_PORT || 4801);
const root = path.resolve('tests/fixtures/site');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

http
  .createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'x-powered-by': 'TestSite' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`[test-site] http://localhost:${PORT}`));
