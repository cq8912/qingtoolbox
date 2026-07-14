import * as THREE from 'three';
import { createScene } from './scene';
import { BodySystem } from './bodies';
import { CameraController, formatSpeed } from './camera';
import { Hud, describeFocus, type HudState } from './hud';
import { Minimap } from './minimap';
import { BODIES, BODY_BY_ID, type BodyId } from './constants';
import { selfCheckEarthDistance } from './astronomy';
import { loadSpaceTextures } from './textures';

export function bootSpace() {
  const w = window as unknown as { __spaceCleanup?: () => void };
  if (w.__spaceCleanup) w.__spaceCleanup();

  const canvas = document.getElementById('space-canvas') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('space-hud');
  const miniCanvas = document.getElementById('sp-minimap') as HTMLCanvasElement | null;
  if (!canvas || !hudRoot) return;

  if (!selfCheckEarthDistance()) {
    console.warn('[space] Earth/Moon visual check failed');
  }

  const state: HudState = {
    simDate: new Date(),
    timeMult: 1,
    mode: 'observe',
    focus: 'earth',
    speedMult: 1,
    orbits: true,
    info: 'SYS ONLINE',
    speedText: '—',
    touring: false,
  };

  let cam!: CameraController;
  let bodies!: BodySystem;
  let camera!: THREE.PerspectiveCamera;
  let minimap: Minimap | null = null;
  let sceneReady = false;
  let raf = 0;
  let dead = false;

  const gotoBody = (id: BodyId) => {
    if (!sceneReady) return;
    cam.stopTour();
    state.touring = false;
    cam.travelTo(id);
    state.mode = cam.mode;
    state.focus = cam.travelDestId;
    rebuildInfo();
    hud.render();
  };

  const hud = new Hud(hudRoot, () => state, {
    onGoto: gotoBody,
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
  function rebuildInfo() {
    if (!sceneReady) return;
    const fid = cam.mode == 'travel' ? cam.travelDestId : cam.focus;
    const def = BODY_BY_ID[fid];
    const target = bodies.getWorldPos(fid, tmp);
    state.info = describeFocus(cam, camera.position.distanceTo(target), def.name);
    state.speedText = formatSpeed(cam.currentSpeedAu || cam.getAdaptiveSpeedAu());
    state.touring = cam.touring;
  }

  w.__spaceCleanup = () => {
    dead = true;
    cancelAnimationFrame(raf);
  };

  loadSpaceTextures()
    .then((tex) => {
      if (dead) return;
      const pack = createScene(canvas, tex);
      camera = pack.camera;
      bodies = new BodySystem(pack.scene, tex);
      bodies.updatePositions(state.simDate, true);
      cam = new CameraController(camera, canvas, bodies);
      cam.setFocus('earth');
      cam.speedMult = state.speedMult;

      if (miniCanvas) {
        minimap = new Minimap(miniCanvas, bodies, camera);
        minimap.bind(gotoBody);
        minimap.resize();
        window.addEventListener('resize', () => minimap?.resize());
      }

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

        if (state.timeMult != 0) {
          state.simDate = new Date(state.simDate.getTime() + dt * 1000 * state.timeMult);
          bodies.updatePositions(state.simDate, false);
          orbitRebuildAcc += dt;
          if (state.timeMult > 1 && orbitRebuildAcc > 2) {
            bodies.buildOrbits(state.simDate);
            orbitRebuildAcc = 0;
          }
        }

        bodies.tick(t);
        cam.update(dt);
        state.mode = cam.mode;
        state.focus = cam.mode == 'travel' ? cam.travelDestId : cam.focus;
        state.touring = cam.touring;
        rebuildInfo();

        minimap?.draw(cam.mode == 'travel' ? cam.travelDestId : state.focus, cam.travelTrail);

        if ((now / 250 | 0) != ((now - dt * 1000) / 250 | 0)) hud.render();

        pack.composer.render();
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);

      (window as unknown as { __space: unknown }).__space = { bodies, cam, state, BODIES };
    })
    .catch((err) => {
      console.error(err);
      state.info = '场景加载失败';
      hud.render();
    });
}
