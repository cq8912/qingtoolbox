import { findPasses, loadSatrec, lookAt, type Pass, type LookSample } from './propagate';

export type SkyVizState = {
  passes: Pass[];
  track: LookSample[];
  passIndex: number;
};

export function samplePassTrack(
  satrec: ReturnType<typeof loadSatrec>,
  lat: number,
  lon: number,
  pass: Pass,
  stepSec = 8,
): LookSample[] {
  const out: LookSample[] = [];
  const t0 = pass.start.getTime();
  const t1 = pass.end.getTime();
  for (let t = t0; t <= t1; t += stepSec * 1000) {
    const s = lookAt(satrec, new Date(t), lat, lon);
    if (s && s.elevation >= -2) out.push(s);
  }
  return out;
}

export function buildSkyState(
  satrec: ReturnType<typeof loadSatrec>,
  lat: number,
  lon: number,
  from = new Date(),
): SkyVizState {
  const passes = findPasses(satrec, lat, lon, from, 48, 10, 20);
  const track = passes.length ? samplePassTrack(satrec, lat, lon, passes[0], 6) : [];
  return { passes, track, passIndex: 0 };
}

function azElToXY(azDeg: number, elDeg: number, cx: number, cy: number, radius: number) {
  const az = ((azDeg % 360) + 360) % 360;
  const el = Math.max(0, Math.min(90, elDeg));
  const r = radius * (1 - el / 90);
  const rad = ((az - 90) * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

function formatShort(d: Date) {
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function drawSkyDome(canvas: HTMLCanvasElement, state: SkyVizState, timeMs: number) {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width != w || canvas.height != h) {
    canvas.width = w;
    canvas.height = h;
  }

  const cx = w * 0.5;
  const cy = h * 0.92;
  const R = Math.min(w, h) * 0.78;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#020610');
  sky.addColorStop(0.55, '#061828');
  sky.addColorStop(1, '#0a1a2e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  let s = 42;
  for (let i = 0; i < 80; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const sx = ((s % 1000) / 1000) * w;
    const sy = ((s % 700) / 700) * h * 0.75;
    ctx.fillStyle = `rgba(180,220,255,${0.2 + (s % 50) / 80})`;
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }

  ctx.strokeStyle = 'rgba(0,232,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.stroke();

  for (const el of [30, 60]) {
    const r = R * (1 - el / 90);
    ctx.strokeStyle = 'rgba(0,232,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,232,255,0.4)';
    ctx.font = `${9 * dpr}px monospace`;
    ctx.fillText(`${el}°`, cx + r - 14, cy - 4);
  }

  const dirs = [
    { label: 'N', az: 0 },
    { label: 'E', az: 90 },
    { label: 'S', az: 180 },
    { label: 'W', az: 270 },
  ];
  ctx.fillStyle = 'rgba(255,200,87,0.9)';
  ctx.font = `bold ${12 * dpr}px monospace`;
  for (const d of dirs) {
    const p = azElToXY(d.az, 0, cx, cy, R);
    ctx.fillText(d.label, p.x - 6 * dpr, p.y + 16 * dpr);
    ctx.strokeStyle = 'rgba(255,200,87,0.25)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  const pass = state.passes[state.passIndex];
  const track = state.track;

  if (track.length >= 2) {
    ctx.strokeStyle = 'rgba(0,232,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00e8ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const p0 = azElToXY(track[0].azimuth, track[0].elevation, cx, cy, R);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < track.length; i++) {
      const p = azElToXY(track[i].azimuth, track[i].elevation, cx, cy, R);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    const cycle = 6000;
    const u = (timeMs % cycle) / cycle;
    const idx = u * (track.length - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(track.length - 1, i0 + 1);
    const f = idx - i0;
    const az = track[i0].azimuth + (track[i1].azimuth - track[i0].azimuth) * f;
    const el = track[i0].elevation + (track[i1].elevation - track[i0].elevation) * f;
    const sat = azElToXY(az, el, cx, cy, R);

    const pulse = 0.6 + Math.sin(timeMs * 0.008) * 0.4;
    const grd = ctx.createRadialGradient(sat.x, sat.y, 0, sat.x, sat.y, 18 * pulse);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(0,232,255,0.9)');
    grd.addColorStop(1, 'rgba(0,232,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sat.x, sat.y, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sat.x, sat.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (pass) {
      ctx.fillStyle = 'rgba(232,244,255,0.9)';
      ctx.font = `${11 * dpr}px monospace`;
      ctx.fillText(`下次过顶 · 最高 ${pass.maxEl.toFixed(0)}° · ${formatShort(pass.max)}`, 16, 28);
      ctx.fillStyle = 'rgba(0,232,255,0.65)';
      ctx.font = `${10 * dpr}px monospace`;
      ctx.fillText('弧线 = ISS 在地平天空中的飞行路径（仰角越高越接近头顶）', 16, 46);
    }
  } else {
    ctx.fillStyle = 'rgba(232,244,255,0.7)';
    ctx.font = `${12 * dpr}px monospace`;
    ctx.fillText('未来 48h 无仰角≥10° 的 ISS 过顶', cx - 120 * dpr, h * 0.4);
  }

  ctx.strokeStyle = 'rgba(0,232,255,0.25)';
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = 'rgba(0,232,255,0.5)';
  ctx.font = `${10 * dpr}px monospace`;
  ctx.fillText('PASS PREDICTOR · ISS', w - 160 * dpr, 22);
}

export function startSkyAnim(canvas: HTMLCanvasElement, getState: () => SkyVizState) {
  let raf = 0;
  const frame = (t: number) => {
    drawSkyDome(canvas, getState(), t);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
