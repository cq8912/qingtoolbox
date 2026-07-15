export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
};

export function createParticles(n: number, w: number, h: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1 + Math.random() * 2,
      life: Math.random(),
    });
  }
  return out;
}

/** 用频谱驱动粒子；返回是否全部坐标有限 */
export function updateParticles(
  particles: Particle[],
  freq: Uint8Array,
  w: number,
  h: number,
  sensitivity: number,
  dt: number,
): boolean {
  let ok = true;
  let energy = 0;
  for (let i = 0; i < freq.length; i++) energy += freq[i];
  energy = (energy / (freq.length * 255)) * sensitivity;

  const cx = w / 2;
  const cy = h / 2;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const band = freq[i % freq.length] / 255;
    const kick = band * energy * 120;
    const ang = (i / particles.length) * Math.PI * 2 + performance.now() * 0.0003;
    p.vx += Math.cos(ang) * kick * dt * 0.02;
    p.vy += Math.sin(ang) * kick * dt * 0.02;
    p.vx += (cx - p.x) * 0.0008;
    p.vy += (cy - p.y) * 0.0008;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.r = 1 + band * 4 * sensitivity;
    p.life = band;

    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;

    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) ok = false;
  }
  return ok;
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  w: number,
  h: number,
) {
  ctx.fillStyle = 'rgba(1,3,5,0.28)';
  ctx.fillRect(0, 0, w, h);

  // 中心环
  ctx.strokeStyle = 'rgba(0,232,255,0.2)';
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.18, 0, Math.PI * 2);
  ctx.stroke();

  for (const p of particles) {
    const a = 0.25 + p.life * 0.75;
    ctx.fillStyle = `rgba(0,232,255,${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
