import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from 'puppeteer-core';
import { assertSafeUrl, isPublicAddress, privateHostsAllowed, resolvePublicHost } from '@/lib/security/ssrf';

/**
 * Headless Chromium, shared by the PDF renderer and the rendered site pass.
 *
 * - On Vercel (or any Linux server without Chrome) it uses @sparticuz/chromium.
 *   Its compressed binary lives in node_modules/@sparticuz/chromium/bin and must
 *   be included in the function bundle (see outputFileTracingIncludes).
 * - Locally it uses an installed Chrome, Chromium, Edge or Brave.
 */
function localBrowserCandidates(): string[] {
  const env = [process.env.CHROME_EXECUTABLE_PATH, process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH];
  const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
  const pf = process.env.PROGRAMFILES ?? 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
  return [
    ...env,
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Windows
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter((p): p is string => !!p);
}

export class BrowserUnavailableError extends Error {
  constructor(detail: string) {
    super(`browser_unavailable: ${detail}`);
    this.name = 'BrowserUnavailableError';
  }
}

export async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default;
  const onServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const local = onServerless ? undefined : localBrowserCandidates().find((p) => fs.existsSync(p));
  if (local) {
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    });
  }
  if (process.platform !== 'linux') {
    throw new BrowserUnavailableError('no Chrome, Chromium or Edge found; set CHROME_EXECUTABLE_PATH');
  }
  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    return await puppeteer.launch({
      args: [...chromium.args, '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });
  } catch (err) {
    throw new BrowserUnavailableError((err as Error).message.slice(0, 200));
  }
}

// Third-party trackers add time and nothing to the analysis.
const TRACKERS = /google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.net|connect\.facebook|analytics\.tiktok|sc-static\.net|snapchat\.com\/.*pixel|hotjar\.com|clarity\.ms|segment\.(io|com)|mixpanel\.com|intercom|crisp\.chat|tawk\.to|zendesk/i;

/**
 * Guard every request a rendered page makes: only http(s) to hosts that
 * resolve to public addresses. Results are cached per host for the session.
 */
export async function guardPage(
  page: Page,
  opts: { allowNavigation?: (url: URL) => boolean } = {},
): Promise<{ blocked: () => number; navigationsBlocked: () => number }> {
  const verdicts = new Map<string, Promise<boolean>>();
  let blocked = 0;
  let navigationsBlocked = 0;
  const allowPrivate = privateHostsAllowed();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const raw = req.url();
    if (raw.startsWith('data:') || raw.startsWith('blob:') || raw === 'about:blank') return void req.continue();
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      blocked++;
      return void req.abort();
    }
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || TRACKERS.test(raw) || req.resourceType() === 'media') {
      return void req.abort();
    }
    // Page navigations (e.g. submitting the search form) must also respect robots.txt.
    if (opts.allowNavigation && req.isNavigationRequest() && req.frame() === page.mainFrame() && !opts.allowNavigation(url)) {
      navigationsBlocked++;
      return void req.abort();
    }
    const host = url.hostname;
    let verdict = verdicts.get(host);
    if (!verdict) {
      verdict = (async () => {
        try {
          if (allowPrivate) return true;
          assertSafeUrl(new URL(`${url.protocol}//${url.host}/`));
          await resolvePublicHost(host);
          return true;
        } catch {
          return false;
        }
      })();
      verdicts.set(host, verdict);
    }
    verdict.then((ok) => {
      if (ok) void req.continue().catch(() => undefined);
      else {
        blocked++;
        void req.abort().catch(() => undefined);
      }
    });
  });
  return { blocked: () => blocked, navigationsBlocked: () => navigationsBlocked };
}

export { isPublicAddress };
