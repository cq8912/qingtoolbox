import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C_AU_PER_S, BODIES, type BodyId } from './constants';
import type { BodySystem } from './bodies';
import type { TravelTrail } from './minimap';

export type CamMode = 'observe' | 'fly' | 'travel' | 'tour' | 'facesun';

export class CameraController {
  mode: CamMode = 'observe';
  speedMult = 1;
  focus: BodyId = 'earth';
  currentSpeedAu = 0;
  touring = false;
  travelTrail: TravelTrail | null = null;
  /** 跃迁目标（飞行过程中 focus 不变，避免逻辑错乱） */
  travelDestId: BodyId = 'earth';

  private orbit: OrbitControls;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;

  private travelFrom = new THREE.Vector3();
  private travelMid = new THREE.Vector3();
  private travelPivotStart = new THREE.Vector3();
  private travelViewDir = new THREE.Vector3();
  private travelViewDist = 0;
  private travelFromQuat = new THREE.Quaternion();
  private travelT = 0;
  private travelDur = 1;
  private travelDone: (() => void) | null = null;
  /** 跃迁分镜：起步停顿 → 加速飞行 → 到达缓停 */
  private travelPhase: 'hold' | 'move' | 'settle' = 'move';
  private travelHold = 0;
  private travelSettle = 0;
  private travelSettlePos = new THREE.Vector3();
  private baseFov = 58;
  private matLook = new THREE.Matrix4();

  private tourIndex = 0;
  private tourSpin = 0;
  private tourRadius = 0.1;
  private tourPhase: 'goto' | 'spin' = 'goto';

  /** 面向太阳：绕当前轨道中心旋转，距离不变，始终注视中心天体 */
  private faceSunHold = false;
  private faceSunDist = 0;
  private faceSunFromDir = new THREE.Vector3();
  private faceSunToDir = new THREE.Vector3();
  private faceSunPivotOffset = new THREE.Vector3();
  private faceSunT = 0;
  private faceSunDur = 1;

  private lookQuat = new THREE.Quaternion();

  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmp3 = new THREE.Vector3();
  private sunPos = new THREE.Vector3(0, 0, 0);

  constructor(
    private camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    private bodies: BodySystem,
  ) {
    this.orbit = new OrbitControls(camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.rotateSpeed = 0.6;
    this.orbit.zoomSpeed = 1.05;
    this.orbit.panSpeed = 0.45;
    this.orbit.enablePan = true;
    this.orbit.screenSpacePanning = true;
    this.orbit.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.orbit.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.orbit.addEventListener('start', () => {
      this.faceSunHold = false;
    });

    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    let flyDrag = false;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode != 'fly') return;
      flyDrag = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!flyDrag || this.mode != 'fly') return;
      this.yaw -= (e.clientX - lastX) * 0.003;
      this.pitch -= (e.clientY - lastY) * 0.003;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
      lastX = e.clientX;
      lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', () => {
      flyDrag = false;
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag == 'INPUT' || tag == 'SELECT' || tag == 'TEXTAREA') return;
      this.keys.add(e.code);
      if (e.code == 'KeyF') {
        this.stopTour();
        this.setMode(this.mode == 'fly' ? 'observe' : 'fly');
      }
      if (e.code == 'KeyT') this.toggleTour();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.focus = 'earth';
    const target = this.bodies.getWorldPos('earth', this.tmp);
    const dist = Math.max(this.bodies.getDef('earth').visualRadius * 12, 0.035);
    this.orbit.target.copy(target);
    this.camera.position.set(target.x + dist * 0.65, target.y + dist * 0.35, target.z + dist);
    this.orbit.update();
    this.baseFov = camera.fov;
  }

  /** 背阳侧略偏：星球在前景，太阳从侧后方露出（不透过夜面看太阳） */
  private sunOffsetDir(pivot: THREE.Vector3, out: THREE.Vector3) {
    const away = out.copy(pivot).sub(this.sunPos);
    if (away.lengthSq() < 1e-12) away.set(0, 0, 1);
    away.normalize();
    let side = this.tmp2.set(0, 1, 0).cross(away);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    return out.copy(away).multiplyScalar(0.9).addScaledVector(side, 0.32).normalize();
  }

  /** 按当前中心 + 固定距离/方向放置相机，注视中心 */
  private applyFaceSunPose(pivot: THREE.Vector3, dir: THREE.Vector3) {
    this.camera.position.copy(pivot).addScaledVector(dir, this.faceSunDist);
    this.camera.lookAt(pivot);
  }

  /** 从当前四元数平滑转向「看向 target」，不改写 target（避免 tmp 复用踩踏） */
  private slerpLookAt(fromQ: THREE.Quaternion, pos: THREE.Vector3, target: THREE.Vector3, t: number) {
    if (t <= 0) {
      this.camera.quaternion.copy(fromQ);
      return;
    }
    this.matLook.lookAt(pos, target, UP);
    this.lookQuat.setFromRotationMatrix(this.matLook);
    if (t >= 1) {
      this.camera.quaternion.copy(this.lookQuat);
      return;
    }
    this.camera.quaternion.copy(fromQ).slerp(this.lookQuat, t);
  }

  private resetFov() {
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  /** 跃迁弧线控制点：抬高并绕开太阳，避免路径穿过 (0,0,0) */
  private buildTravelMid(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3) {
    const SUN_CLR = 1.25;
    out.copy(from).lerp(to, 0.5);
    const chord = from.distanceTo(to);
    const lift = Math.min(4.5, Math.max(0.2, chord * 0.38));
    out.y += lift;

    let r = out.length();
    if (r < SUN_CLR) {
      if (r < 1e-5) {
        out.set(0, SUN_CLR, 0);
      } else {
        out.multiplyScalar(SUN_CLR / r);
      }
    }

    const a = this.tmp.copy(from).normalize();
    const b = this.tmp2.copy(to).normalize();
    if (a.lengthSq() > 1e-6 && b.lengthSq() > 1e-6 && a.dot(b) < 0.25) {
      const outer = Math.max(from.length(), to.length(), SUN_CLR) * 1.2;
      const midDir = a.add(b);
      if (midDir.lengthSq() < 1e-6) midDir.set(0, 1, 0);
      midDir.normalize();
      out.copy(midDir).multiplyScalar(outer);
      out.y += lift * 0.8;
    }
    return out;
  }

  private travelEndPos(destPivot: THREE.Vector3, out: THREE.Vector3) {
    return out.copy(destPivot).addScaledVector(this.travelViewDir, this.travelViewDist);
  }

  getAdaptiveSpeedAu(): number {
    const def = this.bodies.getDef(this.focus);
    const dist = this.camera.position.distanceTo(this.bodies.getWorldPos(this.focus, this.tmp));
    const base = Math.max(dist * 0.55, def.visualRadius * 35, 0.015);
    return base * this.speedMult;
  }

  setMode(m: CamMode) {
    if (m != 'tour') this.touring = false;
    this.mode = m;
    this.faceSunHold = false;
    this.orbit.enabled = m == 'observe';
    if (m == 'observe') this.syncOrbitFromCamera();
    if (m == 'fly') this.syncFlyAngles();
  }

  setFocus(id: BodyId) {
    this.focus = id;
    if (this.mode == 'observe') {
      this.bodies.getWorldPos(id, this.tmp);
      this.orbit.target.copy(this.tmp);
      this.orbit.minDistance = Math.max(this.bodies.getDef(id).visualRadius * 1.6, 0.0005);
    }
  }

  /** 绕当前轨道中心旋转，保持距离，直到背阳构图（始终看见中心天体） */
  faceSun() {
    this.stopTour();
    this.faceSunHold = false;

    const planet = this.bodies.getWorldPos(this.focus, this.tmp);
    const pivot = this.tmp2.copy(this.orbit.target);
    this.faceSunPivotOffset.copy(pivot).sub(planet);

    const offset = this.tmp3.copy(this.camera.position).sub(pivot);
    const dist = offset.length();
    if (dist < 1e-6) return;

    this.faceSunDist = dist;
    this.faceSunFromDir.copy(offset).normalize();

    if (this.focus == 'sun') {
      this.faceSunToDir.set(0, 0.12, 1).normalize();
    } else {
      this.sunOffsetDir(pivot, this.faceSunToDir);
    }

    const dot = Math.max(-1, Math.min(1, this.faceSunFromDir.dot(this.faceSunToDir)));
    const angle = Math.acos(dot);
    this.faceSunT = 0;
    this.faceSunDur = Math.min(3.2, Math.max(0.9, angle / Math.PI * 2.8));

    this.mode = 'facesun';
    this.orbit.enabled = false;
    this.travelTrail = null;
  }

  private faceSunPivot(out: THREE.Vector3) {
    const planet = this.bodies.getWorldPos(this.focus, this.tmp);
    return out.copy(planet).add(this.faceSunPivotOffset);
  }

  toggleTour() {
    if (this.touring) this.stopTour();
    else this.startTour();
  }

  startTour() {
    this.touring = true;
    this.tourIndex = BODIES.findIndex((b) => b.id == this.focus);
    if (this.tourIndex < 0) this.tourIndex = 0;
    this.tourPhase = 'goto';
    this.mode = 'tour';
    this.orbit.enabled = false;
    this.gotoTourBody();
  }

  stopTour() {
    this.touring = false;
    if (this.mode == 'tour') {
      this.mode = 'observe';
      this.orbit.enabled = true;
      this.syncOrbitFromCamera();
    }
  }

  private gotoTourBody() {
    const id = BODIES[this.tourIndex].id;
    this.travelTo(id, () => {
      if (!this.touring) return;
      this.focus = id;
      this.tourPhase = 'spin';
      this.tourSpin = 0;
      this.mode = 'tour';
      this.orbit.enabled = false;
      const def = this.bodies.getDef(id);
      this.tourRadius = Math.max(def.visualRadius * 11, 0.04);
    });
  }

  /** 从当前位置/视角/相对偏移，弧线飞往目标天体 */
  travelTo(id: BodyId, onDone?: () => void) {
    this.faceSunHold = false;
    this.travelDestId = id;
    this.mode = 'travel';
    this.orbit.enabled = false;

    this.travelFrom.copy(this.camera.position);
    this.travelPivotStart.copy(this.orbit.target);
    this.travelFromQuat.copy(this.camera.quaternion);

    const off = this.tmp.copy(this.camera.position).sub(this.travelPivotStart);
    this.travelViewDist = off.length();
    if (this.travelViewDist < 1e-6) {
      this.travelViewDir.set(0.65, 0.35, 1).normalize();
      this.travelViewDist = 0.035;
    } else {
      this.travelViewDir.copy(off).normalize();
    }
    const destDef = this.bodies.getDef(id);
    const maxView = Math.max(destDef.visualRadius * 14, 0.04);
    if (this.travelViewDist > maxView * 2.5) this.travelViewDist = maxView * 2.5;

    const dest = this.bodies.getWorldPos(id, this.tmp);
    const endPos = this.travelEndPos(dest, this.tmp2);
    this.buildTravelMid(this.travelFrom, endPos, this.travelMid);

    this.travelT = 0;
    const dist = this.travelFrom.distanceTo(endPos);
    this.travelDur = Math.min(6.2, Math.max(1.8, Math.log10(dist + 1) * 2.0 + dist * 0.18));
    this.travelPhase = 'hold';
    this.travelHold = 0.35;

    this.travelTrail = {
      from: this.travelFrom.clone(),
      mid: this.travelMid.clone(),
      to: endPos.clone(),
      progress: 0,
    };
    this.travelDone = onDone || null;
  }

  private syncOrbitFromCamera() {
    const def = this.bodies.getDef(this.focus);
    this.bodies.getWorldPos(this.focus, this.tmp);
    this.orbit.target.copy(this.tmp);
    this.orbit.minDistance = Math.max(def.visualRadius * 1.6, 0.0005);
    this.orbit.maxDistance = 120;
    this.orbit.update();
  }

  private syncFlyAngles() {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = e.y;
    this.pitch = e.x;
  }

  private finishTravel() {
    const done = this.travelDone;
    this.travelDone = null;
    this.travelTrail = null;
    this.travelPhase = 'move';
    this.resetFov();

    if (this.touring && this.tourPhase == 'goto') {
      done?.();
      return;
    }
    if (!this.touring) {
      this.focus = this.travelDestId;
      this.mode = 'observe';
      this.orbit.enabled = true;
      this.bodies.getWorldPos(this.travelDestId, this.tmp);
      this.orbit.target.copy(this.tmp);
      this.orbit.minDistance = Math.max(this.bodies.getDef(this.travelDestId).visualRadius * 1.6, 0.0005);
    }
    done?.();
  }

  update(dt: number) {
    this.currentSpeedAu = this.getAdaptiveSpeedAu();

    if (this.mode == 'facesun') {
      this.faceSunT += dt / this.faceSunDur;
      const t = easeInOutCubic(Math.min(1, this.faceSunT));
      const pivot = this.faceSunPivot(this.tmp);

      const dir = slerpDir(this.faceSunFromDir, this.faceSunToDir, t, this.tmp3);
      this.applyFaceSunPose(pivot, dir);

      if (this.faceSunT >= 1) {
        this.mode = 'observe';
        this.orbit.enabled = true;
        this.faceSunHold = true;
        this.orbit.target.copy(pivot);
        this.orbit.minDistance = Math.max(this.bodies.getDef(this.focus).visualRadius * 1.6, 0.0005);
      }
      return;
    }

    if (this.mode == 'travel') {
      const destPivot = this.bodies.getWorldPos(this.travelDestId, this.tmp);
      const endPos = this.travelEndPos(destPivot, this.tmp2);

      if (this.travelPhase == 'hold') {
        this.travelHold -= dt;
        const breathe = Math.sin((0.35 - this.travelHold) * 14) * 0.35;
        this.camera.fov = this.baseFov + breathe;
        this.camera.updateProjectionMatrix();
        if (this.travelHold <= 0) this.travelPhase = 'move';
        return;
      }

      if (this.travelPhase == 'settle') {
        this.travelSettle -= dt;
        const st = 1 - Math.max(0, this.travelSettle) / 1.0;
        const ease = easeOutCubic(st);
        this.camera.position.lerpVectors(this.travelSettlePos, endPos, ease);
        // 到达段：直接看向目标星球，不再从出发四元数插值（避免末尾突然拧头）
        this.camera.lookAt(destPivot);
        this.camera.fov = this.baseFov + (1 - ease) * 2;
        this.camera.updateProjectionMatrix();
        if (this.travelSettle <= 0) this.finishTravel();
        return;
      }

      this.travelT += dt / this.travelDur;
      const t = easeCinematic(Math.min(1, this.travelT));
      const pos = quadBezier(this.travelFrom, this.travelMid, endPos, t);
      this.camera.position.copy(pos);

      // 注视：始终朝「目标星球」插值朝向，绝不把 look 点在地球↔目标间插值（会扫过太阳）
      const lookT = smoothstep(0.08, 0.82, t);
      this.slerpLookAt(this.travelFromQuat, pos, destPivot, lookT);

      const fovWave = Math.sin(t * Math.PI);
      this.camera.fov = this.baseFov + fovWave * 4;
      this.camera.updateProjectionMatrix();

      if (this.travelTrail) {
        this.travelTrail.progress = t;
        this.travelTrail.to.copy(endPos);
      }

      if (this.travelT >= 1) {
        this.travelPhase = 'settle';
        this.travelSettle = 0.85;
        this.travelSettlePos.copy(this.camera.position);
      }
      return;
    }

    if (this.mode == 'tour' && this.tourPhase == 'spin') {
      this.tourSpin += (Math.PI * 2 * dt) / 9;
      const target = this.bodies.getWorldPos(this.focus, this.tmp);
      const a = this.tourSpin;
      this.camera.position.set(
        target.x + Math.cos(a) * this.tourRadius,
        target.y + this.tourRadius * 0.28,
        target.z + Math.sin(a) * this.tourRadius,
      );
      this.camera.lookAt(target);
      if (this.tourSpin >= Math.PI * 2) {
        this.tourIndex = (this.tourIndex + 1) % BODIES.length;
        this.tourPhase = 'goto';
        this.gotoTourBody();
      }
      return;
    }

    if (this.mode == 'observe') {
      if (this.faceSunHold) {
        const pivot = this.faceSunPivot(this.tmp);
        this.applyFaceSunPose(pivot, this.faceSunToDir);
        this.orbit.target.copy(pivot);
        return;
      }

      this.bodies.getWorldPos(this.focus, this.tmp);
      this.tmp2.copy(this.camera.position).sub(this.orbit.target);
      this.orbit.target.copy(this.tmp);
      this.camera.position.copy(this.tmp).add(this.tmp2);
      this.orbit.update();
      return;
    }

    const turn = 1.2 * dt;
    if (this.keys.has('ArrowLeft')) this.yaw += turn;
    if (this.keys.has('ArrowRight')) this.yaw -= turn;
    if (this.keys.has('ArrowUp')) this.pitch += turn;
    if (this.keys.has('ArrowDown')) this.pitch -= turn;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));

    const speed = this.getAdaptiveSpeedAu();
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    ).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    let mx = 0;
    let my = 0;
    let mz = 0;
    if (this.keys.has('KeyW')) mz += 1;
    if (this.keys.has('KeyS')) mz -= 1;
    if (this.keys.has('KeyD')) mx += 1;
    if (this.keys.has('KeyA')) mx -= 1;
    if (this.keys.has('KeyE') || this.keys.has('Space')) my += 1;
    if (this.keys.has('KeyQ') || this.keys.has('ShiftLeft')) my -= 1;

    if (mx || my || mz) {
      this.tmp
        .copy(forward)
        .multiplyScalar(mz)
        .addScaledVector(right, mx)
        .addScaledVector(up, my)
        .normalize()
        .multiplyScalar(speed * dt);
      this.camera.position.add(this.tmp);
    }

    this.tmp2.copy(this.camera.position).add(forward);
    this.camera.lookAt(this.tmp2);
  }
}

function quadBezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out = new THREE.Vector3()) {
  const u = 1 - t;
  out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
  return out;
}

function slerpDir(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const dot = Math.max(-1, Math.min(1, a.dot(b)));
  const theta = Math.acos(dot);
  if (theta < 1e-5) return out.copy(a);
  const sinT = Math.sin(theta);
  const w1 = Math.sin((1 - t) * theta) / sinT;
  const w2 = Math.sin(t * theta) / sinT;
  return out.set(a.x * w1 + b.x * w2, a.y * w1 + b.y * w2, a.z * w1 + b.z * w2).normalize();
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 跃迁主段：慢起 → 快中 → 慢停（比 cubic 更戏剧） */
function easeCinematic(t: number) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const UP = new THREE.Vector3(0, 1, 0);

export function formatSpeed(auPerS: number): string {
  const c = auPerS / C_AU_PER_S;
  if (c >= 100) return `${auPerS.toFixed(2)} AU/s · ${c.toFixed(0)}c`;
  if (c >= 1) return `${auPerS.toFixed(3)} AU/s · ${c.toFixed(1)}c`;
  const km = auPerS * 149597870.7;
  return `${(km / 1000).toFixed(0)} 千km/s · ${c.toFixed(2)}c`;
}
