import {
  twoline2satrec,
  propagate,
  gstime,
  eciToEcf,
  eciToGeodetic,
  ecfToLookAngles,
  degreesLat,
  degreesLong,
} from 'satellite.js';
import tle from '../../data/iss-tle.json';

export type LookSample = {
  time: Date;
  elevation: number;
  azimuth: number;
  rangeSat: number;
};

export type Pass = {
  start: Date;
  max: Date;
  end: Date;
  maxEl: number;
  azAtMax: number;
};

export function loadSatrec() {
  return twoline2satrec(tle.line1, tle.line2);
}

export function tleMeta() {
  return { updated: tle.updated, name: tle.name, source: tle.source };
}

/** 某时刻相对观测者的仰角/方位 */
export function lookAt(
  satrec: ReturnType<typeof twoline2satrec>,
  when: Date,
  latDeg: number,
  lonDeg: number,
): LookSample | null {
  const pv = propagate(satrec, when);
  if (!pv || !pv.position || !pv.velocity) return null;
  const gmst = gstime(when);
  const geo = eciToGeodetic(pv.position, gmst);
  // 传播有效性粗检
  const lat = degreesLat(geo.latitude);
  const lon = degreesLong(geo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const observerGd = {
    longitude: (lonDeg * Math.PI) / 180,
    latitude: (latDeg * Math.PI) / 180,
    height: 0,
  };
  const positionEcf = eciToEcf(pv.position, gmst);
  const look = ecfToLookAngles(observerGd, positionEcf);
  return {
    time: when,
    elevation: (look.elevation * 180) / Math.PI,
    azimuth: (look.azimuth * 180) / Math.PI,
    rangeSat: look.rangeSat,
  };
}

export function geodeticAt(satrec: ReturnType<typeof twoline2satrec>, when: Date) {
  const pv = propagate(satrec, when);
  if (!pv || !pv.position) return null;
  const gmst = gstime(when);
  const geo = eciToGeodetic(pv.position, gmst);
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    heightKm: geo.height,
  };
}

/**
 * 扫描 from 起 hours 小时内的过顶（仰角 ≥ minElDeg）。
 * 向前回溯 lookback 以补全「正在过顶」的真实开始时刻；已完全结束的过境丢弃。
 */
export function findPasses(
  satrec: ReturnType<typeof twoline2satrec>,
  lat: number,
  lon: number,
  from = new Date(),
  hours = 48,
  minElDeg = 10,
  stepSec = 30,
): Pass[] {
  // ISS 单次过顶约 10min；2h 回溯足够接到升起段
  const lookbackMs = 2 * 3600 * 1000;
  const fromMs = from.getTime();
  const endMs = fromMs + hours * 3600 * 1000;
  const samples: LookSample[] = [];
  for (let t = fromMs - lookbackMs; t <= endMs; t += stepSec * 1000) {
    const s = lookAt(satrec, new Date(t), lat, lon);
    if (s) samples.push(s);
  }

  const passes: Pass[] = [];
  let i = 0;
  while (i < samples.length) {
    while (i < samples.length && samples[i].elevation < 0) i++;
    if (i >= samples.length) break;
    const startIdx = i;
    let maxIdx = i;
    while (i < samples.length && samples[i].elevation >= 0) {
      if (samples[i].elevation > samples[maxIdx].elevation) maxIdx = i;
      i++;
    }
    const endIdx = i - 1;
    const maxEl = samples[maxIdx].elevation;
    const end = samples[endIdx].time;
    // 已在 from 之前结束的过境不展示
    if (end.getTime() < fromMs) continue;
    if (maxEl >= minElDeg) {
      passes.push({
        start: samples[startIdx].time,
        max: samples[maxIdx].time,
        end,
        maxEl,
        azAtMax: samples[maxIdx].azimuth,
      });
    }
  }
  return passes;
}
