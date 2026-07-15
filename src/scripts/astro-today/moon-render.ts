import * as Astronomy from 'astronomy-engine';

export type MoonPhaseInfo = {
  fraction: number;
  angleDeg: number;
  name: string;
  emoji: string;
};

const MOON_TEX = '/space/textures/2k_moon.jpg';
let moonImg: HTMLImageElement | null = null;
let moonLoad: Promise<HTMLImageElement> | null = null;

function loadMoonTex() {
  if (moonImg) return Promise.resolve(moonImg);
  if (!moonLoad) {
    moonLoad = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        moonImg = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = MOON_TEX;
    });
  }
  return moonLoad;
}

export function moonPhaseInfo(when: Date): MoonPhaseInfo {
  const ill = Astronomy.Illumination(Astronomy.Body.Moon, when);
  const f = ill.phase_fraction;
  const angle = ill.phase_angle;
  let name = '新月';
  let emoji = '🌑';
  if (f < 0.03 || f > 0.97) {
    name = '新月';
    emoji = '🌑';
  } else if (f < 0.22) {
    name = angle < 90 ? '娥眉月' : '残月';
    emoji = angle < 90 ? '🌒' : '🌘';
  } else if (f < 0.28) {
    name = angle < 90 ? '上弦月' : '下弦月';
    emoji = angle < 90 ? '🌓' : '🌗';
  } else if (f < 0.47) {
    name = angle < 90 ? '盈凸月' : '亏凸月';
    emoji = angle < 90 ? '🌔' : '🌖';
  } else if (f < 0.53) {
    name = '满月';
    emoji = '🌕';
  } else if (f < 0.72) {
    name = angle < 90 ? '盈凸月' : '亏凸月';
    emoji = angle < 90 ? '🌔' : '🌖';
  } else if (f < 0.78) {
    name = angle < 90 ? '上弦月' : '下弦月';
    emoji = angle < 90 ? '🌓' : '🌗';
  } else {
    name = angle < 90 ? '娥眉月' : '残月';
    emoji = angle < 90 ? '🌒' : '🌘';
  }
  return { fraction: f, angleDeg: angle, name, emoji };
}

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = '#020408';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.55);
  g.addColorStop(0, '#0a1628');
  g.addColorStop(1, '#020408');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  let s = seed;
  for (let i = 0; i < 120; i++) {
    s = (s * 16807 + 7) % 2147483647;
    const x = ((s % 10000) / 10000) * w;
    s = (s * 16807 + 7) % 2147483647;
    const y = ((s % 10000) / 10000) * h * 0.85;
    const a = 0.25 + ((s % 100) / 100) * 0.75;
    ctx.fillStyle = `rgba(200,230,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + (s % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shadeMoonDisk(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, phase: number) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.02 || p > 0.98) {
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (p > 0.48 && p < 0.52) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  const waxing = p <= 0.5;
  const k = waxing ? 1 - p * 2 : (p - 0.5) * 2;

  ctx.fillStyle = 'rgba(2,4,8,0.96)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  if (waxing) {
    const ex = cx + r * (1 - k * 2);
    const rx = Math.max(r * k * 2, 0.5);
    ctx.beginPath();
    ctx.ellipse(ex, cy, rx, r, 0, 0, Math.PI * 2);
    ctx.fill();
    if (k < 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(cx, cy);
      ctx.fill();
    }
  } else {
    const ex = cx - r * (1 - k * 2);
    const rx = Math.max(r * k * 2, 0.5);
    ctx.beginPath();
    ctx.ellipse(ex, cy, rx, r, 0, 0, Math.PI * 2);
    ctx.fill();
    if (k < 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, true);
      ctx.lineTo(cx, cy);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHudFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0,232,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.fillStyle = 'rgba(0,232,255,0.55)';
  ctx.font = '11px monospace';
  ctx.fillText('LUNAR TELEMETRY', 24, 28);
}

export async function drawMoonHero(
  canvas: HTMLCanvasElement,
  when: Date,
  illumPct: number,
  phaseName: string,
) {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width != w || canvas.height != h) {
    canvas.width = w;
    canvas.height = h;
  }

  drawStarfield(ctx, w, h, Math.floor(when.getTime() / 86400000));
  drawHudFrame(ctx, w, h);

  const img = await loadMoonTex();
  const cx = w * 0.5;
  const cy = h * 0.48;
  const r = Math.min(w, h) * 0.32;

  const glow = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.35);
  glow.addColorStop(0, 'rgba(200,220,255,0.12)');
  glow.addColorStop(1, 'rgba(0,232,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  const limb = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = limb;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  const info = moonPhaseInfo(when);
  shadeMoonDisk(ctx, cx, cy, r, info.fraction);

  ctx.strokeStyle = 'rgba(0,232,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(232,244,255,0.85)';
  ctx.font = `${Math.floor(14 * dpr)}px monospace`;
  ctx.fillText(`${phaseName}  ·  照明 ${illumPct.toFixed(1)}%`, 24, h - 36);
  ctx.fillStyle = 'rgba(0,232,255,0.65)';
  ctx.font = `${Math.floor(11 * dpr)}px monospace`;
  ctx.fillText('LIVE · LOCAL EPHEMERIS', 24, h - 18);
}

export function drawMoonHeroSync(canvas: HTMLCanvasElement, when: Date, illumPct: number, phaseName: string) {
  drawMoonHero(canvas, when, illumPct, phaseName).catch(() => {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00e8ff';
    ctx.font = '14px monospace';
    ctx.fillText('月表纹理加载中…', 20, 40);
  });
}
