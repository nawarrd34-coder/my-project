import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // `NEXT_OUTPUT=standalone` builds a self-contained bundle (only traced files), as a
  // serverless function would get. Used to verify what the PDF route ships with.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  // The WebGL hero background releases its context on unmount, which React's
  // development-only double mount would then find lost.
  reactStrictMode: false,
  // Headless Chromium (PDF rendering) must stay external to the server bundle.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  // Fonts and the brand mark are read from disk when the PDF is rendered.
  outputFileTracingIncludes: {
    // @sparticuz/chromium reads its compressed browser from bin/ at runtime; the file
    // tracer cannot see that, so without this line the deployed route has no browser.
    '/api/report/pdf': ['./assets/fonts/*.woff2', './public/brand/*.png', './node_modules/@sparticuz/chromium/bin/**'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
