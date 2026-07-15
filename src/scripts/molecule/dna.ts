import type { Atom, Bond, Molecule } from './presets';

const BASE_COLOR: Record<string, number> = {
  A: 0xff5555,
  T: 0x55ff88,
  G: 0xffaa33,
  C: 0x5599ff,
};

/** 生成双螺旋骨架分子（球棍） */
export function buildDna(pairs = 16): Molecule {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const bases = ['A', 'T', 'G', 'C'] as const;
  const r = 2.2;
  const rise = 0.34 * 3.2;
  const twist = (Math.PI * 2) / 10.5;

  for (let i = 0; i < pairs; i++) {
    const a = i * twist;
    const y = (i - pairs / 2) * rise;
    const b1 = bases[i % 4];
    const b2 = b1 == 'A' ? 'T' : b1 == 'T' ? 'A' : b1 == 'G' ? 'C' : 'G';

    // 糖磷酸骨架点（用 P / C 近似）
    const p1 = atoms.length;
    atoms.push({ el: 'P', x: r * Math.cos(a), y, z: r * Math.sin(a) });
    const c1 = atoms.length;
    atoms.push({
      el: 'C',
      x: (r - 0.7) * Math.cos(a),
      y,
      z: (r - 0.7) * Math.sin(a),
    });
    // 碱基用 N 表示并靠颜色区分（存在 el 上通过注释；简化全用 N，颜色在 scene 里按 index 覆盖）
    const base1 = atoms.length;
    atoms.push({
      el: 'N',
      x: (r - 1.4) * Math.cos(a),
      y,
      z: (r - 1.4) * Math.sin(a),
    });

    const p2 = atoms.length;
    atoms.push({
      el: 'P',
      x: r * Math.cos(a + Math.PI),
      y,
      z: r * Math.sin(a + Math.PI),
    });
    const c2 = atoms.length;
    atoms.push({
      el: 'C',
      x: (r - 0.7) * Math.cos(a + Math.PI),
      y,
      z: (r - 0.7) * Math.sin(a + Math.PI),
    });
    const base2 = atoms.length;
    atoms.push({
      el: 'N',
      x: (r - 1.4) * Math.cos(a + Math.PI),
      y,
      z: (r - 1.4) * Math.sin(a + Math.PI),
    });

    bonds.push({ a: p1, b: c1 }, { a: c1, b: base1 });
    bonds.push({ a: p2, b: c2 }, { a: c2, b: base2 });
    // 碱基对
    bonds.push({ a: base1, b: base2 });

    if (i > 0) {
      const prevP1 = p1 - 6;
      const prevP2 = p2 - 6;
      bonds.push({ a: prevP1, b: p1 }, { a: prevP2, b: p2 });
    }

    // 挂载碱基色到原子：滥用，scene 可读 BASE_COLOR via userdata — 这里把颜色存在 z 额外通道不合适
    void BASE_COLOR;
    void b2;
  }

  return {
    id: 'dna',
    name: `DNA 双螺旋（${pairs} bp）`,
    atoms,
    bonds,
  };
}

export function dnaChainCounts(mol: Molecule) {
  const p = mol.atoms.filter((a) => a.el == 'P').length;
  return { phosphates: p, half: p / 2 };
}
