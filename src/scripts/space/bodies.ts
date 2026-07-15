import * as THREE from 'three';
import { BODIES, BODY_BY_ID, type BodyId, type BodyDef } from './constants';
import { bodyPosition, sampleOrbit, sampleSatelliteOrbitRel, type Vec3 } from './astronomy';
import type { SpaceTextures } from './textures';
import { createEarthGroup, createSunGroup } from './materials';

/** 轻量程序化卫星贴图（无 2K 资源时用） */
function makeMoonCanvasTex(baseColor: number, seed: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  let s = seed || 1;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const rad = 0.4 + rnd() * 3.5;
    const k = 0.55 + rnd() * 0.55;
    ctx.fillStyle = `rgba(${r * k | 0},${g * k | 0},${b * k | 0},${0.15 + rnd() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // 赤道条带微扰
  for (let y = 0; y < size; y += 2) {
    const shade = 0.85 + rnd() * 0.25;
    ctx.fillStyle = `rgba(${r * shade | 0},${g * shade | 0},${b * shade | 0},0.08)`;
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface BodyMeshes {
  group: THREE.Group;
  mesh: THREE.Mesh | null;
}

type TickFn = (t: number, sunWorld: THREE.Vector3) => void;

export class BodySystem {
  root = new THREE.Group();
  meshes = new Map<BodyId, BodyMeshes>();
  orbitLines = new Map<BodyId, THREE.LineLoop>();
  /** 日心逻辑坐标（未扣 Floating Origin） */
  logical = new Map<BodyId, THREE.Vector3>();
  floatingOrigin = new THREE.Vector3();
  private orbitVisible = true;
  private ticks: TickFn[] = [];
  /** 太阳的场景世界坐标（已扣 FO），供光照 / 地球着色 */
  private sunScene = new THREE.Vector3(0, 0, 0);
  private sunLight: THREE.PointLight | null = null;
  private tmp = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private tex: SpaceTextures,
  ) {
    scene.add(this.root);
    for (const def of BODIES) {
      this.logical.set(def.id, new THREE.Vector3());
      this.meshes.set(def.id, this.createBody(def));
    }
  }

  /** 点光跟随太阳网格；FO 重设后也要同步 */
  attachSunLight(light: THREE.PointLight) {
    this.sunLight = light;
    this.syncSunLight();
  }

  private syncSunLight() {
    this.getWorldPos('sun', this.sunScene);
    if (this.sunLight) this.sunLight.position.copy(this.sunScene);
  }

  private mapFor(id: BodyId): THREE.Texture | null {
    const t = this.tex;
    switch (id) {
      case 'mercury':
        return t.mercury;
      case 'venus':
        return t.venus;
      case 'mars':
        return t.mars;
      case 'jupiter':
        return t.jupiter;
      case 'saturn':
        return t.saturn;
      case 'uranus':
        return t.uranus;
      case 'neptune':
        return t.neptune;
      case 'moon':
        return t.moon;
      default:
        return null;
    }
  }

  private createBody(def: BodyDef): BodyMeshes {
    const group = new THREE.Group();
    group.name = def.id;
    let mesh: THREE.Mesh | null = null;

    if (def.id == 'sun') {
      const sun = createSunGroup(def.visualRadius, this.tex.sun);
      sun.group.renderOrder = 0;
      group.add(sun.group);
      this.ticks.push((t) => sun.update(t));
    } else if (def.id == 'earth') {
      const earth = createEarthGroup(def.visualRadius, {
        day: this.tex.earthDay,
        night: this.tex.earthNight,
        clouds: this.tex.earthClouds,
        normal: this.tex.earthNormal,
        spec: this.tex.earthSpec,
      });
      group.add(earth.group);
      this.ticks.push((t, sun) => earth.update(t, sun));
    } else if (def.id == 'moon') {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(def.visualRadius, 96, 64),
        new THREE.MeshStandardMaterial({
          map: this.tex.moon,
          bumpMap: this.tex.moonBump,
          bumpScale: def.visualRadius * 0.08,
          roughness: 0.95,
          metalness: 0.02,
        }),
      );
      group.add(mesh);
    } else if (def.moonOf) {
      const map = makeMoonCanvasTex(def.color, def.id.length * 97 + def.visualRadius * 1e5);
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(def.visualRadius, 48, 32),
        new THREE.MeshStandardMaterial({
          map,
          color: 0xffffff,
          roughness: 0.86,
          metalness: 0.04,
          emissive: new THREE.Color(def.color),
          emissiveIntensity: 0.05,
        }),
      );
      group.add(mesh);
    } else if (def.id == 'venus') {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(def.visualRadius, 64, 48),
        new THREE.MeshStandardMaterial({
          map: this.tex.venus,
          roughness: 0.85,
          metalness: 0.05,
        }),
      );
      group.add(mesh);
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(def.visualRadius * 1.015, 48, 32),
        new THREE.MeshStandardMaterial({
          map: this.tex.venusCloud,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          roughness: 1,
        }),
      );
      group.add(cloud);
      this.ticks.push((t) => {
        mesh!.rotation.y = t * 0.02;
        cloud.rotation.y = t * 0.03;
      });
    } else {
      const map = this.mapFor(def.id);
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(def.visualRadius, 64, 48),
        new THREE.MeshStandardMaterial({
          map: map || undefined,
          color: map ? 0xffffff : def.color,
          roughness: 0.78,
          metalness: 0.05,
        }),
      );
      group.add(mesh);
      const spin = def.id == 'jupiter' || def.id == 'saturn' ? 0.12 : 0.04;
      this.ticks.push((t) => {
        if (mesh) mesh.rotation.y = t * spin;
      });
    }

    if (def.hasRings) {
      const ringGeo = new THREE.RingGeometry(def.visualRadius * 1.35, def.visualRadius * 2.4, 96);
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const r = Math.sqrt(x * x + y * y);
        const u = (r - def.visualRadius * 1.35) / (def.visualRadius * (2.4 - 1.35));
        uv.setXY(i, u, 0.5);
      }
      uv.needsUpdate = true;
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          map: this.tex.saturnRing,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2.35;
      group.add(ring);
    }

    group.renderOrder = def.parent ? 12 : 10;
    this.root.add(group);
    return { group, mesh };
  }

  tick(t: number) {
    this.syncSunLight();
    for (const fn of this.ticks) fn(t, this.sunScene);
  }

  updatePositions(when: Date, rebuildOrbits = false) {
    for (const def of BODIES) {
      const p = bodyPosition(def.id, def.astro, when);
      const log = this.logical.get(def.id)!;
      log.set(p.x, p.y, p.z);
      this.applyLocal(def.id);
    }
    this.syncSunLight();

    // 潮汐锁定：卫星朝向父星（世界坐标）
    for (const def of BODIES) {
      if (!def.parent) continue;
      const moon = this.meshes.get(def.id)?.group;
      const parent = this.meshes.get(def.parent)?.group;
      if (moon && parent) {
        parent.getWorldPosition(this.tmp);
        moon.lookAt(this.tmp);
      }
    }

    if (rebuildOrbits) this.buildOrbits(when);
  }

  /** 将逻辑坐标应用到 mesh（扣掉 floating origin） */
  private applyLocal(id: BodyId) {
    const log = this.logical.get(id)!;
    const g = this.meshes.get(id)!.group;
    g.position.set(
      log.x - this.floatingOrigin.x,
      log.y - this.floatingOrigin.y,
      log.z - this.floatingOrigin.z,
    );
  }

  /**
   * 重设 Floating Origin；返回位移量 delta（新 - 旧），调用方需同步平移相机
   */
  setFloatingOrigin(next: THREE.Vector3): THREE.Vector3 {
    const delta = this.tmp.copy(next).sub(this.floatingOrigin);
    if (delta.lengthSq() < 1e-18) return this.tmp.set(0, 0, 0);
    this.floatingOrigin.copy(next);
    for (const def of BODIES) this.applyLocal(def.id);
    this.syncSunLight();
    // 仅行星日心轨道需补偿 FO；卫星环挂在父星下，跟着走
    for (const [id, line] of this.orbitLines) {
      const def = BODY_BY_ID[id as BodyId];
      if (def?.parent) continue;
      line.position.set(-this.floatingOrigin.x, -this.floatingOrigin.y, -this.floatingOrigin.z);
    }
    return delta;
  }

  getLogicalPos(id: BodyId, out = new THREE.Vector3()): THREE.Vector3 {
    const log = this.logical.get(id);
    if (!log) return out.set(0, 0, 0);
    return out.copy(log);
  }

  buildOrbits(when: Date) {
    for (const line of this.orbitLines.values()) {
      line.parent?.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.orbitLines.clear();

    for (const def of BODIES) {
      if (def.periodDays <= 0) continue;
      if (!def.astro && !def.parent) continue;

      if (def.parent) {
        // 卫星环：相对父星本地坐标，挂到父星 group → 跟着行星跑
        const pts = sampleSatelliteOrbitRel(def.id, when, 96);
        if (!pts.length) continue;
        const line = makeOrbitLine(pts, 0x8aa0b8);
        line.visible = this.orbitVisible;
        this.orbitLines.set(def.id, line);
        this.meshes.get(def.parent)!.group.add(line);
        continue;
      }

      if (!def.astro) continue;
      const pts = sampleOrbit(def.astro, when, def.periodDays, 200);
      if (!pts.length) continue;
      const line = makeOrbitLine(pts, 0x3d5a72);
      line.position.set(-this.floatingOrigin.x, -this.floatingOrigin.y, -this.floatingOrigin.z);
      line.visible = this.orbitVisible;
      this.orbitLines.set(def.id, line);
      this.root.add(line);
    }
  }

  setOrbitsVisible(v: boolean) {
    this.orbitVisible = v;
    for (const line of this.orbitLines.values()) line.visible = v && this.root.visible;
  }

  /** 尺度切换：整棵太阳系树显隐 */
  setRootVisible(v: boolean) {
    this.root.visible = v;
    for (const line of this.orbitLines.values()) line.visible = v && this.orbitVisible;
  }

  /** 场景世界坐标（已含 Floating Origin） */
  getWorldPos(id: BodyId, out = new THREE.Vector3()): THREE.Vector3 {
    const g = this.meshes.get(id)?.group;
    if (!g) return out.set(0, 0, 0);
    return g.getWorldPosition(out);
  }

  getDef(id: BodyId): BodyDef {
    return BODIES.find((b) => b.id == id)!;
  }
}

function makeOrbitLine(pts: Vec3[], color: number): THREE.LineLoop {
  // 已含闭合点，LineLoop 再保险连一次首尾
  const arr = new Float32Array(pts.length * 3);
  for (let i = 0; i < pts.length; i++) {
    arr[i * 3] = pts[i].x;
    arr[i * 3 + 1] = pts[i].y;
    arr[i * 3 + 2] = pts[i].z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  return new THREE.LineLoop(geo, mat);
}
