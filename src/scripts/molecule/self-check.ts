import { buildDna, dnaChainCounts } from './dna';
import { PRESETS } from './presets';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

for (const m of PRESETS) {
  assert(m.atoms.length > 0, `${m.id} empty atoms`);
  assert(m.bonds.length > 0, `${m.id} empty bonds`);
}

const dna = buildDna(16);
assert(dna.atoms.length > 0, 'dna empty');
const { phosphates, half } = dnaChainCounts(dna);
assert(phosphates == 32, `phosphates=${phosphates}`);
assert(half == 16, `half=${half}`);

console.log('PASS: molecule presets OK');
console.log(`  water=${PRESETS[0].atoms.length} caffeine=${PRESETS[1].atoms.length} dnaAtoms=${dna.atoms.length}`);
