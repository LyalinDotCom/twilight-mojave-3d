import * as THREE from 'three';

/**
 * Procedural fallback vertical-rib corrugated salmon-pink metal texture set
 * (used only when @asset-forge textures are null).
 */
function createProceduralCorrugatedMaps() {
  const w = 512;
  const h = 512;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const ctx = diffCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bctx = bumpCanvas.getContext('2d');

  const ribs = 16;
  const ribW = w / ribs;
  for (let x = 0; x < w; x++) {
    const phase = ((x % ribW) / ribW) * Math.PI * 2;
    const wave = Math.sin(phase) * 0.5 + 0.5;
    const r = Math.round(192 + wave * 36);
    const g = Math.round(96 + wave * 28);
    const b = Math.round(108 + wave * 30);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, 0, 1, h);

    const bv = Math.round(60 + wave * 180);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x, 0, 1, h);
  }

  // Subtle horizontal dust gradient at base
  const dust = ctx.createLinearGradient(0, h * 0.78, 0, h);
  dust.addColorStop(0, 'rgba(90, 58, 56, 0.0)');
  dust.addColorStop(1, 'rgba(90, 58, 56, 0.35)');
  ctx.fillStyle = dust;
  ctx.fillRect(0, 0, w, h);

  const map = new THREE.CanvasTexture(diffCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 1);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { map, bumpMap };
}

/**
 * Procedural fallback colorful convenience-store shelf + cooler wall texture.
 */
function createProceduralShelfTexture() {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // Warm interior wood/cream wall
  ctx.fillStyle = '#EBD7B4';
  ctx.fillRect(0, 0, w, h);

  // Left half: 4 illuminated beverage cooler doors
  for (let d = 0; d < 4; d++) {
    const dx = 18 + d * 120;
    ctx.fillStyle = '#FFF9E8';
    ctx.fillRect(dx, 56, 110, 420);
    ctx.strokeStyle = '#7A6B52';
    ctx.lineWidth = 6;
    ctx.strokeRect(dx, 56, 110, 420);

    const rowColors = ['#D93829', '#2E7EC9', '#3FA65B', '#F0A824', '#C4386E', '#48A9B8'];
    for (let r = 0; r < 6; r++) {
      const ry = 80 + r * 64;
      ctx.fillStyle = '#333';
      ctx.fillRect(dx + 4, ry + 42, 102, 5);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = rowColors[(r + k + d) % rowColors.length];
        ctx.fillRect(dx + 9 + k * 15, ry + 8, 12, 34);
      }
    }
  }

  // Right half: stocked snack & grocery shelves
  const boxColors = ['#E54B3C', '#F2B830', '#2E86C1', '#48A956', '#E87A2E', '#9B4FA3', '#F5E7CE'];
  for (let row = 0; row < 5; row++) {
    const sy = 80 + row * 78;
    ctx.fillStyle = '#C9B99B';
    ctx.fillRect(520, sy + 54, 486, 10);
    let sx = 528;
    while (sx < 988) {
      const bw = 22 + ((sx * 13 + row * 7) % 28);
      const bh = 34 + ((sx * 5 + row * 11) % 18);
      ctx.fillStyle = boxColors[(sx + row) % boxColors.length];
      ctx.fillRect(sx, sy + 54 - bh, bw - 3, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(sx + 3, sy + 54 - bh + 5, bw - 9, 8);
      sx += bw;
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Retro warm terrazzo / checkered convenience store floor tile texture.
 */
function createStoreFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const s = 64;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#E8D9BC' : '#D5BE9A';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Crisp illuminated "OPEN" mini neon sign hanging inside the storefront door glass.
 */
function createOpenSignTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#18141E';
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = '#38E0FF';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 108);

  ctx.shadowColor = '#FF382E';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#FF6254';
  ctx.font = 'bold 64px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OPEN', 128, 66);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFE4DC';
  ctx.font = 'bold 58px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('OPEN', 128, 66);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Subtle weathered satin-paint roughness + bottom desert dust texture for the
 * powder-blue storefront panels & wainscot.
 */
function createWeatheredBluePaintMaps() {
  const w = 256;
  const h = 256;

  const colCanvas = document.createElement('canvas');
  colCanvas.width = w;
  colCanvas.height = h;
  const ctx = colCanvas.getContext('2d');

  // Subtle roller-painted powder-blue micro-variation + gentle desert dust along lower edge
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3C85C8');
  g.addColorStop(0.75, '#377BB8');
  g.addColorStop(1, '#586A7D');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // True non-repeating pseudo-random fine stucco micro-grain (ZERO diagonal lattice streaks!)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 2400; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const v = rand() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(18,24,38,0.032)';
    ctx.fillStyle = v;
    ctx.fillRect(x, y, 2, 2);
  }

  const rCanvas = document.createElement('canvas');
  rCanvas.width = w;
  rCanvas.height = h;
  const rctx = rCanvas.getContext('2d');
  const rg = rctx.createLinearGradient(0, 0, 0, h);
  rg.addColorStop(0, '#787878');
  rg.addColorStop(0.78, '#888888');
  rg.addColorStop(1, '#B8B8B8'); // dustier, rougher bottom edge
  rctx.fillStyle = rg;
  rctx.fillRect(0, 0, w, h);

  const map = new THREE.CanvasTexture(colCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.colorSpace = THREE.NoColorSpace;

  return { map, roughnessMap };
}

/**
 * Procedural fallback detailed product-row texture for 3D gondola shelves
 * (when @asset-forge storeShelvesAlbedo is unavailable).
 */
function createDetailedGondolaProductTexture() {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1E1A16';
  ctx.fillRect(0, 0, w, h);

  const palettes = [
    ['#B83024', '#F2D06B'],
    ['#2668A3', '#E8EEF5'],
    ['#367D42', '#F5E1A4'],
    ['#C96D24', '#261812'],
    ['#7C335E', '#F0D5C8'],
    ['#C49A28', '#22201E'],
    ['#D4C4A8', '#8F2420'],
  ];

  let x = 4;
  let i = 0;
  while (x < w - 8) {
    const pw = 18 + ((i * 19) % 24);
    const ph = 72 + ((i * 13) % 38);
    const [bg, accent] = palettes[i % palettes.length];
    const py = h - ph - 4;

    ctx.fillStyle = bg;
    ctx.fillRect(x, py, pw - 2, ph);

    // Label band & simulated mini graphics
    ctx.fillStyle = accent;
    ctx.fillRect(x + 2, py + ph * 0.24, pw - 6, ph * 0.26);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x + 3, py + ph * 0.58, pw - 8, 5);
    ctx.fillRect(x + 3, py + ph * 0.70, (pw - 8) * 0.65, 4);

    // Subtle side edge shadow between packages
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(x + pw - 5, py, 3, ph);

    x += pw + 2;
    i++;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a realistic 3D double-sided convenience store gondola shelving rack stocked
 * with photographic textured merchandise rows (matching the back cooler wall!).
 */
function buildGondolaRack(length, height, depth, seedOffset, mats) {
  const rack = new THREE.Group();

  // Dark recessed pegboard center spine
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(length, height, 0.05), mats.shelfBack);
  backPanel.position.y = height * 0.5;
  rack.add(backPanel);

  // Dark metallic endcap pilasters + base kickplate
  for (const ex of [-length * 0.5, length * 0.5]) {
    const endPost = new THREE.Mesh(new THREE.BoxGeometry(0.055, height + 0.03, depth), mats.shelfTrim);
    endPost.position.set(ex, height * 0.5, 0);
    rack.add(endPost);
  }
  const kick = new THREE.Mesh(new THREE.BoxGeometry(length, 0.14, depth * 0.92), mats.shelfTrim);
  kick.position.y = 0.07;
  rack.add(kick);

  // 3–4 tiered steel shelf decks with dark price-tag molding strips + textured 3D merchandise bays
  const shelfLevels = height > 1.3 ? [0.16, 0.50, 0.84, 1.16] : [0.16, 0.48, 0.80, 1.06];
  const bayCount = 4;
  const bayW = (length - 0.12) / bayCount;

  shelfLevels.forEach((sy, lvl) => {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(length - 0.05, 0.028, depth), mats.shelfMetal);
    deck.position.y = sy;
    rack.add(deck);

    // Front/back dark price-tag channel rail
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length - 0.05, 0.034, 0.012), mats.shelfTrim);
      rail.position.set(0, sy - 0.004, side * (depth * 0.5 + 0.004));
      rack.add(rail);

      // Stocked 3D product bays with varied slight depth offsets & photographic textures
      for (let b = 0; b < bayCount; b++) {
        const idx = lvl * 7 + b + seedOffset + (side > 0 ? 3 : 0);
        const pw = bayW - 0.035;
        const ph = 0.21 + ((idx * 17) % 5) * 0.014;
        const pd = depth * (0.31 + ((idx * 11) % 3) * 0.03);
        const mat = mats.productRowMats[idx % mats.productRowMats.length];

        const prod = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mat);
        const px = -length * 0.5 + 0.06 + (b + 0.5) * bayW;
        prod.position.set(px, sy + 0.014 + ph * 0.5, side * (depth * 0.23));
        rack.add(prod);
      }
    }
  });

  return rack;
}

export function createStore({ config, textures = {} }) {
  const group = new THREE.Group();
  group.name = 'ConvenienceStore';

  const cfg = config.station.store;
  const [cx, baseY, cz] = cfg.center; // [9.2, 0.025, -2.2]
  const W = cfg.width; // 7.6 -> local X in [-3.8, 3.8]
  const D = cfg.depth; // 6.2 -> local Z in [-3.1, 3.1]
  const H = cfg.height; // 3.55 -> local Y in [0, 3.55]

  const storeRoot = new THREE.Group();
  storeRoot.position.set(cx, baseY, cz);
  group.add(storeRoot);

  // --- Materials ---
  const hasCorrugated = Boolean(textures?.corrugatedMetalAlbedo);
  const procCorr = hasCorrugated ? null : createProceduralCorrugatedMaps();

  const cloneCorr = (tex) => {
    if (!tex) return null;
    const c = tex.clone();
    c.needsUpdate = true;
    c.wrapS = THREE.RepeatWrapping;
    c.wrapT = THREE.RepeatWrapping;
    // Crisp, fine vertical architectural corrugated ribs matching reference photo!
    c.repeat.set(6, 1.5);
    return c;
  };

  const corrAlbedo = hasCorrugated ? cloneCorr(textures.corrugatedMetalAlbedo) : procCorr.map;
  const corrNormal = cloneCorr(textures?.corrugatedMetalNormal);
  const corrRough = cloneCorr(textures?.corrugatedMetalRoughness);

  const corrugatedMat = new THREE.MeshStandardMaterial({
    // Soft dusty rose-salmon pink (#D8727E) catching warm canopy bounce cleanly
    color: hasCorrugated ? new THREE.Color('#DC98A6') : new THREE.Color('#FFFFFF'),
    map: corrAlbedo,
    normalMap: corrNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: corrRough,
    bumpMap: hasCorrugated ? null : procCorr.bumpMap,
    bumpScale: 0.018,
    metalness: 0.16,
    roughness: 0.74,
  });

  const weatheredBlue = createWeatheredBluePaintMaps();
  const storeBlueMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: weatheredBlue.map,
    roughnessMap: weatheredBlue.roughnessMap,
    metalness: 0.20,
    roughness: 0.52,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: '#252B36',
    metalness: 0.65,
    roughness: 0.38,
  });

  const aluminumMullionMat = new THREE.MeshStandardMaterial({
    color: '#BAC4D0',
    metalness: 0.78,
    roughness: 0.28,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: '#2A252E',
    metalness: 0.08,
    roughness: 0.92,
  });

  const cyanEaveNeonMat = new THREE.MeshStandardMaterial({
    // Pure saturated electric cyan matching canopy tubes
    color: '#00D8FF',
    emissive: new THREE.Color('#00E6FF'),
    emissiveIntensity: 2.35,
    roughness: 0.14,
  });

  // Reflective transparent storefront glass (NEVER flat yellow quads!)
  const storefrontGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#D4ECFF',
    transparent: true,
    opacity: 0.18,
    roughness: 0.12,
    metalness: 0.10,
    envMapIntensity: 1.45,
    depthWrite: false,
  });

  const interiorWallMat = new THREE.MeshStandardMaterial({
    color: '#F2DEC0',
    emissive: new THREE.Color('#4A3218'),
    emissiveIntensity: 0.42,
    roughness: 0.84,
    metalness: 0.02,
  });

  const interiorCeilingMat = new THREE.MeshStandardMaterial({
    color: '#F6E8CC',
    emissive: new THREE.Color('#5A401E'),
    emissiveIntensity: 0.48,
    roughness: 0.86,
    metalness: 0.02,
  });

  const interiorFloorMat = new THREE.MeshStandardMaterial({
    map: createStoreFloorTexture(),
    emissive: new THREE.Color('#382510'),
    emissiveIntensity: 0.28,
    roughness: 0.48,
    metalness: 0.08,
  });

  const fluorStripMat = new THREE.MeshStandardMaterial({
    color: '#FFFDF0',
    emissive: '#FFEEC0',
    emissiveIntensity: 2.15,
    roughness: 0.18,
  });

  const shelfAlbedo = textures?.storeShelvesAlbedo || createProceduralShelfTexture();
  const shelfEmissive = textures?.storeShelvesEmissive || shelfAlbedo;
  const backWallCoolerMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: shelfAlbedo,
    emissive: new THREE.Color('#FFE8B8'),
    emissiveMap: shelfEmissive,
    emissiveIntensity: 1.55,
    roughness: 0.78,
    metalness: 0.04,
  });

  // Slice realistic snack-shelf rows directly from @asset-forge's storeShelvesAlbedo (or fallback)
  const makeProductRowMat = (uOff, vOff) => {
    let tex;
    if (textures?.storeShelvesAlbedo) {
      tex = textures.storeShelvesAlbedo.clone();
      tex.needsUpdate = true;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(0.36, 0.22);
      tex.offset.set(uOff, vOff);
      tex.colorSpace = THREE.SRGBColorSpace;
    } else {
      tex = createDetailedGondolaProductTexture();
    }
    return new THREE.MeshStandardMaterial({
      color: '#EAE0D2',
      map: tex,
      emissive: new THREE.Color('#422E18'),
      emissiveMap: tex,
      emissiveIntensity: 0.34,
      roughness: 0.58,
      metalness: 0.08,
    });
  };

  const shelfMats = {
    shelfMetal: new THREE.MeshStandardMaterial({
      color: '#CCC0AC',
      emissive: '#382714',
      emissiveIntensity: 0.22,
      roughness: 0.48,
      metalness: 0.30,
    }),
    shelfBack: new THREE.MeshStandardMaterial({ color: '#44382C', roughness: 0.78, metalness: 0.16 }),
    shelfTrim: new THREE.MeshStandardMaterial({ color: '#342E28', roughness: 0.56, metalness: 0.34 }),
    productRowMats: [
      makeProductRowMat(0.52, 0.56),
      makeProductRowMat(0.52, 0.34),
      makeProductRowMat(0.52, 0.12),
      makeProductRowMat(0.64, 0.44),
    ],
  };

  // =========================================================================
  // 1. EXTERIOR ARCHITECTURAL SHELL (with REAL openings for front & corner glass!)
  // =========================================================================
  const wallT = 0.18;
  const fasciaBottomY = 2.98;
  const fasciaH = H - fasciaBottomY; // 0.57m powder-blue roof parapet

  // Left Wall (x = -W/2 = -3.8): Iconic corrugated salmon-pink metal facing canopy (-X)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, fasciaBottomY, D), corrugatedMat);
  leftWall.position.set(-W * 0.5 + wallT * 0.5, fasciaBottomY * 0.5, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  storeRoot.add(leftWall);

  // Matching salmon-coral upper fascia trim along the left wall edge (matches reference!)
  const leftFasciaBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, fasciaH - 0.12, D + 0.02),
    corrugatedMat
  );
  leftFasciaBand.position.set(-W * 0.5 - 0.015, fasciaBottomY + (fasciaH - 0.12) * 0.5, 0);
  storeRoot.add(leftFasciaBand);

  // Subtle weathered metal base flashing + galvanized vent grille + mini restroom plaque on left wall
  const leftBaseFlash = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, D + 0.02), darkTrimMat);
  leftBaseFlash.position.set(-W * 0.5 - 0.01, 0.07, 0);
  storeRoot.add(leftBaseFlash);

  const wallVent = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.42), aluminumMullionMat);
  wallVent.position.set(-W * 0.5 - 0.015, 2.25, 1.45);
  storeRoot.add(wallVent);

  // Vertical corner flashing seam on front-left corner
  const cornerTrim = new THREE.Mesh(new THREE.BoxGeometry(0.09, fasciaBottomY, 0.09), storeBlueMat);
  cornerTrim.position.set(-W * 0.5 + 0.02, fasciaBottomY * 0.5, D * 0.5 - 0.02);
  storeRoot.add(cornerTrim);

  // Back Wall (z = -D/2 = -3.1)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), corrugatedMat);
  backWall.position.set(0, H * 0.5, -D * 0.5 + wallT * 0.5);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  storeRoot.add(backWall);

  // Right Wall (x = +W/2 = +3.8): rear corrugated section + front wrap-around window bay
  const rightRearLen = D - 2.35;
  const rightRearWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallT, fasciaBottomY, rightRearLen),
    corrugatedMat
  );
  rightRearWall.position.set(W * 0.5 - wallT * 0.5, fasciaBottomY * 0.5, -D * 0.5 + rightRearLen * 0.5);
  rightRearWall.castShadow = true;
  rightRearWall.receiveShadow = true;
  storeRoot.add(rightRearWall);

  // Right wrap-around blue wainscot beneath side picture window (z in [0.75, 2.75])
  const rightWainscot = new THREE.Mesh(new THREE.BoxGeometry(wallT, 0.94, 2.35), storeBlueMat);
  rightWainscot.position.set(W * 0.5 - wallT * 0.5, 0.47, D * 0.5 - 1.175);
  rightWainscot.castShadow = true;
  rightWainscot.receiveShadow = true;
  storeRoot.add(rightWainscot);

  // Right wrap-around glass pane
  const rightGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.90), storefrontGlassMat);
  rightGlass.rotation.y = Math.PI * 0.5;
  rightGlass.position.set(W * 0.5 - 0.06, 1.90, D * 0.5 - 1.25);
  storeRoot.add(rightGlass);

  // Roof Parapet Fascia (powder-blue band wrapping full top perimeter + dark coping)
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, fasciaH, D + 0.04), storeBlueMat);
  parapet.position.set(0, fasciaBottomY + fasciaH * 0.5, 0);
  parapet.castShadow = true;
  parapet.receiveShadow = true;
  storeRoot.add(parapet);

  const roofCoping = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.06, D + 0.12), darkTrimMat);
  roofCoping.position.set(0, H - 0.01, 0);
  storeRoot.add(roofCoping);

  const roofSurface = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.03, D - 0.2), roofMat);
  roofSurface.position.set(0, H + 0.01, 0);
  roofSurface.receiveShadow = true;
  storeRoot.add(roofSurface);

  // Overhanging front eave brow + Electric Cyan Neon Eave Strip (matches reference zoom!)
  const eaveOverhang = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, 0.08, 0.36), storeBlueMat);
  eaveOverhang.position.set(0.06, fasciaBottomY + 0.04, D * 0.5 + 0.16);
  eaveOverhang.castShadow = true;
  storeRoot.add(eaveOverhang);

  // Continuous cyan neon eave tube running across front overhang & wrapping around right corner
  const eaveCurve = new THREE.CurvePath();
  eaveCurve.add(
    new THREE.LineCurve3(
      new THREE.Vector3(-W * 0.5 + 0.12, fasciaBottomY - 0.01, D * 0.5 + 0.30),
      new THREE.Vector3(W * 0.5 + 0.12, fasciaBottomY - 0.01, D * 0.5 + 0.30)
    )
  );
  eaveCurve.add(
    new THREE.LineCurve3(
      new THREE.Vector3(W * 0.5 + 0.12, fasciaBottomY - 0.01, D * 0.5 + 0.30),
      new THREE.Vector3(W * 0.5 + 0.12, fasciaBottomY - 0.01, D * 0.5 - 2.2)
    )
  );
  const eaveNeonMesh = new THREE.Mesh(
    new THREE.TubeGeometry(eaveCurve, 48, 0.021, 8, false),
    cyanEaveNeonMat
  );
  eaveNeonMesh.userData.noShadowCast = true;
  storeRoot.add(eaveNeonMesh);

  // =========================================================================
  // 2. FRONT STOREFRONT FACADE (z = +D/2 = +3.1): Powder-Blue Panels, Door & 3 Windows
  // =========================================================================
  const fz = D * 0.5 - 0.08;

  // Left pier (x in [-3.80, -3.38])
  const leftPier = new THREE.Mesh(new THREE.BoxGeometry(0.42, fasciaBottomY, 0.22), storeBlueMat);
  leftPier.position.set(-3.59, fasciaBottomY * 0.5, fz);
  leftPier.castShadow = true;
  leftPier.receiveShadow = true;
  storeRoot.add(leftPier);

  // Pier between entrance door and storefront windows (x in [-2.26, -1.86])
  const midDoorPier = new THREE.Mesh(new THREE.BoxGeometry(0.40, fasciaBottomY, 0.22), storeBlueMat);
  midDoorPier.position.set(-2.06, fasciaBottomY * 0.5, fz);
  midDoorPier.castShadow = true;
  midDoorPier.receiveShadow = true;
  storeRoot.add(midDoorPier);

  // Right corner pier (x in [3.26, 3.80])
  const rightPier = new THREE.Mesh(new THREE.BoxGeometry(0.54, fasciaBottomY, 0.24), storeBlueMat);
  rightPier.position.set(3.53, fasciaBottomY * 0.5, fz);
  rightPier.castShadow = true;
  rightPier.receiveShadow = true;
  storeRoot.add(rightPier);

  // Lower powder-blue wainscot panel under the 3 storefront windows (x in [-1.86, 3.26], y in [0, 0.94])
  const wainscotW = 3.26 - -1.86; // 5.12m
  const wainscot = new THREE.Mesh(new THREE.BoxGeometry(wainscotW, 0.94, 0.20), storeBlueMat);
  wainscot.position.set((-1.86 + 3.26) * 0.5, 0.47, fz);
  wainscot.castShadow = true;
  wainscot.receiveShadow = true;
  storeRoot.add(wainscot);

  // Subtle architectural vertical panel joints on the blue wainscot
  for (const jx of [-0.15, 1.55]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.92, 0.215), darkTrimMat);
    seam.position.set(jx, 0.47, fz);
    storeRoot.add(seam);
  }

  // Upper transom header bar above windows & door (y in [2.84, 2.98])
  const headerBar = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.16, 0.22), storeBlueMat);
  headerBar.position.set(0, 2.91, fz);
  storeRoot.add(headerBar);

  // --- Entrance Door Assembly (x in [-3.38, -2.26], width = 1.12m) ---
  const doorCenterX = -2.82;
  // Aluminum door frame jambs + transom divider bar
  const doorTransomBar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.065, 0.14), aluminumMullionMat);
  doorTransomBar.position.set(doorCenterX, 2.18, fz);
  storeRoot.add(doorTransomBar);

  // Lower solid powder-blue door kick panel (y in [0.02, 0.92])
  const doorKick = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.90, 0.08), storeBlueMat);
  doorKick.position.set(doorCenterX, 0.47, fz - 0.02);
  storeRoot.add(doorKick);

  // Door stiles
  for (const dsx of [-0.51, 0.51]) {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.82, 0.10), aluminumMullionMat);
    stile.position.set(doorCenterX + dsx, 1.41, fz);
    storeRoot.add(stile);
  }

  // Door glass + transom glass
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.88), storefrontGlassMat);
  doorGlass.position.set(doorCenterX, 1.88, fz + 0.01);
  storeRoot.add(doorGlass);

  // Brushed stainless vertical door pull handle & horizontal push bar
  const pushBar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.84, 10), aluminumMullionMat);
  pushBar.rotation.z = Math.PI * 0.5;
  pushBar.position.set(doorCenterX, 1.04, fz + 0.075);
  storeRoot.add(pushBar);

  const pullHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 10), aluminumMullionMat);
  pullHandle.position.set(doorCenterX + 0.38, 1.12, fz + 0.08);
  storeRoot.add(pullHandle);

  // Glowing miniature "OPEN" neon sign hanging inside the door transom glass
  const openTex = createOpenSignTexture();
  const openSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.23),
    new THREE.MeshStandardMaterial({
      map: openTex,
      emissive: '#FFFFFF',
      emissiveMap: openTex,
      emissiveIntensity: 1.8,
      roughness: 0.25,
    })
  );
  openSign.position.set(doorCenterX, 1.78, fz - 0.12);
  storeRoot.add(openSign);

  // --- 3 Wide Storefront Picture Windows (x in [-1.86, 3.26], y in [0.94, 2.84]) ---
  // Aluminum sill & head frame
  const winSill = new THREE.Mesh(new THREE.BoxGeometry(wainscotW + 0.06, 0.06, 0.24), aluminumMullionMat);
  winSill.position.set((-1.86 + 3.26) * 0.5, 0.95, fz + 0.01);
  storeRoot.add(winSill);

  // 2 interior vertical mullions dividing the 5.12m span into 3 crisp picture window bays
  for (const mx of [-0.15, 1.55]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.92, 0.14), darkTrimMat);
    mullion.position.set(mx, 1.90, fz);
    mullion.castShadow = true;
    storeRoot.add(mullion);
  }
  // Subtle horizontal transom bar across upper third of windows (matches reference window framing!)
  const winTransom = new THREE.Mesh(new THREE.BoxGeometry(wainscotW, 0.045, 0.10), darkTrimMat);
  winTransom.position.set((-1.86 + 3.26) * 0.5, 2.40, fz);
  storeRoot.add(winTransom);

  // Reflective transparent storefront glass pane across all 3 bays
  const mainGlass = new THREE.Mesh(new THREE.PlaneGeometry(wainscotW - 0.04, 1.88), storefrontGlassMat);
  mainGlass.position.set((-1.86 + 3.26) * 0.5, 1.90, fz + 0.02);
  storeRoot.add(mainGlass);

  // =========================================================================
  // 3. GENUINE 3D LIT INTERIOR ROOM (4.6m deep!)
  // =========================================================================
  const intGroup = new THREE.Group();
  intGroup.name = 'StoreInterior3D';
  storeRoot.add(intGroup);

  const intW = W - 0.42; // 7.18m
  const intH = 2.94;
  const intFrontZ = D * 0.5 - 0.22; // +2.88
  const intBackZ = intFrontZ - 4.6; // -1.72 (4.6m deep!)
  const intMidZ = (intFrontZ + intBackZ) * 0.5;
  const intD = intFrontZ - intBackZ;

  // Interior floor
  const intFloor = new THREE.Mesh(new THREE.PlaneGeometry(intW, intD), interiorFloorMat);
  intFloor.rotation.x = -Math.PI * 0.5;
  intFloor.position.set(0, 0.015, intMidZ);
  intFloor.receiveShadow = true;
  intGroup.add(intFloor);

  // Interior warm ceiling
  const intCeil = new THREE.Mesh(new THREE.PlaneGeometry(intW, intD), interiorCeilingMat);
  intCeil.rotation.x = Math.PI * 0.5;
  intCeil.position.set(0, intH, intMidZ);
  intGroup.add(intCeil);

  // Interior left wall
  const intLeftWall = new THREE.Mesh(new THREE.PlaneGeometry(intD, intH), interiorWallMat);
  intLeftWall.rotation.y = Math.PI * 0.5;
  intLeftWall.position.set(-intW * 0.5, intH * 0.5, intMidZ);
  intGroup.add(intLeftWall);

  // Interior right back section wall
  const intRightWall = new THREE.Mesh(new THREE.PlaneGeometry(intD - 2.0, intH), interiorWallMat);
  intRightWall.rotation.y = -Math.PI * 0.5;
  intRightWall.position.set(intW * 0.5, intH * 0.5, intBackZ + (intD - 2.0) * 0.5);
  intGroup.add(intRightWall);

  // Back wall: Full-width illuminated beverage coolers + stocked rear shelving using @asset-forge textures!
  const backCoolerWall = new THREE.Mesh(new THREE.PlaneGeometry(intW, intH), backWallCoolerMat);
  backCoolerWall.position.set(0, intH * 0.5, intBackZ + 0.02);
  intGroup.add(backCoolerWall);

  // 3D physical cooler frame mullions standing slightly proud of the back cooler wall for depth!
  for (let d = 0; d <= 4; d++) {
    const cxDoor = -intW * 0.5 + 0.14 + d * 0.85;
    const frameBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 2.22, 0.10), aluminumMullionMat);
    frameBar.position.set(cxDoor, 1.18, intBackZ + 0.07);
    intGroup.add(frameBar);
  }
  const coolerHeader = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.12, 0.16), darkTrimMat);
  coolerHeader.position.set(-intW * 0.5 + 1.85, 2.34, intBackZ + 0.08);
  intGroup.add(coolerHeader);

  // Glowing overhead fluorescent ceiling light strips (4 fixtures in 2 rows)
  const stripGeo = new THREE.BoxGeometry(2.45, 0.06, 0.24);
  const stripHousingGeo = new THREE.BoxGeometry(2.55, 0.05, 0.30);
  const stripCoords = [
    [-1.65, intH - 0.04, 1.55],
    [1.55, intH - 0.04, 1.55],
    [-1.65, intH - 0.04, -0.35],
    [1.55, intH - 0.04, -0.35],
  ];
  for (const [sx, sy, sz] of stripCoords) {
    const housing = new THREE.Mesh(stripHousingGeo, aluminumMullionMat);
    housing.position.set(sx, sy + 0.02, sz);
    housing.userData.noShadowCast = true;
    intGroup.add(housing);

    const tube = new THREE.Mesh(stripGeo, fluorStripMat);
    tube.position.set(sx, sy - 0.015, sz);
    tube.userData.noShadowCast = true;
    intGroup.add(tube);
  }

  // Two genuine 3D stocked gondola shelving aisles inside the room (low enough to frame the lit back coolers!)
  const gondola1 = buildGondolaRack(3.35, 1.24, 0.66, 11, shelfMats);
  gondola1.position.set(1.05, 0.015, 1.28);
  intGroup.add(gondola1);

  const gondola2 = buildGondolaRack(3.55, 1.42, 0.66, 47, shelfMats);
  gondola2.position.set(0.95, 0.015, -0.18);
  intGroup.add(gondola2);

  // Checkout Counter near the left entrance + retro cash register & candy rack
  const counterGroup = new THREE.Group();
  counterGroup.position.set(-2.45, 0.015, 0.95);

  const counterBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.94, 0.74),
    new THREE.MeshStandardMaterial({ color: '#8C5B3C', roughness: 0.65, metalness: 0.06 })
  );
  counterBody.position.y = 0.47;
  counterGroup.add(counterBody);

  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.055, 0.80),
    new THREE.MeshStandardMaterial({ color: '#E8DFCF', roughness: 0.35, metalness: 0.15 })
  );
  counterTop.position.y = 0.96;
  counterGroup.add(counterTop);

  // Vintage cash register / POS terminal on counter
  const register = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.34), darkTrimMat);
  register.position.set(0.15, 1.12, 0);
  counterGroup.add(register);

  const regScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.09),
    new THREE.MeshStandardMaterial({ color: '#9FFFD0', emissive: '#44E89A', emissiveIntensity: 1.6 })
  );
  regScreen.position.set(0.15, 1.20, 0.175);
  counterGroup.add(regScreen);

  intGroup.add(counterGroup);

  // Two warm indoor fluorescent fill lights bathing the 3D shelves, checkout counter & floor
  // from INSIDE the store room (while @architect's exterior RectAreaLight/SpotLight carries spill outward!)
  const interiorLightLeft = new THREE.PointLight('#FFDF9E', 16.0, 8.0, 2.0);
  interiorLightLeft.position.set(-1.65, 2.66, 1.35);
  storeRoot.add(interiorLightLeft);

  const interiorLightRight = new THREE.PointLight('#FFD890', 14.0, 8.5, 2.0);
  interiorLightRight.position.set(0.9, 2.62, 0.65);
  storeRoot.add(interiorLightRight);

  // =========================================================================
  // 4. EXTERIOR STOREFRONT PROPS: Dark Trash Bin, 3 Yellow Parking Bollards, Cone
  // =========================================================================
  // Dark charcoal trash bin right beside the entrance door
  const trashGroup = new THREE.Group();
  trashGroup.position.set(-2.35, 0, D * 0.5 + 0.32);

  const binBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.18, 0.74, 18),
    new THREE.MeshStandardMaterial({ color: '#2B2830', roughness: 0.62, metalness: 0.28 })
  );
  binBody.position.y = 0.37;
  binBody.castShadow = true;
  binBody.receiveShadow = true;
  trashGroup.add(binBody);

  const binLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.215, 0.215, 0.07, 18),
    darkTrimMat
  );
  binLid.position.y = 0.76;
  binLid.castShadow = true;
  trashGroup.add(binLid);

  storeRoot.add(trashGroup);

  // 3 Yellow Steel Parking Bollards along front curb (exact CONFIG world coordinates)
  const yellowBollardMat = new THREE.MeshStandardMaterial({
    color: '#EAB92E',
    metalness: 0.28,
    roughness: 0.32,
  });
  const bollardTapeMat = new THREE.MeshStandardMaterial({
    color: '#222026',
    roughness: 0.45,
    metalness: 0.2,
  });

  const yShaftGeo = new THREE.CylinderGeometry(0.064, 0.068, 0.86, 16);
  const yCapGeo = new THREE.SphereGeometry(0.064, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const yBaseGeo = new THREE.CylinderGeometry(0.095, 0.102, 0.032, 16);
  const yBandGeo = new THREE.CylinderGeometry(0.066, 0.066, 0.06, 16);

  for (const [bx, by, bz] of cfg.bollards) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, by, bz);

    const base = new THREE.Mesh(yBaseGeo, darkTrimMat);
    base.position.y = 0.016;
    base.receiveShadow = true;
    bGroup.add(base);

    const shaft = new THREE.Mesh(yShaftGeo, yellowBollardMat);
    shaft.position.y = 0.032 + 0.43;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bGroup.add(shaft);

    const cap = new THREE.Mesh(yCapGeo, yellowBollardMat);
    cap.position.y = 0.032 + 0.86;
    cap.castShadow = true;
    bGroup.add(cap);

    const band = new THREE.Mesh(yBandGeo, bollardTapeMat);
    band.position.y = 0.72;
    bGroup.add(band);

    group.add(bGroup);
  }

  // Tiny authentic orange safety cone near far-right front corner (visible in reference zoom!)
  const coneGroup = new THREE.Group();
  coneGroup.position.set(12.2, baseY, 1.55);
  const coneBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.035, 0.30),
    new THREE.MeshStandardMaterial({ color: '#1E1D22', roughness: 0.85 })
  );
  coneBase.position.y = 0.0175;
  coneGroup.add(coneBase);

  const coneBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.46, 14),
    new THREE.MeshStandardMaterial({ color: '#E86222', roughness: 0.45 })
  );
  coneBody.position.y = 0.25;
  coneBody.castShadow = true;
  coneGroup.add(coneBody);

  const coneStripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.072, 0.08, 14),
    new THREE.MeshStandardMaterial({ color: '#F5F2EC', roughness: 0.3 })
  );
  coneStripe.position.y = 0.31;
  coneGroup.add(coneStripe);
  group.add(coneGroup);

  function update(t, _dt, opts) {
    if (opts?.livingWorld) {
      cyanEaveNeonMat.emissiveIntensity = 2.35 + Math.sin(t * 19.0 + 1.2) * 0.025;
    } else {
      cyanEaveNeonMat.emissiveIntensity = 2.35;
    }
  }

  return {
    group,
    lights: {
      // Exposed under storeInterior (not store) so master lighting.js never dampens its exterior storefront spill!
      store: [],
      storeInterior: [interiorLightLeft, interiorLightRight],
    },
    update,
  };
}
