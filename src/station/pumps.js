import * as THREE from 'three';

/**
 * Generates crisp high-res diffuse + emissive textures for the retro-modern fuel dispenser
 * illuminated amber price/gallon readout panel.
 */
function createPumpDisplayTextures(pumpIndex) {
  const w = 512;
  const h = 512;

  const sales = ['24.43', '31.41', '17.45'];
  const gallons = ['07.00', '09.00', '05.00'];
  const saleStr = sales[pumpIndex % sales.length];
  const galStr = gallons[pumpIndex % gallons.length];

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const ctx = diffCanvas.getContext('2d');

  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = w;
  emisCanvas.height = h;
  const ectx = emisCanvas.getContext('2d');

  // Dark anodized bezel background
  ctx.fillStyle = '#191B20';
  ctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  // Top retro header strip
  ctx.fillStyle = '#C92B27';
  ctx.fillRect(18, 16, w - 36, 54);
  ectx.fillStyle = '#52110F';
  ectx.fillRect(18, 16, w - 36, 54);

  ctx.fillStyle = '#FFF5E0';
  ctx.font = 'bold 28px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`DESERT GAS & GO  ·  PUMP ${pumpIndex + 1}`, w * 0.5, 44);
  ectx.fillStyle = '#FFDEAA';
  ectx.font = 'bold 28px "Helvetica Neue", Arial, sans-serif';
  ectx.textAlign = 'center';
  ectx.textBaseline = 'middle';
  ectx.fillText(`DESERT GAS & GO  ·  PUMP ${pumpIndex + 1}`, w * 0.5, 44);

  // Main warm backlit amber readout window
  const drawAmberWindow = (x, y, ww, hh, value, label) => {
    // Bezel recess
    ctx.fillStyle = '#0D0E12';
    ctx.fillRect(x - 6, y - 6, ww + 12, hh + 12);

    // Warm backlit amber panel
    const g = ctx.createLinearGradient(x, y, x, y + hh);
    g.addColorStop(0, '#FFD485');
    g.addColorStop(0.5, '#FFBF5E');
    g.addColorStop(1, '#E89B3C');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, ww, hh);

    ectx.fillStyle = '#FFB84D';
    ectx.fillRect(x, y, ww, hh);

    // Subtle mechanical roller drum dividers
    ctx.strokeStyle = 'rgba(40, 20, 5, 0.22)';
    ctx.lineWidth = 2;
    const cols = 5;
    for (let i = 1; i < cols; i++) {
      const lx = x + (ww / cols) * i;
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(lx, y + hh);
      ctx.stroke();
    }

    // Crisp dark digital/roller numerals
    ctx.fillStyle = '#1E140A';
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, x + ww * 0.5, y + hh * 0.54);

    ectx.fillStyle = '#1A1006';
    ectx.font = 'bold 64px "Courier New", monospace';
    ectx.textAlign = 'center';
    ectx.textBaseline = 'middle';
    ectx.fillText(value, x + ww * 0.5, y + hh * 0.54);

    // Label below window
    ctx.fillStyle = '#D5CFC6';
    ctx.font = 'bold 20px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(label, x + ww * 0.5, y + hh + 24);
  };

  drawAmberWindow(38, 92, w - 76, 96, `$${saleStr}`, 'THIS SALE');
  drawAmberWindow(38, 232, w - 76, 86, galStr, 'GALLONS');

  // Price per gallon banner
  ctx.fillStyle = '#252830';
  ctx.fillRect(28, 356, w - 56, 42);
  ctx.fillStyle = '#FFE3A8';
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('$3.49 / GAL   ·   UNLEADED', w * 0.5, 378);
  ectx.fillStyle = '#FFD17A';
  ectx.font = 'bold 26px "Courier New", monospace';
  ectx.textAlign = 'center';
  ectx.fillText('$3.49 / GAL   ·   UNLEADED', w * 0.5, 378);

  // 3 Fuel Grade Selector Badges (REGULAR / PLUS / SUPER)
  const grades = [
    { name: 'REGULAR', oct: '87', price: '$3.49', color: '#E8B52A', glow: '#D49E1A' },
    { name: 'PLUS', oct: '89', price: '$3.69', color: '#2F95C8', glow: '#267FAD' },
    { name: 'SUPER', oct: '93', price: '$3.89', color: '#D4352B', glow: '#B82820' },
  ];
  const bw = 136;
  const bh = 86;
  const gap = 16;
  const startX = (w - (bw * 3 + gap * 2)) * 0.5;
  grades.forEach((gr, i) => {
    const gx = startX + i * (bw + gap);
    const gy = 412;

    ctx.fillStyle = gr.color;
    ctx.fillRect(gx, gy, bw, bh);
    ectx.fillStyle = gr.glow;
    ectx.fillRect(gx + 3, gy + 3, bw - 6, bh - 6);

    ctx.strokeStyle = '#E6E2DA';
    ctx.lineWidth = 3;
    ctx.strokeRect(gx, gy, bw, bh);

    ctx.fillStyle = '#141210';
    ctx.font = 'bold 18px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gr.name, gx + bw * 0.5, gy + 22);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(gr.oct, gx + bw * 0.5, gy + 50);

    ctx.fillStyle = '#FFF6DF';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(gr.price, gx + bw * 0.5, gy + 74);
  });

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const emissiveMap = new THREE.CanvasTexture(emisCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 4;

  return { map, emissiveMap };
}

/**
 * Subtle painted cream-white panel texture (albedo + roughness) with lower desert
 * dust gradient, weathered seam line, corner screws & louver detail.
 */
function createCreamSkirtMaps() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#E9E3D7');
  g.addColorStop(0.68, '#DDD5C8');
  g.addColorStop(0.88, '#C8B8AD');
  g.addColorStop(1, '#9E8A82'); // road-dust / desert splash along base kick
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle grime flecks & micro paint wear
  for (let i = 0; i < 450; i++) {
    const x = (i * 59) % 256;
    const y = (i * 113) % 256;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(60,42,38,0.06)' : 'rgba(255,250,242,0.05)';
    ctx.fillRect(x, y, 4, 4);
  }

  // Subtle recessed access panel seam
  ctx.strokeStyle = 'rgba(55, 48, 46, 0.42)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 22, 220, 206);

  // Small metallic louvers near bottom
  ctx.fillStyle = 'rgba(42, 38, 42, 0.35)';
  for (let ly = 182; ly <= 206; ly += 8) {
    ctx.fillRect(68, ly, 120, 3);
  }

  // Small lock keyhole near top center
  ctx.fillStyle = '#3B3840';
  ctx.beginPath();
  ctx.arc(128, 44, 6, 0, Math.PI * 2);
  ctx.fill();

  const rc = document.createElement('canvas');
  rc.width = 256;
  rc.height = 256;
  const rctx = rc.getContext('2d');
  const rg = rctx.createLinearGradient(0, 0, 0, 256);
  rg.addColorStop(0, '#5A5A5A'); // satin enameled steel top
  rg.addColorStop(0.75, '#767676');
  rg.addColorStop(1, '#C4C4C4'); // dusty matte bottom
  rctx.fillStyle = rg;
  rctx.fillRect(0, 0, 256, 256);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(rc);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  return { map, roughnessMap };
}

/**
 * Brushed stainless steel roughness map for the pump side rails.
 */
function createStainlessRoughnessMap() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 256; y++) {
    const v = 42 + Math.floor((Math.sin(y * 3.1) * 0.5 + 0.5) * 32 + (Math.sin(y * 17.0) * 0.5 + 0.5) * 18);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 128, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * Builds one detailed retro-modern fuel dispenser (`0.85m W × 0.55m D × 2.10m H`).
 */
function buildSingleDispenser(index, mats) {
  const pump = new THREE.Group();
  pump.name = `FuelDispenser_${index + 1}`;

  const W = 0.85;
  const D = 0.55;
  const H = 2.1;

  // 1. Dark recessed base kickplate (Y: 0 -> 0.10)
  const kick = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.1, D - 0.06), mats.darkMetal);
  kick.position.y = 0.05;
  kick.castShadow = true;
  kick.receiveShadow = true;
  pump.add(kick);

  // 2. Painted cream-white lower skirt cabinet (Y: 0.10 -> 0.96)
  const lowerH = 0.86;
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(W - 0.14, lowerH, D - 0.04), mats.creamSkirt);
  lowerBody.position.y = 0.1 + lowerH * 0.5;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  pump.add(lowerBody);

  // Horizontal brushed chrome bumper strip separating lower skirt and mid bay
  const midTrim = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.045, D - 0.01), mats.stainless);
  midTrim.position.y = 0.98;
  pump.add(midTrim);

  // 3. Recessed dark control bay & upper readout core (Y: 1.00 -> 1.94)
  const upperCoreH = 0.94;
  const upperCore = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, upperCoreH, D - 0.08), mats.darkBay);
  upperCore.position.y = 1.0 + upperCoreH * 0.5;
  upperCore.castShadow = true;
  upperCore.receiveShadow = true;
  pump.add(upperCore);

  // 4. Brushed stainless/aluminum vertical side rails framing both sides (full height)
  const railW = 0.085;
  const railH = H - 0.18;
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(railW, railH, D), mats.stainless);
    rail.position.set(sx * (W * 0.5 - railW * 0.5), 0.1 + railH * 0.5, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    pump.add(rail);

    // Subtle dark rubber bumper molding along outer edge of side rail
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.016, railH * 0.86, 0.06), mats.rubber);
    bumper.position.set(sx * (W * 0.5 + 0.004), 0.1 + railH * 0.5, 0);
    pump.add(bumper);
  }

  // 5. Top canopy valance cap + retro stainless trim (Y: 1.94 -> 2.10)
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, 0.14, D + 0.04), mats.creamCap);
  topCap.position.y = H - 0.07;
  topCap.castShadow = true;
  topCap.receiveShadow = true;
  pump.add(topCap);

  const topChromeLip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.045, 0.028, D + 0.055), mats.stainless);
  topChromeLip.position.y = H - 0.14;
  pump.add(topChromeLip);

  // Small illuminated pump-number beacon box on top (middle pump slightly taller like reference!)
  const beaconH = index === 1 ? 0.15 : 0.10;
  const beaconFrame = new THREE.Mesh(new THREE.BoxGeometry(0.16, beaconH, 0.12), mats.darkMetal);
  beaconFrame.position.y = H + beaconH * 0.5;
  pump.add(beaconFrame);

  const beaconLens = new THREE.Mesh(new THREE.BoxGeometry(0.12, beaconH - 0.035, 0.128), mats.amberBeacon);
  beaconLens.position.y = H + beaconH * 0.5;
  pump.add(beaconLens);

  // 6. Crisp Canvas-Baked Illuminated Amber Price/Gallon Readout (front +Z and back -Z!)
  const { map: dispMap, emissiveMap: dispEmissive } = createPumpDisplayTextures(index);
  const displayMat = new THREE.MeshStandardMaterial({
    map: dispMap,
    emissive: '#FFC870',
    emissiveMap: dispEmissive,
    emissiveIntensity: 0.92,
    roughness: 0.36,
    metalness: 0.04,
  });

  const displayGeo = new THREE.PlaneGeometry(0.62, 0.72);
  const glassGeo = new THREE.PlaneGeometry(0.64, 0.74);

  for (const dir of [1, -1]) {
    const faceZ = dir * ((D - 0.08) * 0.5 + 0.004);
    const disp = new THREE.Mesh(displayGeo, displayMat);
    disp.position.set(0, 1.50, faceZ);
    if (dir === -1) disp.rotation.y = Math.PI;
    pump.add(disp);

    // Glossy protective display glass
    const glass = new THREE.Mesh(glassGeo, mats.displayGlass);
    glass.position.set(0, 1.50, faceZ + dir * 0.008);
    if (dir === -1) glass.rotation.y = Math.PI;
    pump.add(glass);

    // Metallic payment keypad / card slot panel just below the display
    const payPanel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.025), mats.stainless);
    payPanel.position.set(-0.16, 1.07, faceZ + dir * 0.01);
    pump.add(payPanel);

    const cardSlot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.03), mats.darkMetal);
    cardSlot.position.set(-0.08, 1.09, faceZ + dir * 0.015);
    pump.add(cardSlot);

    // Chrome nozzle holster recess boot on right side of front/back
    const holster = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.065), mats.stainless);
    holster.position.set(0.20, 1.14, faceZ + dir * 0.022);
    pump.add(holster);

    const holsterSlot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.18, 0.05), mats.darkMetal);
    holsterSlot.position.set(0.20, 1.14, faceZ + dir * 0.035);
    pump.add(holsterSlot);
  }

  // 7. Curved Black Rubber Fuel Hoses (TubeGeometry + CatmullRomCurve3) + Chrome Fuel Nozzles
  const addHoseAndNozzle = (sideSign, zSign) => {
    const sx = sideSign; // +1 right side, -1 left side
    const zOff = zSign * 0.14;

    // Chrome upper swivel elbow
    const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.09, 10), mats.chrome);
    elbow.rotation.z = Math.PI * 0.5;
    elbow.position.set(sx * (W * 0.5 + 0.035), 1.80, zOff);
    pump.add(elbow);

    // Smoothly draped weighted rubber fuel hose curve
    const hoseStart = new THREE.Vector3(sx * (W * 0.5 + 0.075), 1.80, zOff);
    const p1 = new THREE.Vector3(sx * (W * 0.5 + 0.16), 1.38, zOff + zSign * 0.05);
    const p2 = new THREE.Vector3(sx * (W * 0.5 + 0.19), 0.72, zOff + zSign * 0.10);
    const p3 = new THREE.Vector3(sx * (W * 0.5 + 0.12), 0.56, zOff + zSign * 0.15);
    const p4 = new THREE.Vector3(sx * (W * 0.5 + 0.04), 0.82, zSign * (D * 0.5 + 0.07));
    const nozzleEntry = new THREE.Vector3(sx * 0.20, 1.04, zSign * (D * 0.5 + 0.055));

    const curve = new THREE.CatmullRomCurve3([hoseStart, p1, p2, p3, p4, nozzleEntry]);
    const hoseGeo = new THREE.TubeGeometry(curve, 36, 0.017, 10, false);
    const hoseMesh = new THREE.Mesh(hoseGeo, mats.rubber);
    hoseMesh.castShadow = true;
    pump.add(hoseMesh);

    // Chrome Fuel Nozzle seated cleanly in holster
    const nozzleGroup = new THREE.Group();
    nozzleGroup.position.set(sx * 0.20, 1.13, zSign * (D * 0.5 + 0.03));

    // Nozzle body + trigger guard
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.07), mats.chrome);
    body.rotation.x = zSign * 0.28;
    nozzleGroup.add(body);

    // Rubberized grip sleeve
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.09, 0.045), mats.nozzleBoot);
    grip.position.set(0, -0.02, zSign * 0.015);
    grip.rotation.x = zSign * 0.28;
    nozzleGroup.add(grip);

    // Curved chrome spout tucked into holster slot
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.14, 10), mats.chrome);
    spout.position.set(0, 0.08, -zSign * 0.025);
    spout.rotation.x = -zSign * 0.55;
    nozzleGroup.add(spout);

    pump.add(nozzleGroup);
  };

  // Primary hose on right-front side + secondary hose on left-rear for full 360 silhouette
  addHoseAndNozzle(1, 1);
  addHoseAndNozzle(-1, -1);

  // Overhead canopy spotlights + crisp backlit display emissive (0.92) shade the pump cleanly
  // with zero washed-out lightbox glare (and zero extra PointLights for 60 FPS!).
  return { pump, light: null };
}

/**
 * Builds the iconic red cylindrical metal trash bin + mounted fire extinguisher
 * on the right side of the pump island (`[5.15, 0.025, -0.2]`).
 */
function buildRedTrashAndExtinguisher(mats) {
  const unit = new THREE.Group();
  unit.name = 'RedTrashBinAndExtinguisher';

  // Heavy painted red steel drum body
  const drumH = 0.84;
  const drumR = 0.23;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(drumR, drumR * 0.96, drumH, 22), mats.redEnamel);
  drum.position.y = drumH * 0.5;
  drum.castShadow = true;
  drum.receiveShadow = true;
  unit.add(drum);

  // Dark rubber base ring
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(drumR * 1.01, drumR * 1.02, 0.05, 22), mats.rubber);
  baseRing.position.y = 0.025;
  unit.add(baseRing);

  // Two raised metallic structural bands (visible in reference zoom!)
  for (const bandY of [0.30, 0.62]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(drumR + 0.004, 0.011, 8, 24), mats.stainless);
    band.rotation.x = Math.PI * 0.5;
    band.position.y = bandY;
    unit.add(band);
  }

  // Domed metal hood lid with dark trash chute opening
  const hood = new THREE.Mesh(
    new THREE.SphereGeometry(drumR * 0.99, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
    mats.redEnamel
  );
  hood.position.y = drumH - 0.01;
  hood.castShadow = true;
  unit.add(hood);

  const chute = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.08), mats.darkMetal);
  chute.position.set(0, drumH + 0.09, drumR * 0.65);
  chute.rotation.x = -0.35;
  unit.add(chute);

  // Mounted roadside fire extinguisher cylinder clipped on the left-front side
  const extGroup = new THREE.Group();
  extGroup.position.set(-drumR - 0.075, 0.0, 0.08);

  const extTank = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.46, 16), mats.brightRed);
  extTank.position.y = 0.36;
  extTank.castShadow = true;
  extGroup.add(extTank);

  const extShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    mats.brightRed
  );
  extShoulder.position.y = 0.59;
  extGroup.add(extShoulder);

  const extValve = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.075, 10), mats.chrome);
  extValve.position.y = 0.68;
  extGroup.add(extValve);

  const extHandle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.014, 0.022), mats.chrome);
  extHandle.position.set(0.035, 0.70, 0);
  extHandle.rotation.z = 0.2;
  extGroup.add(extHandle);

  const extNozzle = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.11, 10), mats.rubber);
  extNozzle.position.set(-0.045, 0.55, 0.03);
  extNozzle.rotation.z = 0.25;
  extGroup.add(extNozzle);

  // White instruction decal band on extinguisher
  const extLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16, 1, true, -0.9, 1.8),
    new THREE.MeshStandardMaterial({ color: '#F0ECE4', roughness: 0.5 })
  );
  extLabel.position.y = 0.39;
  extGroup.add(extLabel);

  // Mounting collar bracket connecting extinguisher to drum
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.03), mats.darkMetal);
  strap.position.set(0.055, 0.42, 0);
  extGroup.add(strap);

  unit.add(extGroup);
  return unit;
}

/**
 * Windshield washer squeegee bucket on the left end of the concrete pump island.
 */
function buildWasherBucket(mats) {
  const b = new THREE.Group();
  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.44, 0.24), mats.darkMetal);
  tub.position.y = 0.22;
  tub.castShadow = true;
  tub.receiveShadow = true;
  b.add(tub);

  const towelBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.18), mats.stainless);
  towelBox.position.set(0, 0.57, -0.02);
  towelBox.castShadow = true;
  b.add(towelBox);

  // Squeegee handle sticking up out of bucket
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.42, 8), mats.stainless);
  handle.position.set(0.07, 0.56, 0.05);
  handle.rotation.z = -0.18;
  b.add(handle);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.035), mats.rubber);
  head.position.set(0.105, 0.76, 0.05);
  head.rotation.z = -0.18;
  b.add(head);

  return b;
}

export function createPumps({ config }) {
  const group = new THREE.Group();
  group.name = 'StationPumps';

  const cfg = config.station.pumps;
  const skirtMaps = createCreamSkirtMaps();
  const stainlessRough = createStainlessRoughnessMap();

  const mats = {
    stainless: new THREE.MeshStandardMaterial({
      color: '#C8CED6',
      metalness: 0.74,
      roughness: 0.38,
      roughnessMap: stainlessRough,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: '#E6EAEF',
      metalness: 0.92,
      roughness: 0.16,
    }),
    creamSkirt: new THREE.MeshStandardMaterial({
      color: '#DBD2C5',
      map: skirtMaps.map,
      roughnessMap: skirtMaps.roughnessMap,
      metalness: 0.08,
      roughness: 0.64,
    }),
    creamCap: new THREE.MeshStandardMaterial({
      color: '#CFC6B8',
      metalness: 0.10,
      roughness: 0.56,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: '#17171E',
      metalness: 0.52,
      roughness: 0.50,
    }),
    darkBay: new THREE.MeshStandardMaterial({
      color: '#111218',
      metalness: 0.25,
      roughness: 0.56,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: '#17171B',
      metalness: 0.04,
      roughness: 0.88,
    }),
    nozzleBoot: new THREE.MeshStandardMaterial({
      color: '#22242A',
      metalness: 0.08,
      roughness: 0.75,
    }),
    displayGlass: new THREE.MeshPhysicalMaterial({
      color: '#E4F0FF',
      transparent: true,
      opacity: 0.11,
      roughness: 0.16,
      metalness: 0.08,
      envMapIntensity: 1.1,
      depthWrite: false,
    }),
    amberBeacon: new THREE.MeshStandardMaterial({
      color: '#FFE09E',
      emissive: '#FFAA32',
      emissiveIntensity: 1.15,
      roughness: 0.28,
    }),
    redEnamel: new THREE.MeshStandardMaterial({
      color: '#C2221E',
      metalness: 0.32,
      roughness: 0.32,
    }),
    brightRed: new THREE.MeshStandardMaterial({
      color: '#D82622',
      metalness: 0.38,
      roughness: 0.24,
    }),
  };

  // Place all 3 fuel dispensers cleanly on the concrete pump island
  const pumpLights = [];
  cfg.positions.forEach(([x, y, z], idx) => {
    const { pump, light } = buildSingleDispenser(idx, mats);
    pump.position.set(x, y, z);
    group.add(pump);
    if (light) pumpLights.push(light);
  });

  // Iconic red metal trash bin + fire extinguisher at right end of island
  const trashBin = buildRedTrashAndExtinguisher(mats);
  trashBin.position.set(cfg.trashBinPos[0], cfg.trashBinPos[1], cfg.trashBinPos[2]);
  group.add(trashBin);

  // Subtle squeegee washer bucket on left end of pump island
  const washer = buildWasherBucket(mats);
  washer.position.set(-1.08, cfg.yBase, -0.2);
  group.add(washer);

  return {
    group,
    lights: {
      pumps: pumpLights,
    },
    update() {},
  };
}
