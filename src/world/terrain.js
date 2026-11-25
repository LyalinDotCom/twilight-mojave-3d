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

function fbm2(x, y, octaves = 4) {
  let v = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * freq, y * freq);
    freq *= 2.04;
    amp *= 0.5;
  }
  return v;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Signed distance to the paved forecourt apron footprint (<= 0 inside apron).
 */
export function apronSignedDistance(x, z, config) {
  const ap = config.world.apron;
  const hx = ap.width * 0.5;
  const hz = ap.depth * 0.5;
  const dx = Math.abs(x - ap.center[0]) - hx;
  const dz = Math.abs(z - ap.center[2]) - hz;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  const inside = Math.min(Math.max(dx, dz), 0);
  return outside + inside;
}

/**
 * Subtle curving tire-track depression intensity (0..1) across the dusty dirt approach.
 */
export function tireTrackIntensity(x, z) {
  const centerZ = 7.4 + Math.sin(x * 0.075 + 0.5) * 0.72 + Math.max(0, -x - 4) * 0.07;
  const halfTrack = 0.92;
  const d1 = Math.abs(z - (centerZ - halfTrack));
  const d2 = Math.abs(z - (centerZ + halfTrack));
  const rut1 = Math.exp(-(d1 * d1) / (0.36 * 0.36));
  const rut2 = Math.exp(-(d2 * d2) / (0.36 * 0.36));
  const xFade = smoothstep(-28, -12, x) * (1.0 - smoothstep(12, 24, x));
  return Math.max(rut1, rut2) * xFade;
}

/**
 * Shared exact terrain elevation query (used by terrain mesh, pebbles, and foliage roots).
 */
export function sampleTerrainHeight(x, z, config) {
  const dApron = apronSignedDistance(x, z, config);
  if (dApron <= -0.15) {
    return -0.008; // Strictly below concrete pad top (Y = 0.025) to prevent z-fighting
  }

  // Smooth sand bank ramping seamlessly right up to apron lip (Y = 0.018) so there's zero harsh step!
  const rampMask = smoothstep(-0.15, 2.8, dApron);
  const sandLip = (1.0 - smoothstep(0.0, 2.4, Math.max(0, dApron))) * 0.018;

  const broad = (fbm2(x * 0.042 + 3.2, z * 0.042 - 1.7, 4) - 0.5) * 0.20;
  const med = (fbm2(x * 0.13 - 7.4, z * 0.13 + 4.1, 3) - 0.5) * 0.06;

  const farDist = Math.hypot(x, z);
  const basinRoll =
    smoothstep(28, 85, farDist) *
    (1.0 - smoothstep(130, 195, farDist)) *
    (fbm2(x * 0.016 + 11.1, z * 0.016 + 2.3, 3) - 0.48) *
    0.50;

  const rut = -tireTrackIntensity(x, z) * 0.025;
  const fgMicro = (noise2(x * 0.38, z * 0.38) - 0.5) * 0.016 * smoothstep(5.0, 12.0, z);

  return -0.008 * (1.0 - rampMask) + sandLip + (broad + med + basinRoll + rut + fgMicro) * rampMask;
}

function createProceduralDesertMaps() {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const ctx = colCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');

  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const nctx = normCanvas.getContext('2d');

  const img = ctx.createImageData(size, size);
  const rImg = rctx.createImageData(size, size);
  const nImg = nctx.createImageData(size, size);
  const heights = new Float32Array(size * size);

  let seed = 424242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const coarse =
        Math.sin(u * Math.PI * 6 + Math.cos(v * Math.PI * 4)) * 0.25 +
        Math.cos(v * Math.PI * 8 - Math.sin(u * Math.PI * 6)) * 0.25 +
        0.5;
      const grit = rand();
      const finePebble = grit > 0.88 ? 0.35 + rand() * 0.45 : grit * 0.32;
      const h = coarse * 0.45 + finePebble * 0.55;
      heights[y * size + x] = h;

      const baseR = 122 + h * 48 + (grit - 0.5) * 24;
      const baseG = 88 + h * 36 + (grit - 0.5) * 18;
      const baseB = 96 + h * 38 + (grit - 0.5) * 20;

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.max(0, Math.min(255, baseR));
      img.data[idx + 1] = Math.max(0, Math.min(255, baseG));
      img.data[idx + 2] = Math.max(0, Math.min(255, baseB));
      img.data[idx + 3] = 255;

      const rough = Math.max(210, Math.min(252, 238 - finePebble * 24));
      rImg.data[idx] = rough;
      rImg.data[idx + 1] = rough;
      rImg.data[idx + 2] = rough;
      rImg.data[idx + 3] = 255;
    }
  }

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[y * size + xp] - heights[y * size + xm]) * 2.6;
      const dy = (heights[yp * size + x] - heights[ym * size + x]) * 2.6;
      const invLen = 1 / Math.hypot(dx, dy, 1.0);
      const idx = (y * size + x) * 4;
      nImg.data[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 2] = Math.round((invLen * 0.5 + 0.5) * 255);
      nImg.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rImg, 0, 0);
  nctx.putImageData(nImg, 0, 0);

  const makeTex = (canvas, isSrgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(78, 58);
    t.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };

  return {
    albedo: makeTex(colCanvas, true),
    normal: makeTex(normCanvas, false),
    roughness: makeTex(roughCanvas, false),
  };
}

function createProceduralApronMaps() {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const ctx = colCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');

  ctx.fillStyle = '#685862';
  ctx.fillRect(0, 0, size, size);

  rctx.fillStyle = '#B8B8B8';
  rctx.fillRect(0, 0, size, size);

  let seed = 13379;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 8 + rand() * 36;
    const v = rand();
    ctx.fillStyle = v > 0.5 ? `rgba(135, 102, 106, ${0.04 + rand() * 0.06})` : `rgba(48, 36, 46, ${0.04 + rand() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();

    const rVal = v > 0.55 ? 150 : 204;
    rctx.fillStyle = `rgba(${rVal}, ${rVal}, ${rVal}, 0.12)`;
    rctx.beginPath();
    rctx.arc(x, y, rad * 1.1, 0, Math.PI * 2);
    rctx.fill();
  }

  for (let i = 0; i < 9000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const bright = rand() > 0.5 ? 142 : 52;
    ctx.fillStyle = `rgba(${bright}, ${bright - 8}, ${bright - 4}, 0.14)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const makeTex = (canvas, isSrgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 3);
    t.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };

  return {
    albedo: makeTex(colCanvas, true),
    roughness: makeTex(roughCanvas, false),
  };
}

/**
 * Builds an INDEXED smooth-yet-irregular desert gravel pebble geometry (organic Mojave stones, NOT shiny ovals!).
 */
function buildDesertGravelGeometry(widthSegs, heightSegs, seedOffset, irregularity) {
  const geo = new THREE.SphereGeometry(1.0, widthSegs, heightSegs);
  const pos = geo.attributes.position;
  const vertAO = new Float32Array(pos.count);

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();

    // Multi-frequency angular-weathered Mojave gravel profile (smooth indexed normals, irregular silhouette)
    const n1 =
      Math.sin(dir.x * 2.9 + seedOffset) *
      Math.cos(dir.y * 2.3 - seedOffset * 0.5) *
      Math.sin(dir.z * 3.1 + 1.1);
    const n2 =
      Math.sin(dir.x * 5.2 - dir.z * 4.7 + seedOffset * 1.4) *
      Math.cos(dir.y * 4.4 + 0.7);
    const radial = 1.0 + n1 * irregularity + n2 * (irregularity * 0.42);
    v.multiplyScalar(radial);

    // Flatten bottom so pebbles sit deeply nestled into Mojave sand
    if (v.y < -0.15) {
      v.y = -0.15 + (v.y + 0.15) * 0.42;
    }

    pos.setXYZ(i, v.x, v.y, v.z);

    // Deepened bottom-contact AO (0.38 -> 1.0) preserves crisp 3D grounding even without GTAOPass!
    vertAO[i] = smoothstep(-0.56, 0.46, v.y) * 0.62 + 0.38;
  }

  geo.setAttribute('aVertAO', new THREE.BufferAttribute(vertAO, 1));
  geo.computeVertexNormals();
  return geo;
}

function createRoundedSlabGeometry(width, depth, height, cornerRadius, bevelSize, bevelThickness) {
  const hw = width * 0.5 - bevelSize;
  const hd = depth * 0.5 - bevelSize;
  const r = Math.min(cornerRadius, hw, hd);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const extrudeDepth = Math.max(0.005, height - bevelThickness * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize,
    bevelThickness,
    curveSegments: 16,
  });

  geo.rotateX(-Math.PI / 2);

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const currentHeight = bb.max.y - bb.min.y;
  const scaleY = currentHeight > 1e-4 ? height / currentHeight : 1;
  geo.translate(0, -bb.min.y, 0);
  if (Math.abs(scaleY - 1) > 1e-4) {
    geo.scale(1, scaleY, 1);
  }

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    uv.setXY(i, (px + width * 0.5) / width, (pz + depth * 0.5) / depth);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function createTerrain({ config, textures }) {
  const group = new THREE.Group();
  group.name = 'MojaveTerrainAndPebbles';

  const sunVec = new THREE.Vector3(...(config.palette.sunsetSunDir || [-0.62, 0.11, -0.78])).normalize();

  // ---------------------------------------------------------------------------
  // 1. Expansive Luminous Dusty Rose-Taupe Mojave Hardpan (540m x 400m)
  //    NOTE: Uses high-luminance neutral-tinted vertex multipliers so real PBR
  //    desert_ground_albedo NEVER gets double-darkened to black ink!
  // ---------------------------------------------------------------------------
  const width = 540;
  const depth = 400;
  const centerZ = -110;
  const segX = 140;
  const segZ = 140;

  const groundGeo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  groundGeo.rotateX(-Math.PI / 2);

  const gPos = groundGeo.attributes.position;
  const gColors = new Float32Array(gPos.count * 3);
  // Subtle neutral-warm vertex multipliers (dusty Mojave taupe, never over-magenta!)
  const cCool = new THREE.Color('#D4C6C6');
  const cWarm = new THREE.Color('#F2E4DC');
  const cRut = new THREE.Color('#B5A4A2');
  const tmpCol = new THREE.Color();

  for (let i = 0; i < gPos.count; i++) {
    const lx = gPos.getX(i);
    const lz = gPos.getZ(i) + centerZ;
    const y = sampleTerrainHeight(lx, lz, config);
    gPos.setXYZ(i, lx, y, lz);

    const macro = fbm2(lx * 0.055 + 4.1, lz * 0.055 - 2.9, 3);
    const rut = tireTrackIntensity(lx, lz);
    const nearApronDust = 1.0 - smoothstep(0.0, 6.5, Math.max(0, apronSignedDistance(lx, lz, config)));

    tmpCol.copy(cCool).lerp(cWarm, macro * 0.8 + nearApronDust * 0.25);
    tmpCol.lerp(cRut, rut * 0.25);
    gColors[i * 3] = tmpCol.r;
    gColors[i * 3 + 1] = tmpCol.g;
    gColors[i * 3 + 2] = tmpCol.b;
  }

  groundGeo.setAttribute('color', new THREE.BufferAttribute(gColors, 3));
  groundGeo.computeVertexNormals();

  const fallbackDesert =
    !textures?.desertGroundAlbedo || !textures?.desertGroundNormal || !textures?.desertGroundRoughness
      ? createProceduralDesertMaps()
      : null;

  const desertAlbedo = textures?.desertGroundAlbedo || fallbackDesert.albedo;
  const desertNormal = textures?.desertGroundNormal || fallbackDesert.normal;
  const desertRoughness = textures?.desertGroundRoughness || fallbackDesert.roughness;

  for (const t of [desertAlbedo, desertNormal, desertRoughness]) {
    if (t) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(82, 62); // High-frequency fine Mojave sand/gravel detail
    }
  }

  const groundMat = new THREE.MeshStandardMaterial({
    map: desertAlbedo,
    normalMap: desertNormal,
    normalScale: new THREE.Vector2(1.22, 1.22),
    roughnessMap: desertRoughness,
    roughness: 0.90, // Matte desert hardpan that still catches grazing headlight & station spill
    metalness: 0.01,
    vertexColors: true,
    color: new THREE.Color('#FFFFFF'),
    envMapIntensity: 0.45,
  });

  // Lift dark photographic albedo cleanly into luminous dusty rose-taupe/mauve (#5E414C..#7E5A60)
  // + world-space macro breakup + unified rose-violet basin haze matching mountains.js!
  groundMat.customProgramCacheKey = () => 'mojave_ground_v3';
  groundMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = { value: sunVec };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrainWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrainWorldPos;
        uniform vec3 uSunDir;
        float tHash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }
        float tNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x),
            mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // World-space macro washes & dusty grit breakup (eliminates tiling)
        float m1 = tNoise(vTerrainWorldPos.xz * 0.13);
        float m2 = tNoise(vTerrainWorldPos.xz * 0.42 + vec2(12.3, 7.1));
        float m3 = tNoise(vTerrainWorldPos.xz * 1.85 - vec2(4.1, 9.3));
        float macroVar = mix(0.84, 1.18, m1 * 0.55 + m2 * 0.30 + m3 * 0.15);

        // Neutralized dusty Mojave warm-taupe/mauve hardpan (#664D52..#7B5E5E, zero excess magenta!)
        vec3 targetTaupeSoil = pow(vec3(0.47, 0.36, 0.37), vec3(2.2));
        vec3 lifted = diffuseColor.rgb * vec3(1.75, 1.88, 1.62);
        diffuseColor.rgb = mix(lifted, targetTaupeSoil, 0.42) * macroVar;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // Subtle worn-gravel sheen near the station & van headlights while keeping open desert matte
        float stationNear = 1.0 - smoothstep(4.0, 16.0, length(vTerrainWorldPos.xz - vec2(1.5, 0.5)));
        roughnessFactor = clamp(mix(max(roughnessFactor, 0.87), clamp(roughnessFactor * 0.86, 0.72, 0.86), stationNear * 0.65), 0.72, 0.95);`
      )
      .replace(
        '#include <fog_fragment>',
        `#include <fog_fragment>
        // Exact rose-violet basin haze matching mountains.js ground skirt (zero dark cutoff!)
        float basinDist = length(vTerrainWorldPos.xz - cameraPosition.xz);
        float hMist = smoothstep(55.0, 195.0, basinDist);
        vec2 hView = normalize((vTerrainWorldPos - cameraPosition).xz + vec2(1e-5));
        vec2 hSun = normalize(uSunDir.xz + vec2(1e-5));
        float sunAlign = clamp(dot(hView, hSun) * 0.5 + 0.5, 0.0, 1.0);
        vec3 coolMist = pow(vec3(0.44, 0.29, 0.49), vec3(2.2));
        vec3 warmMist = pow(vec3(0.66, 0.39, 0.50), vec3(2.2));
        vec3 valleyMistCol = mix(coolMist, warmMist, pow(sunAlign, 1.7) * 0.65) * 0.92;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, valleyMistCol, hMist * 0.88);`
      );
  };

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.name = 'MojaveDesertFloor';
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // ---------------------------------------------------------------------------
  // 2. Feathered Weathered Concrete / Asphalt Forecourt Apron (Top Y = 0.025m)
  // ---------------------------------------------------------------------------
  const ap = config.world.apron;
  const fallbackApron =
    !textures?.asphaltAlbedo || !textures?.asphaltRoughness ? createProceduralApronMaps() : null;

  const apronAlbedo = textures?.asphaltAlbedo || fallbackApron.albedo;
  const apronNormal = textures?.asphaltNormal || null;
  const apronRoughness = textures?.asphaltRoughness || fallbackApron.roughness;

  // Low subtle bevelled edge (no razor-sharp bright block step!)
  const apronGeo = createRoundedSlabGeometry(ap.width, ap.depth, ap.thickness, 0.85, 0.22, 0.016);
  const apronMat = new THREE.MeshStandardMaterial({
    map: apronAlbedo,
    normalMap: apronNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: apronRoughness,
    roughness: 0.62, // Physical 0.54-0.72 concrete sheen catches RectAreaLight canopy, cyan neon & storefront reflections!
    metalness: 0.04,
    color: new THREE.Color('#BBA4AC'),
    envMapIntensity: 1.05,
  });

  // Noise-feathered Mojave sand encroachment around the outer 1.8m of the apron!
  apronMat.customProgramCacheKey = () => 'mojave_apron_v3';
  apronMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vApronLocal;
        varying vec3 vApronWorld;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vApronLocal = position;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vApronWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vApronLocal;
        varying vec3 vApronWorld;
        float apHash(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.5);
          return fract(p.x * p.y);
        }
        float apNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(apHash(i), apHash(i + vec2(1.0, 0.0)), u.x),
            mix(apHash(i + vec2(0.0, 1.0)), apHash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Subtle concrete slab joints every 3.2m
        vec2 jg = abs(fract((vApronLocal.xz + vec2(9.5, 5.7)) / 3.2) - 0.5);
        float joint = 1.0 - smoothstep(0.486, 0.498, max(jg.x, jg.y));
        diffuseColor.rgb *= mix(0.78, 1.0, joint);

        // Wide, organic noise-feathered Mojave sand encroachment along apron edges -> melts seamlessly into dirt!
        float nDrift = (apNoise(vApronWorld.xz * 0.55) - 0.5) * 1.35 + (apNoise(vApronWorld.xz * 1.9) - 0.5) * 0.50;
        float edgeX = smoothstep(6.2, 9.45, abs(vApronLocal.x) + nDrift * 0.72);
        float edgeZ = smoothstep(2.7, 5.65, abs(vApronLocal.z) + nDrift * 0.72);
        float sandMask = clamp(max(edgeX, edgeZ), 0.0, 1.0);
        vec3 dustySandCol = pow(vec3(0.46, 0.35, 0.36), vec3(2.2));
        diffuseColor.rgb = mix(diffuseColor.rgb, dustySandCol, sandMask * 0.92);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // Calibrated concrete wear roughness (0.54-0.72 across pad for crisp RectAreaLight/neon/tungsten reflections)
        float wearNoise = apNoise(vApronWorld.xz * 0.48 + vec2(3.1, 7.4));
        float padRough = mix(0.54, 0.72, clamp(roughnessFactor * 0.65 + wearNoise * 0.35, 0.0, 1.0));
        float rDrift = (apNoise(vApronWorld.xz * 0.65) - 0.5) * 1.0;
        float rEdge = clamp(max(smoothstep(6.6, 9.45, abs(vApronLocal.x) + rDrift * 0.6), smoothstep(3.2, 5.65, abs(vApronLocal.z) + rDrift * 0.6)), 0.0, 1.0);
        roughnessFactor = mix(padRough, 0.92, rEdge * 0.85);`
      );
  };

  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.name = 'ForecourtConcreteApron';
  apronMesh.position.set(ap.center[0], ap.center[1] - ap.thickness, ap.center[2]);
  apronMesh.receiveShadow = true;
  group.add(apronMesh);

  const stripeMat = new THREE.MeshStandardMaterial({
    color: '#A8825E',
    roughness: 0.86,
    metalness: 0.0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const laneLineGeo = new THREE.PlaneGeometry(8.6, 0.08);
  laneLineGeo.rotateX(-Math.PI / 2);
  const laneLine = new THREE.Mesh(laneLineGeo, stripeMat);
  laneLine.position.set(2.0, ap.center[1] + 0.002, 2.35);
  laneLine.receiveShadow = true;
  group.add(laneLine);

  // ---------------------------------------------------------------------------
  // 3. Rounded 3D Concrete Pump Island (Y = 0.025 -> 0.165m)
  // ---------------------------------------------------------------------------
  const isl = config.world.pumpIsland;
  const islandGeo = createRoundedSlabGeometry(
    isl.width,
    isl.depth,
    isl.height,
    isl.depth * 0.48,
    0.028,
    0.022
  );
  const islandMat = new THREE.MeshStandardMaterial({
    map: apronAlbedo,
    roughnessMap: apronRoughness,
    roughness: 0.80,
    metalness: 0.02,
    color: new THREE.Color('#BEAAB2'),
    envMapIntensity: 0.72,
  });

  islandMat.customProgramCacheKey = () => 'mojave_island_v3';
  islandMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vIslNormal;
        varying float vIslY;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vIslNormal = normal;
        vIslY = position.y;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vIslNormal;
        varying float vIslY;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float isCurbSide = 1.0 - smoothstep(0.45, 0.78, abs(vIslNormal.y));
        vec3 curbPaint = pow(vec3(0.60, 0.24, 0.25), vec3(2.2));
        diffuseColor.rgb = mix(diffuseColor.rgb, curbPaint, isCurbSide * 0.48);
        diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.055, vIslY));`
      );
  };

  const islandMesh = new THREE.Mesh(islandGeo, islandMat);
  islandMesh.name = 'ConcretePumpIsland';
  islandMesh.position.set(isl.center[0], isl.center[1], isl.center[2]);
  islandMesh.castShadow = true;
  islandMesh.receiveShadow = true;
  group.add(islandMesh);

  const aoGeo = createRoundedSlabGeometry(isl.width + 0.34, isl.depth + 0.34, 0.004, isl.depth * 0.52, 0.01, 0.001);
  const aoMat = new THREE.MeshBasicMaterial({
    color: '#180D16',
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const aoMesh = new THREE.Mesh(aoGeo, aoMat);
  aoMesh.position.set(isl.center[0], isl.center[1] + 0.001, isl.center[2]);
  group.add(aoMesh);

  // ---------------------------------------------------------------------------
  // 4. 15,500 Focused Matte Mojave Gravel Pebbles (tightly packed in visible frustum -> 60 FPS!)
  // ---------------------------------------------------------------------------
  const bounds = config.world.pebbleBounds || { xMin: -22, xMax: 22, zMin: 4.5, zMax: 35.0 };
  const zMaxEffective = Math.max(bounds.zMax || 35.0, 35.0);
  // Cap cleanly at ~15,500 focused instances (concentrated 90% in the visible camera corridor so
  // on-screen gravel density stays identical to 34k while cutting triangle load by >3.3x!)
  const totalPebbles = Math.min(config.world.pebbleCount || 15500, 15500);

  const fineCount = Math.round(totalPebbles * 0.59);
  const medCount = Math.round(totalPebbles * 0.30);
  const largeCount = totalPebbles - fineCount - medCount;

  // Natural matte desert stone (low envMapIntensity kills shiny pink sky-ovals while roughness 0.82
  // lets raking van headlight SpotLights & station spill catch authentic micro-glints on 3D stones!)
  const pebbleMaterial = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.82,
    metalness: 0.0,
    envMapIntensity: 0.32,
  });

  pebbleMaterial.customProgramCacheKey = () => 'mojave_pebbles_v3';
  pebbleMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aVertAO;
        varying float vVertAO;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vVertAO = aVertAO;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vVertAO;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= vVertAO;`
      );
  };

  // Dusty warm-taupe/mauve Mojave gravel palette (neutralized ~20% away from magenta!)
  const rockPalette = [
    new THREE.Color('#5E4A4E'), // Dusty warm-mauve gravel
    new THREE.Color('#6D5557'), // Matching hardpan warm-taupe
    new THREE.Color('#7C605C'), // Sun-baked Mojave terracotta-taupe
    new THREE.Color('#4E3D42'), // Dark desert basalt chip
    new THREE.Color('#886E6B'), // Weathered quartz-taupe
    new THREE.Color('#644F50'), // Muted umber pebble
    new THREE.Color('#755E60'), // Dusty twilight desert slate
    new THREE.Color('#927974'), // Subtle pale desert sandstone
  ];

  let seed = 20261125;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function populateRockLayer(name, geo, count, sizeMin, sizeMax, castShadows, clusterBias, minStartZ) {
    const mesh = new THREE.InstancedMesh(geo, pebbleMaterial, count);
    mesh.name = name;
    mesh.castShadow = castShadows;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 10;

    const xSpan = bounds.xMax - bounds.xMin;

    while (placed < count && attempts < maxAttempts) {
      attempts++;

      let x, z;
      if (rand() < 0.90) {
        // Tightly concentrated along visible hero portrait & cinema foreground corridor (X: -14.5..+13.5, Z: 9.5..35)
        const u = rand();
        const v = rand();
        z = minStartZ + Math.pow(v, 0.72) * (zMaxEffective - minStartZ);
        x = -14.5 + u * 28.0;
      } else {
        x = bounds.xMin + rand() * xSpan;
        z = Math.max(bounds.zMin, minStartZ - 2.0) + rand() * (zMaxEffective - Math.max(bounds.zMin, minStartZ - 2.0));
      }

      const dApron = apronSignedDistance(x, z, config);
      if (dApron < 0.35) continue;

      // Keep dusty compacted approach in front of apron (Z = 5..12.2m) clean & open!
      const approachFade = smoothstep(8.2, 16.5, z);
      if (rand() > 0.04 + 0.96 * approachFade) continue;

      // Natural desert gravel wash patches leaving textured hardpan exposed between beds
      const patch = fbm2(x * 0.25 + 2.1, z * 0.25 - 4.7, 3);
      const acceptProb = (1.0 - clusterBias) + clusterBias * smoothstep(0.28, 0.74, patch);
      if (rand() > acceptProb) continue;

      // Keep tire tracks noticeably cleaner
      const rut = tireTrackIntensity(x, z);
      if (rut > 0.20 && rand() < rut * 0.76) continue;

      const groundY = sampleTerrainHeight(x, z, config);

      // Authentic fine gravel power-law sizing (tiny chips + fine pebbles + occasional 5-7cm cobbles!)
      const sz = sizeMin + Math.pow(rand(), 1.75) * (sizeMax - sizeMin);
      const sx = sz * (0.74 + rand() * 0.54);
      const szScale = sz * (0.74 + rand() * 0.54);
      const sy = sz * (0.34 + rand() * 0.18); // Flattened & seated low in dirt

      // Embed ~44% into dirt so pebbles look physically pressed into the Mojave floor!
      dummy.position.set(x, groundY + sy * 0.16, z);
      dummy.rotation.set(
        (rand() - 0.5) * 0.32,
        rand() * Math.PI * 2,
        (rand() - 0.5) * 0.32
      );
      dummy.scale.set(sx, sy, szScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);

      const baseC = rockPalette[Math.floor(rand() * rockPalette.length)];
      const shade = 0.78 + rand() * 0.34;
      color.copy(baseC).multiplyScalar(shade);
      mesh.setColorAt(placed, color);

      placed++;
    }

    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  // Layer A: ~9,150 tiny 1.3-3.4cm fine Mojave gravel (ultra-lean 20-tri smooth sphere, castShadow=false)
  const fineGeo = buildDesertGravelGeometry(5, 3, 1.3, 0.24);
  const finePebbles = populateRockLayer(
    'DesertFinePebbles',
    fineGeo,
    fineCount,
    0.013,
    0.034,
    false,
    0.46,
    9.5
  );
  group.add(finePebbles);

  // Layer B: ~4,650 medium desert gravel cobbles (3.0cm - 5.8cm, 30-tri smooth sphere, baked crisp shadows)
  const medGeo = buildDesertGravelGeometry(5, 4, 7.9, 0.26);
  const medCobbles = populateRockLayer(
    'DesertMediumCobbles',
    medGeo,
    medCount,
    0.030,
    0.058,
    true,
    0.60,
    12.5
  );
  group.add(medCobbles);

  // Layer C: ~1,700 accent cobbles (5.2cm - 7.8cm max, 36-tri smooth sphere, baked crisp shadows)
  const largeGeo = buildDesertGravelGeometry(6, 4, 14.5, 0.25);
  const largeRocks = populateRockLayer(
    'DesertLargeCobbles',
    largeGeo,
    largeCount,
    0.052,
    0.078,
    true,
    0.68,
    15.0
  );
  group.add(largeRocks);

  return {
    group,
    sampleHeight: (x, z) => sampleTerrainHeight(x, z, config),
  };
}
