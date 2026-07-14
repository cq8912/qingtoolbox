import { Body, HelioVector, JupiterMoons, MakeTime, type FlexibleDateTime } from 'astronomy-engine';
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

const GALILEAN = new Set<BodyId>(['io', 'europa', 'ganymede', 'callisto']);

/** 土卫六：开普勒环常量（相对土星，AU / 日） */
const TITAN = {
  aAu: 1221870 / 149597870.7, // ~0.00817 AU
  periodDays: 15.945,
  /** 相对土星赤道近似倾角（弧度） */
  inc: 0.006,
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
 * 真实方向 + 放大 separation，保证卫星在放大后的父星球体外
 */
export function satelliteVisualPosition(
  parentPos: Vec3,
  moonRealPos: Vec3,
  parentR: number,
  moonR: number,
  sepBoost: number,
): Vec3 {
  const dx = moonRealPos.x - parentPos.x;
  const dy = moonRealPos.y - parentPos.y;
  const dz = moonRealPos.z - parentPos.z;
  const real = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
  const minSep = (parentR + moonR) * 3.2;
  const sep = Math.max(real * sepBoost, minSep);
  const s = sep / real;
  return {
    x: parentPos.x + dx * s,
    y: parentPos.y + dy * s,
    z: parentPos.z + dz * s,
  };
}

function moonHelioReal(when: Date): Vec3 {
  return helioAu('Moon', when);
}

function galileanHelioReal(id: BodyId, when: Date): Vec3 {
  const jup = helioAu('Jupiter', when);
  const jm = JupiterMoons(when);
  const rel =
    id == 'io' ? jm.io : id == 'europa' ? jm.europa : id == 'ganymede' ? jm.ganymede : jm.callisto;
  const r = toScene(rel);
  return { x: jup.x + r.x, y: jup.y + r.y, z: jup.z + r.z };
}

/** 土卫六：绕土星的倾斜圆轨道（历元相位） */
function titanHelioReal(when: Date): Vec3 {
  const sat = helioAu('Saturn', when);
  const t0 = Date.UTC(2000, 0, 1, 12) / 1000;
  const now = when.getTime() / 1000;
  const phase = ((now - t0) / (TITAN.periodDays * 86400)) * Math.PI * 2;
  const c = Math.cos(phase);
  const s = Math.sin(phase);
  const cosI = Math.cos(TITAN.inc);
  const sinI = Math.sin(TITAN.inc);
  // 轨道面：略倾，位置在土星坐标系（scene）
  const rx = TITAN.aAu * c;
  const ry = TITAN.aAu * s * sinI;
  const rz = TITAN.aAu * s * cosI;
  return { x: sat.x + rx, y: sat.y + ry, z: sat.z + rz };
}

function satelliteHelioReal(id: BodyId, when: Date): Vec3 {
  if (id == 'moon') return moonHelioReal(when);
  if (GALILEAN.has(id)) return galileanHelioReal(id, when);
  if (id == 'titan') return titanHelioReal(when);
  return { x: 0, y: 0, z: 0 };
}

export function bodyPosition(id: BodyId, astro: string | null, when: Date): Vec3 {
  if (id == 'sun' || !astro) return { x: 0, y: 0, z: 0 };
  const def = BODY_BY_ID[id];
  if (def.parent) {
    const parent = BODY_BY_ID[def.parent];
    const parentPos = bodyPosition(def.parent, parent.astro, when);
    const real = satelliteHelioReal(id, when);
    return satelliteVisualPosition(
      parentPos,
      real,
      parent.visualRadius,
      def.visualRadius,
      def.sepBoost ?? 12,
    );
  }
  return helioAu(astro, when);
}

/** 采样一条公转轨迹（AU），强制首尾闭合 */
export function sampleOrbit(astroName: string, when: Date, periodDays: number, samples = 180): Vec3[] {
  const pts: Vec3[] = [];
  const step = (periodDays * 86400 * 1000) / samples;
  for (let i = 0; i < samples; i++) {
    pts.push(helioAu(astroName, new Date(when.getTime() + i * step)));
  }
  // 闭合成环：终点 = 起点（避免椭圆历元步长缝隙）
  pts.push({ ...pts[0] });
  return pts;
}

/**
 * 卫星轨道相对父星的偏移采样（闭环）。
 * 画线时应挂到父星 group 下，才会跟着行星走，无需每帧跟着挪环心。
 */
export function sampleSatelliteOrbitRel(id: BodyId, when: Date, samples = 96): Vec3[] {
  const def = BODY_BY_ID[id];
  if (!def.parent) return [];
  const parentDef = BODY_BY_ID[def.parent];
  const periodMs = Math.max(def.periodDays, 0.5) * 86400 * 1000;
  const step = periodMs / samples;
  const pts: Vec3[] = [];
  for (let i = 0; i < samples; i++) {
    const t = new Date(when.getTime() + i * step);
    const pThen = bodyPosition(def.parent, parentDef.astro, t);
    const mThen = bodyPosition(id, def.astro, t);
    pts.push({
      x: mThen.x - pThen.x,
      y: mThen.y - pThen.y,
      z: mThen.z - pThen.z,
    });
  }
  pts.push({ ...pts[0] });
  return pts;
}

/**
 * @deprecated 日心绝对采样会留在原地；用 sampleSatelliteOrbitRel + 父星挂载
 */
export function sampleSatelliteOrbit(id: BodyId, when: Date, samples = 96): Vec3[] {
  const def = BODY_BY_ID[id];
  if (!def.parent) return [];
  const parentDef = BODY_BY_ID[def.parent];
  const parentNow = bodyPosition(def.parent, parentDef.astro, when);
  const rel = sampleSatelliteOrbitRel(id, when, samples);
  return rel.map((o) => ({
    x: parentNow.x + o.x,
    y: parentNow.y + o.y,
    z: parentNow.z + o.z,
  }));
}

/** @deprecated 用 sampleSatelliteOrbit('moon') */
export function sampleMoonOrbit(when: Date, samples = 90): Vec3[] {
  return sampleSatelliteOrbit('moon', when, samples);
}

export function moonVisualPosition(when: Date): Vec3 {
  return bodyPosition('moon', 'Moon', when);
}

/** 自检：地球距日 + 各主要卫星在父星球体外 */
export function selfCheckEarthDistance(): boolean {
  const p = helioAu('Earth', new Date());
  const d = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  if (!(d > 0.95 && d < 1.05)) return false;
  return selfCheckSatellites(new Date());
}

export function selfCheckSatellites(when = new Date()): boolean {
  const pairs: [BodyId, BodyId][] = [
    ['moon', 'earth'],
    ['io', 'jupiter'],
    ['europa', 'jupiter'],
    ['ganymede', 'jupiter'],
    ['callisto', 'jupiter'],
    ['titan', 'saturn'],
  ];
  for (const [sid, pid] of pairs) {
    const s = bodyPosition(sid, BODY_BY_ID[sid].astro, when);
    const p = bodyPosition(pid, BODY_BY_ID[pid].astro, when);
    const sep = Math.sqrt((s.x - p.x) ** 2 + (s.y - p.y) ** 2 + (s.z - p.z) ** 2);
    const need = BODY_BY_ID[pid].visualRadius + BODY_BY_ID[sid].visualRadius;
    if (!(sep > need)) return false;
  }
  return true;
}
