/** Run only the business analysis against a URL: npx tsx scripts/business-cli.mts <url> [out.json] */
import fs from 'node:fs';
import { analyzeBusiness } from '../src/features/business/analyze';
import { probeSite } from '../src/features/audit/probe';
import { validateTarget } from '../src/features/audit/runAudit';

const [input, out] = process.argv.slice(2);
const target = await validateTarget(input);
const probe = await probeSite(target);
const t0 = Date.now();
const b = await analyzeBusiness({ url: probe.finalUrl, html: probe.html ?? null, headers: probe.headers, emit: (id, s, code) => console.log(`  ${id}: ${s}${code ? ` (${code})` : ''}`) });
if (!b) {
  console.log('no analysis (page unreadable)');
  process.exit(0);
}
const { design, ...rest } = b;
console.log(JSON.stringify({ ...rest, design: { ...design, screenshots: { desktop: design.screenshots.desktop ? `${design.screenshots.desktop.length} chars` : null, mobile: design.screenshots.mobile ? `${design.screenshots.mobile.length} chars` : null } }, identity: { ...rest.identity, logo: rest.identity.logo ? { ...rest.identity.logo, dataUri: rest.identity.logo.dataUri ? `${rest.identity.logo.dataUri.length} chars` : undefined } : null } }, null, 1).slice(0, 9000));
console.log('took', Date.now() - t0, 'ms');
if (out) fs.writeFileSync(out, JSON.stringify(b, null, 2));
