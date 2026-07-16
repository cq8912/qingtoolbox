import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENT_COLOR, ELEMENT_RADIUS, type Molecule } from './presets';

export type MolScene = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  root: THREE.Group;
  setMolecule: (mol: Molecule, showPairs: boolean) => void;
  setAutoSpin: (on: boolean) => void;
  dispose: () => void;
};

function addStarfield(scene: THREE.Scene) {
  const n = 1200;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 40 + Math.random() * 80;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.15, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Points(geo, mat));
}

export function createMolScene(canvas: HTMLCanvasElement): MolScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0c1424, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  addStarfield(scene);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
  camera.position.set(5, 4, 7);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.85;

  scene.add(new THREE.AmbientLight(0xc8d8f0, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(8, 12, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x00e8ff, 0.75);
  rim.position.set(-6, 2, -8);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffc857, 0.55, 60);
  warm.position.set(-4, -3, 5);
  scene.add(warm);

  const root = new THREE.Group();
  scene.add(root);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  const setMolecule = (mol: Molecule, showPairs: boolean) => {
    while (root.children.length) {
      const ch = root.children.pop()!;
      root.remove(ch);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat.dispose();
        }
      });
    }

    root.position.set(0, 0, 0);
    const scale =
      mol.id == 'water' ? 1.8 :
      mol.id == 'caffeine' || mol.id == 'dopamine' || mol.id == 'serotonin' ? 1.15 :
      1;

    for (const atom of mol.atoms) {
      const geo = new THREE.SphereGeometry(ELEMENT_RADIUS[atom.el] * scale, 28, 22);
      const mat = new THREE.MeshStandardMaterial({
        color: ELEMENT_COLOR[atom.el],
        roughness: 0.28,
        metalness: 0.22,
        emissive: ELEMENT_COLOR[atom.el],
        emissiveIntensity: 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(atom.x * scale, atom.y * scale, atom.z * scale);
      root.add(mesh);
    }

    for (const bond of mol.bonds) {
      const A = mol.atoms[bond.a];
      const B = mol.atoms[bond.b];
      const isPair = mol.id == 'dna' && A.el == 'N' && B.el == 'N';
      if (isPair && !showPairs) continue;

      const start = new THREE.Vector3(A.x * scale, A.y * scale, A.z * scale);
      const end = new THREE.Vector3(B.x * scale, B.y * scale, B.z * scale);
      const dir = end.clone().sub(start);
      const len = dir.length();
      if (len < 1e-6) continue;
      const geo = new THREE.CylinderGeometry(
        (isPair ? 0.05 : 0.09) * scale,
        (isPair ? 0.05 : 0.09) * scale,
        len,
        10,
      );
      const mat = new THREE.MeshStandardMaterial({
        color: isPair ? 0xffc857 : 0x99bbdd,
        roughness: 0.35,
        metalness: 0.1,
        emissive: isPair ? 0xffc857 : 0x4488aa,
        emissiveIntensity: 0.06,
      });
      const stick = new THREE.Mesh(geo, mat);
      stick.position.copy(start).add(end).multiplyScalar(0.5);
      stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      root.add(stick);
    }

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    controls.target.set(0, 0, 0);
    const size = box.getSize(new THREE.Vector3()).length();
    camera.position.set(size * 0.42, size * 0.28, size * 0.58);
    controls.update();
  };

  return {
    renderer,
    camera,
    controls,
    root,
    setMolecule,
    setAutoSpin: (on) => {
      controls.autoRotate = on;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
    },
  };
}
