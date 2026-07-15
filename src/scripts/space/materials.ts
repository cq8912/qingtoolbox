import * as THREE from 'three';

/** 太阳：贴图 + 动画颗粒/边缘变暗 + 多层日冕 */
export function createSunGroup(radius: number, map: THREE.Texture): {
  group: THREE.Group;
  update: (t: number) => void;
} {
  const group = new THREE.Group();

  const uniforms = {
    uMap: { value: map },
    uTime: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec3 base = texture2D(uMap, vUv).rgb;
        float n = noise(vUv * 48.0 + uTime * 0.12);
        n += 0.5 * noise(vUv * 96.0 - uTime * 0.18);
        vec3 hot = vec3(1.0, 0.55, 0.12);
        vec3 col = mix(base, base * hot * 1.45, 0.4 + 0.35 * n);
        float ndv = max(dot(normalize(vNormal), normalize(vView)), 0.0);
        float limb = pow(ndv, 0.4);
        col *= 0.65 + 0.55 * limb;
        col += hot * pow(1.0 - limb, 2.0) * 0.85;
        col *= 1.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), mat);
  group.add(core);

  // 多层加法日冕（亮度抬高，交给 Bloom）
  const coronaColors = [0xffc266, 0xff8c2a, 0xffe0a8];
  const coronaScales = [1.22, 1.55, 2.05];
  const coronaOpacity = [0.22, 0.1, 0.045];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(radius * coronaScales[i], 48, 32),
      new THREE.MeshBasicMaterial({
        color: coronaColors[i],
        transparent: true,
        opacity: coronaOpacity[i],
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        toneMapped: false,
      }),
    );
    group.add(c);
  }

  return {
    group,
    update(t: number) {
      uniforms.uTime.value = t;
      core.rotation.y = t * 0.02;
    },
  };
}

/** 软光晕精灵（径向渐变，避免低模多边形边） */
function makeGlowSprite(color: number, strength: number): THREE.Sprite {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},${0.85 * strength})`);
  grad.addColorStop(0.25, `rgba(${r},${g},${b},${0.35 * strength})`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},${0.08 * strength})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  return new THREE.Sprite(mat);
}

/**
 * 邻近恒星：复用太阳表面贴图 + 光谱染色（行业里几乎没有单星 2K 球面贴图）
 */
export function createTintedStarGroup(
  radius: number,
  map: THREE.Texture,
  tintHex: number,
  glow = 1,
): {
  group: THREE.Group;
  update: (t: number) => void;
} {
  const group = new THREE.Group();
  const tint = new THREE.Color(tintHex);
  const uniforms = {
    uMap: { value: map },
    uTime: { value: 0 },
    uTint: { value: tint },
    uHot: { value: tint.clone().multiplyScalar(1.35) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      uniform vec3 uTint;
      uniform vec3 uHot;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        vec3 base = texture2D(uMap, vUv).rgb;
        float lum = dot(base, vec3(0.299, 0.587, 0.114));
        float n = noise(vUv * 40.0 + uTime * 0.1);
        n += 0.45 * noise(vUv * 80.0 - uTime * 0.14);
        vec3 col = mix(uTint * (0.35 + lum), uHot * (0.5 + lum), 0.35 + 0.4 * n);
        float ndv = max(dot(normalize(vNormal), normalize(vView)), 0.0);
        float limb = pow(ndv, 0.45);
        col *= 0.7 + 0.5 * limb;
        col += uHot * pow(1.0 - limb, 2.2) * 0.7;
        col *= 1.45;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), mat);
  group.add(core);

  const sprite = makeGlowSprite(tintHex, 0.35 + glow * 0.22);
  sprite.scale.setScalar(radius * (5 + glow * 2.2));
  group.add(sprite);

  const sprite2 = makeGlowSprite(tintHex, 0.14 + glow * 0.12);
  sprite2.scale.setScalar(radius * (8 + glow * 3));
  group.add(sprite2);

  return {
    group,
    update(t: number) {
      uniforms.uTime.value = t;
      core.rotation.y = t * 0.015;
    },
  };
}

/** 地球大气辉光壳 */
export function createAtmosphere(radius: number, color = new THREE.Color(0x7ad0ff)): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: color },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.2);
        gl_FragColor = vec4(uColor, f * 1.05);
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.045, 64, 48), mat);
}

/** 地球：昼夜混合 + 云层 + 法线/高光 */
export function createEarthGroup(
  radius: number,
  maps: {
    day: THREE.Texture;
    night: THREE.Texture;
    clouds: THREE.Texture;
    normal: THREE.Texture;
    spec: THREE.Texture;
  },
): { group: THREE.Group; update: (t: number, sunWorld: THREE.Vector3) => void } {
  const group = new THREE.Group();

  const uniforms = {
    uDay: { value: maps.day },
    uNight: { value: maps.night },
    uNormal: { value: maps.normal },
    uSpec: { value: maps.spec },
    uSunDir: { value: new THREE.Vector3(1, 0, 0) },
  };

  const earthMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPosW = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDay;
      uniform sampler2D uNight;
      uniform sampler2D uNormal;
      uniform sampler2D uSpec;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vPosW;

      void main() {
        vec3 day = texture2D(uDay, vUv).rgb;
        vec3 night = texture2D(uNight, vUv).rgb;
        vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
        // 简化：用几何法线 + 一点点法线扰动
        vec3 N = normalize(vNormalW + nTex * 0.35);
        vec3 L = normalize(uSunDir);
        float ndl = dot(N, L);
        float dayAmt = smoothstep(-0.12, 0.25, ndl);
        // 晨昏线偏暖
        float twilight = smoothstep(-0.2, 0.05, ndl) * (1.0 - smoothstep(0.05, 0.35, ndl));
        vec3 col = mix(night * 1.4, day, dayAmt);
        col += vec3(1.0, 0.45, 0.15) * twilight * 0.25;
        // 海洋高光
        float specMask = texture2D(uSpec, vUv).r;
        vec3 V = normalize(cameraPosition - vPosW);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 48.0) * specMask * dayAmt;
        col += vec3(0.7, 0.85, 1.0) * spec * 0.65;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const earth = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), earthMat);
  group.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.012, 64, 48),
    new THREE.MeshStandardMaterial({
      map: maps.clouds,
      transparent: true,
      opacity: 0.82,
      depthWrite: true,
      roughness: 1,
      metalness: 0,
    }),
  );
  group.add(clouds);
  // 不加蓝色大气描边壳，靠云层 + 贴图本身

  const sunDir = new THREE.Vector3();
  const earthWorld = new THREE.Vector3();
  return {
    group,
    update(t, sunWorld) {
      earth.rotation.y = t * 0.05;
      clouds.rotation.y = t * 0.058;
      // sunWorld / earthWorld 都是场景世界坐标（已扣 FO）
      group.getWorldPosition(earthWorld);
      sunDir.copy(sunWorld).sub(earthWorld);
      if (sunDir.lengthSq() < 1e-18) sunDir.set(1, 0, 0);
      else sunDir.normalize();
      uniforms.uSunDir.value.copy(sunDir);
    },
  };
}
