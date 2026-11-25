import * as THREE from 'three';
import { apronSignedDistance, sampleTerrainHeight } from './terrain.js';

function createPRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Generates a crisp botanical Mojave creosote & sagebrush micro-foliage sprig texture.
 */
function createCreosoteSprigTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const rand = createPRNG(77123);

  function drawSprig(x0, y0, angle, len, width, depth) {
    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 + Math.sin(angle) * len;

    ctx.strokeStyle = depth === 0 ? '#684E46' : '#7C5D52';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    const steps = depth === 0 ? 6 : 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 0.25);
      const lx = x0 + (x1 - x0) * t;
      const ly = y0 + (y1 - y0) * t;
      for (const side of [-1, 1]) {
        if (rand() < 0.18) continue;
        const la = angle + side * (0.38 + rand() * 0.56);
        const ll = (5.5 + rand() * 5.5) * (1.0 - depth * 0.15);
        const lw = 2.2 + rand() * 1.9;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(la);
        const tone = rand();
        // Dusty Mojave sage-olive & warm desert taupe leaflets (natural twilight tones)
        ctx.fillStyle =
          tone < 0.40 ? '#786756' : tone < 0.76 ? '#8F7664' : '#A68874';
        ctx.beginPath();
        ctx.ellipse(ll * 0.5, 0, ll * 0.56, lw * 0.52, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (depth < 2) {
      const forks = depth === 0 ? 3 : 2;
      for (let f = 0; f < forks; f++) {
        const ft = 0.36 + (f / forks) * 0.54;
        const fx = x0 + (x1 - x0) * ft;
        const fy = y0 + (y1 - y0) * ft;
        const spread = (f % 2 === 0 ? 1 : -1) * (0.34 + rand() * 0.42);
        drawSprig(fx, fy, angle + spread, len * (0.60 + rand() * 0.16), width * 0.68, depth + 1);
      }
    }
  }

  drawSprig(size * 0.5, size * 0.92, -Math.PI * 0.5, size * 0.46, 3.4, 0);
  drawSprig(size * 0.5, size * 0.88, -Math.PI * 0.70, size * 0.40, 2.8, 0);
  drawSprig(size * 0.5, size * 0.88, -Math.PI * 0.30, size * 0.40, 2.8, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function appendTaperedTube(buffers, p0, p1, r0, r1, sides, maxH, tip0, tip1, v0, v1) {
  const dir = new THREE.Vector3().subVectors(p1, p0);
  const len = dir.length();
  if (len < 1e-5) return;
  dir.divideScalar(len);

  const refUp = Math.abs(dir.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(refUp, dir).normalize();
  const bitangent = new THREE.Vector3().crossVectors(dir, tangent).normalize();

  const baseIdx = buffers.positions.length / 3;
  const sway0 = Math.pow(Math.max(0, p0.y) / maxH, 1.6);
  const sway1 = Math.pow(Math.max(0, p1.y) / maxH, 1.6);

  for (let i = 0; i <= sides; i++) {
    const frac = i / sides;
    const ang = frac * Math.PI * 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);

    const nx = tangent.x * ca + bitangent.x * sa;
    const ny = tangent.y * ca + bitangent.y * sa;
    const nz = tangent.z * ca + bitangent.z * sa;

    buffers.positions.push(p0.x + nx * r0, p0.y + ny * r0, p0.z + nz * r0);
    buffers.normals.push(nx, ny, nz);
    buffers.uvs.push(frac, v0);
    buffers.sway.push(sway0);
    buffers.tip.push(tip0);

    buffers.positions.push(p1.x + nx * r1, p1.y + ny * r1, p1.z + nz * r1);
    buffers.normals.push(nx, ny, nz);
    buffers.uvs.push(frac, v1);
    buffers.sway.push(sway1);
    buffers.tip.push(tip1);
  }

  for (let i = 0; i < sides; i++) {
    const a = baseIdx + i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    buffers.indices.push(a, c, b);
    buffers.indices.push(b, c, d);
  }
}

function appendLeafSprigCluster(leafBuf, center, dir, size, maxH, rand) {
  const sway = Math.pow(Math.max(0, center.y) / maxH, 1.6);
  const up = dir.clone().normalize();
  const ref = Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const sideA = new THREE.Vector3().crossVectors(up, ref).normalize();
  const sideB = new THREE.Vector3().crossVectors(up, sideA).normalize();

  const twist = rand() * Math.PI;
  const ct = Math.cos(twist);
  const st = Math.sin(twist);

  for (let plane = 0; plane < 2; plane++) {
    const a = plane === 0 ? ct : -st;
    const b = plane === 0 ? st : ct;
    const right = new THREE.Vector3(
      sideA.x * a + sideB.x * b,
      sideA.y * a + sideB.y * b,
      sideA.z * a + sideB.z * b
    );
    const norm = new THREE.Vector3().crossVectors(right, up).normalize();

    const hw = size * 0.56;
    const h = size * 1.02;
    const baseIdx = leafBuf.positions.length / 3;

    const pBL = center.clone().addScaledVector(right, -hw);
    const pBR = center.clone().addScaledVector(right, hw);
    const pTL = pBL.clone().addScaledVector(up, h);
    const pTR = pBR.clone().addScaledVector(up, h);

    const pts = [pBL, pBR, pTL, pTR];
    const uvs = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];

    for (let k = 0; k < 4; k++) {
      leafBuf.positions.push(pts[k].x, pts[k].y, pts[k].z);
      leafBuf.normals.push(norm.x, norm.y, norm.z);
      leafBuf.uvs.push(uvs[k][0], uvs[k][1]);
      leafBuf.sway.push(sway + (k >= 2 ? 0.12 : 0));
    }

    leafBuf.indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    leafBuf.indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
  }
}

function finalizeGeometry(buf, hasTip) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  geo.setAttribute('aSway', new THREE.Float32BufferAttribute(buf.sway, 1));
  if (hasTip) {
    geo.setAttribute('aTip', new THREE.Float32BufferAttribute(buf.tip, 1));
  }
  geo.setIndex(buf.indices);
  return geo;
}

/**
 * Builds a TRUE recursive 3D branching woody Mojave creosote / sagebrush template.
 */
function buildBranchingScrubTemplate({
  seed,
  primaryStems,
  maxDepth,
  baseLength,
  baseRadius,
  spreadMin,
  spreadMax,
  maxHeight,
  leafDensity,
  leafSize,
}) {
  const rand = createPRNG(seed);
  const woodBuf = { positions: [], normals: [], uvs: [], sway: [], tip: [], indices: [] };
  const leafBuf = { positions: [], normals: [], uvs: [], sway: [], indices: [] };

  function growBranch(origin, dir, length, radius, depth, uvStart) {
    const segs = depth === 0 ? 3 : 2;
    let curPos = origin.clone();
    let curDir = dir.clone().normalize();
    let curR = radius;
    let curV = uvStart;
    const sides = depth === 0 ? 5 : depth === 1 ? 4 : 3;

    for (let s = 0; s < segs; s++) {
      const segLen = (length / segs) * (0.86 + rand() * 0.28);
      const nextR = Math.max(0.0022, curR * (depth === 0 ? 0.77 : 0.73));
      const nextPos = curPos.clone().addScaledVector(curDir, segLen);

      const tip0 = Math.min(1, (depth + s / segs) / (maxDepth + 0.6));
      const tip1 = Math.min(1, (depth + (s + 1) / segs) / (maxDepth + 0.6));

      appendTaperedTube(
        woodBuf,
        curPos,
        nextPos,
        curR,
        nextR,
        sides,
        maxHeight,
        tip0,
        tip1,
        curV,
        curV + segLen * 3.5
      );

      if (depth >= maxDepth - 1 && leafDensity > 0 && rand() < leafDensity) {
        appendLeafSprigCluster(
          leafBuf,
          nextPos,
          curDir,
          leafSize * (0.78 + rand() * 0.52),
          maxHeight,
          rand
        );
      }

      if (depth < maxDepth && s === 1 && rand() < 0.74) {
        const sideDir = curDir
          .clone()
          .add(new THREE.Vector3((rand() - 0.5) * 1.05, 0.14 + rand() * 0.42, (rand() - 0.5) * 1.05))
          .normalize();
        growBranch(
          nextPos,
          sideDir,
          length * (0.58 + rand() * 0.20),
          nextR * 0.78,
          depth + 1,
          curV + segLen * 3.5
        );
      }

      curDir
        .add(new THREE.Vector3((rand() - 0.5) * 0.42, 0.10 + rand() * 0.18, (rand() - 0.5) * 0.42))
        .normalize();
      curPos = nextPos;
      curR = nextR;
      curV += segLen * 3.5;
    }

    if (depth < maxDepth) {
      const childCount = depth === 0 ? 2 + (rand() > 0.35 ? 1 : 0) : 2;
      for (let c = 0; c < childCount; c++) {
        const childDir = curDir
          .clone()
          .add(new THREE.Vector3((rand() - 0.5) * 1.15, 0.16 + rand() * 0.46, (rand() - 0.5) * 1.15))
          .normalize();
        growBranch(
          curPos,
          childDir,
          length * (0.62 + rand() * 0.22),
          curR * 0.82,
          depth + 1,
          curV
        );
      }
    } else if (leafDensity > 0 && rand() < Math.min(0.98, leafDensity * 1.45)) {
      appendLeafSprigCluster(
        leafBuf,
        curPos,
        curDir,
        leafSize * (0.85 + rand() * 0.48),
        maxHeight,
        rand
      );
    }
  }

  for (let i = 0; i < primaryStems; i++) {
    const az = (i / primaryStems) * Math.PI * 2 + (rand() - 0.5) * 0.38;
    const tilt = spreadMin + rand() * (spreadMax - spreadMin);
    const dir = new THREE.Vector3(
      Math.cos(az) * Math.sin(tilt),
      Math.cos(tilt),
      Math.sin(az) * Math.sin(tilt)
    ).normalize();

    const rootOffset = new THREE.Vector3(
      Math.cos(az) * (0.04 + rand() * 0.14),
      -0.04,
      Math.sin(az) * (0.04 + rand() * 0.14)
    );

    growBranch(
      rootOffset,
      dir,
      baseLength * (0.76 + rand() * 0.44),
      baseRadius * (0.82 + rand() * 0.34),
      0,
      0
    );
  }

  return {
    woodGeo: finalizeGeometry(woodBuf, true),
    leafGeo: leafBuf.positions.length > 0 ? finalizeGeometry(leafBuf, false) : null,
  };
}

/**
 * Builds a soft, natural, feathery desert sedge / dry scrub tussock (arching slender 3D stems
 * + delicate botanical micro-sprigs so foreground edge clumps look organic, NEVER like stiff wire brushes!).
 */
function buildSoftForegroundScrubTemplate(seed) {
  const rand = createPRNG(seed);
  const woodBuf = { positions: [], normals: [], uvs: [], sway: [], tip: [], indices: [] };
  const leafBuf = { positions: [], normals: [], uvs: [], sway: [], indices: [] };
  const maxHeight = 0.46;
  const stemCount = 30;

  for (let i = 0; i < stemCount; i++) {
    const az = (i / stemCount) * Math.PI * 2 + (rand() - 0.5) * 0.42;
    const tilt = 0.28 + rand() * 0.85; // Bushier low spreading arch
    const totalLen = 0.24 + rand() * 0.26;
    let curPos = new THREE.Vector3(
      Math.cos(az) * (0.02 + rand() * 0.14),
      -0.035,
      Math.sin(az) * (0.02 + rand() * 0.14)
    );
    let curDir = new THREE.Vector3(
      Math.cos(az) * Math.sin(tilt),
      Math.cos(tilt),
      Math.sin(az) * Math.sin(tilt)
    ).normalize();

    let curR = 0.0036 + rand() * 0.0018;
    const segs = 4;
    for (let s = 0; s < segs; s++) {
      const segLen = totalLen / segs;
      const nextR = Math.max(0.0007, curR * 0.68);
      const nextPos = curPos.clone().addScaledVector(curDir, segLen);
      appendTaperedTube(
        woodBuf,
        curPos,
        nextPos,
        curR,
        nextR,
        3,
        maxHeight,
        s / segs,
        (s + 1) / segs,
        s * 0.8,
        (s + 1) * 0.8
      );

      // Soft feathery dry desert sprigs along upper stem tips break up any wire-brush look!
      if (s >= 2 && rand() < 0.72) {
        appendLeafSprigCluster(
          leafBuf,
          nextPos,
          curDir,
          0.11 + rand() * 0.08,
          maxHeight,
          rand
        );
      }

      // Graceful outward droop
      curDir.y -= 0.14 + rand() * 0.12;
      curDir.x += Math.cos(az) * 0.18 + (rand() - 0.5) * 0.14;
      curDir.z += Math.sin(az) * 0.18 + (rand() - 0.5) * 0.14;
      curDir.normalize();

      curPos = nextPos;
      curR = nextR;
    }
  }

  return {
    woodGeo: finalizeGeometry(woodBuf, true),
    leafGeo: finalizeGeometry(leafBuf, false),
  };
}

/**
 * Enhances wood bark & micro-foliage with custom twilight coral Fresnel rim backlighting,
 * subtle distant valley mist blending, and optional Living World wind sway.
 */
function attachBotanicalShaderHooks(material, uniforms, { isWood, sunDir, isBasin = false }) {
  material.customProgramCacheKey = () =>
    `mojave_botanical_${isWood ? 'wood' : 'leaf'}_${isBasin ? 'basin' : 'fg'}_v3`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = uniforms.uWindTime;
    shader.uniforms.uWindAmp = uniforms.uWindAmp;
    shader.uniforms.uSunDir = { value: sunDir };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSway;
        ${isWood ? 'attribute float aTip; varying float vTip;' : ''}
        uniform float uWindTime;
        uniform float uWindAmp;
        varying vec3 vBotWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${isWood ? 'vTip = aTip;' : ''}
        #ifdef USE_INSTANCING
          vec3 instOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 instOrigin = vec3(modelMatrix[3][0], modelMatrix[3][1], modelMatrix[3][2]);
        #endif
        if (uWindAmp > 0.0001) {
          float phase = instOrigin.x * 0.45 + instOrigin.z * 0.37;
          float gust = sin(uWindTime * 1.85 + phase) * 0.65 + sin(uWindTime * 3.4 + phase * 2.1 + transformed.y * 2.0) * 0.35;
          float swayAmt = aSway * uWindAmp * 0.055;
          transformed.x += gust * swayAmt;
          transformed.z += cos(uWindTime * 1.45 + phase * 1.3) * swayAmt * 0.65;
        }`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vBotWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vBotWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${isWood ? 'varying float vTip;' : ''}
        varying vec3 vBotWorldPos;
        uniform vec3 uSunDir;`
      )
      .replace(
        '#include <dithering_fragment>',
        `// Warm coral-peach sunset Fresnel rim & backlight glow along thin outer desert twigs
        vec3 bView = normalize(cameraPosition - vBotWorldPos);
        vec3 bSun = normalize(uSunDir);
        float backScatter = pow(clamp(dot(-bView, bSun) * 0.5 + 0.5, 0.0, 1.0), 2.0);
        float rimN = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.1);
        float rimWeight = ${isWood ? '(0.32 + 0.68 * vTip)' : '0.86'};
        vec3 sunsetRimCol = pow(vec3(0.95, 0.54, 0.44), vec3(2.2));
        gl_FragColor.rgb += sunsetRimCol * rimN * (0.28 + 0.46 * backScatter) * rimWeight;
        ${
          isBasin
            ? `
        // Blend distant Mojave basin sagebrush gently into the rose-violet horizon mist
        float bDist = length(vBotWorldPos.xz - cameraPosition.xz);
        float bMist = smoothstep(50.0, 165.0, bDist);
        vec3 mistCol = pow(vec3(0.50, 0.33, 0.49), vec3(2.2));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, mistCol, bMist * 0.78);`
            : ''
        }
        #include <dithering_fragment>`
      );
  };
}

export function createFoliage({ config, textures }) {
  const group = new THREE.Group();
  group.name = 'MojaveDesertFoliage';

  const sunVec = new THREE.Vector3(...(config.palette.sunsetSunDir || [-0.62, 0.11, -0.78])).normalize();
  const sharedUniforms = {
    uWindTime: { value: 0 },
    uWindAmp: { value: 0 },
  };

  const barkTex = textures?.woodBarkAlbedo || null;
  if (barkTex) {
    barkTex.wrapS = THREE.RepeatWrapping;
    barkTex.wrapT = THREE.RepeatWrapping;
    barkTex.repeat.set(1, 3);
  }

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    color: barkTex ? new THREE.Color('#A67D7E') : new THREE.Color('#664A4D'),
    roughness: 0.91,
    metalness: 0.0,
    envMapIntensity: 0.58,
  });
  attachBotanicalShaderHooks(barkMat, sharedUniforms, { isWood: true, sunDir: sunVec, isBasin: false });

  const softTwigMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    color: new THREE.Color('#B88E88'),
    roughness: 0.90,
    metalness: 0.0,
    envMapIntensity: 0.62,
  });
  attachBotanicalShaderHooks(softTwigMat, sharedUniforms, { isWood: true, sunDir: sunVec, isBasin: false });

  // Lighter dusty-sage material for distant desert basin scrub mounds behind the van!
  const basinBarkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    color: new THREE.Color('#987D7B'),
    roughness: 0.93,
    metalness: 0.0,
    envMapIntensity: 0.45,
  });
  attachBotanicalShaderHooks(basinBarkMat, sharedUniforms, { isWood: true, sunDir: sunVec, isBasin: true });

  const sprigTex = createCreosoteSprigTexture();
  const leafMat = new THREE.MeshStandardMaterial({
    map: sprigTex,
    color: new THREE.Color('#B28E88'),
    roughness: 0.89,
    metalness: 0.0,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    envMapIntensity: 0.58,
  });
  attachBotanicalShaderHooks(leafMat, sharedUniforms, { isWood: false, sunDir: sunVec, isBasin: false });

  const basinLeafMat = new THREE.MeshStandardMaterial({
    map: sprigTex,
    color: new THREE.Color('#A88F84'), // Dusty sage-taupe visible clearly against the basin plain!
    roughness: 0.92,
    metalness: 0.0,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    envMapIntensity: 0.45,
  });
  attachBotanicalShaderHooks(basinLeafMat, sharedUniforms, { isWood: false, sunDir: sunVec, isBasin: true });

  // ---------------------------------------------------------------------------
  // Build 4 rich, organic 3D desert scrub templates
  // ---------------------------------------------------------------------------
  // 1. Lush gnarled hero creosote bush (28 stems -> dense organic Mojave silhouette!)
  const heroCreosote = buildBranchingScrubTemplate({
    seed: 10101,
    primaryStems: 28,
    maxDepth: 2,
    baseLength: 0.54,
    baseRadius: 0.017,
    spreadMin: 0.32,
    spreadMax: 1.18,
    maxHeight: 1.15,
    leafDensity: 0.78,
    leafSize: 0.175,
  });

  // 2. Compact dense desert sagebrush mound (for lower-mid-right foreground clump)
  const compactSage = buildBranchingScrubTemplate({
    seed: 20202,
    primaryStems: 24,
    maxDepth: 2,
    baseLength: 0.33,
    baseRadius: 0.012,
    spreadMin: 0.36,
    spreadMax: 1.24,
    maxHeight: 0.54,
    leafDensity: 0.84,
    leafSize: 0.155,
  });

  // 3. Rounded dusty-sage Mojave basin scrub clump (for 340+ midground/background flats!)
  const basinScrub = buildBranchingScrubTemplate({
    seed: 30303,
    primaryStems: 14,
    maxDepth: 1,
    baseLength: 0.40,
    baseRadius: 0.016,
    spreadMin: 0.42,
    spreadMax: 1.20,
    maxHeight: 0.72,
    leafDensity: 0.92,
    leafSize: 0.25,
  });

  // 4. Soft feathery extreme-foreground desert grass/scrub tussock (with micro-sprigs!)
  const softFgScrub = buildSoftForegroundScrubTemplate(40404);

  function placeTemplateInstances(name, template, instances, woodMat, customLeafMat, castShadow) {
    if (instances.length === 0) return;

    const woodMesh = new THREE.InstancedMesh(template.woodGeo, woodMat, instances.length);
    woodMesh.name = `${name}_Wood`;
    woodMesh.castShadow = castShadow;
    woodMesh.receiveShadow = true;
    woodMesh.frustumCulled = false;

    const leafMesh = template.leafGeo
      ? new THREE.InstancedMesh(template.leafGeo, customLeafMat, instances.length)
      : null;
    if (leafMesh) {
      leafMesh.name = `${name}_Leaves`;
      leafMesh.castShadow = castShadow;
      leafMesh.receiveShadow = true;
      leafMesh.frustumCulled = false;
    }

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    instances.forEach((inst, idx) => {
      const y = sampleTerrainHeight(inst.x, inst.z, config);
      dummy.position.set(inst.x, y, inst.z);
      dummy.rotation.set(inst.tiltX || 0, inst.rotY || 0, inst.tiltZ || 0);
      dummy.scale.set(inst.sx, inst.sy, inst.sz);
      dummy.updateMatrix();

      woodMesh.setMatrixAt(idx, dummy.matrix);
      tint.setRGB(inst.shade, inst.shade * 0.97, inst.shade * 0.96);
      woodMesh.setColorAt(idx, tint);

      if (leafMesh) {
        leafMesh.setMatrixAt(idx, dummy.matrix);
        leafMesh.setColorAt(idx, tint);
      }
    });

    woodMesh.instanceMatrix.needsUpdate = true;
    if (woodMesh.instanceColor) woodMesh.instanceColor.needsUpdate = true;
    group.add(woodMesh);

    if (leafMesh) {
      leafMesh.instanceMatrix.needsUpdate = true;
      if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
      group.add(leafMesh);
    }
  }

  const rand = createPRNG(556677);

  // ---------------------------------------------------------------------------
  // 1. Curated Hero Scrub & Foreground Edge Tufts (exact ref_right_portrait_05s composition!)
  // ---------------------------------------------------------------------------
  const heroList = [];
  const compactList = [];
  const fgTuftList = [];

  const cfgHeroes = config.world.heroScrubPositions || [];
  for (const h of cfgHeroes) {
    const [hx, , hz] = h.pos;
    if (apronSignedDistance(hx, hz, config) < 0.7) continue;
    const s = h.scale || 1.0;

    if (hz >= 24.5) {
      // Delicate low off-center bottom-edge foreground tufts (shrunk ~65% so pebbles breathe cleanly!)
      const shiftedX = Math.abs(hx + 1.8) < 1.8 ? (hx < -1.8 ? hx - 1.6 : hx + 1.8) : hx;
      fgTuftList.push({
        x: shiftedX,
        z: hz,
        sx: s * 0.56,
        sy: s * 0.44,
        sz: s * 0.56,
        rotY: rand() * Math.PI * 2,
        tiltX: (rand() - 0.5) * 0.08,
        tiltZ: (rand() - 0.5) * 0.08,
        shade: 0.92 + rand() * 0.22,
      });
    } else if (s < 0.82) {
      // Compact low rounded lower-mid-right scrub mound
      compactList.push({
        x: hx,
        z: hz,
        sx: s * 1.18,
        sy: s * 0.92,
        sz: s * 1.18,
        rotY: rand() * Math.PI * 2,
        tiltX: (rand() - 0.5) * 0.08,
        tiltZ: (rand() - 0.5) * 0.08,
        shade: 0.92 + rand() * 0.22,
      });
    } else {
      // Prominent gnarled mid-left hero creosote bush below the van!
      heroList.push({
        x: hx,
        z: hz,
        sx: s * 1.18,
        sy: s * 1.00,
        sz: s * 1.18,
        rotY: rand() * Math.PI * 2,
        tiltX: (rand() - 0.5) * 0.06,
        tiltZ: (rand() - 0.5) * 0.06,
        shade: 0.90 + rand() * 0.22,
      });
    }
  }

  // Prominent gnarled hero creosote bush positioned cleanly mid-left below the van's left nose
  // matching ref_right_portrait_05s.png + flanking desert wings
  const companionHeroes = [
    { x: -6.3, z: 13.4, s: 1.02 },
    { x: -7.1, z: 12.8, s: 0.86 },
    { x: -13.6, z: 10.6, s: 1.15 },
    { x: 11.5, z: 11.8, s: 1.05 },
    { x: 15.2, z: 16.0, s: 1.12 },
  ];
  for (const sp of companionHeroes) {
    if (apronSignedDistance(sp.x, sp.z, config) < 0.85) continue;
    heroList.push({
      x: sp.x,
      z: sp.z,
      sx: sp.s * (0.95 + rand() * 0.2),
      sy: sp.s * (0.88 + rand() * 0.18),
      sz: sp.s * (0.95 + rand() * 0.2),
      rotY: rand() * Math.PI * 2,
      tiltX: (rand() - 0.5) * 0.07,
      tiltZ: (rand() - 0.5) * 0.07,
      shade: 0.88 + rand() * 0.24,
    });
  }

  // Small compact sagebrush mound lower-mid-right (exact ref_right_portrait_05s balance!)
  compactList.push({
    x: 0.5,
    z: 22.4,
    sx: 0.72,
    sy: 0.56,
    sz: 0.72,
    rotY: 1.4,
    tiltX: 0.02,
    tiltZ: -0.02,
    shade: 0.96,
  });

  // Additional compact sagebrush strictly outside the clear central pump/van sightline
  for (let i = 0; i < 16; i++) {
    const x = -20.0 + rand() * 40.0;
    const z = 8.0 + rand() * 21.0;
    if (apronSignedDistance(x, z, config) < 1.3) continue;
    if (x > -6.4 && x < 5.8 && z < 24.0) continue;
    const s = 0.60 + rand() * 0.50;
    compactList.push({
      x,
      z,
      sx: s * (0.95 + rand() * 0.28),
      sy: s * (0.76 + rand() * 0.22),
      sz: s * (0.95 + rand() * 0.28),
      rotY: rand() * Math.PI * 2,
      tiltX: (rand() - 0.5) * 0.1,
      tiltZ: (rand() - 0.5) * 0.1,
      shade: 0.84 + rand() * 0.28,
    });
  }

  // Delicate low off-center extreme-foreground dry scrub tufts (NO giant bottom-center blocker!)
  const extraTufts = [
    { x: -5.4, z: 27.6, s: 0.54 },
    { x: -7.4, z: 26.5, s: 0.62 },
    { x: 2.8, z: 27.4, s: 0.52 },
    { x: -4.2, z: 28.9, s: 0.48 },
    { x: 1.9, z: 28.8, s: 0.46 },
    { x: -9.4, z: 24.8, s: 0.75 },
    { x: 5.2, z: 25.4, s: 0.65 },
  ];
  for (const t of extraTufts) {
    fgTuftList.push({
      x: t.x,
      z: t.z,
      sx: t.s * (0.95 + rand() * 0.22),
      sy: t.s * (0.80 + rand() * 0.20),
      sz: t.s * (0.95 + rand() * 0.22),
      rotY: rand() * Math.PI * 2,
      tiltX: (rand() - 0.5) * 0.08,
      tiltZ: (rand() - 0.5) * 0.08,
      shade: 0.90 + rand() * 0.24,
    });
  }

  placeTemplateInstances('HeroCreosoteBushes', heroCreosote, heroList, barkMat, leafMat, true);
  placeTemplateInstances('CompactDesertSagebrush', compactSage, compactList, barkMat, leafMat, true);
  placeTemplateInstances('ForegroundSoftDryScrub', softFgScrub, fgTuftList, softTwigMat, leafMat, true);

  // ---------------------------------------------------------------------------
  // 2. 340+ Dusty-Sage Mojave Basin Scrub Mounds (Populates entire flat behind van!)
  // ---------------------------------------------------------------------------
  const basinList = [];
  for (let i = 0; i < 360; i++) {
    let x, z;
    if (i < 160) {
      // Dense immediate midground desert flat directly behind & left of the van (eliminates barren strip!)
      x = -48.0 + rand() * 44.0;
      z = -46.0 + rand() * 52.0;
    } else if (i < 305) {
      // Vast rear Mojave sagebrush plain stretching all the way toward distant valley highway lights
      x = -110.0 + rand() * 116.0;
      z = -115.0 + rand() * 75.0;
    } else {
      // Right desert flank beyond convenience store (widescreen & interactive orbit)
      x = 13.0 + rand() * 52.0;
      z = -68.0 + rand() * 86.0;
    }

    if (apronSignedDistance(x, z, config) < 1.6) continue;
    // Keep foreground open gravel carpet reserved for curated hero bushes
    if (z > 6.5 && x > -16.0 && x < 14.0) continue;

    // Slight scale boost farther out so distant Mojave scrub reads cleanly in horizontal bands
    const distBoost = z < -30 ? 1.15 + rand() * 0.55 : 0.72 + rand() * 0.75;
    basinList.push({
      x,
      z,
      sx: distBoost * (1.15 + rand() * 0.40),
      sy: distBoost * (0.62 + rand() * 0.30), // Low broad Mojave creosote/sagebrush mound silhouette
      sz: distBoost * (1.15 + rand() * 0.40),
      rotY: rand() * Math.PI * 2,
      tiltX: 0,
      tiltZ: 0,
      shade: 0.85 + rand() * 0.32,
    });
  }

  // Split near-midground basin bushes (cast real sunset/headlight shadows!) from far horizon basin scrub
  const nearBasinList = [];
  const farBasinList = [];
  for (const b of basinList) {
    if (b.x > -26 && b.x < 22 && b.z > -22 && b.z < 18) {
      nearBasinList.push(b);
    } else {
      farBasinList.push(b);
    }
  }
  placeTemplateInstances('NearBasinMojaveScrub', basinScrub, nearBasinList, basinBarkMat, basinLeafMat, true);
  placeTemplateInstances('BasinMojaveScrub', basinScrub, farBasinList, basinBarkMat, basinLeafMat, false);

  let windClock = 0;

  function update(_t, dt, opts = {}) {
    if (opts.livingWorld) {
      windClock += Math.min(dt || 0.016, 0.1);
      sharedUniforms.uWindTime.value = windClock;
      sharedUniforms.uWindAmp.value = THREE.MathUtils.lerp(
        sharedUniforms.uWindAmp.value,
        1.0,
        Math.min(1, (dt || 0.016) * 4.0)
      );
    } else {
      windClock = 0;
      sharedUniforms.uWindTime.value = 0;
      sharedUniforms.uWindAmp.value = 0;
    }
  }

  return {
    group,
    update,
  };
}
