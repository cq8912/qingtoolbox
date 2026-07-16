import * as THREE from 'three';
import { createScene } from './scene';
import { BodySystem } from './bodies';
import { StarSystem } from './stars';
import { CameraController, formatSpeed } from './camera';
import { Hud, describeFocus, describeStarFocus, type HudState } from './hud';
import { Minimap } from './minimap';
import { BodyLabels } from './labels';
import { ScenePicker } from './pick';
import { BODIES, BODY_BY_ID, type BodyId } from './constants';
import { selfCheckEarthDistance, selfCheckSatellites } from './astronomy';
import { selfCheckStars } from './stars-check';
import { loadSpaceTextures } from './textures';
import type { StarId } from './stars';
import type { ScaleMode } from './scale';

export function bootSpace() {
  const w = window as unknown as { __spaceCleanup?: () => void };
  if (w.__spaceCleanup) w.__spaceCleanup();

  const canvas = document.getElementById('space-canvas') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('space-hud');
  const miniCanvas = document.getElementById('sp-minimap') as HTMLCanvasElement | null;
  if (!canvas || !hudRoot) return;

  if (!selfCheckEarthDistance() || !selfCheckSatellites()) {
    console.warn('[space] Earth/satellite visual check failed');
  }
  if (!selfCheckStars()) {
    console.warn('[space] nearby-star catalog check failed');
  }

  const state: HudState = {
    simDate: new Date(),
    timeMult: 1,
    mode: 'observe',
    focus: 'earth',
    starFocus: 'sol',
    scaleMode: 'solar',
    speedMult: 1,
    orbits: true,
    info: 'SYS ONLINE',
    speedText: '—',
    touring: false,
  };

  let cam!: CameraController;
  let bodies!: BodySystem;
  let stars!: StarSystem;
  let camera!: THREE.PerspectiveCamera;
  let minimap: Minimap | null = null;
  let labels: BodyLabels | null = null;
  let sceneReady = false;
  let raf = 0;
  let dead = false;

  // 触摸板捏合/Ctrl+滚轮：拦截浏览器页面缩放，留给 OrbitControls 做相机靠近/远离
  const blockPageZoom = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault();
  };
  const blockGesture = (e: Event) => e.preventDefault();
  window.addEventListener('wheel', blockPageZoom, { passive: false });
  document.addEventListener('gesturestart', blockGesture as EventListener, { passive: false } as AddEventListenerOptions);
  document.addEventListener('gesturechange', blockGesture as EventListener, { passive: false } as AddEventListenerOptions);
  document.addEventListener('gestureend', blockGesture as EventListener, { passive: false } as AddEventListenerOptions);

  const gotoBody = (id: BodyId) => {
    if (!sceneReady) return;
    if (cam.scaleMode != 'solar') return;
    // 已在看这颗星：再点不跳转
    if (id == cam.focus && cam.mode != 'travel') return;
    if (cam.mode == 'travel' && cam.travelDestId == id) return;
    cam.stopTour();
    state.touring = false;
    cam.travelTo(id);
    state.mode = cam.mode;
    state.focus = cam.travelDestId;
    rebuildInfo();
    hud.render();
  };

  const gotoStar = (id: StarId) => {
    if (!sceneReady) return;
    if (id == cam.starFocus && cam.mode != 'travel' && cam.scaleMode == 'stellar') return;
    if (cam.mode == 'travel' && cam.travelDestStar == id && cam.scaleMode == 'stellar') return;
    cam.stopTour();
    state.touring = false;
    cam.travelToStar(id);
    state.mode = cam.mode;
    state.scaleMode = cam.scaleMode;
    state.starFocus = cam.travelDestStar;
    rebuildInfo();
    hud.render();
  };

  const returnSol = () => {
    if (!sceneReady) return;
    cam.returnToSol();
    state.mode = cam.mode;
    state.scaleMode = cam.scaleMode;
    rebuildInfo();
    hud.render();
  };

  const onScaleChange = (m: ScaleMode) => {
    state.scaleMode = m;
    minimap?.setScaleMode(m);
    hud.render();
  };

  const hud = new Hud(hudRoot, () => state, {
    onGoto: gotoBody,
    onGotoStar: gotoStar,
    onReturnSol: returnSol,
    onTour: () => {
      if (!sceneReady) return;
      cam.toggleTour();
      state.touring = cam.touring;
      state.mode = cam.mode;
      hud.render();
    },
    onFaceSun: () => {
      if (!sceneReady) return;
      cam.faceSun();
      state.mode = cam.mode;
      rebuildInfo();
      hud.render();
    },
    onChange: (patch) => {
      Object.assign(state, patch);
      if (sceneReady) {
        if (patch.mode != null && patch.mode != 'travel' && patch.mode != 'tour' && patch.mode != 'facesun') {
          cam.stopTour();
          state.touring = false;
          cam.setMode(patch.mode);
        }
        if (patch.focus != null) cam.setFocus(patch.focus);
        if (patch.speedMult != null) cam.speedMult = patch.speedMult;
        if (patch.orbits != null) bodies.setOrbitsVisible(patch.orbits);
        if (patch.simDate != null) bodies.updatePositions(state.simDate, true);
      }
      rebuildInfo();
      hud.render();
    },
  });
  hud.render();

  const tmp = new THREE.Vector3();
  const foTarget = new THREE.Vector3();
  const FO_REBASE_SOLAR = 2.2;
  const FO_REBASE_STELLAR = 8;

  function rebaseFloatingOrigin() {
    if (!sceneReady) return;
    if (cam.scaleMode == 'stellar') {
      const fid = cam.mode == 'travel' ? cam.travelDestStar : cam.starFocus;
      stars.getLogicalPos(fid, foTarget);
      const need =
        camera.position.length() > FO_REBASE_STELLAR ||
        stars.floatingOrigin.distanceTo(foTarget) > FO_REBASE_STELLAR;
      if (!need) return;
      const delta = stars.setFloatingOrigin(foTarget);
      cam.applyOriginShift(delta);
      return;
    }

    const fid = cam.mode == 'travel' ? cam.travelDestId : cam.focus;
    bodies.getLogicalPos(fid, foTarget);
    const need =
      camera.position.length() > FO_REBASE_SOLAR ||
      bodies.floatingOrigin.distanceTo(foTarget) > FO_REBASE_SOLAR;
    if (!need) return;
    const delta = bodies.setFloatingOrigin(foTarget);
    cam.applyOriginShift(delta);
  }

  function rebuildInfo() {
    if (!sceneReady) return;
    if (cam.scaleMode == 'stellar') {
      const sid = cam.mode == 'travel' ? cam.travelDestStar : cam.starFocus;
      const target = stars.getWorldPos(sid, tmp);
      state.info = describeStarFocus(camera.position.distanceTo(target), sid);
      state.speedText = formatSpeed(cam.currentSpeedAu || cam.getAdaptiveSpeedAu(), true);
    } else {
      const fid = cam.mode == 'travel' ? cam.travelDestId : cam.focus;
      const def = BODY_BY_ID[fid];
      const target = bodies.getWorldPos(fid, tmp);
      state.info = describeFocus(cam, camera.position.distanceTo(target), def.name);
      state.speedText = formatSpeed(cam.currentSpeedAu || cam.getAdaptiveSpeedAu(), false);
    }
    state.touring = cam.touring;
    state.scaleMode = cam.scaleMode;
    state.starFocus = cam.starFocus;
  }

  w.__spaceCleanup = () => {
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('wheel', blockPageZoom);
    document.removeEventListener('gesturestart', blockGesture as EventListener);
    document.removeEventListener('gesturechange', blockGesture as EventListener);
    document.removeEventListener('gestureend', blockGesture as EventListener);
  };

  loadSpaceTextures()
    .then((tex) => {
      if (dead) return;
      const pack = createScene(canvas, tex);
      camera = pack.camera;
      bodies = new BodySystem(pack.scene, tex);
      bodies.attachSunLight(pack.sunLight);
      stars = new StarSystem(pack.scene, tex.sun);
      bodies.updatePositions(state.simDate, true);
      cam = new CameraController(camera, canvas, bodies, stars, onScaleChange);
      cam.setFocus('earth');
      cam.speedMult = state.speedMult;
      bodies.getLogicalPos('earth', foTarget);
      const d0 = bodies.setFloatingOrigin(foTarget);
      cam.applyOriginShift(d0);

      if (miniCanvas) {
        minimap = new Minimap(miniCanvas, bodies, stars, camera);
        minimap.bind(gotoBody, gotoStar);
        minimap.resize();
        window.addEventListener('resize', () => minimap?.resize());
      }
      labels = new BodyLabels(hudRoot);
      labels.bind(gotoBody, gotoStar);
      new ScenePicker(canvas, camera, () => cam.scaleMode, bodies, stars, gotoBody, gotoStar);

      sceneReady = true;
      rebuildInfo();
      hud.render();

      let last = performance.now();
      let orbitRebuildAcc = 0;
      const t0 = performance.now();

      function frame(now: number) {
        if (dead) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = (now - t0) / 1000;

        if (cam.scaleMode == 'solar' && state.timeMult != 0) {
          state.simDate = new Date(state.simDate.getTime() + dt * 1000 * state.timeMult);
          bodies.updatePositions(state.simDate, false);
          orbitRebuildAcc += dt;
          // 行星椭圆随历元漂移慢；卫星环已挂父星，形状仍随相位变，快进时多刷一点
          const needRebuild =
            (state.timeMult > 1 && orbitRebuildAcc > 2) ||
            (state.timeMult >= 86400 && orbitRebuildAcc > 0.5) ||
            (state.timeMult > 0 && state.timeMult <= 1 && orbitRebuildAcc > 30);
          if (needRebuild) {
            bodies.buildOrbits(state.simDate);
            orbitRebuildAcc = 0;
          }
        }

        if (cam.scaleMode == 'solar') bodies.tick(t);
        else {
          stars.tick(t);
          stars.updateLink(cam.mode == 'travel' ? cam.travelDestStar : cam.starFocus);
        }
        cam.update(dt);
        rebaseFloatingOrigin();
        state.mode = cam.mode;
        state.scaleMode = cam.scaleMode;
        state.focus = cam.mode == 'travel' && cam.scaleMode == 'solar' ? cam.travelDestId : cam.focus;
        state.starFocus = cam.mode == 'travel' && cam.scaleMode == 'stellar' ? cam.travelDestStar : cam.starFocus;
        state.touring = cam.touring;
        rebuildInfo();

        minimap?.setScaleMode(cam.scaleMode);
        minimap?.draw(state.focus, state.starFocus, cam.travelTrail);
        labels?.update(bodies, stars, camera, cam.scaleMode, state.focus, state.starFocus, canvas!);

        if (((now / 250) | 0) != (((now - dt * 1000) / 250) | 0)) hud.render();

        pack.composer.render();
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      (window as unknown as { __space: unknown }).__space = { bodies, stars, cam, state, BODIES };
    })
    .catch((err) => {
      console.error(err);
      state.info = '场景加载失败';
      hud.render();
    });
}
