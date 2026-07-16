import * as THREE from 'three';
import { COMETS, cometPosition, type CometDef, type CometId } from './comets';

/** 彗星核 + 背日彗尾粒子 */
export class CometSystem {
  root = new THREE.Group();
  floatingOrigin = new THREE.Vector3();
  private meshes = new Map<CometId, THREE.Group>();
  private logical = new Map<CometId, THREE.Vector3>();
  private tails = new Map<CometId, THREE.Points>();
  private tmp = new THREE.Vector3();
  private tmpSun = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    for (const def of COMETS) {
      this.logical.set(def.id, new THREE.Vector3());
      this.meshes.set(def.id, this.createComet(def));
    }
  }

  private createComet(def: CometDef) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(def.visualRadius, 24, 16),
      new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.color,
        emissiveIntensity: 0.45,
        roughness: 0.55,
      }),
    );
    g.add(core);

    // 彗尾：沿 -太阳方向的粒子条带
    const N = 180;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const r = ((def.color >> 16) & 255) / 255;
    const gg = ((def.color >> 8) & 255) / 255;
    const b = (def.color & 255) / 255;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      const a = 1 - t * 0.85;
      col[i * 3] = r * a;
      col[i * 3 + 1] = gg * a;
      col[i * 3 + 2] = b * a;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tail = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.018,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    g.add(tail);
    this.tails.set(def.id, tail);

    this.root.add(g);
    return g;
  }

  updatePositions(when: Date) {
    for (const def of COMETS) {
      const p = cometPosition(def, when);
      this.logical.get(def.id)!.set(p.x, p.y, p.z);
      this.applyLocal(def.id);
      this.updateTail(def);
    }
  }

  private updateTail(def: CometDef) {
    const tail = this.tails.get(def.id)!;
    const log = this.logical.get(def.id)!;
    // 背日方向（太阳在原点）
    this.tmpSun.copy(log).normalize();
    if (this.tmpSun.lengthSq() < 1e-8) this.tmpSun.set(1, 0, 0);
    const away = this.tmp.copy(this.tmpSun); // 从太阳指向彗星 = 尾向外？ 尾应指远离太阳
    // 太阳在 0，彗星在 log → 太阳→彗星方向是 log；彗尾在反太阳方向继续延伸 = +log 方向
    const len = Math.min(1.8, Math.max(0.25, 0.9 / Math.max(log.length(), 0.4)));
    const pos = tail.geometry.getAttribute('position') as THREE.BufferAttribute;
    const N = pos.count;
    let s = def.id.length * 97;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      s = (s * 16807) % 2147483647;
      const jitter = ((s % 1000) / 1000 - 0.5) * 0.04 * t;
      // 尾在局部坐标：核在 0，沿 away 延伸
      pos.array[i * 3] = away.x * len * t + jitter;
      pos.array[i * 3 + 1] = away.y * len * t + jitter * 0.5;
      pos.array[i * 3 + 2] = away.z * len * t - jitter;
    }
    pos.needsUpdate = true;
  }

  private applyLocal(id: CometId) {
    const log = this.logical.get(id)!;
    const g = this.meshes.get(id)!;
    g.position.set(
      log.x - this.floatingOrigin.x,
      log.y - this.floatingOrigin.y,
      log.z - this.floatingOrigin.z,
    );
  }

  setFloatingOrigin(next: THREE.Vector3): THREE.Vector3 {
    const delta = this.tmp.copy(next).sub(this.floatingOrigin);
    if (delta.lengthSq() < 1e-18) return this.tmp.set(0, 0, 0);
    this.floatingOrigin.copy(next);
    for (const def of COMETS) this.applyLocal(def.id);
    return delta;
  }

  /** 与行星共用同一 FO 时直接同步原点 */
  syncOrigin(origin: THREE.Vector3) {
    this.floatingOrigin.copy(origin);
    for (const def of COMETS) this.applyLocal(def.id);
  }

  getWorldPos(id: CometId, out = new THREE.Vector3()) {
    const g = this.meshes.get(id);
    if (!g) return out.set(0, 0, 0);
    return g.getWorldPosition(out);
  }

  getLogicalPos(id: CometId, out = new THREE.Vector3()) {
    return out.copy(this.logical.get(id)!);
  }

  getDef(id: CometId): CometDef {
    return COMETS.find((c) => c.id == id)!;
  }

  setRootVisible(v: boolean) {
    this.root.visible = v;
  }

  /** 反日方向单位向量（世界），用于跟随彗尾视角 */
  antiSunDir(id: CometId, out = new THREE.Vector3()) {
    const log = this.logical.get(id)!;
    return out.copy(log).normalize();
  }
}
