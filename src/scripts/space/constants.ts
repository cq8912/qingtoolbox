/** 天文与场景尺度常量 */

export const AU_KM = 149597870.7;
/** 光速：AU / 秒 */
export const C_AU_PER_S = 299792.458 / AU_KM;

export type BodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'io'
  | 'europa'
  | 'ganymede'
  | 'callisto'
  | 'saturn'
  | 'titan'
  | 'uranus'
  | 'neptune';

export interface BodyDef {
  id: BodyId;
  name: string;
  /** astronomy-engine Body 名；太阳/开普勒卫星为 null 或特殊标记 */
  astro: string | null;
  /** 视觉半径（AU，已放大便于观看） */
  visualRadius: number;
  color: number;
  emissive?: number;
  /** 公转/轨道周期（日），用于画轨道采样 */
  periodDays: number;
  /** 父天体：卫星绕行 */
  parent?: BodyId;
  /** 土星环 */
  hasRings?: boolean;
  /** 卫星视觉间距放大倍率（相对真实 separation） */
  sepBoost?: number;
  /** HUD 卫星按钮样式：无贴图时用色块 */
  moonOf?: BodyId;
}

export const BODIES: BodyDef[] = [
  { id: 'sun', name: '太阳', astro: null, visualRadius: 0.045, color: 0xffcc66, emissive: 0xffaa33, periodDays: 0 },
  { id: 'mercury', name: '水星', astro: 'Mercury', visualRadius: 0.0032, color: 0xb5b5b5, periodDays: 87.97 },
  { id: 'venus', name: '金星', astro: 'Venus', visualRadius: 0.005, color: 0xe8d4a8, periodDays: 224.7 },
  { id: 'earth', name: '地球', astro: 'Earth', visualRadius: 0.0054, color: 0x3a7bd5, periodDays: 365.25 },
  {
    id: 'moon',
    name: '月球',
    astro: 'Moon',
    visualRadius: 0.0018,
    color: 0xc8c8c8,
    periodDays: 27.32,
    parent: 'earth',
    sepBoost: 12,
    moonOf: 'earth',
  },
  { id: 'mars', name: '火星', astro: 'Mars', visualRadius: 0.004, color: 0xc1440e, periodDays: 686.98 },
  { id: 'jupiter', name: '木星', astro: 'Jupiter', visualRadius: 0.018, color: 0xd4a574, periodDays: 4332.59 },
  {
    id: 'io',
    name: '木卫一',
    astro: 'Io',
    visualRadius: 0.0024,
    color: 0xf0d060,
    periodDays: 1.769,
    parent: 'jupiter',
    sepBoost: 28,
    moonOf: 'jupiter',
  },
  {
    id: 'europa',
    name: '木卫二',
    astro: 'Europa',
    visualRadius: 0.0022,
    color: 0xc8b898,
    periodDays: 3.551,
    parent: 'jupiter',
    sepBoost: 28,
    moonOf: 'jupiter',
  },
  {
    id: 'ganymede',
    name: '木卫三',
    astro: 'Ganymede',
    visualRadius: 0.0028,
    color: 0xa89878,
    periodDays: 7.155,
    parent: 'jupiter',
    sepBoost: 28,
    moonOf: 'jupiter',
  },
  {
    id: 'callisto',
    name: '木卫四',
    astro: 'Callisto',
    visualRadius: 0.0026,
    color: 0x6a6058,
    periodDays: 16.69,
    parent: 'jupiter',
    sepBoost: 28,
    moonOf: 'jupiter',
  },
  { id: 'saturn', name: '土星', astro: 'Saturn', visualRadius: 0.015, color: 0xe6d5a8, periodDays: 10759.22, hasRings: true },
  {
    id: 'titan',
    name: '土卫六',
    astro: 'Titan',
    visualRadius: 0.0026,
    color: 0xd4a060,
    periodDays: 15.945,
    parent: 'saturn',
    sepBoost: 22,
    moonOf: 'saturn',
  },
  { id: 'uranus', name: '天王星', astro: 'Uranus', visualRadius: 0.009, color: 0x7ec8e3, periodDays: 30688.5 },
  { id: 'neptune', name: '海王星', astro: 'Neptune', visualRadius: 0.0088, color: 0x4166f5, periodDays: 60182 },
];

export const BODY_BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b])) as Record<BodyId, BodyDef>;

/** 父星「卫系统」外延半径（视觉 AU），用于近距停靠 */
export function satelliteEnvelope(parentId: BodyId): number {
  let max = BODY_BY_ID[parentId].visualRadius * 4;
  for (const b of BODIES) {
    if (b.parent != parentId) continue;
    // 粗估：父星半径 + 放大后卫星轨道外缘
    const approx = BODY_BY_ID[parentId].visualRadius * (b.sepBoost || 12) * 0.08 + b.visualRadius * 6;
    if (approx > max) max = approx;
  }
  if (parentId == 'saturn') max = Math.max(max, BODY_BY_ID.saturn.visualRadius * 3.2);
  return max;
}

/** 巡航档位：相对「自适应航速」的倍率 */
export const SPEED_PRESETS = [
  { label: '慢 0.25×', mult: 0.25 },
  { label: '自动 1×', mult: 1 },
  { label: '快 4×', mult: 4 },
  { label: '极速 16×', mult: 16 },
  { label: '狂暴 64×', mult: 64 },
];

/** 模拟时间倍率（相对真实秒） */
export const TIME_PRESETS = [
  { label: '暂停', mult: 0 },
  { label: '实时', mult: 1 },
  { label: '1时/秒', mult: 3600 },
  { label: '1天/秒', mult: 86400 },
  { label: '30天/秒', mult: 86400 * 30 },
  { label: '1年/秒', mult: 86400 * 365.25 },
];
