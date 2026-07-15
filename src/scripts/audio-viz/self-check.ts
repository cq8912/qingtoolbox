import { createParticles, updateParticles } from './particles';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const particles = createParticles(100, 400, 300);
const freq = new Uint8Array(256);
for (let i = 0; i < freq.length; i++) freq[i] = (i * 17) % 256;

const ok = updateParticles(particles, freq, 400, 300, 1.2, 0.016);
assert(ok, 'NaN in particle positions');
for (const p of particles) {
  assert(Number.isFinite(p.x) && Number.isFinite(p.y), 'non-finite particle');
}

console.log('PASS: audio-viz particles OK');
