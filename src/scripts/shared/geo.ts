/** 默认观测点：北京 */
export const DEFAULT_LAT = 39.9;
export const DEFAULT_LON = 116.4;

export type GeoPos = { lat: number; lon: number; source: 'gps' | 'manual' | 'default' };

/** 解析输入框经纬度；非法则返回 null */
export function parseLatLon(latStr: string, lonStr: string): { lat: number; lon: number } | null {
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** 尝试 GPS；失败回调 default */
export function requestGeo(onDone: (pos: GeoPos) => void) {
  if (!navigator.geolocation) {
    onDone({ lat: DEFAULT_LAT, lon: DEFAULT_LON, source: 'default' });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => onDone({ lat: p.coords.latitude, lon: p.coords.longitude, source: 'gps' }),
    () => onDone({ lat: DEFAULT_LAT, lon: DEFAULT_LON, source: 'default' }),
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
  );
}

export function formatAz(deg: number) {
  const d = ((deg % 360) + 360) % 360;
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const i = Math.round(d / 45) % 8;
  return `${dirs[i]} ${d.toFixed(0)}°`;
}

export function formatLocalTime(d: Date) {
  return d.toLocaleString('zh-CN', { hour12: false });
}
