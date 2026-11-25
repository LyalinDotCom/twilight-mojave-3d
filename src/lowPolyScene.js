import * as THREE from 'three';

/**
 * Faithful flat-shaded low-poly "Before" scene matching the left panel of
 * tFeMuURbfQRLZsSf.mp4 — shares the exact same world coordinates and camera
 * matrix as the photoreal hero scene for synchronized Split-Screen Benchmark Mode.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createStarShape(outerR, innerR) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 + Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function createLowPolyScene(config) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#7B488C');
  scene.fog = new THREE.Fog('#A85478', 110, 390);

  // Bright Firewatch-style low-poly lighting with crisp low grazing sun for sharp faceted triangles!
  const dirLight = new THREE.DirectionalLight('#FFC69C', 2.25);
  dirLight.position.set(-42, 13, 18);
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight('#B878CC', '#7C3A52', 1.35);
  scene.add(hemiLight);

  // 1. Simple 3-stop linear gradient sky dome (with proper sRGB colorspace_fragment!)
  const skyGeo = new THREE.SphereGeometry(420, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#6A428C') },
      uMid: { value: new THREE.Color('#C4627E') },
      uHorizon: { value: new THREE.Color('#F3986F') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.03, 0.25, h));
        col = mix(col, uTop, smoothstep(0.24, 0.56, h));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // 2. Flat opaque hexagonal pill clouds (matching left panel)
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#F6AA92', side: THREE.DoubleSide });
  const cloudSpecs = [
    { pos: [-14, 72, -145], w: 30, h: 2.4 },
    { pos: [10, 58, -148], w: 38, h: 2.8 },
    { pos: [-46, 50, -140], w: 36, h: 2.9 },
    { pos: [34, 42, -146], w: 26, h: 2.2 },
    { pos: [-22, 34, -142], w: 48, h: 3.1 },
    { pos: [26, 26, -145], w: 32, h: 2.4 },
    { pos: [-54, 18, -138], w: 30, h: 2.4 },
  ];
  for (const c of cloudSpecs) {
    const shape = new THREE.Shape();
    const hw = c.w * 0.5;
    const hh = c.h * 0.5;
    const tip = Math.min(hw * 0.25, 5.5);
    shape.moveTo(-hw, 0);
    shape.lineTo(-hw + tip, hh);
    shape.lineTo(hw - tip, hh);
    shape.lineTo(hw, 0);
    shape.lineTo(hw - tip, -hh);
    shape.lineTo(-hw + tip, -hh);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), cloudMat);
    mesh.position.set(...c.pos);
    scene.add(mesh);
  }

  // 3. Faceted triangular desert mountain ridge (crisp low-poly facets rising behind canopy/star like ref left panel)
  const rng = mulberry32(4242);
  const mtnGeo = new THREE.PlaneGeometry(540, 82, 54, 7);
  mtnGeo.rotateX(-Math.PI / 2);
  const mPos = mtnGeo.attributes.position;
  for (let i = 0; i < mPos.count; i++) {
    const x = mPos.getX(i);
    const z = mPos.getZ(i);
    const edgeFade = Math.max(0, 1 - Math.abs(z) / 39);
    const rightBias = THREE.MathUtils.smoothstep(x, -15, 130) * 24;
    const leftRidge = Math.exp(-Math.pow((x + 85) / 62, 2)) * 18;
    const ridge =
      Math.abs(Math.sin(x * 0.036 + 0.5)) * 15 +
      Math.abs(Math.cos(x * 0.075 - 0.3)) * 8.5 +
      (rng() - 0.5) * 7.5;
    const h = Math.max(0, (12 + rightBias + leftRidge + ridge) * edgeFade);
    mPos.setX(i, x + (rng() - 0.5) * 4.0);
    mPos.setY(i, h);
  }
  const mtnNonIndexed = mtnGeo.toNonIndexed();
  mtnNonIndexed.computeVertexNormals();
  const mtnMat = new THREE.MeshStandardMaterial({
    color: '#7C4574',
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });
  const mtnMesh = new THREE.Mesh(mtnNonIndexed, mtnMat);
  mtnMesh.position.set(0, -1.0, -195);
  scene.add(mtnMesh);

  // 4. Crisp faceted triangulated low-poly dusty plum floor (prominent triangulated facets matching ref left!)
  const floorGeo = new THREE.PlaneGeometry(200, 260, 62, 74);
  floorGeo.rotateX(-Math.PI / 2);
  const fPos = floorGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const x = fPos.getX(i);
    const zLocal = fPos.getZ(i);
    const zWorld = zLocal - 55;
    const inApron = x > -9.2 && x < 14.2 && zWorld > -7.2 && zWorld < 6.4;
    if (!inApron) {
      fPos.setX(i, x + (rng() - 0.5) * 1.15);
      fPos.setZ(i, zLocal + (rng() - 0.5) * 1.15);
      fPos.setY(i, (rng() - 0.5) * 0.58);
    }
  }
  const floorNonIdx = floorGeo.toNonIndexed();
  floorNonIdx.computeVertexNormals();
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#8E4860',
    roughness: 0.94,
    metalness: 0.0,
    flatShading: true,
  });
  const floorMesh = new THREE.Mesh(floorNonIdx, floorMat);
  floorMesh.position.set(0, 0, -55);
  scene.add(floorMesh);

  // Flat concrete apron
  const apronCfg = config.world.apron;
  const apronMesh = new THREE.Mesh(
    new THREE.BoxGeometry(apronCfg.width, 0.05, apronCfg.depth),
    new THREE.MeshStandardMaterial({ color: '#9C687A', roughness: 0.9, flatShading: true })
  );
  apronMesh.position.set(...apronCfg.center);
  scene.add(apronMesh);

  // Scattered angular low-poly rocks (small & flat, matching left panel)
  const rockGeo = new THREE.DodecahedronGeometry(0.14, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: '#5C3144',
    roughness: 0.9,
    flatShading: true,
  });
  const rockCount = 140;
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rockCount; i++) {
    const rx = (rng() - 0.5) * 34;
    const rz = 5.5 + rng() * 25.0;
    const s = 0.45 + rng() * 1.1;
    dummy.position.set(rx, 0.03, rz);
    dummy.rotation.set(rng() * 3, rng() * 6, rng() * 3);
    dummy.scale.set(s * (0.8 + rng() * 0.6), s * 0.48, s * (0.8 + rng() * 0.6));
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  scene.add(rockInst);

  // Spiky straight-blade low-poly grass tufts (matching ref left panel 1:1!)
  const grassMat = new THREE.MeshStandardMaterial({
    color: '#AF8C5E',
    roughness: 0.85,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const bladeGeo = new THREE.ConeGeometry(0.048, 0.92, 3);
  bladeGeo.translate(0, 0.46, 0);

  function addGrassTuft(x, z, scale = 1.0, blades = 11) {
    const tuft = new THREE.Group();
    tuft.position.set(x, 0, z);
    for (let i = 0; i < blades; i++) {
      const blade = new THREE.Mesh(bladeGeo, grassMat);
      const ang = (i / blades) * Math.PI * 2 + rng() * 0.4;
      const tilt = 0.36 + rng() * 0.6;
      blade.rotation.y = ang;
      blade.rotation.z = tilt;
      const h = (0.68 + rng() * 0.78) * scale;
      blade.scale.set(scale * 0.88, h, scale * 0.88);
      tuft.add(blade);
    }
    scene.add(tuft);
  }

  // Exact ref left-panel tuft composition: iconic mid-left below van, mid-right, dramatic bottom foreground
  addGrassTuft(-6.6, 13.8, 1.18, 14);
  addGrassTuft(0.6, 20.2, 0.76, 11);
  addGrassTuft(-1.9, 27.2, 0.92, 13);
  addGrassTuft(5.2, 14.5, 0.52, 8);
  addGrassTuft(-10.5, 16.0, 0.75, 9);

  // 5. Blocky 2-tone left-facing low-poly van (exact position/rotation as hero van)
  const vanGroup = new THREE.Group();
  vanGroup.position.set(...config.van.position);
  vanGroup.rotation.y = config.van.rotationY;

  const vanBlueMat = new THREE.MeshStandardMaterial({ color: '#4E7D96', roughness: 0.75, flatShading: true });
  const vanTopMat = new THREE.MeshStandardMaterial({ color: '#D6D8DE', roughness: 0.72, flatShading: true });
  const vanWinMat = new THREE.MeshStandardMaterial({ color: '#2B3646', roughness: 0.45, flatShading: true });
  const vanTireMat = new THREE.MeshStandardMaterial({ color: '#24232B', roughness: 0.9, flatShading: true });
  const vanHubMat = new THREE.MeshStandardMaterial({ color: '#B5B8C2', roughness: 0.5, flatShading: true });
  const vanLightMat = new THREE.MeshBasicMaterial({ color: '#FFF4C4' });

  // Lower blue hull
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.82, 1.82), vanBlueMat);
  lowerBody.position.set(0, 0.76, 0);
  vanGroup.add(lowerBody);

  // Upper off-white cabin
  const upperBody = new THREE.Mesh(new THREE.BoxGeometry(4.32, 0.74, 1.76), vanTopMat);
  upperBody.position.set(0.08, 1.54, 0);
  vanGroup.add(upperBody);

  // 3 flat dark side windows (both sides)
  const winXs = [-1.2, 0.15, 1.45];
  for (const wx of winXs) {
    const winMesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.48, 1.8), vanWinMat);
    winMesh.position.set(wx, 1.54, 0);
    vanGroup.add(winMesh);
  }
  // Front windshield on -X nose
  const frontWin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.54, 1.54), vanWinMat);
  frontWin.position.set(-2.06, 1.52, 0);
  frontWin.rotation.z = -0.2;
  vanGroup.add(frontWin);

  // Square glowing headlights on -X nose
  for (const hz of [-0.55, 0.55]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.24), vanLightMat);
    hl.position.set(-2.24, 0.74, hz);
    vanGroup.add(hl);
  }

  // Bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(4.68, 0.14, 1.88), vanTireMat);
  bumper.position.set(0, 0.42, 0);
  vanGroup.add(bumper);

  // 4 flat cylindrical wheels
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.26, 8);
  hubGeo.rotateX(Math.PI / 2);
  const wheelCoords = [
    [-1.25, 0.34, 0.84],
    [-1.25, 0.34, -0.84],
    [1.25, 0.34, 0.84],
    [1.25, 0.34, -0.84],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const w = new THREE.Mesh(wheelGeo, vanTireMat);
    w.position.set(wx, wy, wz);
    vanGroup.add(w);
    const h = new THREE.Mesh(hubGeo, vanHubMat);
    h.position.set(wx, wy, wz);
    vanGroup.add(h);
  }
  scene.add(vanGroup);

  // 6. Low-Poly Gas Station (exact positions from CONFIG.station)
  const stGroup = new THREE.Group();
  const canopy = config.station.canopy;
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#E8EDF2', roughness: 0.7, flatShading: true });
  const cyanBandMat = new THREE.MeshBasicMaterial({ color: '#7AE2F5' });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#D6DADF', roughness: 0.75, flatShading: true });

  // Canopy slab + cyan stripe
  const canopyRoof = new THREE.Mesh(
    new THREE.BoxGeometry(canopy.width, canopy.fasciaHeight, canopy.depth),
    whiteMat
  );
  canopyRoof.position.set(canopy.center[0], canopy.soffitY + canopy.fasciaHeight * 0.5, canopy.center[2]);
  stGroup.add(canopyRoof);

  const canopyStripe = new THREE.Mesh(
    new THREE.BoxGeometry(canopy.width + 0.04, 0.18, canopy.depth + 0.04),
    cyanBandMat
  );
  canopyStripe.position.set(canopy.center[0], canopy.soffitY + canopy.fasciaHeight * 0.45, canopy.center[2]);
  stGroup.add(canopyStripe);

  // 4 pillars
  const pillarGeo = new THREE.BoxGeometry(0.24, canopy.soffitY, 0.24);
  for (const [px, _py, pz] of canopy.pillars) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(px, canopy.soffitY * 0.5, pz);
    stGroup.add(p);
  }

  // Pump island
  const isl = config.world.pumpIsland;
  const islandMesh = new THREE.Mesh(
    new THREE.BoxGeometry(isl.width, isl.height, isl.depth),
    new THREE.MeshStandardMaterial({ color: '#B49FA8', roughness: 0.85, flatShading: true })
  );
  islandMesh.position.set(isl.center[0], isl.center[1] + isl.height * 0.5, isl.center[2]);
  stGroup.add(islandMesh);

  // 3 Blocky Fuel Pumps (red, blue, red caps — matching left panel!)
  const pumpCapColors = ['#C93E3E', '#3D7AC4', '#C93E3E'];
  const pumpBodyMat = new THREE.MeshStandardMaterial({ color: '#ECECF0', roughness: 0.7, flatShading: true });
  const pumpScreenMat = new THREE.MeshBasicMaterial({ color: '#333642' });

  config.station.pumps.positions.forEach((pos, idx) => {
    const pGrp = new THREE.Group();
    pGrp.position.set(...pos);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.55, 0.5), pumpBodyMat);
    body.position.y = 0.775;
    pGrp.add(body);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.36, 0.54),
      new THREE.MeshStandardMaterial({ color: pumpCapColors[idx % 3], roughness: 0.65, flatShading: true })
    );
    cap.position.y = 1.72;
    pGrp.add(cap);

    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.53), pumpScreenMat);
    scr.position.y = 1.24;
    pGrp.add(scr);

    stGroup.add(pGrp);
  });

  // 2 small red bins near right pump
  const redBinMat = new THREE.MeshStandardMaterial({ color: '#B83434', roughness: 0.7, flatShading: true });
  for (const bx of [4.85, 5.18]) {
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.28), redBinMat);
    bin.position.set(bx, 0.385, -0.2);
    stGroup.add(bin);
  }

  // Convenience Store (coral side wall + powder-blue front + flat yellow slatted windows!)
  const store = config.station.store;
  const storeCoralMat = new THREE.MeshStandardMaterial({ color: '#C96D79', roughness: 0.85, flatShading: true });
  const storeBlueMat = new THREE.MeshStandardMaterial({ color: '#427EB8', roughness: 0.8, flatShading: true });
  const yellowWinMat = new THREE.MeshBasicMaterial({ color: '#F5DF82' });

  const storeBody = new THREE.Mesh(
    new THREE.BoxGeometry(store.width, store.height, store.depth),
    storeCoralMat
  );
  storeBody.position.set(store.center[0], store.center[1] + store.height * 0.5, store.center[2]);
  stGroup.add(storeBody);

  // Front blue facade plate
  const frontBlue = new THREE.Mesh(
    new THREE.BoxGeometry(store.width + 0.04, store.height, 0.14),
    storeBlueMat
  );
  frontBlue.position.set(store.center[0], store.center[1] + store.height * 0.5, store.frontZ);
  stGroup.add(frontBlue);

  // Top cyan eave strip on store
  const storeTrim = new THREE.Mesh(
    new THREE.BoxGeometry(store.width + 0.12, 0.22, store.depth + 0.12),
    cyanBandMat
  );
  storeTrim.position.set(store.center[0], store.center[1] + store.height + 0.05, store.center[2]);
  stGroup.add(storeTrim);

  // Flat yellow slatted storefront windows (4 bays + horizontal slats)
  for (let i = 0; i < 4; i++) {
    const wx = store.leftX + 1.05 + i * 1.65;
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.85, 0.06), yellowWinMat);
    win.position.set(wx, 1.85, store.frontZ + 0.08);
    stGroup.add(win);

    // Subtle horizontal slat lines
    for (let s = -1; s <= 1; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.08), storeBlueMat);
      slat.position.set(wx, 1.85 + s * 0.52, store.frontZ + 0.09);
      stGroup.add(slat);
    }
  }

  // Blank rooftop marquee sign + 5-pointed star (matching left panel)
  const sign = config.station.signage;
  const signGrp = new THREE.Group();
  signGrp.position.set(...sign.position);
  signGrp.rotation.y = sign.rotationY;

  const postMat = new THREE.MeshStandardMaterial({ color: '#45354B', roughness: 0.85, flatShading: true });
  for (const px of [-0.75, 0.75]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), postMat);
    post.position.set(px, 0.7, 0);
    signGrp.add(post);
  }

  const signRedMat = new THREE.MeshStandardMaterial({ color: '#B0343B', roughness: 0.7, flatShading: true });
  const signCreamMat = new THREE.MeshBasicMaterial({ color: '#F0D09E' });

  // Main blank red-bordered box
  const mainBox = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.96, 0.24), signRedMat);
  mainBox.position.set(0, 1.25, 0);
  signGrp.add(mainBox);

  const mainBlank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.56, 0.27), signCreamMat);
  mainBlank.position.set(0, 1.25, 0);
  signGrp.add(mainBlank);

  // Lower blank sub-box
  const subBox = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.44, 0.22), signRedMat);
  subBox.position.set(0, 0.48, 0);
  signGrp.add(subBox);

  const subBlank = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.22, 0.25), signCreamMat);
  subBlank.position.set(0, 0.48, 0);
  signGrp.add(subBlank);

  // Flat white 5-point star above
  const starGeo = new THREE.ExtrudeGeometry(createStarShape(0.46, 0.2), {
    depth: 0.1,
    bevelEnabled: false,
  });
  starGeo.center();
  const starMesh = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: '#FFF6EE' }));
  starMesh.position.set(0, sign.starCenterY - sign.position[1], 0);
  signGrp.add(starMesh);

  stGroup.add(signGrp);
  scene.add(stGroup);

  return { scene };
}
