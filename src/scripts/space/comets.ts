/** 公开轨道根数（JPL / 天文年表近似），本地开普勒传播 */

export type CometId = 'halley' | 'encke' | '67p';

export type CometDef = {
  id: CometId;
  name: string;
  /** 半长轴 AU（椭圆） */
  aAu: number;
  e: number;
  iDeg: number;
  nodeDeg: number;
  periDeg: number;
  /** 历元 JD（TDB 近似用 UTC） */
  epochJd: number;
  /** 历元平近点角 deg */
  mDeg: number;
  periodDays: number;
  color: number;
  visualRadius: number;
};

/**
 * 根数来源摘要（维护时可对照 JPL Horizons / MPC）：
 * - 哈雷：q≈0.586, e≈0.96714, i≈162.26°, P≈75.3 yr
 * - 恩克：短周期，e≈0.848, a≈2.21 AU
 * - 67P：罗塞塔目标，a≈3.46, e≈0.641
 */
export const COMETS: CometDef[] = [
  {
    id: 'halley',
    name: '哈雷彗星',
    aAu: 17.834,
    e: 0.96714,
    iDeg: 162.262,
    nodeDeg: 58.42,
    periDeg: 111.33,
    epochJd: 2449400.5, // ~1994
    mDeg: 38.38,
    periodDays: 27798,
    color: 0x88ccff,
    visualRadius: 0.004,
  },
  {
    id: 'encke',
    name: '恩克彗星',
    aAu: 2.215,
    e: 0.848,
    iDeg: 11.78,
    nodeDeg: 334.57,
    periDeg: 186.55,
    epochJd: 2459200.5,
    mDeg: 210.4,
    periodDays: 1204,
    color: 0xaaffcc,
    visualRadius: 0.003,
  },
  {
    id: '67p',
    name: '67P 丘留莫夫',
    aAu: 3.463,
    e: 0.64102,
    iDeg: 7.0405,
    nodeDeg: 50.147,
    periDeg: 12.786,
    epochJd: 2457600.5,
    mDeg: 85.2,
    periodDays: 2353,
    color: 0xffd4a8,
    visualRadius: 0.0032,
  },
];

export const COMET_BY_ID = Object.fromEntries(COMETS.map((c) => [c.id, c])) as Record<CometId, CometDef>;

const DEG = Math.PI / 180;
const MU_SUN = 1; // AU³ / day²（开普勒归一，与 a、周期自洽用 n=2π/P）

function wrap360(d: number) {
  let x = d % 360;
  if (x < 0) x += 360;
  return x;
}

/** 解开普勒方程 E - e sin E = M */
function solveE(M: number, e: number) {
  let E = M;
  for (let i = 0; i < 12; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    E -= f / fp;
  }
  return E;
}

function jdFromDate(d: Date) {
  return d.getTime() / 86400000 + 2440587.5;
}

/** 日心坐标 → 场景坐标（与 astronomy.ts 一致） */
function toScene(x: number, y: number, z: number) {
  return { x, y: z, z: -y };
}

/** 彗核日心位置（场景 AU） */
export function cometPosition(def: CometDef, when: Date): { x: number; y: number; z: number } {
  const jd = jdFromDate(when);
  const n = (360 / def.periodDays) * DEG; // rad/day
  const M0 = def.mDeg * DEG;
  const M = wrap360(((M0 + n * (jd - def.epochJd)) / DEG)) * DEG;
  const E = solveE(M, def.e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const r = def.aAu * (1 - def.e * cosE);
  // 轨道平面
  const xOrb = def.aAu * (cosE - def.e);
  const yOrb = def.aAu * Math.sqrt(1 - def.e * def.e) * sinE;

  const i = def.iDeg * DEG;
  const Om = def.nodeDeg * DEG;
  const w = def.periDeg * DEG;
  const cosO = Math.cos(Om);
  const sinO = Math.sin(Om);
  const cosw = Math.cos(w);
  const sinw = Math.sin(w);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);

  const x =
    (cosO * cosw - sinO * sinw * cosi) * xOrb + (-cosO * sinw - sinO * cosw * cosi) * yOrb;
  const y =
    (sinO * cosw + cosO * sinw * cosi) * xOrb + (-sinO * sinw + cosO * cosw * cosi) * yOrb;
  const z = sinw * sini * xOrb + cosw * sini * yOrb;

  void r;
  void MU_SUN;
  return toScene(x, y, z);
}
