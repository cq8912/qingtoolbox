import * as THREE from 'three';

const BASE = '/space/textures';

export interface SpaceTextures {
  sun: THREE.Texture;
  mercury: THREE.Texture;
  venus: THREE.Texture;
  venusCloud: THREE.Texture;
  earthDay: THREE.Texture;
  earthNight: THREE.Texture;
  earthClouds: THREE.Texture;
  earthNormal: THREE.Texture;
  earthSpec: THREE.Texture;
  moon: THREE.Texture;
  moonBump: THREE.Texture;
  mars: THREE.Texture;
  jupiter: THREE.Texture;
  saturn: THREE.Texture;
  saturnRing: THREE.Texture;
  uranus: THREE.Texture;
  neptune: THREE.Texture;
  milkyWay: THREE.Texture;
}

function colorMap(tex: THREE.Texture) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function dataMap(tex: THREE.Texture) {
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function placeholder(): THREE.Texture {
  const data = new Uint8Array([180, 180, 180, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
}

export function loadSpaceTextures(): Promise<SpaceTextures> {
  const loader = new THREE.TextureLoader();
  const load = (file: string) =>
    new Promise<THREE.Texture>((resolve) => {
      loader.load(
        `${BASE}/${file}`,
        resolve,
        undefined,
        () => {
          console.warn('[space] texture missing:', file);
          resolve(placeholder());
        },
      );
    });

  const files = [
    '2k_sun.jpg',
    '2k_mercury.jpg',
    '2k_venus_surface.jpg',
    '2k_venus_atmosphere.jpg',
    '2k_earth_daymap.jpg',
    '2k_earth_nightmap.jpg',
    '2k_earth_clouds.jpg',
    '2k_earth_normal_map.jpg',
    '2k_earth_specular_map.jpg',
    '2k_moon.jpg',
    'moon_bump.jpg',
    '2k_mars.jpg',
    '2k_jupiter.jpg',
    '2k_saturn.jpg',
    '2k_saturn_ring_alpha.png',
    '2k_uranus.jpg',
    '2k_neptune.jpg',
    '2k_stars_milky_way.jpg',
  ];

  return Promise.all(files.map(load)).then((t) => ({
    sun: colorMap(t[0]),
    mercury: colorMap(t[1]),
    venus: colorMap(t[2]),
    venusCloud: colorMap(t[3]),
    earthDay: colorMap(t[4]),
    earthNight: colorMap(t[5]),
    earthClouds: colorMap(t[6]),
    earthNormal: dataMap(t[7]),
    earthSpec: dataMap(t[8]),
    moon: colorMap(t[9]),
    moonBump: dataMap(t[10]),
    mars: colorMap(t[11]),
    jupiter: colorMap(t[12]),
    saturn: colorMap(t[13]),
    saturnRing: colorMap(t[14]),
    uranus: colorMap(t[15]),
    neptune: colorMap(t[16]),
    milkyWay: colorMap(t[17]),
  }));
}
