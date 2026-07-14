import { Body, HelioVector, MakeTime, type FlexibleDateTime } from 'astronomy-engine';
import { BODY_BY_ID, type BodyId } from './constants';

const ASTRO_MAP: Record<string, Body> = {
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Earth: Body.Earth,
  Moon: Body.Moon,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** astronomy-engine 坐标系 → Three.js：x 不变，z→y（上），y→z（前） */
export function toScene(v: { x: number; y: number; z: number }): Vec3 {
  return { x: v.x, y: v.z, z: -v.y };
}

export function helioAu(astroName: string, when: FlexibleDateTime): Vec3 {
  const body = ASTRO_MAP[astroName];
  if (!body) return { x: 0, y: 0, z: 0 };
  const t = MakeTime(when);
  return toScene(HelioVector(body, t));
}

/**
 * 月球位置：方向用真实地月矢量，距离放大到「一定在放大后的地球球体外」
 * （真实地月距约 0.0026 AU，而视觉地球半径 0.0054，不放大就会陷进地球里）
 */
export function moonVisualPosition(when: Date): Vec3 {
  const earth = helioAu('Earth', when);
  const moon = helioAu('Moon', when);
  const dx = moon.x - earth.x;
  const dy = moon.y - earth.y;
  const dz = moon.z - earth.z;
  const real = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
  const earthR = BODY_BY_ID.earth.visualRadius;
  const moonR = BODY_BY_ID.moon.visualRadius;
  const minSep = (earthR + moonR) * 3.2;
  const sep = Math.max(real * 12, minSep);
  const s = sep / real;
  return {
    x: earth.x + dx * s,
    y: earth.y + dy * s,
    z: earth.z + dz * s,
  };
}

export function bodyPosition(id: BodyId, astro: string | null, when: Date): Vec3 {
  if (id == 'sun' || !astro) return { x: 0, y: 0, z: 0 };
  if (id == 'moon') return moonVisualPosition(when);
  return helioAu(astro, when);
}

/** 采样一条公转轨迹（AU） */
export function sampleOrbit(astroName: string, when: Date, periodDays: number, samples = 180): Vec3[] {
  const pts: Vec3[] = [];
  const step = (periodDays * 86400 * 1000) / samples;
  for (let i = 0; i <= samples; i++) {
    pts.push(helioAu(astroName, new Date(when.getTime() + i * step)));
  }
  return pts;
}

/** 月球视觉轨道（与 moonVisualPosition 同尺度） */
export function sampleMoonOrbit(when: Date, samples = 90): Vec3[] {
  const pts: Vec3[] = [];
  const periodMs = 27.32 * 86400 * 1000;
  const step = periodMs / samples;
  for (let i = 0; i <= samples; i++) {
    pts.push(moonVisualPosition(new Date(when.getTime() + i * step)));
  }
  return pts;
}

/** 自检：地球距日应约 0.98–1.02 AU；月球视觉位置应在地球球体外 */
export function selfCheckEarthDistance(): boolean {
  const p = helioAu('Earth', new Date());
  const d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  if (!(d > 0.95 && d < 1.05)) return false;
  const m = moonVisualPosition(new Date());
  const e = helioAu('Earth', new Date());
  const sep = Math.sqrt((m.x - e.x) ** 2 + (m.y - e.y) ** 2 + (m.z - e.z) ** 2);
  const minNeed = BODY_BY_ID.earth.visualRadius + BODY_BY_ID.moon.visualRadius;
  return sep > minNeed;
}
