import * as THREE from 'three';
import { BODIES, type BodyId } from './constants';
import type { BodySystem } from './bodies';
import type { StarSystem, StarId } from './stars';
import { NEARBY_STARS } from './stars';
import type { ScaleMode } from './scale';

/**
 * 画布点击选天体：短点击才触发；射线优先，失败则用屏幕空间近邻兜底（小星球也好点）
 */
export class ScenePicker {
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private tmp = new THREE.Vector3();
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private armed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: THREE.PerspectiveCamera,
    private getScale: () => ScaleMode,
    private bodies: BodySystem,
    private stars: StarSystem,
    private onBody: (id: BodyId) => void,
    private onStar: (id: StarId) => void,
  ) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button != 0) return;
      this.armed = true;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downT = performance.now();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button != 0 || !this.armed) return;
      this.armed = false;
      const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      if (moved > 8) return;
      if (performance.now() - this.downT > 450) return;
      this.pick(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointercancel', () => {
      this.armed = false;
    });
  }

  private pick(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.ndc, this.camera);

    if (this.getScale() == 'stellar') {
      const roots: THREE.Object3D[] = [];
      for (const m of this.stars.meshes.values()) roots.push(m.group);
      const hits = this.ray.intersectObjects(roots, true);
      let id = findNamedId(hits);
      if (!id) id = this.nearestStar(clientX, clientY, rect);
      if (id) this.onStar(id);
      return;
    }

    const roots: THREE.Object3D[] = [];
    for (const m of this.bodies.meshes.values()) roots.push(m.group);
    const hits = this.ray.intersectObjects(roots, true);
    let id = findNamedId(hits) as BodyId | null;
    if (!id) id = this.nearestBody(clientX, clientY, rect);
    if (id) this.onBody(id);
  }

  private nearestBody(clientX: number, clientY: number, rect: DOMRect): BodyId | null {
    const w = rect.width;
    const h = rect.height;
    let best: BodyId | null = null;
    let bestD = 36; // px
    for (const def of BODIES) {
      this.bodies.getWorldPos(def.id, this.tmp);
      this.tmp.project(this.camera);
      if (this.tmp.z < -1 || this.tmp.z > 1) continue;
      const sx = (this.tmp.x * 0.5 + 0.5) * w + rect.left;
      const sy = (-this.tmp.y * 0.5 + 0.5) * h + rect.top;
      const d = Math.hypot(clientX - sx, clientY - sy);
      const hitR = Math.max(18, def.visualRadius * 8000);
      if (d < hitR && d < bestD) {
        bestD = d;
        best = def.id;
      }
    }
    return best;
  }

  private nearestStar(clientX: number, clientY: number, rect: DOMRect): StarId | null {
    const w = rect.width;
    const h = rect.height;
    let best: StarId | null = null;
    let bestD = 42;
    for (const def of NEARBY_STARS) {
      this.stars.getWorldPos(def.id, this.tmp);
      this.tmp.project(this.camera);
      if (this.tmp.z < -1 || this.tmp.z > 1) continue;
      const sx = (this.tmp.x * 0.5 + 0.5) * w + rect.left;
      const sy = (-this.tmp.y * 0.5 + 0.5) * h + rect.top;
      const d = Math.hypot(clientX - sx, clientY - sy);
      const hitR = Math.max(22, def.visualRadius * 120);
      if (d < hitR && d < bestD) {
        bestD = d;
        best = def.id;
      }
    }
    return best;
  }
}

function findNamedId(hits: THREE.Intersection[]): string | null {
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o) {
      if (o.name) return o.name;
      o = o.parent;
    }
  }
  return null;
}
