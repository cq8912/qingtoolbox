import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C_AU_PER_S, BODIES, satelliteEnvelope, type BodyId } from './constants';
import type { BodySystem } from './bodies';
import type { TravelTrail } from './minimap';
import type { StarSystem, StarId } from './stars';
import { STAR_BY_ID } from './stars';
import { applyScaleVisibility, type ScaleMode } from './scale';

export type CamMode = 'observe' | 'fly' | 'travel' | 'tour' | 'facesun';

type TravelDomain = 'body' | 'star';

export class CameraController {
  mode: CamMode = 'observe';
  speedMult = 1;
  focus: BodyId = 'earth';
  starFocus: StarId = 'sol';
  scaleMode: ScaleMode = 'solar';
  currentSpeedAu = 0;
  touring = false;
  travelTrail: TravelTrail | null = null;
  /** 跃迁目标（飞行过程中 focus 不变，避免逻辑错乱） */
  travelDestId: BodyId = 'earth';
  travelDestStar: StarId = 'sirius';
  private travelDomain: TravelDomain = 'body';

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

  /** 离场 / 入场跨尺度 */
  private crossPhase: null | 'leave' | 'enter' = null;
  private pendingStar: StarId | null = null;
  private leaveFrom = new THREE.Vector3();
  private leaveTo = new THREE.Vector3();
  private leaveLook = new THREE.Vector3();
  private leaveT = 0;
  private leaveDur = 1.4;
  private returningToSol = false;

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
    private stars: StarSystem,
    private onScaleChange?: (mode: ScaleMode) => void,
  ) {
    this.orbit = new OrbitControls(camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.rotateSpeed = 0.6;
    this.orbit.zoomSpeed = 1.25;
    this.orbit.enableZoom = true;
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

  private applyFaceSunPose(pivot: THREE.Vector3, dir: THREE.Vector3) {
    this.camera.position.copy(pivot).addScaledVector(dir, this.faceSunDist);
    this.camera.lookAt(pivot);
  }

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

  /** Floating Origin 重设后：场景点与相机同步平移 */
  applyOriginShift(delta: THREE.Vector3) {
    if (delta.lengthSq() < 1e-18) return;
    this.camera.position.sub(delta);
    this.orbit.target.sub(delta);
    this.travelFrom.sub(delta);
    this.travelMid.sub(delta);
    this.travelPivotStart.sub(delta);
    this.travelSettlePos.sub(delta);
    this.leaveFrom.sub(delta);
    this.leaveTo.sub(delta);
    this.leaveLook.sub(delta);
    if (this.travelTrail) {
      this.travelTrail.from.sub(delta);
      this.travelTrail.mid.sub(delta);
      this.travelTrail.to.sub(delta);
    }
  }

  private clearance(): number {
    return this.scaleMode == 'stellar' ? 0.35 : 1.25;
  }

  /** 跃迁弧线控制点：抬高并绕开原点大质量体 */
  private buildTravelMid(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3) {
    const CLR = this.clearance();
    out.copy(from).lerp(to, 0.5);
    const chord = from.distanceTo(to);
    const lift = Math.min(this.scaleMode == 'stellar' ? 6 : 4.5, Math.max(0.2, chord * 0.38));
    out.y += lift;

    let r = out.length();
    if (r < CLR) {
      if (r < 1e-5) {
        out.set(0, CLR, 0);
      } else {
        out.multiplyScalar(CLR / r);
      }
    }

    const a = this.tmp.copy(from).normalize();
    const b = this.tmp2.copy(to).normalize();
    if (a.lengthSq() > 1e-6 && b.lengthSq() > 1e-6 && a.dot(b) < 0.25) {
      const outer = Math.max(from.length(), to.length(), CLR) * 1.2;
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

  private destPivot(out: THREE.Vector3): THREE.Vector3 {
    if (this.travelDomain == 'star') return this.stars.getWorldPos(this.travelDestStar, out);
    return this.bodies.getWorldPos(this.travelDestId, out);
  }

  getAdaptiveSpeedAu(): number {
    if (this.scaleMode == 'stellar') {
      const id = this.mode == 'travel' ? this.travelDestStar : this.starFocus;
      const def = STAR_BY_ID[id];
      const dist = this.camera.position.distanceTo(this.stars.getWorldPos(id, this.tmp));
      const base = Math.max(dist * 0.55, (def?.visualRadius || 0.05) * 35, 0.02);
      return base * this.speedMult;
    }
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
    if (this.mode == 'observe' && this.scaleMode == 'solar') {
      this.bodies.getWorldPos(id, this.tmp);
      this.orbit.target.copy(this.tmp);
      this.orbit.minDistance = Math.max(
        this.bodies.getDef(id).visualRadius * (id == 'sun' ? 18 : 1.6),
        id == 'sun' ? 0.7 : 0.0005,
      );
    }
  }

  setStarFocus(id: StarId) {
    this.starFocus = id;
    if (this.mode == 'observe' && this.scaleMode == 'stellar') {
      this.stars.getWorldPos(id, this.tmp);
      this.orbit.target.copy(this.tmp);
      this.orbit.minDistance = Math.max(STAR_BY_ID[id].visualRadius * 8, 0.45);
    }
  }

  /** 绕当前轨道中心旋转，保持距离，直到背阳构图（始终看见中心天体） */
  faceSun() {
    if (this.scaleMode != 'solar') return;
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
    this.faceSunDur = Math.min(3.2, Math.max(0.9, (angle / Math.PI) * 2.8));

    this.mode = 'facesun';
    this.orbit.enabled = false;
    this.travelTrail = null;
  }

  private faceSunPivot(out: THREE.Vector3) {
    const planet = this.bodies.getWorldPos(this.focus, this.tmp);
    return out.copy(planet).add(this.faceSunPivotOffset);
  }

  toggleTour() {
    if (this.scaleMode != 'solar') return;
    if (this.touring) this.stopTour();
    else this.startTour();
  }

  startTour() {
    if (this.scaleMode != 'solar') return;
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

  /** 从太阳系跃迁到邻近恒星；已在星域则同尺度飞行 */
  travelToStar(id: StarId, onDone?: () => void) {
    if (id == 'sol') {
      this.returnToSol(onDone);
      return;
    }
    this.stopTour();
    this.faceSunHold = false;
    this.returningToSol = false;
    this.travelDone = onDone || null;

    if (this.scaleMode == 'solar') {
      this.beginLeaveSolar(id);
      return;
    }
    this.beginStarTravel(id);
  }

  /** 从星域返回太阳系（停靠地球） */
  returnToSol(onDone?: () => void) {
    this.stopTour();
    this.faceSunHold = false;
    this.travelDone = onDone || null;
    if (this.scaleMode == 'solar') {
      this.travelTo('earth', onDone);
      return;
    }
    this.returningToSol = true;
    this.beginStarTravel('sol');
  }

  private beginLeaveSolar(starId: StarId) {
    this.pendingStar = starId;
    this.crossPhase = 'leave';
    this.mode = 'travel';
    this.orbit.enabled = false;
    this.travelDomain = 'body';
    this.travelDestStar = starId;

    this.leaveFrom.copy(this.camera.position);
    this.leaveLook.copy(this.orbit.target);
    // 沿目标恒星方向拉远离场（AU 尺度）
    this.stars.getLogicalPos(starId, this.tmp);
    if (this.tmp.lengthSq() < 1e-8) this.tmp.set(1, 0.2, 0);
    this.tmp.normalize();
    const pull = 55;
    this.leaveTo.copy(this.tmp).multiplyScalar(pull);
    this.leaveT = 0;
    this.leaveDur = 1.55;
    this.travelTrail = null;
  }

  private finishLeaveSolar() {
    const starId = this.pendingStar!;
    this.pendingStar = null;
    this.crossPhase = null;

    applyScaleVisibility('stellar', this.bodies, this.stars);
    this.scaleMode = 'stellar';
    this.onScaleChange?.('stellar');

    // 星域：相机放在太阳附近朝向目标
    this.stars.getLogicalPos(starId, this.tmp);
    const dir = this.tmp2.copy(this.tmp);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0.15, 0);
    dir.normalize();

    this.stars.setFloatingOrigin(this.tmp3.set(0, 0, 0));
    const startDist = 1.1;
    this.camera.position.copy(dir).multiplyScalar(startDist);
    this.orbit.target.set(0, 0, 0);
    this.camera.lookAt(this.stars.getWorldPos(starId, this.tmp));
    this.starFocus = 'sol';

    this.beginStarTravel(starId);
  }

  private beginEnterSolar() {
    this.crossPhase = null;
    this.returningToSol = false;

    applyScaleVisibility('solar', this.bodies, this.stars);
    this.scaleMode = 'solar';
    this.onScaleChange?.('solar');

    this.bodies.getLogicalPos('earth', this.tmp);
    this.bodies.setFloatingOrigin(this.tmp);
    this.stars.setFloatingOrigin(this.tmp3.set(0, 0, 0));

    this.focus = 'earth';
    this.starFocus = 'sol';
    const target = this.bodies.getWorldPos('earth', this.tmp);
    const dist = Math.max(this.bodies.getDef('earth').visualRadius * 12, 0.035);
    this.orbit.target.copy(target);
    this.camera.position.set(target.x + dist * 0.65, target.y + dist * 0.35, target.z + dist);
    this.orbit.minDistance = Math.max(this.bodies.getDef('earth').visualRadius * 1.6, 0.0005);
    this.orbit.maxDistance = 120;
    this.mode = 'observe';
    this.orbit.enabled = true;
    this.orbit.update();
    this.resetFov();
    this.travelTrail = null;

    const done = this.travelDone;
    this.travelDone = null;
    done?.();
  }

  private beginStarTravel(id: StarId) {
    this.travelDomain = 'star';
    this.travelDestStar = id;
    this.mode = 'travel';
    this.orbit.enabled = false;
    this.faceSunHold = false;

    this.travelFrom.copy(this.camera.position);
    this.travelPivotStart.copy(this.orbit.target);
    this.travelFromQuat.copy(this.camera.quaternion);

    const off = this.tmp.copy(this.camera.position).sub(this.travelPivotStart);
    this.travelViewDist = off.length();
    if (this.travelViewDist < 1e-6) {
      this.travelViewDir.set(0.65, 0.35, 1).normalize();
      this.travelViewDist = 0.35;
    } else {
      this.travelViewDir.copy(off).normalize();
    }

    const def = STAR_BY_ID[id];
    const maxView = Math.max(def.visualRadius * 22, 1.15);
    const minView = Math.max(def.visualRadius * 14, 0.75);
    if (this.travelViewDist > maxView * 2.2) this.travelViewDist = maxView * 2.2;
    if (this.travelViewDist < minView) this.travelViewDist = minView;

    const dest = this.stars.getWorldPos(id, this.tmp);
    const endPos = this.travelEndPos(dest, this.tmp2);
    this.buildTravelMid(this.travelFrom, endPos, this.travelMid);

    this.travelT = 0;
    const dist = this.travelFrom.distanceTo(endPos);
    this.travelDur = Math.min(7.5, Math.max(2.0, Math.log10(dist + 1) * 2.2 + dist * 0.12));
    this.travelPhase = 'hold';
    this.travelHold = 0.35;

    this.travelTrail = {
      from: this.travelFrom.clone(),
      mid: this.travelMid.clone(),
      to: endPos.clone(),
      progress: 0,
    };
  }

  /** 从当前位置/视角/相对偏移，弧线飞往目标天体 */
  travelTo(id: BodyId, onDone?: () => void) {
    if (this.scaleMode != 'solar') {
      // 星域下点行星无效，忽略
      return;
    }
    this.faceSunHold = false;
    this.travelDomain = 'body';
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
    let maxView = Math.max(destDef.visualRadius * 14, 0.04);
    let minView = 0;
    if (id == 'sun') {
      maxView = Math.max(destDef.visualRadius * 32, 1.4);
      minView = Math.max(destDef.visualRadius * 22, 0.95);
    } else if (destDef.parent) {
      maxView = Math.max(maxView, satelliteEnvelope(destDef.parent) * 0.4);
    } else {
      maxView = Math.max(maxView, satelliteEnvelope(id) * 0.65);
    }
    if (this.travelViewDist > maxView * 2.5) this.travelViewDist = maxView * 2.5;
    if (minView > 0 && this.travelViewDist < minView) this.travelViewDist = minView;
    if (!destDef.parent && id != 'sun') {
      const env = satelliteEnvelope(id);
      if (this.travelViewDist < env * 0.55) this.travelViewDist = env * 0.55;
    }

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
    if (this.scaleMode == 'stellar') {
      const def = STAR_BY_ID[this.starFocus];
      this.stars.getWorldPos(this.starFocus, this.tmp);
      this.orbit.target.copy(this.tmp);
      this.orbit.minDistance = Math.max(def.visualRadius * 8, 0.45);
      this.orbit.maxDistance = 120;
      this.orbit.update();
      return;
    }
    const def = this.bodies.getDef(this.focus);
    this.bodies.getWorldPos(this.focus, this.tmp);
    this.orbit.target.copy(this.tmp);
    this.orbit.minDistance = Math.max(def.visualRadius * (def.id == 'sun' ? 18 : 1.6), def.id == 'sun' ? 0.7 : 0.0005);
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

    if (this.travelDomain == 'star') {
      if (this.returningToSol && this.travelDestStar == 'sol') {
        this.beginEnterSolar();
        return;
      }
      this.starFocus = this.travelDestStar;
      this.mode = 'observe';
      this.orbit.enabled = true;
      this.stars.getWorldPos(this.travelDestStar, this.tmp);
      this.orbit.target.copy(this.tmp);
      this.orbit.minDistance = Math.max(STAR_BY_ID[this.travelDestStar].visualRadius * 8, 0.45);
      done?.();
      return;
    }

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
      this.orbit.minDistance = Math.max(
        this.bodies.getDef(this.travelDestId).visualRadius * (this.travelDestId == 'sun' ? 18 : 1.6),
        this.travelDestId == 'sun' ? 0.7 : 0.0005,
      );
    }
    done?.();
  }

  update(dt: number) {
    this.currentSpeedAu = this.getAdaptiveSpeedAu();

    // 离场：太阳系拉远后切入星域
    if (this.crossPhase == 'leave') {
      this.leaveT += dt / this.leaveDur;
      const t = easeInOutCubic(Math.min(1, this.leaveT));
      this.camera.position.lerpVectors(this.leaveFrom, this.leaveTo, t);
      this.camera.lookAt(this.leaveLook);
      this.camera.fov = this.baseFov + Math.sin(t * Math.PI) * 6;
      this.camera.updateProjectionMatrix();
      if (this.leaveT >= 1) this.finishLeaveSolar();
      return;
    }

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
      const destPivot = this.destPivot(this.tmp);
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
      if (this.faceSunHold && this.scaleMode == 'solar') {
        const pivot = this.faceSunPivot(this.tmp);
        this.applyFaceSunPose(pivot, this.faceSunToDir);
        this.orbit.target.copy(pivot);
        return;
      }

      if (this.scaleMode == 'stellar') {
        this.stars.getWorldPos(this.starFocus, this.tmp);
        this.tmp2.copy(this.camera.position).sub(this.orbit.target);
        this.orbit.target.copy(this.tmp);
        this.camera.position.copy(this.tmp).add(this.tmp2);
        this.orbit.update();
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

/** 光速：ly / 秒 */
const C_LY_PER_S = 1 / (365.25 * 86400);

export function formatSpeed(auPerS: number, stellar = false): string {
  if (stellar) {
    const lyPerS = auPerS; // 星域场景单位即 ly
    const c = lyPerS / C_LY_PER_S;
    if (lyPerS >= 0.1) return `${lyPerS.toFixed(2)} ly/s · ${c.toFixed(0)}c`;
    if (c >= 1) return `${(lyPerS * 1e3).toFixed(2)} mly/s · ${c.toFixed(1)}c`;
    return `${(lyPerS * 1e6).toFixed(1)} μly/s · ${c.toFixed(2)}c`;
  }
  const c = auPerS / C_AU_PER_S;
  if (c >= 100) return `${auPerS.toFixed(2)} AU/s · ${c.toFixed(0)}c`;
  if (c >= 1) return `${auPerS.toFixed(3)} AU/s · ${c.toFixed(1)}c`;
  const km = auPerS * 149597870.7;
  return `${(km / 1000).toFixed(0)} 千km/s · ${c.toFixed(2)}c`;
}
