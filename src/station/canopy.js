import * as THREE from 'three';

/**
 * Procedural brushed metal roughness & bump texture for the salmon-coral canopy fascia
 * and metallic columns.
 */
function createBrushedMetalMaps() {
  const w = 512;
  const h = 256;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = w;
  roughCanvas.height = h;
  const rctx = roughCanvas.getContext('2d');

  rctx.fillStyle = '#686868';
  rctx.fillRect(0, 0, w, h);

  // Horizontal brushed aluminum streaks + subtle panel joints
  for (let y = 0; y < h; y++) {
    const streak = 88 + Math.floor(Math.sin(y * 1.7) * 12 + (Math.sin(y * 13.3) * 0.5 + 0.5) * 26);
    rctx.fillStyle = `rgb(${streak},${streak},${streak})`;
    rctx.fillRect(0, y, w, 1);
  }
  // Subtle vertical sheet-metal seam lines
  rctx.fillStyle = '#3a3a3a';
  for (let x = 0; x < w; x += 128) {
    rctx.fillRect(x, 0, 2, h);
  }
  // Subtle weathered top-to-bottom grime gradient
  const grad = rctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(30,30,30,0.22)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
  grad.addColorStop(1, 'rgba(55,55,55,0.28)');
  rctx.fillStyle = grad;
  rctx.fillRect(0, 0, w, h);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 1);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  return { roughnessMap };
}

/**
 * Prismatic warm-tungsten soffit troffer diffuser canvas texture.
 */
function createTrofferTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');

  const g = ctx.createRadialGradient(128, 64, 8, 128, 64, 130);
  g.addColorStop(0, '#FFFDF5');
  g.addColorStop(0.55, '#FFF1C8');
  g.addColorStop(1, '#F5CE82');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);

  // Subtle fluorescent tube ribs behind the acrylic diffuser
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(14, 28, 228, 18);
  ctx.fillRect(14, 82, 228, 18);

  // Fine prismatic grid texture
  ctx.strokeStyle = 'rgba(180, 140, 85, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 256; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }
  for (let y = 0; y < 128; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft radial soffit bounce glow texture placed around recessed ceiling fixtures.
 */
function createSoffitGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
  g.addColorStop(0, 'rgba(255, 232, 178, 0.72)');
  g.addColorStop(0.45, 'rgba(255, 205, 130, 0.28)');
  g.addColorStop(1, 'rgba(255, 180, 95, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a continuous rounded-corner horizontal rectangle CurvePath at elevation `y`.
 */
function createRoundedRectPath3D(width, depth, y, cornerRadius = 0.07) {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const r = Math.min(cornerRadius, hw * 0.25, hd * 0.25);

  const path = new THREE.CurvePath();

  // Front edge (-hw+r -> +hw-r at +hd)
  path.add(new THREE.LineCurve3(new THREE.Vector3(-hw + r, y, hd), new THREE.Vector3(hw - r, y, hd)));
  // Front-right corner
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(hw - r, y, hd),
      new THREE.Vector3(hw, y, hd),
      new THREE.Vector3(hw, y, hd - r)
    )
  );
  // Right edge (+hd-r -> -hd+r at +hw)
  path.add(new THREE.LineCurve3(new THREE.Vector3(hw, y, hd - r), new THREE.Vector3(hw, y, -hd + r)));
  // Back-right corner
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(hw, y, -hd + r),
      new THREE.Vector3(hw, y, -hd),
      new THREE.Vector3(hw - r, y, -hd)
    )
  );
  // Back edge (+hw-r -> -hw+r at -hd)
  path.add(new THREE.LineCurve3(new THREE.Vector3(hw - r, y, -hd), new THREE.Vector3(-hw + r, y, -hd)));
  // Back-left corner
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-hw + r, y, -hd),
      new THREE.Vector3(-hw, y, -hd),
      new THREE.Vector3(-hw, y, -hd + r)
    )
  );
  // Left edge (-hd+r -> +hd-r at -hw)
  path.add(new THREE.LineCurve3(new THREE.Vector3(-hw, y, -hd + r), new THREE.Vector3(-hw, y, hd - r)));
  // Front-left corner
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-hw, y, hd - r),
      new THREE.Vector3(-hw, y, hd),
      new THREE.Vector3(-hw + r, y, hd)
    )
  );

  return path;
}

/**
 * Chamfered square cross-section for slender metallic canopy columns.
 */
function createChamferedColumnGeo(size, height, bevel = 0.018) {
  const h = size * 0.5;
  const b = bevel;
  const shape = new THREE.Shape();
  shape.moveTo(-h + b, -h);
  shape.lineTo(h - b, -h);
  shape.lineTo(h, -h + b);
  shape.lineTo(h, h - b);
  shape.lineTo(h - b, h);
  shape.lineTo(-h + b, h);
  shape.lineTo(-h, h - b);
  shape.lineTo(-h, -h + b);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 2,
  });
  // Extrude runs along +Z; rotate so it runs vertically from Y=0 to Y=height
  geo.rotateX(-Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

export function createCanopy({ config }) {
  const group = new THREE.Group();
  group.name = 'StationCanopy';

  const cfg = config.station.canopy;
  const apronY = config.world.apron.center[1]; // 0.025
  const [cx, , cz] = cfg.center; // [2.0, 0, -0.4]
  const W = cfg.width; // 8.8
  const D = cfg.depth; // 4.6
  const soffitY = cfg.soffitY; // 3.85
  const fasciaH = cfg.fasciaHeight; // 0.55

  const { roughnessMap: brushedRough } = createBrushedMetalMaps();

  // --- Materials ---
  const fasciaMat = new THREE.MeshStandardMaterial({
    // Deep electric-teal anodized matte metal with subtle cyan backlit glow (ZERO white specular glare!)
    color: new THREE.Color('#0C3E56'),
    emissive: new THREE.Color('#0088AA'),
    emissiveIntensity: 0.55,
    metalness: 0.15,
    roughness: 0.78,
    roughnessMap: brushedRough,
  });

  const copingMat = new THREE.MeshStandardMaterial({
    color: '#192938',
    metalness: 0.35,
    roughness: 0.65,
  });

  const aluminumTrimMat = new THREE.MeshStandardMaterial({
    color: '#9FB6C4',
    metalness: 0.52,
    roughness: 0.54,
    roughnessMap: brushedRough,
  });

  const soffitMat = new THREE.MeshStandardMaterial({
    // Satin warm-bounce canopy ceiling so underside catches rich tungsten GI instead of reading dead dark
    color: '#6E5A5E',
    emissive: new THREE.Color('#3F281A'),
    emissiveIntensity: 0.48,
    metalness: 0.14,
    roughness: 0.62,
  });

  const roofMembraneMat = new THREE.MeshStandardMaterial({
    color: '#2B252E',
    metalness: 0.06,
    roughness: 0.92,
  });

  const neonCyanMat = new THREE.MeshStandardMaterial({
    // Saturated pure electric cyan neon tubes so ACES keeps vivid aqua-cyan glow!
    color: '#00D8FF',
    emissive: new THREE.Color('#00E6FF'),
    emissiveIntensity: 2.35,
    roughness: 0.14,
    metalness: 0.0,
  });

  const standoffMat = new THREE.MeshStandardMaterial({
    color: '#18202A',
    metalness: 0.55,
    roughness: 0.62,
  });

  // --- Canopy Roof & Fascia Assembly (centered at cx, cz) ---
  const roofGroup = new THREE.Group();
  roofGroup.position.set(cx, 0, cz);
  group.add(roofGroup);

  // Main brushed salmon-coral fascia core
  const fasciaBodyH = fasciaH - 0.09; // leaves room for top coping & bottom drip trim
  const fasciaGeo = new THREE.BoxGeometry(W, fasciaBodyH, D);
  const fasciaMesh = new THREE.Mesh(fasciaGeo, fasciaMat);
  fasciaMesh.position.y = soffitY + 0.04 + fasciaBodyH * 0.5;
  fasciaMesh.castShadow = true;
  fasciaMesh.receiveShadow = true;
  roofGroup.add(fasciaMesh);

  // Top dark steel parapet coping cap (slightly overhanging fascia)
  const topCopingGeo = new THREE.BoxGeometry(W + 0.08, 0.055, D + 0.08);
  const topCoping = new THREE.Mesh(topCopingGeo, copingMat);
  topCoping.position.y = soffitY + fasciaH - 0.025;
  topCoping.castShadow = true;
  topCoping.receiveShadow = true;
  roofGroup.add(topCoping);

  // Recessed gravel/tar roof deck on top
  const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.02, D - 0.16), roofMembraneMat);
  roofDeck.position.y = soffitY + fasciaH + 0.005;
  roofDeck.receiveShadow = true;
  roofGroup.add(roofDeck);

  // Lower brushed aluminum drip-edge trim collar
  const lowerTrimGeo = new THREE.BoxGeometry(W + 0.04, 0.042, D + 0.04);
  const lowerTrim = new THREE.Mesh(lowerTrimGeo, aluminumTrimMat);
  lowerTrim.position.y = soffitY + 0.021;
  lowerTrim.castShadow = true;
  lowerTrim.receiveShadow = true;
  roofGroup.add(lowerTrim);

  // Recessed soffit ceiling panel
  const soffitGeo = new THREE.PlaneGeometry(W - 0.12, D - 0.12);
  const soffitMesh = new THREE.Mesh(soffitGeo, soffitMat);
  soffitMesh.rotation.x = Math.PI * 0.5;
  soffitMesh.position.y = soffitY + 0.004;
  soffitMesh.receiveShadow = true;
  roofGroup.add(soffitMesh);

  // Subtle soffit structural ribbing / panel seams
  const seamMat = new THREE.MeshStandardMaterial({ color: '#B7AEA6', roughness: 0.6, metalness: 0.2 });
  for (let i = -3; i <= 3; i++) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, D - 0.18), seamMat);
    seam.position.set(i * 1.15, soffitY + 0.002, 0);
    roofGroup.add(seam);
  }

  // --- 3 Stacked Continuous Electric-Cyan Neon Tubes + Dark Mounting Raceway + Standoff Brackets ---
  const tubeOffsetsY = [soffitY + 0.11, soffitY + 0.275, soffitY + 0.44];
  const tubeWidth = W + 0.10;
  const tubeDepth = D + 0.10;
  const neonMeshes = [];

  for (const ty of tubeOffsetsY) {
    // Thin dark mounting raceway channel hugging the fascia behind the tube
    const raceway = new THREE.Mesh(new THREE.BoxGeometry(W + 0.025, 0.024, D + 0.025), standoffMat);
    raceway.position.y = ty;
    roofGroup.add(raceway);

    // Continuous bent-glass electric-cyan neon loop around all 4 fascia faces (crisp 2.5cm tube)
    const tubePath = createRoundedRectPath3D(tubeWidth, tubeDepth, ty, 0.075);
    const tubeGeo = new THREE.TubeGeometry(tubePath, 144, 0.025, 10, true);
    const tubeMesh = new THREE.Mesh(tubeGeo, neonCyanMat);
    tubeMesh.userData.noShadowCast = true;
    roofGroup.add(tubeMesh);
    neonMeshes.push(tubeMesh);
  }

  // Standoff brackets holding the neon tubes off the fascia (InstancedMesh)
  const bracketPositions = [];
  const xStep = 0.8;
  for (let x = -W * 0.5 + 0.4; x <= W * 0.5 - 0.39; x += xStep) {
    for (const ty of tubeOffsetsY) {
      bracketPositions.push({ pos: [x, ty, D * 0.5 + 0.028], rotY: 0 });
      bracketPositions.push({ pos: [x, ty, -D * 0.5 - 0.028], rotY: 0 });
    }
  }
  const zStep = 0.75;
  for (let z = -D * 0.5 + 0.4; z <= D * 0.5 - 0.39; z += zStep) {
    for (const ty of tubeOffsetsY) {
      bracketPositions.push({ pos: [-W * 0.5 - 0.028, ty, z], rotY: Math.PI * 0.5 });
      bracketPositions.push({ pos: [W * 0.5 + 0.028, ty, z], rotY: Math.PI * 0.5 });
    }
  }
  const bracketGeo = new THREE.BoxGeometry(0.024, 0.024, 0.062);
  const bracketInst = new THREE.InstancedMesh(bracketGeo, standoffMat, bracketPositions.length);
  const dummy = new THREE.Object3D();
  bracketPositions.forEach((b, i) => {
    dummy.position.set(b.pos[0], b.pos[1], b.pos[2]);
    dummy.rotation.set(0, b.rotY, 0);
    dummy.updateMatrix();
    bracketInst.setMatrixAt(i, dummy.matrix);
  });
  bracketInst.instanceMatrix.needsUpdate = true;
  roofGroup.add(bracketInst);

  // --- 6 Recessed Warm-Tungsten Soffit Ceiling Light Fixtures (2 rows × 3 lanes) ---
  // Physically recessed louver baffles + crisp bright warm-tungsten diffuser lenses
  const trofferTex = createTrofferTexture();

  const trofferPanelMat = new THREE.MeshStandardMaterial({
    color: '#FFECC4',
    map: trofferTex,
    emissive: new THREE.Color('#FFE5A8'),
    emissiveMap: trofferTex,
    emissiveIntensity: 1.95,
    roughness: 0.22,
    metalness: 0.0,
  });

  const baffleMat = new THREE.MeshStandardMaterial({
    color: '#2A2328',
    metalness: 0.55,
    roughness: 0.55,
  });

  // Aligned over the 3 pump X positions (-0.3, 1.8, 3.9 => localX -2.3, -0.2, 1.9)
  const fixtureXs = [-2.3, -0.2, 1.9];
  const fixtureZs = [-0.95, 0.95];

  const trimOuterGeo = new THREE.BoxGeometry(0.98, 0.026, 0.50);
  const baffleInnerGeo = new THREE.BoxGeometry(0.88, 0.038, 0.40);
  const lensGeo = new THREE.PlaneGeometry(0.82, 0.34);

  for (const fx of fixtureXs) {
    for (const fz of fixtureZs) {
      const fixGroup = new THREE.Group();
      fixGroup.position.set(fx, soffitY, fz);

      // Bevelled satin-aluminum outer trim collar flush with soffit
      const frame = new THREE.Mesh(trimOuterGeo, aluminumTrimMat);
      frame.position.y = -0.002;
      fixGroup.add(frame);

      // Recessed dark louver baffle rim giving physical troffer depth
      const baffle = new THREE.Mesh(baffleInnerGeo, baffleMat);
      baffle.position.y = 0.012;
      fixGroup.add(baffle);

      // Glowing recessed warm tungsten diffuser lens facing downward (-Y)
      const lens = new THREE.Mesh(lensGeo, trofferPanelMat);
      lens.rotation.x = Math.PI * 0.5;
      lens.position.y = -0.016;
      lens.userData.noShadowCast = true;
      fixGroup.add(lens);

      roofGroup.add(fixGroup);
    }
  }

  // --- 4 Slender Metallic Columns with Dark Protective Plinths ---
  const pillarMat = new THREE.MeshStandardMaterial({
    color: '#CFC8C4',
    metalness: 0.38,
    roughness: 0.65,
    roughnessMap: brushedRough,
  });

  const plinthMat = new THREE.MeshStandardMaterial({
    color: '#26232B',
    metalness: 0.62,
    roughness: 0.46,
  });

  const colHeight = soffitY - apronY; // 3.825
  const shaftGeo = createChamferedColumnGeo(0.165, colHeight, 0.022);
  const plinthGeo = createChamferedColumnGeo(0.245, 0.34, 0.026);
  const basePlateGeo = new THREE.BoxGeometry(0.32, 0.032, 0.32);
  const capCollarGeo = new THREE.BoxGeometry(0.27, 0.09, 0.27);
  const boltGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.022, 6);

  cfg.pillars.forEach(([px, , pz], idx) => {
    const colGroup = new THREE.Group();
    colGroup.position.set(px, apronY, pz);

    const shaft = new THREE.Mesh(shaftGeo, pillarMat);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    colGroup.add(shaft);

    // Protective dark lower plinth shroud
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    colGroup.add(plinth);

    // Bolted steel floor anchor plate
    const basePlate = new THREE.Mesh(basePlateGeo, standoffMat);
    basePlate.position.y = 0.016;
    basePlate.receiveShadow = true;
    colGroup.add(basePlate);

    for (const bx of [-0.115, 0.115]) {
      for (const bz of [-0.115, 0.115]) {
        const bolt = new THREE.Mesh(boltGeo, aluminumTrimMat);
        bolt.position.set(bx, 0.036, bz);
        colGroup.add(bolt);
      }
    }

    // Upper capital mounting collar at soffit
    const collar = new THREE.Mesh(capCollarGeo, plinthMat);
    collar.position.y = colHeight - 0.045;
    colGroup.add(collar);

    // Micro-detail: slim vertical electrical conduit + emergency shutoff box on front-right pillar
    if (idx === 3) {
      const conduit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, colHeight - 0.2, 8),
        standoffMat
      );
      conduit.position.set(0.095, colHeight * 0.5, -0.02);
      colGroup.add(conduit);

      const shutoffBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.18, 0.12),
        new THREE.MeshStandardMaterial({ color: '#B82320', roughness: 0.35, metalness: 0.3 })
      );
      shutoffBox.position.set(0.105, 1.42, -0.02);
      colGroup.add(shutoffBox);
    }

    group.add(colGroup);
  });

  // --- Red Steel Safety Bollards flanking the Pump Islands ---
  const redBollardMat = new THREE.MeshStandardMaterial({
    color: '#C82320',
    metalness: 0.34,
    roughness: 0.28,
  });
  const reflectiveBandMat = new THREE.MeshStandardMaterial({
    color: '#ECE9E2',
    emissive: '#FFE8D0',
    emissiveIntensity: 0.18,
    metalness: 0.2,
    roughness: 0.3,
  });

  const bollardShaftGeo = new THREE.CylinderGeometry(0.065, 0.068, 0.88, 16);
  const bollardCapGeo = new THREE.SphereGeometry(0.065, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const bollardBaseGeo = new THREE.CylinderGeometry(0.098, 0.105, 0.035, 16);
  const bollardBandGeo = new THREE.CylinderGeometry(0.067, 0.067, 0.075, 16);

  // Positioned cleanly guarding the pump island ends (never clipping pillars or pumps)
  const redBollardCoords = [
    [-1.58, apronY, 0.28],
    [-1.58, apronY, -0.68],
    [4.62, apronY, 0.44], // Prominent red bollard beside front-right pillar (matches reference!)
    [4.62, apronY, -0.68],
  ];

  for (const [bx, by, bz] of redBollardCoords) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, by, bz);

    const base = new THREE.Mesh(bollardBaseGeo, plinthMat);
    base.position.y = 0.0175;
    base.receiveShadow = true;
    bGroup.add(base);

    const shaft = new THREE.Mesh(bollardShaftGeo, redBollardMat);
    shaft.position.y = 0.035 + 0.44;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bGroup.add(shaft);

    const cap = new THREE.Mesh(bollardCapGeo, redBollardMat);
    cap.position.y = 0.035 + 0.88;
    cap.castShadow = true;
    bGroup.add(cap);

    const band = new THREE.Mesh(bollardBandGeo, reflectiveBandMat);
    band.position.y = 0.76;
    bGroup.add(band);

    group.add(bGroup);
  }

  // Master canopy shadow-casting SpotLights, soffit RectAreaLight, and cyan neon RectAreaLights
  // live centrally in src/lighting.js (zero redundant/conflicting point lights here!).
  const canopyLights = [];
  const neonLights = [];

  function update(t, _dt, opts) {
    if (opts?.livingWorld) {
      const hum = 2.35 + Math.sin(t * 23.0) * 0.03 + Math.sin(t * 5.7) * 0.02;
      neonCyanMat.emissiveIntensity = hum;
    } else {
      neonCyanMat.emissiveIntensity = 2.35;
    }
  }

  return {
    group,
    lights: {
      canopy: canopyLights,
      neon: neonLights,
    },
    update,
  };
}
