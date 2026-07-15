import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENT_COLOR, ELEMENT_RADIUS, type Molecule } from './presets';

export type MolScene = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  root: THREE.Group;
  setMolecule: (mol: Molecule, showPairs: boolean) => void;
  dispose: () => void;
};

export function createMolScene(canvas: HTMLCanvasElement): MolScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x010305, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  camera.position.set(4, 3, 6);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.add(new THREE.AmbientLight(0x8899aa, 0.55));
  const key = new THREE.PointLight(0x00e8ff, 1.1, 40);
  key.position.set(6, 8, 4);
  scene.add(key);
  const fill = new THREE.PointLight(0xffc857, 0.35, 40);
  fill.position.set(-5, -2, -4);
  scene.add(fill);

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

    // 先复位，避免上次居中偏移叠加
    root.position.set(0, 0, 0);

    for (const atom of mol.atoms) {
      const geo = new THREE.SphereGeometry(ELEMENT_RADIUS[atom.el], 20, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: ELEMENT_COLOR[atom.el],
        roughness: 0.35,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(atom.x, atom.y, atom.z);
      root.add(mesh);
    }

    for (const bond of mol.bonds) {
      const A = mol.atoms[bond.a];
      const B = mol.atoms[bond.b];
      // DNA 碱基对：两端皆 N 且较近
      const isPair = mol.id == 'dna' && A.el == 'N' && B.el == 'N';
      if (isPair && !showPairs) continue;

      const start = new THREE.Vector3(A.x, A.y, A.z);
      const end = new THREE.Vector3(B.x, B.y, B.z);
      const dir = end.clone().sub(start);
      const len = dir.length();
      if (len < 1e-6) continue;
      const geo = new THREE.CylinderGeometry(isPair ? 0.04 : 0.07, isPair ? 0.04 : 0.07, len, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: isPair ? 0xffc857 : 0x88aacc,
        roughness: 0.5,
      });
      const stick = new THREE.Mesh(geo, mat);
      stick.position.copy(start).add(end).multiplyScalar(0.5);
      stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      root.add(stick);
    }

    // 居中
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    controls.target.set(0, 0, 0);
    const size = box.getSize(new THREE.Vector3()).length();
    camera.position.set(size * 0.55, size * 0.35, size * 0.75);
  };

  return {
    renderer,
    camera,
    controls,
    root,
    setMolecule,
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
    },
  };
}
