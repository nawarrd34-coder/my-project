/** Run one audit from the terminal: npx tsx scripts/audit-cli.mts https://example.com [out.json] */
import fs from 'node:fs';
import { runAudit, validateTarget } from '../src/features/audit/runAudit';

const [input, out] = process.argv.slice(2);
if (!input) {
  console.error('usage: tsx scripts/audit-cli.mts <url> [out.json]');
  process.exit(1);
}
const target = await validateTarget(input);
const report = await runAudit(target, (e) => e.t === 'task' && console.log(`  ${e.id}: ${e.s}${e.code ? ` (${e.code})` : ''}`));
console.log(`overall: ${report.overall.score} (${report.overall.grade}) · coverage ${report.overall.coveredWeight}/100`);
for (const c of report.categories) console.log(`  ${c.id.padEnd(14)} ${String(c.score).padStart(4)}  ${c.status}`);
console.log(`findings: ${report.findings.map((f) => `${f.id}[${f.severity}]`).join(', ')}`);
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
