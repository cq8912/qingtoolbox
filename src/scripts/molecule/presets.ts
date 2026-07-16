export type AtomEl = 'C' | 'H' | 'O' | 'N' | 'P' | 'S';

export type Atom = { el: AtomEl; x: number; y: number; z: number };
export type Bond = { a: number; b: number };

export type Molecule = {
  id: string;
  name: string;
  atoms: Atom[];
  bonds: Bond[];
};

export const ELEMENT_COLOR: Record<AtomEl, number> = {
  C: 0x5a5a5a,
  H: 0xeeeeee,
  O: 0xff4444,
  N: 0x4477ff,
  P: 0xffaa33,
  S: 0xe8d94a,
};

export const ELEMENT_RADIUS: Record<AtomEl, number> = {
  C: 0.35,
  H: 0.22,
  O: 0.32,
  N: 0.33,
  P: 0.4,
  S: 0.38,
};

export const water: Molecule = {
  id: 'water',
  name: '水 H₂O',
  atoms: [
    { el: 'O', x: 0, y: 0, z: 0 },
    { el: 'H', x: 0.96, y: 0, z: 0 },
    { el: 'H', x: -0.24, y: 0.93, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1 },
    { a: 0, b: 2 },
  ],
};

/** 简化咖啡因骨架（可读球棍，非晶格精度） */
export const caffeine: Molecule = {
  id: 'caffeine',
  name: '咖啡因（简化）',
  atoms: [
    { el: 'N', x: 0, y: 0, z: 0 },
    { el: 'C', x: 1.2, y: 0.4, z: 0 },
    { el: 'N', x: 2.1, y: -0.5, z: 0 },
    { el: 'C', x: 1.5, y: -1.7, z: 0 },
    { el: 'C', x: 0.2, y: -1.5, z: 0 },
    { el: 'C', x: -0.7, y: -2.5, z: 0 },
    { el: 'O', x: -0.5, y: -3.7, z: 0 },
    { el: 'N', x: 2.3, y: -2.8, z: 0 },
    { el: 'C', x: 3.5, y: -2.3, z: 0 },
    { el: 'N', x: 3.6, y: -0.9, z: 0 },
    { el: 'C', x: 2.7, y: 0.4, z: 0 },
    { el: 'O', x: 3.0, y: 1.5, z: 0 },
    { el: 'C', x: -1.2, y: 0.7, z: 0 },
    { el: 'C', x: 4.8, y: -0.3, z: 0 },
    { el: 'C', x: 2.2, y: -4.2, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1 },
    { a: 1, b: 2 },
    { a: 2, b: 3 },
    { a: 3, b: 4 },
    { a: 4, b: 0 },
    { a: 4, b: 5 },
    { a: 5, b: 6 },
    { a: 3, b: 7 },
    { a: 7, b: 8 },
    { a: 8, b: 9 },
    { a: 9, b: 2 },
    { a: 9, b: 10 },
    { a: 10, b: 1 },
    { a: 10, b: 11 },
    { a: 0, b: 12 },
    { a: 9, b: 13 },
    { a: 7, b: 14 },
  ],
};

/** 多巴胺（简化球棍）：儿茶酚环 + 乙胺侧链 */
export const dopamine: Molecule = {
  id: 'dopamine',
  name: '多巴胺',
  atoms: [
    { el: 'C', x: 0, y: 0, z: 0 },
    { el: 'C', x: 1.2, y: 0.7, z: 0 },
    { el: 'C', x: 2.4, y: 0, z: 0 },
    { el: 'C', x: 2.4, y: -1.4, z: 0 },
    { el: 'C', x: 1.2, y: -2.1, z: 0 },
    { el: 'C', x: 0, y: -1.4, z: 0 },
    { el: 'O', x: 1.2, y: 2.0, z: 0 },
    { el: 'O', x: 3.6, y: 0.7, z: 0 },
    { el: 'C', x: -1.3, y: 0.7, z: 0 },
    { el: 'C', x: -2.5, y: 0, z: 0.2 },
    { el: 'N', x: -3.7, y: 0.7, z: 0 },
    { el: 'H', x: 1.2, y: 2.7, z: 0 },
    { el: 'H', x: 4.2, y: 0.2, z: 0 },
    { el: 'H', x: -4.3, y: 0.2, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1 },
    { a: 1, b: 2 },
    { a: 2, b: 3 },
    { a: 3, b: 4 },
    { a: 4, b: 5 },
    { a: 5, b: 0 },
    { a: 1, b: 6 },
    { a: 2, b: 7 },
    { a: 6, b: 11 },
    { a: 7, b: 12 },
    { a: 0, b: 8 },
    { a: 8, b: 9 },
    { a: 9, b: 10 },
    { a: 10, b: 13 },
  ],
};

/** 5-羟色胺 / 血清素（简化）：吲哚核 + 羟基 + 乙胺 */
export const serotonin: Molecule = {
  id: 'serotonin',
  name: '5-羟色胺',
  atoms: [
    { el: 'N', x: 0, y: 0, z: 0 },
    { el: 'C', x: 1.1, y: 0.8, z: 0 },
    { el: 'C', x: 2.2, y: 0, z: 0 },
    { el: 'C', x: 1.8, y: -1.3, z: 0 },
    { el: 'C', x: 0.4, y: -1.5, z: 0 },
    { el: 'C', x: 3.5, y: 0.4, z: 0 },
    { el: 'C', x: 4.5, y: -0.5, z: 0 },
    { el: 'C', x: 4.2, y: -1.9, z: 0 },
    { el: 'C', x: 2.9, y: -2.3, z: 0 },
    { el: 'O', x: 5.0, y: -2.9, z: 0 },
    { el: 'C', x: 0.9, y: 2.2, z: 0 },
    { el: 'C', x: -0.4, y: 2.9, z: 0.2 },
    { el: 'N', x: -1.5, y: 2.2, z: 0 },
    { el: 'H', x: -0.7, y: 0.3, z: 0 },
    { el: 'H', x: 5.8, y: -2.5, z: 0 },
    { el: 'H', x: -2.1, y: 2.8, z: 0 },
  ],
  bonds: [
    { a: 0, b: 1 },
    { a: 1, b: 2 },
    { a: 2, b: 3 },
    { a: 3, b: 4 },
    { a: 4, b: 0 },
    { a: 2, b: 5 },
    { a: 5, b: 6 },
    { a: 6, b: 7 },
    { a: 7, b: 8 },
    { a: 8, b: 3 },
    { a: 7, b: 9 },
    { a: 9, b: 14 },
    { a: 1, b: 10 },
    { a: 10, b: 11 },
    { a: 11, b: 12 },
    { a: 0, b: 13 },
    { a: 12, b: 15 },
  ],
};

export const PRESETS: Molecule[] = [water, caffeine, dopamine, serotonin];
