import * as THREE from 'three';
import { BODY_BY_ID, type BodyId } from './constants';
import type { BodySystem } from './bodies';
import type { StarSystem, StarId } from './stars';
import { NEARBY_STARS } from './stars';
import type { ScaleMode } from './scale';

function fmtSunDistAu(au: number): string {
  if (au < 0.001) return `${(au * 149597870.7).toFixed(0)} km`;
  if (au < 0.1) return `${au.toFixed(4)} AU`;
  return `${au.toFixed(3)} AU`;
}

function fmtSunDistLy(ly: number): string {
  if (ly <= 0) return '0 ly';
  if (ly < 10) return `${ly.toFixed(2)} ly`;
  return `${ly.toFixed(1)} ly`;
}

/** 场景旁名称标签：距太阳距离；视野内可点跳转 */
export class BodyLabels {
  private root: HTMLElement;
  private bodyEls = new Map<BodyId, HTMLDivElement>();
  private starEls = new Map<StarId, HTMLDivElement>();
  private world = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private onGotoBody: ((id: BodyId) => void) | null = null;
  private onGotoStar: ((id: StarId) => void) | null = null;

  constructor(_hudRoot: HTMLElement) {
    let box = document.getElementById('sp-labels') as HTMLElement | null;
    if (!box) {
      box = document.createElement('div');
      box.id = 'sp-labels';
      document.body.appendChild(box);
    }
    box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9;overflow:hidden;';
    this.root = box;
    if (box.parentElement != document.body) document.body.appendChild(box);
  }

  bind(onGotoBody: (id: BodyId) => void, onGotoStar: (id: StarId) => void) {
    this.onGotoBody = onGotoBody;
    this.onGotoStar = onGotoStar;
  }

  private bodyEl(id: BodyId) {
    let n = this.bodyEls.get(id);
    if (n) return n;
    n = document.createElement('div');
    n.className = 'sp-label';
    n.dataset.id = id;
    n.innerHTML = `<span class="sp-label-name"></span><span class="sp-label-dist"></span>`;
    n.style.cssText =
      'position:fixed;display:none;transform:translate(-50%,-120%);white-space:nowrap;pointer-events:auto;cursor:pointer;';
    n.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onGotoBody?.(id);
    });
    this.root.appendChild(n);
    this.bodyEls.set(id, n);
    return n;
  }

  private starEl(id: StarId) {
    let n = this.starEls.get(id);
    if (n) return n;
    n = document.createElement('div');
    n.className = 'sp-label';
    n.dataset.star = id;
    n.innerHTML = `<span class="sp-label-name"></span><span class="sp-label-dist"></span>`;
    n.style.cssText =
      'position:fixed;display:none;transform:translate(-50%,-120%);white-space:nowrap;pointer-events:auto;cursor:pointer;';
    n.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onGotoStar?.(id);
    });
    this.root.appendChild(n);
    this.starEls.set(id, n);
    return n;
  }

  private hideAll() {
    for (const el of this.bodyEls.values()) el.style.display = 'none';
    for (const el of this.starEls.values()) el.style.display = 'none';
  }

  private projectLabel(
    el: HTMLDivElement,
    world: THREE.Vector3,
    lift: number,
    camera: THREE.PerspectiveCamera,
    isFocus: boolean,
    name: string,
    distText: string,
  ): boolean {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.projected.copy(world);
    this.projected.y += lift;
    this.projected.project(camera);
    if (
      this.projected.z < -1 ||
      this.projected.z > 1 ||
      this.projected.x < -1.05 ||
      this.projected.x > 1.05 ||
      this.projected.y < -1.05 ||
      this.projected.y > 1.05
    ) {
      el.style.display = 'none';
      return false;
    }
    const x = (this.projected.x * 0.5 + 0.5) * w;
    const y = (-this.projected.y * 0.5 + 0.5) * h;
    // 避开顶栏/侧栏大致区域以外的贴边挤压可后续再做；先保证可见
    el.style.display = 'block';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.toggle('is-focus', isFocus);
    el.classList.toggle('is-dim', !isFocus);
    const nameEl = el.querySelector('.sp-label-name');
    const distEl = el.querySelector('.sp-label-dist');
    if (nameEl) nameEl.textContent = name;
    if (distEl) distEl.textContent = distText;
    return true;
  }

  update(
    bodies: BodySystem,
    stars: StarSystem,
    camera: THREE.PerspectiveCamera,
    scaleMode: ScaleMode,
    focus: BodyId,
    starFocus: StarId,
    _canvas: HTMLCanvasElement,
  ) {
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    this.hideAll();

    if (scaleMode == 'stellar') {
      for (const def of NEARBY_STARS) {
        const el = this.starEl(def.id);
        stars.getWorldPos(def.id, this.world);
        const dist = fmtSunDistLy(def.distLy);
        this.projectLabel(
          el,
          this.world,
          def.visualRadius * 1.4,
          camera,
          def.id == starFocus,
          def.nameZh,
          dist,
        );
      }
      return;
    }

    // 主星视野内都标；卫星只标当前聚焦族
    for (const def of Object.values(BODY_BY_ID)) {
      if (def.moonOf) {
        const fam = focus == def.id || focus == def.moonOf || BODY_BY_ID[focus]?.parent == def.moonOf;
        if (!fam) continue;
      }

      const el = this.bodyEl(def.id);
      bodies.getWorldPos(def.id, this.world);
      const log = bodies.getLogicalPos(def.id);
      const au = Math.sqrt(log.x * log.x + log.y * log.y + log.z * log.z);
      this.projectLabel(
        el,
        this.world,
        def.visualRadius * 1.6,
        camera,
        def.id == focus,
        def.name,
        fmtSunDistAu(au),
      );
    }
  }
}
