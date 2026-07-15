/** 太阳引力参数 μ（AU³ / day² 风格单位，数值自洽即可） */
export const MU = 1;

export type HohmannResult = {
  r1: number;
  r2: number;
  a: number;
  dv1: number;
  dv2: number;
  dvTotal: number;
};

export function hohmann(r1: number, r2: number, mu = MU): HohmannResult {
  const a = (r1 + r2) / 2;
  const dv1 = Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
  const dv2 = Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
  return { r1, r2, a, dv1, dv2, dvTotal: Math.abs(dv1) + Math.abs(dv2) };
}

/** 转移椭圆上真近点角 0→π（近→远）位置；peri 沿 +x */
export function transferPos(r1: number, r2: number, t: number): { x: number; y: number } {
  const a = (r1 + r2) / 2;
  const c = Math.abs(a - r1);
  const b = Math.sqrt(Math.max(a * a - c * c, 1e-12));
  // t: 0..1 沿半椭圆
  const theta = Math.PI * Math.min(1, Math.max(0, t));
  const cx = r1 < r2 ? c : -c;
  return {
    x: cx + a * Math.cos(Math.PI - theta),
    y: b * Math.sin(theta) * (r1 < r2 ? 1 : -1),
  };
}
