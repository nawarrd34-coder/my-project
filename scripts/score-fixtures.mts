/** Print the professionalism score for saved full-audit reports: npx tsx scripts/score-fixtures.mts tests/.artifacts/full-*.json */
import fs from 'node:fs';
import path from 'node:path';
import { scoreProfessional } from '../src/features/professional/score';
import type { AuditReport } from '../src/types/audit';

for (const file of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(file, 'utf8')) as AuditReport;
  const p = scoreProfessional(r);
  const name = path.basename(file, '.json').replace(/^full-/, '');
  if (!p) {
    console.log(`${name.padEnd(12)} no business analysis`);
    continue;
  }
  const cl = r.business?.classification;
  console.log(
    `${name.padEnd(12)} ${String(p.overall.score).padStart(3)} ${String(p.overall.level).padEnd(19)} tech=${r.overall.score} conf=${p.overall.confidence} cov=${Math.round(p.overall.criteriaCoverage * 100)}% cap=${p.overall.levelCap ?? '-'} | ${cl?.category.value}/${cl?.model.primary}`,
  );
  console.log('   ' + p.pillars.map((x) => `${x.id}=${x.score ?? '—'}`).join(' '));
  const low = p.criteria.filter((c) => c.score !== null && c.score < 60).map((c) => `${c.id}:${c.score}`);
  console.log('   low: ' + low.join(' '));
}
