import * as THREE from 'three';
import { BODIES, BODY_BY_ID, type BodyId } from './constants';
import type { BodySystem } from './bodies';
import type { StarSystem, StarId } from './stars';
import { NEARBY_STARS } from './stars';
import type { ScaleMode } from './scale';

const COLORS: Record<BodyId, string> = {
  sun: '#ffb347',
  mercury: '#b8b8b8',
  venus: '#e8d4a8',
  earth: '#4a9eff',
  moon: '#c8c8c8',
  mars: '#c1440e',
  jupiter: '#d4a574',
  io: '#f0d060',
  europa: '#c8b898',
  ganymede: '#a89878',
  callisto: '#6a6058',
  saturn: '#e6d5a8',
  titan: '#d4a060',
  uranus: '#7ec8e3',
  neptune: '#4166f5',
};

export interface TravelTrail {
  from: THREE.Vector3;
  mid: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
}

interface BodyHit {
  kind: 'body';
  id: BodyId;
  sx: number;
  sy: number;
  hit: number;
}

interface StarHit {
  kind: 'star';
  id: StarId;
  sx: number;
  sy: number;
  hit: number;
}

type HitPt = BodyHit | StarHit;

interface MapLayout {
  cx: number;
  cy: number;
  scale: number;
  pts: HitPt[];
}

/** 右上角战术星图：太阳系 AU 或星域 ly，可点击跳转 */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private tmp = new THREE.Vector3();
  private camLogical = new THREE.Vector3();
  private layout: MapLayout | null = null;
  private onGotoBody: ((id: BodyId) => void) | null = null;
  private onGotoStar: ((id: StarId) => void) | null = null;
  private scaleMode: ScaleMode = 'solar';

  constructor(
    private canvas: HTMLCanvasElement,
    private bodies: BodySystem,
    private stars: StarSystem,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.canvas.style.cursor = 'crosshair';
    this.canvas.addEventListener('click', (e) => this.onClick(e));
  }

  bind(onGotoBody: (id: BodyId) => void, onGotoStar: (id: StarId) => void) {
    this.onGotoBody = onGotoBody;
    this.onGotoStar = onGotoStar;
  }

  setScaleMode(m: ScaleMode) {
    this.scaleMode = m;
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
    if (!this.layout) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = this.hitTest(x, y);
    if (!hit) return;
    if (hit.kind == 'body') this.onGotoBody?.(hit.id);
    else this.onGotoStar?.(hit.id);
  }

  private hitTest(x: number, y: number): HitPt | null {
    if (!this.layout) return null;
    let best: HitPt | null = null;
    let bestD = Infinity;
    for (const pt of this.layout.pts) {
      const dx = x - pt.sx;
      const dy = y - pt.sy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= pt.hit && d < bestD) {
        bestD = d;
        best = pt;
      }
    }
    return best;
  }

  draw(focusBody: BodyId, focusStar: StarId, trail: TravelTrail | null) {
    if (this.scaleMode == 'stellar') this.drawStellar(focusStar, trail);
    else this.drawSolar(focusBody, trail);
  }

  private drawFrame(w: number, h: number) {
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
  }

  private drawCorners(w: number, h: number, label: string) {
    const ctx = this.ctx;
    const m = 6;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 1;
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
    ctx.fillText(label, m + 2, h - m - 2);
  }

  private drawSolar(focus: BodyId, trail: TravelTrail | null) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const ctx = this.ctx;
    this.drawFrame(w, h);

    const fo = this.bodies.floatingOrigin;
    const pts: { id: BodyId; x: number; z: number }[] = [];
    let maxR = 0.5;
    for (const b of BODIES) {
      const p = this.bodies.getLogicalPos(b.id, this.tmp);
      const r = Math.sqrt(p.x * p.x + p.z * p.z);
      if (r > maxR) maxR = r;
      pts.push({ id: b.id, x: p.x, z: p.z });
    }
    this.camera.getWorldPosition(this.camLogical);
    this.camLogical.add(fo);
    const camR = Math.sqrt(this.camLogical.x * this.camLogical.x + this.camLogical.z * this.camLogical.z);
    if (camR > maxR) maxR = camR;

    const cx = w / 2;
    const cy = h / 2;
    const scale = (Math.min(w, h) * 0.42) / maxR;
    const toScreen = (x: number, z: number) => ({ sx: cx + x * scale, sy: cy + z * scale });
    const layoutPts: HitPt[] = [];

    if (trail) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = bezier3(trail.from, trail.mid, trail.to, t);
        const { sx, sy } = toScreen(p.x + fo.x, p.z + fo.z);
        if (i == 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const prog = bezier3(trail.from, trail.mid, trail.to, trail.progress);
      const { sx, sy } = toScreen(prog.x + fo.x, prog.z + fo.z);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    for (const b of BODIES) {
      if (!b.astro || b.periodDays <= 0 || b.parent) continue;
      const p = this.bodies.getLogicalPos(b.id, this.tmp);
      const r = Math.sqrt(p.x * p.x + p.z * p.z) * scale;
      if (r < 2) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const pt of pts) {
      const { sx, sy } = toScreen(pt.x, pt.z);
      const def = BODY_BY_ID[pt.id];
      const rad = pt.id == 'sun' ? 5 : Math.max(def.parent ? 1.5 : 2, def.visualRadius * scale * 80);
      const hit = Math.max(rad + 6, def.parent ? 8 : 10);
      layoutPts.push({ kind: 'body', id: pt.id, sx, sy, hit });
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
    const { sx: csx, sy: csy } = toScreen(this.camLogical.x, this.camLogical.z);
    this.drawCamMark(csx, csy);
    this.drawCorners(w, h, 'CLICK · GOTO');
  }

  private drawStellar(focus: StarId, trail: TravelTrail | null) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const ctx = this.ctx;
    this.drawFrame(w, h);

    const fo = this.stars.floatingOrigin;
    let maxR = 2;
    for (const s of NEARBY_STARS) {
      const p = this.stars.getLogicalPos(s.id, this.tmp);
      const r = Math.sqrt(p.x * p.x + p.z * p.z);
      if (r > maxR) maxR = r;
    }
    this.camera.getWorldPosition(this.camLogical);
    this.camLogical.add(fo);
    const camR = Math.sqrt(this.camLogical.x * this.camLogical.x + this.camLogical.z * this.camLogical.z);
    if (camR > maxR) maxR = camR;

    const cx = w / 2;
    const cy = h / 2;
    const scale = (Math.min(w, h) * 0.42) / maxR;
    const toScreen = (x: number, z: number) => ({ sx: cx + x * scale, sy: cy + z * scale });
    const layoutPts: HitPt[] = [];

    if (trail) {
      ctx.strokeStyle = 'rgba(255, 200, 80, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = bezier3(trail.from, trail.mid, trail.to, t);
        const { sx, sy } = toScreen(p.x + fo.x, p.z + fo.z);
        if (i == 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const s of NEARBY_STARS) {
      const p = this.stars.getLogicalPos(s.id, this.tmp);
      const { sx, sy } = toScreen(p.x, p.z);
      const rad = s.id == 'sol' ? 5 : Math.max(2, s.visualRadius * scale * 12);
      const hit = Math.max(rad + 6, 10);
      layoutPts.push({ kind: 'star', id: s.id, sx, sy, hit });
      const hex = '#' + s.color.toString(16).padStart(6, '0');
      ctx.fillStyle = hex;
      ctx.shadowColor = hex;
      ctx.shadowBlur = s.id == focus ? 12 : 5;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (s.id == focus) {
        ctx.strokeStyle = 'rgba(255, 200, 80, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, rad + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    this.layout = { cx, cy, scale, pts: layoutPts };
    const { sx: csx, sy: csy } = toScreen(this.camLogical.x, this.camLogical.z);
    this.drawCamMark(csx, csy);
    this.drawCorners(w, h, 'STELLAR · LY');
  }

  private drawCamMark(csx: number, csy: number) {
    const ctx = this.ctx;
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
  }
}

function bezier3(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number): THREE.Vector3 {
  const u = 1 - t;
  return new THREE.Vector3(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
}
