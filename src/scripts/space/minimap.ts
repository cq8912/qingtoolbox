import * as THREE from 'three';
import { BODIES, BODY_BY_ID, type BodyId } from './constants';
import type { BodySystem } from './bodies';

const COLORS: Record<BodyId, string> = {
  sun: '#ffb347',
  mercury: '#b8b8b8',
  venus: '#e8d4a8',
  earth: '#4a9eff',
  moon: '#c8c8c8',
  mars: '#c1440e',
  jupiter: '#d4a574',
  saturn: '#e6d5a8',
  uranus: '#7ec8e3',
  neptune: '#4166f5',
};

export interface TravelTrail {
  from: THREE.Vector3;
  mid: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
}

interface MapLayout {
  cx: number;
  cy: number;
  scale: number;
  pts: { id: BodyId; sx: number; sy: number; hit: number }[];
}

/** 右上角战术星图：俯视 XZ 平面，可点击跳转 */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private tmp = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private layout: MapLayout | null = null;
  private onGoto: ((id: BodyId) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private bodies: BodySystem,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.canvas.style.cursor = 'crosshair';
    this.canvas.addEventListener('click', (e) => this.onClick(e));
  }

  bind(onGoto: (id: BodyId) => void) {
    this.onGoto = onGoto;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private onClick(e: MouseEvent) {
    if (!this.onGoto || !this.layout) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = this.hitTest(x, y);
    if (id) this.onGoto(id);
  }

  private hitTest(x: number, y: number): BodyId | null {
    if (!this.layout) return null;
    let best: BodyId | null = null;
    let bestD = Infinity;
    for (const pt of this.layout.pts) {
      const dx = x - pt.sx;
      const dy = y - pt.sy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= pt.hit && d < bestD) {
        bestD = d;
        best = pt.id;
      }
    }
    return best;
  }

  draw(focus: BodyId, trail: TravelTrail | null) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(4, 12, 22, 0.88)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    for (let j = 0; j < h; j += 14) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(w, j);
      ctx.stroke();
    }

    const pts: { id: BodyId; x: number; z: number }[] = [];
    let maxR = 0.5;
    for (const b of BODIES) {
      const p = this.bodies.getWorldPos(b.id, this.tmp);
      const r = Math.sqrt(p.x * p.x + p.z * p.z);
      if (r > maxR) maxR = r;
      pts.push({ id: b.id, x: p.x, z: p.z });
    }
    this.camera.getWorldPosition(this.camPos);
    const camR = Math.sqrt(this.camPos.x * this.camPos.x + this.camPos.z * this.camPos.z);
    if (camR > maxR) maxR = camR;

    const cx = w / 2;
    const cy = h / 2;
    const scale = (Math.min(w, h) * 0.42) / maxR;

    const toScreen = (x: number, z: number) => ({
      sx: cx + x * scale,
      sy: cy + z * scale,
    });

    const layoutPts: MapLayout['pts'] = [];

    if (trail) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = bezier3(trail.from, trail.mid, trail.to, t);
        const { sx, sy } = toScreen(p.x, p.z);
        if (i == 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const prog = bezier3(trail.from, trail.mid, trail.to, trail.progress);
      const { sx, sy } = toScreen(prog.x, prog.z);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    for (const b of BODIES) {
      if (!b.astro || b.periodDays <= 0) continue;
      const p = this.bodies.getWorldPos(b.id, this.tmp);
      const r = Math.sqrt(p.x * p.x + p.z * p.z) * scale;
      if (r < 2) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const pt of pts) {
      const { sx, sy } = toScreen(pt.x, pt.z);
      const def = BODY_BY_ID[pt.id];
      const rad = pt.id == 'sun' ? 5 : Math.max(2, def.visualRadius * scale * 80);
      const hit = Math.max(rad + 6, 10);
      layoutPts.push({ id: pt.id, sx, sy, hit });

      ctx.fillStyle = COLORS[pt.id];
      ctx.shadowColor = COLORS[pt.id];
      ctx.shadowBlur = pt.id == focus ? 10 : 4;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (pt.id == focus) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, rad + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    this.layout = { cx, cy, scale, pts: layoutPts };

    const { sx: csx, sy: csy } = toScreen(this.camPos.x, this.camPos.z);
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(csx, csy - 5);
    ctx.lineTo(csx - 4, csy + 4);
    ctx.lineTo(csx + 4, csy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 1;
    const m = 6;
    ctx.beginPath();
    ctx.moveTo(m, m + 10);
    ctx.lineTo(m, m);
    ctx.lineTo(m + 10, m);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - m - 10, m);
    ctx.lineTo(w - m, m);
    ctx.lineTo(w - m, m + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m, h - m - 10);
    ctx.lineTo(m, h - m);
    ctx.lineTo(m + 10, h - m);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w - m, h - m - 10);
    ctx.lineTo(w - m, h - m);
    ctx.lineTo(w - m - 10, h - m);
    ctx.stroke();

    ctx.font = '9px IBM Plex Mono, monospace';
    ctx.fillStyle = 'rgba(0, 232, 255, 0.45)';
    ctx.fillText('CLICK · GOTO', m + 2, h - m - 2);
  }
}

function bezier3(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  t: number,
): THREE.Vector3 {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}
