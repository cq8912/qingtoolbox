import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { SpaceTextures } from './textures';

export interface SpaceScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sunLight: THREE.PointLight;
  composer: EffectComposer;
}

export function createScene(canvas: HTMLCanvasElement, tex: SpaceTextures): SpaceScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Bloom 时 tone mapping 交给 OutputPass
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070e);
  // 减轻雾，避免整体发闷
  scene.fog = new THREE.FogExp2(0x05070e, 0.00055);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.00005, 8000);
  camera.position.set(0, 0.6, 2.8);

  // 提亮环境，行星背面也能看清一点细节
  scene.add(new THREE.AmbientLight(0x2a3348, 0.55));
  scene.add(new THREE.HemisphereLight(0x9eb7ff, 0x1a1208, 0.35));

  const sunLight = new THREE.PointLight(0xfff3dd, 6.5, 0, 0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 64, 48),
    new THREE.MeshBasicMaterial({
      map: tex.milkyWay,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  scene.add(sky);
  // 不要点状闪烁星空，只用银河贴图背景

  // 后处理：太阳辉光（threshold 高，只亮部 bloom）
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.5, 0.92);
  composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, sunLight, composer };
}
