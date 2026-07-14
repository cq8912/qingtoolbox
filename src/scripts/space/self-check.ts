/**
 * 天文位置自检（不依赖 DOM）
 * 运行：npx tsx src/scripts/space/self-check.ts
 */
import { helioAu, moonVisualPosition, selfCheckEarthDistance } from './astronomy';
import { BODY_BY_ID } from './constants';

function dist(p: { x: number; y: number; z: number }) {
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

const now = new Date();
const names = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Moon'];

console.log('date:', now.toISOString());
for (const n of names) {
  const p = helioAu(n, now);
  console.log(`${n.padEnd(8)} ${dist(p).toFixed(6)} AU`);
}

const e = helioAu('Earth', now);
const m = moonVisualPosition(now);
const sep = Math.sqrt((m.x - e.x) ** 2 + (m.y - e.y) ** 2 + (m.z - e.z) ** 2);
console.log(
  `Moon visual sep from Earth: ${sep.toFixed(6)} AU (earthR=${BODY_BY_ID.earth.visualRadius})`,
);

if (!selfCheckEarthDistance()) {
  console.error('FAIL: Earth/Moon visual check failed');
  process.exit(1);
}
console.log('PASS: Earth heliocentric + Moon outside Earth OK');
