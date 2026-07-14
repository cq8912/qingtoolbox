/**
 * 天文位置自检（不依赖 DOM）
 * 运行：npx tsx src/scripts/space/self-check.ts
 */
import { helioAu, bodyPosition, selfCheckEarthDistance, selfCheckSatellites } from './astronomy';
import { BODY_BY_ID } from './constants';
import { selfCheckStars } from './stars-check';
import { STAR_BY_ID, starLogicalXYZ } from './starCatalog';

function dist(p: { x: number; y: number; z: number }) {
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

function sep(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

const now = new Date();
const names = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Moon'];

console.log('date:', now.toISOString());
for (const n of names) {
  const p = helioAu(n, now);
  console.log(`${n.padEnd(8)} ${dist(p).toFixed(6)} AU`);
}

const pairs = [
  ['moon', 'earth'],
  ['io', 'jupiter'],
  ['europa', 'jupiter'],
  ['ganymede', 'jupiter'],
  ['callisto', 'jupiter'],
  ['titan', 'saturn'],
] as const;

for (const [sid, pid] of pairs) {
  const s = bodyPosition(sid, BODY_BY_ID[sid].astro, now);
  const p = bodyPosition(pid, BODY_BY_ID[pid].astro, now);
  const need = BODY_BY_ID[pid].visualRadius + BODY_BY_ID[sid].visualRadius;
  console.log(
    `${sid.padEnd(10)} from ${pid}: ${sep(s, p).toFixed(6)} AU (need > ${need.toFixed(6)})`,
  );
}

if (!selfCheckEarthDistance() || !selfCheckSatellites(now)) {
  console.error('FAIL: Earth/satellite visual check failed');
  process.exit(1);
}
console.log('PASS: heliocentric + satellites outside parents OK');

const prox = STAR_BY_ID.proxima;
const sirius = STAR_BY_ID.sirius;
const pPos = starLogicalXYZ(prox);
console.log(`proxima  ${prox.distLy.toFixed(4)} ly  |vec|=${dist(pPos).toFixed(4)}`);
console.log(`sirius   ${sirius.distLy.toFixed(4)} ly`);
console.log(`vega     ${STAR_BY_ID.vega.distLy.toFixed(4)} ly`);

if (!selfCheckStars()) {
  console.error('FAIL: nearby-star catalog check failed');
  process.exit(1);
}
console.log('PASS: nearby stars (proxima≈4.25 ly, sirius≈8.6 ly) OK');
