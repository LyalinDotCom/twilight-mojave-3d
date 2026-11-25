import * as THREE from 'three';

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, octaves = 5) {
  let v = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * freq, y * freq);
    const nx = x * 0.8 - y * 0.6;
    const ny = x * 0.6 + y * 0.8;
    x = nx + 7.13;
    y = ny + 11.41;
    freq *= 2.04;
    amp *= 0.5;
  }
  return v;
}

// Broad-shouldered Mojave ridged FBM (craggy & natural, avoids isolated spiky horns)
function desertRidgedFbm(x, y, octaves = 5) {
  let v = 0;
  let amp = 0.50;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    const n = 1.0 - Math.abs(noise2(x * freq, y * freq) * 2.0 - 1.0);
    v += Math.pow(n, 1.15) * amp;
    const nx = x * 0.8 - y * 0.6;
    const ny = x * 0.6 + y * 0.8;
    x = nx + 13.7;
    y = ny + 5.9;
    freq *= 2.08;
    amp *= 0.48;
  }
  return v;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Continuous sweeping Mojave skyline calibrated to ref_right_portrait_05s.png:
 * - Solid undulating left range behind van (~32-38m)
 * - Gentle high saddle above canopy left (~27-32m, strictly ABOVE cyan canopy roofline!)
 * - Continuous climbing broad-shouldered massif behind canopy right, store & rooftop star (~46-58m)
 */
function skylineEnvelope(thetaDeg, isFoothill) {
  // Broad rolling desert ridge harmonics for a continuous wall (no lone spikes!)
  const leftMassif = Math.exp(-Math.pow((thetaDeg - -9.0) / 15.0, 2)) * 0.22;
  const farLeftRange = Math.exp(-Math.pow((thetaDeg - -34.0) / 20.0, 2)) * 0.24;
  // Subtle broad saddle between van (-2.3 deg) and canopy (+8 deg)
  const gentleSaddle = Math.exp(-Math.pow((thetaDeg - 2.6) / 5.8, 2)) * 0.14;
  // Continuous rising Mojave mountain wall climbing smoothly behind canopy -> store -> right edge
  const centerClimb = smoothstep(3.0, 24.0, thetaDeg) * 0.44;
  const rightSummit = Math.exp(-Math.pow((thetaDeg - 23.5) / 14.5, 2)) * 0.26;
  const farRightWall = Math.exp(-Math.pow((thetaDeg - 48.0) / 22.0, 2)) * 0.24;

  // Natural multi-crest ridge cadence along the skyline
  const crestWave =
    Math.sin(thetaDeg * 0.23 + 0.6) * 0.055 +
    Math.cos(thetaDeg * 0.47 - 1.2) * 0.032;

  if (isFoothill) {
    const base = 0.24 + leftMassif * 0.35 + centerClimb * 0.68 + rightSummit * 0.42 + farRightWall * 0.40;
    const leftValleyBasin = Math.exp(-Math.pow((thetaDeg - -11.0) / 15.0, 2)) * 0.14;
    return Math.max(0.08, base - gentleSaddle * 0.4 - leftValleyBasin + crestWave * 0.5);
  }

  const h = 0.56 + leftMassif + farLeftRange + centerClimb + rightSummit + farRightWall - gentleSaddle + crestWave;
  return Math.max(0.36, h);
}

function buildMountainRibbon({
  segU,
  segV,
  radiusNear,
  radiusFar,
  angleMinDeg,
  angleMaxDeg,
  heightScale,
  isFoothill,
  seedOffset,
}) {
  const vertexCount = (segU + 1) * (segV + 1);
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const ridgeWeights = new Float32Array(vertexCount);
  const indices = [];

  const refCamX = -2.6;
  const refCamZ = 31.1;

  let ptr = 0;
  let uvPtr = 0;
  let wPtr = 0;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const radius = radiusNear + (radiusFar - radiusNear) * v;

    // Broad alluvial fan rising smoothly to a serrated Mojave mountain crest
    const frontRise = smoothstep(0.0, 0.54, v);
    const backFall = 1.0 - smoothstep(0.60, 1.0, v);
    const crossProfile = Math.pow(frontRise, 1.15) * backFall;

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const deg = angleMinDeg + (angleMaxDeg - angleMinDeg) * u;
      const rad = (deg * Math.PI) / 180;

      const x = Math.sin(rad) * radius;
      const z = -Math.cos(rad) * radius;

      const thetaCamDeg = (Math.atan2(x - refCamX, -(z - refCamZ)) * 180) / Math.PI;
      const env = skylineEnvelope(thetaCamDeg, isFoothill);

      // Broad wind-eroded Mojave mountain shoulders (smooth rolling skyline, ZERO sawtooth spikes!)
      const nx = x * 0.011 + seedOffset;
      const nz = z * 0.011 - seedOffset * 0.65;
      const broadDomes = fbm(nx * 0.85, nz * 0.85, 4);
      const gentleRidge = desertRidgedFbm(nx * 1.15 + 3.2, nz * 1.15 - 2.1, 3);
      const subtleCrest = fbm(nx * 2.4, nz * 2.4, 3);

      // Keep subtle eroded gullies ONLY on lower/mid flanks (taper to 0 near skyline crest v ~ 0.45..0.60!)
      const flankOnly = smoothstep(0.06, 0.24, v) * (1.0 - smoothstep(0.32, 0.50, v));
      const gullyWarp = fbm(nx * 2.2, nz * 2.2, 3) * 3.2;
      const g1 = 1.0 - Math.abs(Math.sin(u * 95.0 + gullyWarp + v * 3.2));
      const erosion = Math.pow(g1, 1.5) * 0.075 * flankOnly;

      const rawHeight =
        crossProfile *
        env *
        heightScale *
        (0.68 + broadDomes * 0.26 + gentleRidge * 0.12 + (subtleCrest - 0.5) * 0.06 - erosion);

      const wingFade = smoothstep(0.0, 0.055, u) * smoothstep(1.0, 0.945, u);
      const y = Math.max(-1.0, rawHeight * wingFade - (1.0 - frontRise) * 0.45);

      positions[ptr++] = x;
      positions[ptr++] = y;
      positions[ptr++] = z;

      uvs[uvPtr++] = u * 18.0;
      uvs[uvPtr++] = v * 4.5;

      ridgeWeights[wPtr++] = Math.min(1.0, Math.max(0.0, (broadDomes * 0.65 + gentleRidge * 0.35) * crossProfile));
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = a + (segU + 1);
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aRidge', new THREE.BufferAttribute(ridgeWeights, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const MOUNTAIN_VERTEX_SHADER = /* glsl */ `
  attribute float aRidge;

  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying float vRidge;

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    vRidge = aRidge;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const MOUNTAIN_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  varying float vRidge;

  uniform vec3 uSunDir;
  uniform float uLayerDepth; // 0 = front foothills, 1 = rear main massif
  uniform float uHasRockMap;
  uniform sampler2D uRockAlbedo;

  vec3 srgb(float r, float g, float b) {
    return pow(vec3(r, g, b), vec3(2.2));
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.5);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float ridged3(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 3; i++) {
      float n = 1.0 - abs(noise2(p) * 2.0 - 1.0);
      v += n * n * a;
      p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.15 + vec2(8.3, 4.1);
      a *= 0.48;
    }
    return v;
  }

  // Crisp analytic erosion heightfield for sunlit west-facing desert canyons & shadow gullies
  float erosionDetail(vec3 wp) {
    float r1 = ridged3(wp.xz * 0.068 + vec2(wp.y * 0.055, -wp.y * 0.035));
    float r2 = ridged3(wp.xz * 0.175 - vec2(wp.y * 0.11, wp.y * 0.075));
    float strata = sin(wp.y * 0.58 + r1 * 4.8) * 0.5 + 0.5;
    return r1 * 0.60 + r2 * 0.28 + strata * 0.12;
  }

  void main() {
    vec3 geomN = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // High-contrast analytic erosion normal perturbation for photographic desert rock relief
    float eps = 1.5;
    float e0 = erosionDetail(vWorldPos);
    float ex = erosionDetail(vWorldPos + vec3(eps, 0.0, 0.0));
    float ez = erosionDetail(vWorldPos + vec3(0.0, 0.0, eps));
    float ey = erosionDetail(vWorldPos + vec3(0.0, eps * 0.7, 0.0));
    vec3 erosionGrad = vec3(ex - e0, ey - e0, ez - e0) / eps;

    float slope = 1.0 - clamp(geomN.y, 0.0, 1.0);
    vec3 N = normalize(geomN - erosionGrad * (2.35 + slope * 1.65));

    // Deep Mojave twilight indigo-plum shadow crevices vs warm rose-mauve sunlit slopes
    vec3 deepCanyon = srgb(0.17, 0.12, 0.27);     // Crisp deep violet arroyo shadow (#2B1F42)
    vec3 midRock = srgb(0.31, 0.20, 0.39);        // Dusty twilight indigo-plum
    vec3 strataBand = srgb(0.45, 0.28, 0.46);     // Exposed lighter Mojave strata
    vec3 sunsetSlope = srgb(0.76, 0.44, 0.54);    // Sun-kissed west-facing ridge face (#7A4866+)

    float strata = sin(vWorldPos.y * 0.52 + e0 * 6.2) * 0.5 + 0.5;
    vec3 albedo = mix(deepCanyon, midRock, smoothstep(0.16, 0.80, e0));
    albedo = mix(albedo, strataBand, strata * smoothstep(0.15, 0.55, slope) * 0.52);

    if (uHasRockMap > 0.5) {
      vec3 texCol = texture2D(uRockAlbedo, vUv).rgb;
      float lum = dot(texCol, vec3(0.299, 0.587, 0.114));
      albedo *= mix(0.76, 1.26, clamp(lum * 1.35, 0.0, 1.0));
    }

    // Sculpted sunset directional contrast (clear sunlit ridge faces vs rich dark violet canyons!)
    float ndl = max(dot(N, L), 0.0);
    float wrapLit = clamp(dot(N, L) * 0.45 + 0.38, 0.0, 1.0);
    float skyFill = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
    float crestRim = pow(1.0 - max(dot(geomN, V), 0.0), 3.2) * smoothstep(10.0, 38.0, vWorldPos.y);

    vec3 lit = albedo * (0.42 + 0.34 * skyFill + 0.32 * wrapLit);
    lit += sunsetSlope * pow(ndl, 0.92) * (0.44 + 0.36 * smoothstep(6.0, 42.0, vWorldPos.y));
    lit += srgb(0.88, 0.48, 0.55) * crestRim * 0.16;

    // -------------------------------------------------------------------------
    // Atmospheric Aerial Perspective Haze (keeps upper ridges crisp dark violet!)
    // -------------------------------------------------------------------------
    float dist = length(cameraPosition - vWorldPos);
    float distFactor = smoothstep(145.0, 330.0, dist);
    float heightMist = exp(-max(vWorldPos.y, 0.0) * mix(0.085, 0.062, uLayerDepth));

    vec2 hView = normalize((vWorldPos - cameraPosition).xz + vec2(1e-5));
    vec2 hSun = normalize(L.xz + vec2(1e-5));
    float sunAlign = clamp(dot(hView, hSun) * 0.5 + 0.5, 0.0, 1.0);

    vec3 coolMist = srgb(0.44, 0.29, 0.49);
    vec3 warmMist = srgb(0.66, 0.39, 0.50);
    vec3 hazeCol = mix(coolMist, warmMist, pow(sunAlign, 1.7) * 0.65);

    // Controlled mist so upper eroded Mojave ridges stay deep, crisp & sculptural!
    float baseHaze = clamp(
      heightMist * mix(0.46, 0.58, uLayerDepth) + distFactor * mix(0.12, 0.24, uLayerDepth),
      0.0,
      0.68
    );
    vec3 finalCol = mix(lit, hazeCol, baseHaze);

    // Seamless ground-line mist skirt matching terrain.js horizon blend
    float skirtBlend = 1.0 - smoothstep(0.0, 5.2, vWorldPos.y);
    finalCol = mix(finalCol, hazeCol * 0.92, skirtBlend * 0.64);

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

function createHorizonLights(config) {
  const cfg = config.world.horizonLights || {
    count: 82,
    xMin: -135,
    xMax: 18,
    zMin: -175,
    zMax: -225,
    yBase: 0.65,
  };

  const totalCount = Math.max(cfg.count || 64, 84);
  const positions = new Float32Array(totalCount * 3);
  const colors = new Float32Array(totalCount * 3);
  const sizes = new Float32Array(totalCount);
  const phases = new Float32Array(totalCount);

  let seed = 918273;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const warmAmber = new THREE.Color('#FFD480');
  const softWhite = new THREE.Color('#FFF6DC');
  const sodiumOrange = new THREE.Color('#FFAA54');
  const faintRed = new THREE.Color('#FF5A4E');

  for (let i = 0; i < totalCount; i++) {
    let x, z;
    if (i < 54) {
      // Crisp horizontal distant highway / valley-town light strips to the left of the van
      const strip = i % 3;
      const stripCenter = strip === 0 ? -24 : strip === 1 ? -54 : -10;
      const spread = strip === 2 ? 12 : 24;
      x = stripCenter + (rand() - 0.5) * spread * 2.0;
      z = -170 - rand() * 34;
    } else {
      x = cfg.xMin + rand() * (cfg.xMax - cfg.xMin + 8);
      z = cfg.zMin - rand() * Math.abs(cfg.zMax - cfg.zMin);
    }

    const y = (cfg.yBase || 0.65) + rand() * 0.85;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const r = rand();
    const c =
      r < 0.46 ? warmAmber : r < 0.80 ? softWhite : r < 0.93 ? sodiumOrange : faintRed;
    const brightness = 0.90 + rand() * 0.70;
    colors[i * 3] = c.r * brightness;
    colors[i * 3 + 1] = c.g * brightness;
    colors[i * 3 + 2] = c.b * brightness;

    sizes[i] = 2.0 + rand() * 2.6;
    phases[i] = rand() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 color;

      varying vec3 vColor;
      varying float vShimmer;

      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vShimmer = 0.84 + 0.16 * sin(uTime * (2.2 + mod(aPhase * 3.1, 3.5)) + aPhase * 11.0);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uPixelRatio * (195.0 / max(-mvPos.z, 1.0)), 1.6, 7.5);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vColor;
      varying float vShimmer;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 46.0);
        float halo = exp(-d * d * 10.0) * 0.36;
        float alpha = (core + halo) * vShimmer;
        gl_FragColor = vec4(vColor * (1.55 * core + 0.60 * halo) * vShimmer, alpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'DistantValleyLights';
  points.frustumCulled = false;

  return { points, material: mat };
}

export function createMountains({ config, textures }) {
  const group = new THREE.Group();
  group.name = 'MojaveMountainRange';

  const sunVec = new THREE.Vector3(...(config.palette.sunsetSunDir || [-0.62, 0.11, -0.78])).normalize();
  const rockTex = textures?.mountainRockAlbedo || null;

  const makeMat = (layerDepth) =>
    new THREE.ShaderMaterial({
      vertexShader: MOUNTAIN_VERTEX_SHADER,
      fragmentShader: MOUNTAIN_FRAGMENT_SHADER,
      fog: false,
      uniforms: {
        uSunDir: { value: sunVec },
        uLayerDepth: { value: layerDepth },
        uHasRockMap: { value: rockTex ? 1.0 : 0.0 },
        uRockAlbedo: { value: rockTex },
      },
    });

  // 1. Primary rear eroded Mojave massif (~1.55x of v2 -> crests well above cyan canopy & frames rooftop star!)
  const mainGeo = buildMountainRibbon({
    segU: 440,
    segV: 52,
    radiusNear: 224,
    radiusFar: 298,
    angleMinDeg: -96,
    angleMaxDeg: 96,
    heightScale: 52.0,
    isFoothill: false,
    seedOffset: 22.3,
  });
  const mainMesh = new THREE.Mesh(mainGeo, makeMat(1.0));
  mainMesh.name = 'MojaveMainRidge';
  group.add(mainMesh);

  // 2. Layered front foothills for authentic two-plane desert ridge depth
  const foothillGeo = buildMountainRibbon({
    segU: 280,
    segV: 32,
    radiusNear: 176,
    radiusFar: 232,
    angleMinDeg: -90,
    angleMaxDeg: 90,
    heightScale: 24.5,
    isFoothill: true,
    seedOffset: 61.8,
  });
  const foothillMesh = new THREE.Mesh(foothillGeo, makeMat(0.0));
  foothillMesh.name = 'MojaveFoothills';
  group.add(foothillMesh);

  // 3. Crisp distant valley / highway pinpoint lights along far-left basin
  const { points: horizonLights, material: lightsMat } = createHorizonLights(config);
  group.add(horizonLights);

  let lightClock = 0;

  function update(_t, dt, opts = {}) {
    if (opts.livingWorld) {
      lightClock += Math.min(dt || 0.016, 0.1);
      lightsMat.uniforms.uTime.value = lightClock;
    } else {
      lightClock = 0;
      lightsMat.uniforms.uTime.value = 0;
    }
  }

  return {
    group,
    update,
  };
}
