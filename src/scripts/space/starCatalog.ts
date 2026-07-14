/** 邻近恒星星表数据（无 Three 依赖，可供 Astro 页面前置导入） */

export type StarId = string;

export interface StarDef {
  id: StarId;
  nameZh: string;
  /** 赤经（时） */
  raHours: number;
  /** 赤纬（度） */
  decDeg: number;
  distLy: number;
  spectral: string;
  color: number;
  /** 日冕/辉光强度 */
  glow: number;
  /** 视觉半径（场景 ly 单位） */
  visualRadius: number;
}

/**
 * 约 20 颗邻近/著名恒星；太阳作原点标记。
 * 方向：赤道直角 → Y-up（X=cosδ cosα，Y=sinδ，Z=cosδ sinα）
 */
export const NEARBY_STARS: StarDef[] = [
  {
    id: 'sol',
    nameZh: '太阳',
    raHours: 0,
    decDeg: 0,
    distLy: 0,
    spectral: 'G2V',
    color: 0xffcc66,
    glow: 1.2,
    visualRadius: 0.09,
  },
  {
    id: 'proxima',
    nameZh: '比邻星',
    raHours: 14.496,
    decDeg: -62.679,
    distLy: 4.2465,
    spectral: 'M5.5Ve',
    color: 0xff5533,
    glow: 0.55,
    visualRadius: 0.05,
  },
  {
    id: 'alpha_cen_a',
    nameZh: '南门二 A',
    raHours: 14.66,
    decDeg: -60.833,
    distLy: 4.34,
    spectral: 'G2V',
    color: 0xffe8a0,
    glow: 1.0,
    visualRadius: 0.08,
  },
  {
    id: 'alpha_cen_b',
    nameZh: '南门二 B',
    raHours: 14.66,
    decDeg: -60.84,
    distLy: 4.37,
    spectral: 'K1V',
    color: 0xffd090,
    glow: 0.85,
    visualRadius: 0.07,
  },
  {
    id: 'barnard',
    nameZh: '巴纳德星',
    raHours: 17.963,
    decDeg: 4.693,
    distLy: 5.96,
    spectral: 'M4.0V',
    color: 0xff7744,
    glow: 0.5,
    visualRadius: 0.048,
  },
  {
    id: 'wolf359',
    nameZh: '沃尔夫 359',
    raHours: 10.94,
    decDeg: 7.0,
    distLy: 7.86,
    spectral: 'M6.0V',
    color: 0xff4422,
    glow: 0.45,
    visualRadius: 0.042,
  },
  {
    id: 'lalande21185',
    nameZh: '拉朗德 21185',
    raHours: 11.06,
    decDeg: 35.97,
    distLy: 8.31,
    spectral: 'M2.0V',
    color: 0xff8866,
    glow: 0.55,
    visualRadius: 0.05,
  },
  {
    id: 'sirius',
    nameZh: '天狼星',
    raHours: 6.752,
    decDeg: -16.716,
    distLy: 8.6,
    spectral: 'A1V',
    color: 0xc8e8ff,
    glow: 1.35,
    visualRadius: 0.11,
  },
  {
    id: 'ross154',
    nameZh: '罗斯 154',
    raHours: 18.83,
    decDeg: -23.84,
    distLy: 9.69,
    spectral: 'M3.5Ve',
    color: 0xff6644,
    glow: 0.5,
    visualRadius: 0.045,
  },
  {
    id: 'epsilon_eri',
    nameZh: '波江座 ε',
    raHours: 3.548,
    decDeg: -9.46,
    distLy: 10.52,
    spectral: 'K2V',
    color: 0xffaa66,
    glow: 0.75,
    visualRadius: 0.065,
  },
  {
    id: 'lacaille9352',
    nameZh: '拉卡耶 9352',
    raHours: 23.09,
    decDeg: -35.95,
    distLy: 10.74,
    spectral: 'M0.5V',
    color: 0xff7755,
    glow: 0.55,
    visualRadius: 0.05,
  },
  {
    id: 'ross128',
    nameZh: '罗斯 128',
    raHours: 11.79,
    decDeg: 0.8,
    distLy: 11.01,
    spectral: 'M4.0V',
    color: 0xff6644,
    glow: 0.48,
    visualRadius: 0.044,
  },
  {
    id: 'procyon',
    nameZh: '南河三',
    raHours: 7.655,
    decDeg: 5.225,
    distLy: 11.46,
    spectral: 'F5IV-V',
    color: 0xfff4d0,
    glow: 1.1,
    visualRadius: 0.095,
  },
  {
    id: 'cyg61',
    nameZh: '天鹅座 61',
    raHours: 21.11,
    decDeg: 38.74,
    distLy: 11.41,
    spectral: 'K5V',
    color: 0xffaa77,
    glow: 0.7,
    visualRadius: 0.06,
  },
  {
    id: 'epsilon_indi',
    nameZh: '印第安座 ε',
    raHours: 22.06,
    decDeg: -56.79,
    distLy: 11.87,
    spectral: 'K5V',
    color: 0xffbb88,
    glow: 0.7,
    visualRadius: 0.058,
  },
  {
    id: 'tau_ceti',
    nameZh: '鲸鱼座 τ',
    raHours: 1.734,
    decDeg: -15.94,
    distLy: 11.91,
    spectral: 'G8.5V',
    color: 0xffe8b0,
    glow: 0.9,
    visualRadius: 0.075,
  },
  {
    id: 'luyten',
    nameZh: '鲁坦之星',
    raHours: 7.46,
    decDeg: 5.23,
    distLy: 12.2,
    spectral: 'M3.5V',
    color: 0xff6644,
    glow: 0.48,
    visualRadius: 0.045,
  },
  {
    id: 'altair',
    nameZh: '牛郎星',
    raHours: 19.846,
    decDeg: 8.868,
    distLy: 16.73,
    spectral: 'A7V',
    color: 0xffffff,
    glow: 1.2,
    visualRadius: 0.1,
  },
  {
    id: 'vega',
    nameZh: '织女星',
    raHours: 18.615,
    decDeg: 38.783,
    distLy: 25.04,
    spectral: 'A0V',
    color: 0xe0f0ff,
    glow: 1.4,
    visualRadius: 0.12,
  },
  {
    id: 'fomalhaut',
    nameZh: '北落师门',
    raHours: 22.96,
    decDeg: -29.62,
    distLy: 25.13,
    spectral: 'A3V',
    color: 0xf0f8ff,
    glow: 1.25,
    visualRadius: 0.11,
  },
];

export const STAR_BY_ID = Object.fromEntries(NEARBY_STARS.map((s) => [s.id, s])) as Record<
  StarId,
  StarDef
>;

/** 太阳系外可跃迁目标（不含 sol） */
export const DEST_STARS = NEARBY_STARS.filter((s) => s.id != 'sol');

export function starDistLy(id: StarId): number {
  return STAR_BY_ID[id]?.distLy ?? 0;
}

/** 赤经赤纬 + 距离 → 相对太阳笛卡尔（ly，Y-up） */
export function starLogicalFromSky(
  raHours: number,
  decDeg: number,
  distLy: number,
): { x: number; y: number; z: number } {
  if (distLy <= 0) return { x: 0, y: 0, z: 0 };
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const c = Math.cos(dec);
  return {
    x: distLy * c * Math.cos(ra),
    y: distLy * Math.sin(dec),
    z: distLy * c * Math.sin(ra),
  };
}

export function starLogicalXYZ(def: StarDef): { x: number; y: number; z: number } {
  return starLogicalFromSky(def.raHours, def.decDeg, def.distLy);
}
