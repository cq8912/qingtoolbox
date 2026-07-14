import * as THREE from 'three';
import {
  NEARBY_STARS,
  STAR_BY_ID,
  starLogicalXYZ,
  type StarDef,
  type StarId,
} from './starCatalog';
import { createTintedStarGroup } from './materials';

export type { StarDef, StarId };
export { NEARBY_STARS, STAR_BY_ID, DEST_STARS, starDistLy } from './starCatalog';

export function starLogicalFromSky(
  raHours: number,
  decDeg: number,
  distLy: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  if (distLy <= 0) return out.set(0, 0, 0);
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const c = Math.cos(dec);
  return out.set(distLy * c * Math.cos(ra), distLy * Math.sin(dec), distLy * c * Math.sin(ra));
}

export function starLogicalPos(def: StarDef, out = new THREE.Vector3()): THREE.Vector3 {
  const p = starLogicalXYZ(def);
  return out.set(p.x, p.y, p.z);
}

export interface StarMeshes {
  group: THREE.Group;
  core: THREE.Object3D | null;
}

type TickFn = (t: number) => void;

const DIST_RINGS_LY = [5, 10, 25];

/** 星域网格：太阳贴图染色 + 软光晕；ly 尺度环 + Sol→目标连线 */
export class StarSystem {
  root = new THREE.Group();
  meshes = new Map<StarId, StarMeshes>();
  logical = new Map<StarId, THREE.Vector3>();
  floatingOrigin = new THREE.Vector3();
  private ticks: TickFn[] = [];
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private ringGroup = new THREE.Group();
  private linkLine: THREE.Line;
  private linkAttr: THREE.BufferAttribute;

  constructor(scene: THREE.Scene, sunMap: THREE.Texture) {
    this.root.visible = false;
    scene.add(this.root);
    for (const def of NEARBY_STARS) {
      this.logical.set(def.id, starLogicalPos(def));
      this.meshes.set(def.id, this.createStar(def, sunMap));
      this.applyLocal(def.id);
    }
    this.buildDistanceRings();
    this.root.add(this.ringGroup);

    const linkPos = new Float32Array(6);
    const geo = new THREE.BufferGeometry();
    this.linkAttr = new THREE.BufferAttribute(linkPos, 3);
    geo.setAttribute('position', this.linkAttr);
    this.linkLine = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffc857,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.linkLine.frustumCulled = false;
    this.root.add(this.linkLine);
  }

  private buildDistanceRings() {
    for (const r of DIST_RINGS_LY) {
      const pts = 96;
      const arr = new Float32Array((pts + 1) * 3);
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        arr[i * 3] = Math.cos(a) * r;
        arr[i * 3 + 1] = 0;
        arr[i * 3 + 2] = Math.sin(a) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const line = new THREE.LineLoop(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x3d5a72,
          transparent: true,
          opacity: r == 10 ? 0.28 : 0.16,
          depthWrite: false,
        }),
      );
      this.ringGroup.add(line);
    }
  }

  private createStar(def: StarDef, sunMap: THREE.Texture): StarMeshes {
    // 视觉球略缩小，停靠再拉远，避免一进星就占满屏
    const r = def.visualRadius * 0.72;
    const star = createTintedStarGroup(r, sunMap, def.color, def.glow * 0.75);
    star.group.name = def.id;
    this.root.add(star.group);
    this.ticks.push((t) => star.update(t));
    return { group: star.group, core: star.group };
  }

  tick(t: number) {
    for (const fn of this.ticks) fn(t);
  }

  setVisible(v: boolean) {
    this.root.visible = v;
  }

  /** 更新太阳→焦点连线（场景坐标） */
  updateLink(focusId: StarId) {
    this.getWorldPos('sol', this.tmp);
    this.getWorldPos(focusId, this.tmp2);
    this.linkAttr.setXYZ(0, this.tmp.x, this.tmp.y, this.tmp.z);
    this.linkAttr.setXYZ(1, this.tmp2.x, this.tmp2.y, this.tmp2.z);
    this.linkAttr.needsUpdate = true;
    this.linkLine.visible = focusId != 'sol';
  }

  private applyLocal(id: StarId) {
    const log = this.logical.get(id)!;
    const g = this.meshes.get(id)!.group;
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
    for (const def of NEARBY_STARS) this.applyLocal(def.id);
    this.ringGroup.position.set(-this.floatingOrigin.x, -this.floatingOrigin.y, -this.floatingOrigin.z);
    return delta;
  }

  getLogicalPos(id: StarId, out = new THREE.Vector3()): THREE.Vector3 {
    const log = this.logical.get(id);
    if (!log) return out.set(0, 0, 0);
    return out.copy(log);
  }

  getWorldPos(id: StarId, out = new THREE.Vector3()): THREE.Vector3 {
    const g = this.meshes.get(id)?.group;
    if (!g) return out.set(0, 0, 0);
    return g.getWorldPosition(out);
  }

  getDef(id: StarId): StarDef {
    return STAR_BY_ID[id];
  }
}
