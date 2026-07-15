import { hohmann, MU } from './physics';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// μ=1, r1=1, r2=2 → Δv1≈0.1547, Δv2≈0.1298
const expect1 = Math.sqrt(1 / 1) * (Math.sqrt((2 * 2) / (1 + 2)) - 1);
const expect2 = Math.sqrt(1 / 2) * (1 - Math.sqrt((2 * 1) / (1 + 2)));
const h = hohmann(1, 2, MU);
assert(Math.abs(h.a - 1.5) < 1e-9, `a=${h.a}`);
assert(Math.abs(h.dv1 - expect1) / expect1 < 1e-3, `dv1=${h.dv1}`);
assert(Math.abs(h.dv2 - expect2) / expect2 < 1e-3, `dv2=${h.dv2}`);

console.log('PASS: orbit-lab Hohmann OK');
console.log(`  dv1=${h.dv1.toFixed(6)} dv2=${h.dv2.toFixed(6)} total=${h.dvTotal.toFixed(6)}`);
