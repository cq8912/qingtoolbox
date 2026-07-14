import * as THREE from 'three';
import { BODIES, type BodyId, type BodyDef } from './constants';
import { bodyPosition, sampleMoonOrbit, sampleOrbit, type Vec3 } from './astronomy';
import type { SpaceTextures } from './textures';
import { createEarthGroup, createSunGroup } from './materials';

export interface BodyMeshes {
  group: THREE.Group;
  mesh: THREE.Mesh | null;
}

type TickFn = (t: number, sunWorld: THREE.Vector3) => void;

export class BodySystem {
  root = new THREE.Group();
  meshes = new Map<BodyId, BodyMeshes>();
  orbitLines = new Map<BodyId, THREE.Line>();
  private orbitVisible = true;
  private ticks: TickFn[] = [];
  private sunWorld = new THREE.Vector3(0, 0, 0);

  constructor(
    scene: THREE.Scene,
    private tex: SpaceTextures,
  ) {
    scene.add(this.root);
    for (const def of BODIES) {
      this.meshes.set(def.id, this.createBody(def));
    }
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
      // 环 UV：径向映射到贴图
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

    // 行星后绘制，正确遮挡太阳
    group.renderOrder = 10;
    this.root.add(group);
    return { group, mesh };
  }

  tick(t: number) {
    for (const fn of this.ticks) fn(t, this.sunWorld);
  }

  updatePositions(when: Date, rebuildOrbits = false) {
    for (const def of BODIES) {
      const item = this.meshes.get(def.id)!;
      const p = bodyPosition(def.id, def.astro, when);
      item.group.position.set(p.x, p.y, p.z);
    }
    // 月球朝向地球（潮汐锁定近似）
    const moon = this.meshes.get('moon')?.group;
    const earth = this.meshes.get('earth')?.group;
    if (moon && earth) moon.lookAt(earth.position);

    if (rebuildOrbits) this.buildOrbits(when);
  }

  buildOrbits(when: Date) {
    for (const line of this.orbitLines.values()) {
      this.root.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.orbitLines.clear();

    for (const def of BODIES) {
      if (!def.astro || def.periodDays <= 0) continue;
      const pts =
        def.id == 'moon' ? sampleMoonOrbit(when, 96) : sampleOrbit(def.astro, when, def.periodDays, 200);
      const line = makeOrbitLine(pts, def.id == 'moon' ? 0x8aa0b8 : 0x3d5a72);
      line.visible = this.orbitVisible;
      this.orbitLines.set(def.id, line);
      this.root.add(line);
    }
  }

  setOrbitsVisible(v: boolean) {
    this.orbitVisible = v;
    for (const line of this.orbitLines.values()) line.visible = v;
  }

  getWorldPos(id: BodyId, out = new THREE.Vector3()): THREE.Vector3 {
    const g = this.meshes.get(id)?.group;
    if (!g) return out.set(0, 0, 0);
    return g.getWorldPosition(out);
  }

  getDef(id: BodyId): BodyDef {
    return BODIES.find((b) => b.id == id)!;
  }
}

function makeOrbitLine(pts: Vec3[], color: number): THREE.Line {
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
    opacity: 0.28,
    depthWrite: false,
  });
  return new THREE.Line(geo, mat);
}
