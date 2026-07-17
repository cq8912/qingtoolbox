import { hohmann, transferPos } from './physics';

function phaseLabel(t: number) {
  if (t < 0.08) return '① 近地点火离站';
  if (t < 0.92) return '② 转移椭圆飞行中';
  return '③ 到达 · 二次点火入轨';
}

export function drawOrbit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  r1: number,
  r2: number,
  t: number,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#010305';
  ctx.fillRect(0, 0, w, h);

  const pad = 36;
  const maxR = Math.max(r1, r2) * 1.2;
  const scale = (Math.min(w, h) / 2 - pad) / maxR;
  const cx = w / 2;
  const cy = h / 2 + 8;

  const toScreen = (x: number, y: number) => ({
    x: cx + x * scale,
    y: cy - y * scale,
  });

  ctx.strokeStyle = 'rgba(0,232,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const p = toScreen(i * maxR * 0.25, 0);
    ctx.beginPath();
    ctx.moveTo(p.x, pad);
    ctx.lineTo(p.x, h - pad);
    ctx.stroke();
  }

  const sun = toScreen(0, 0);
  const sunGlow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 22);
  sunGlow.addColorStop(0, 'rgba(255,200,87,1)');
  sunGlow.addColorStop(0.4, 'rgba(255,180,60,0.55)');
  sunGlow.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffc857';
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 7, 0, Math.PI * 2);
  ctx.fill();

  const ring = (r: number, color: string, dash?: number[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  ring(r1, 'rgba(0,232,255,0.65)');
  ring(r2, 'rgba(0,232,255,0.35)');

  // 转移椭圆
  ctx.strokeStyle = '#ffc857';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const p = transferPos(r1, r2, i / 64);
    const s = toScreen(p.x, p.y);
    if (i == 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 拖尾
  const trailN = 18;
  for (let i = trailN; i >= 1; i--) {
    const tt = Math.max(0, t - i * 0.012);
    const p = transferPos(r1, r2, tt);
    const s = toScreen(p.x, p.y);
    ctx.fillStyle = `rgba(0,232,255,${0.04 + (1 - i / trailN) * 0.25})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const craft = transferPos(r1, r2, t);
  const cs = toScreen(craft.x, craft.y);
  ctx.fillStyle = '#00e8ff';
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,232,255,0.5)';
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, 11, 0, Math.PI * 2);
  ctx.stroke();

  // 点火点标注
  const burn1 = toScreen(r1, 0);
  const burn2 = toScreen(-r2, 0);
  ctx.fillStyle = 'rgba(255,200,87,0.95)';
  ctx.font = '11px sans-serif';
  ctx.fillText('① 第一次点火', burn1.x + 8, burn1.y - 10);
  ctx.fillText('③ 第二次点火', burn2.x - 70, burn2.y - 10);

  const innerLbl = toScreen(0, r1);
  const outerLbl = toScreen(0, -r2);
  ctx.fillStyle = 'rgba(0,232,255,0.75)';
  ctx.fillText('近地圆轨', innerLbl.x + 6, innerLbl.y + 4);
  ctx.fillText('目标圆轨', outerLbl.x + 6, outerLbl.y + 4);

  ctx.fillStyle = 'rgba(232,244,255,0.85)';
  ctx.font = '13px sans-serif';
  ctx.fillText(phaseLabel(t), 14, 28);

  const { dvTotal } = hohmann(r1, r2);
  ctx.fillStyle = 'rgba(232,244,255,0.55)';
  ctx.font = '11px monospace';
  ctx.fillText(`r1=${r1.toFixed(2)}  r2=${r2.toFixed(2)}  油耗Σ=${dvTotal.toFixed(4)}`, 14, h - 14);
}

export function orbitPhaseText(t: number) {
  return phaseLabel(t);
}
