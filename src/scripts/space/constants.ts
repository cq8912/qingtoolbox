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
  | 'saturn'
  | 'uranus'
  | 'neptune';

export interface BodyDef {
  id: BodyId;
  name: string;
  /** astronomy-engine Body 名；太阳为 null */
  astro: string | null;
  /** 视觉半径（AU，已放大便于观看） */
  visualRadius: number;
  color: number;
  emissive?: number;
  /** 公转周期（日），用于画轨道采样 */
  periodDays: number;
  /** 父天体：月球绕地球 */
  parent?: BodyId;
  /** 土星环 */
  hasRings?: boolean;
}

export const BODIES: BodyDef[] = [
  { id: 'sun', name: '太阳', astro: null, visualRadius: 0.045, color: 0xffcc66, emissive: 0xffaa33, periodDays: 0 },
  { id: 'mercury', name: '水星', astro: 'Mercury', visualRadius: 0.0032, color: 0xb5b5b5, periodDays: 87.97 },
  { id: 'venus', name: '金星', astro: 'Venus', visualRadius: 0.005, color: 0xe8d4a8, periodDays: 224.7 },
  { id: 'earth', name: '地球', astro: 'Earth', visualRadius: 0.0054, color: 0x3a7bd5, periodDays: 365.25 },
  { id: 'moon', name: '月球', astro: 'Moon', visualRadius: 0.0018, color: 0xc8c8c8, periodDays: 27.32, parent: 'earth' },
  { id: 'mars', name: '火星', astro: 'Mars', visualRadius: 0.004, color: 0xc1440e, periodDays: 686.98 },
  { id: 'jupiter', name: '木星', astro: 'Jupiter', visualRadius: 0.018, color: 0xd4a574, periodDays: 4332.59 },
  { id: 'saturn', name: '土星', astro: 'Saturn', visualRadius: 0.015, color: 0xe6d5a8, periodDays: 10759.22, hasRings: true },
  { id: 'uranus', name: '天王星', astro: 'Uranus', visualRadius: 0.009, color: 0x7ec8e3, periodDays: 30688.5 },
  { id: 'neptune', name: '海王星', astro: 'Neptune', visualRadius: 0.0088, color: 0x4166f5, periodDays: 60182 },
];

export const BODY_BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b])) as Record<BodyId, BodyDef>;

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
