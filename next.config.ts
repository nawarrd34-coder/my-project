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
  // The WebGL hero background releases its context on unmount, which React's
  // development-only double mount would then find lost.
  reactStrictMode: false,
  // Headless Chromium (PDF rendering) must stay external to the server bundle.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  // Fonts and the brand mark are read from disk when the PDF is rendered.
  outputFileTracingIncludes: {
    '/api/report/pdf': ['./assets/fonts/*.woff2', './public/brand/*'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
