/**
 * Catalogue audit (§13). Reports near-duplicates by pose signature, family
 * crowding, and poses whose scene lists look implausible. Reads the compiled
 * catalogue through a tiny TS shim so it stays in step with the real data.
 */
import { execSync } from 'node:child_process';

const script = `
import { PoseRepository } from './src/data/poseRepository';
const all = PoseRepository.all();
const rows = all.map((p) => ({
  id: p.id, name: p.name, family: p.poseFamily, people: p.peopleType,
  position: p.bodyPosition, difficulty: p.difficulty,
  scenes: p.compatibleScenes.length, required: p.requiredElements,
  sig: [p.poseSignature.torsoDirection, p.poseSignature.weightDistribution,
        p.poseSignature.legPattern, p.poseSignature.armPattern,
        p.poseSignature.headDirection, p.poseSignature.movementState,
        p.poseSignature.environmentInteraction].join('|'),
}));
console.log(JSON.stringify(rows));
`;
import { writeFileSync, unlinkSync } from 'node:fs';
writeFileSync('.audit.ts', script);
let rows;
try {
  const out = execSync('npx vite-node .audit.ts', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  rows = JSON.parse(out.trim().split('\n').pop());
} finally {
  try { unlinkSync('.audit.ts'); } catch {}
}

console.log(`${rows.length} poses\n`);

const bySig = new Map();
for (const r of rows) {
  const key = `${r.people}/${r.position}/${r.sig}`;
  if (!bySig.has(key)) bySig.set(key, []);
  bySig.get(key).push(r);
}
const collisions = [...bySig.values()].filter((g) => g.length > 1);
console.log(`Signature collisions (identical pose signature, same position and people):`);
if (!collisions.length) console.log('  none');
for (const g of collisions) console.log(`  ${g.map((r) => r.name).join('  ==  ')}`);

const byFamily = new Map();
for (const r of rows) {
  if (!byFamily.has(r.family)) byFamily.set(r.family, []);
  byFamily.get(r.family).push(r);
}
console.log(`\nFamilies with more than two poses:`);
const crowded = [...byFamily.entries()].filter(([, g]) => g.length > 2);
if (!crowded.length) console.log('  none');
for (const [fam, g] of crowded) console.log(`  ${fam}: ${g.map((r) => r.name).join(', ')}`);

console.log(`\nPoses compatible with more than 12 scenes (possibly too permissive):`);
const broad = rows.filter((r) => r.scenes > 12);
if (!broad.length) console.log('  none');
for (const r of broad) console.log(`  ${r.name} — ${r.scenes} scenes`);

console.log(`\nBreakdown:`);
for (const key of ['position', 'people', 'difficulty']) {
  const counts = {};
  for (const r of rows) counts[r[key]] = (counts[r[key]] ?? 0) + 1;
  console.log(`  ${key}: ${JSON.stringify(counts)}`);
}
