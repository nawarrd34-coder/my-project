import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSafeUrl, isPublicAddress, parseUserUrl, UrlSafetyError } from '../src/lib/security/ssrf';
import { rateLimit } from '../src/lib/security/rateLimit';
import { isNoindex } from '../src/features/scoring/engine';

const codeOf = (input: string): string => {
  try {
    assertSafeUrl(parseUserUrl(input));
    return 'ok';
  } catch (e) {
    return e instanceof UrlSafetyError ? e.code : 'other';
  }
};

test('accepts ordinary public URLs and adds https:// when missing', () => {
  assert.equal(codeOf('https://example.com'), 'ok');
  assert.equal(codeOf('http://shop.example.sa/path?q=1'), 'ok');
  assert.equal(parseUserUrl('example.com.sa').toString(), 'https://example.com.sa/');
  assert.equal(codeOf('https://xn--mgbab2bd.xn--mgberp4a5d4ar'), 'ok');
});

test('rejects malformed input and non-web schemes', () => {
  for (const bad of ['', '   ', 'not a url', 'javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.com', 'gopher://example.com', 'https://exa mple.com', 'data:text/html,hi']) {
    assert.notEqual(codeOf(bad), 'ok', bad);
  }
});

test('blocks localhost, internal names, IP literals, ports and credentials', () => {
  const blocked: Record<string, string> = {
    'http://localhost': 'hostname_not_public',
    'http://localhost:3000': 'port_not_allowed',
    'https://intranet': 'hostname_not_public',
    'https://db.internal': 'hostname_not_public',
    'https://printer.local': 'hostname_not_public',
    'https://foo.localhost': 'hostname_not_public',
    'http://127.0.0.1': 'ip_literal_not_allowed',
    'http://10.0.0.5': 'ip_literal_not_allowed',
    'http://169.254.169.254/latest/meta-data': 'ip_literal_not_allowed',
    'http://[::1]/': 'ip_literal_not_allowed',
    'http://2130706433/': 'ip_literal_not_allowed', // decimal 127.0.0.1
    'http://0x7f.0.0.1/': 'ip_literal_not_allowed',
    'http://8.8.8.8': 'ip_literal_not_allowed',
    'https://example.com:8443': 'port_not_allowed',
    'https://user:pass@example.com': 'credentials_not_allowed',
  };
  for (const [url, code] of Object.entries(blocked)) assert.equal(codeOf(url), code, url);
});

test('classifies resolved addresses: only global unicast is public', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a00:1', '2002:a00:1::', 'not-an-ip']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of ['8.8.8.8', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

test('rate limiter allows the quota then refuses', () => {
  const key = `t:${Math.random()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 60_000).allowed, true);
  const over = rateLimit(key, 3, 60_000);
  assert.equal(over.allowed, false);
  assert.ok(over.retryAfterSeconds > 0);
});

test('noindex detection ignores unrelated directives', () => {
  assert.equal(isNoindex('noindex, nofollow'), true);
  assert.equal(isNoindex('none'), true);
  assert.equal(isNoindex('googlebot: noindex'), true);
  assert.equal(isNoindex('index, follow, max-image-preview:none'), false);
  assert.equal(isNoindex('max-snippet:-1'), false);
  assert.equal(isNoindex(''), false);
});
