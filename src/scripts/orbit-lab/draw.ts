import { hohmann, transferPos } from './physics';

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

  const pad = 28;
  const maxR = Math.max(r1, r2) * 1.15;
  const scale = (Math.min(w, h) / 2 - pad) / maxR;
  const cx = w / 2;
  const cy = h / 2;

  const toScreen = (x: number, y: number) => ({
    x: cx + x * scale,
    y: cy - y * scale,
  });

  // 网格
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
  ctx.fillStyle = '#ffc857';
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 7, 0, Math.PI * 2);
  ctx.fill();

  const ring = (r: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  };
  ring(r1, 'rgba(0,232,255,0.55)');
  ring(r2, 'rgba(0,232,255,0.35)');

  // 转移椭圆
  ctx.strokeStyle = '#ffc857';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const p = transferPos(r1, r2, i / 64);
    const s = toScreen(p.x, p.y);
    if (i == 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const craft = transferPos(r1, r2, t);
  const cs = toScreen(craft.x, craft.y);
  ctx.fillStyle = '#00e8ff';
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,232,255,0.5)';
  ctx.beginPath();
  ctx.arc(cs.x, cs.y, 10, 0, Math.PI * 2);
  ctx.stroke();

  const { dvTotal } = hohmann(r1, r2);
  ctx.fillStyle = 'rgba(232,244,255,0.7)';
  ctx.font = '12px monospace';
  ctx.fillText(`r1=${r1.toFixed(2)}  r2=${r2.toFixed(2)}  ΔvΣ=${dvTotal.toFixed(4)}`, 12, h - 12);
}
