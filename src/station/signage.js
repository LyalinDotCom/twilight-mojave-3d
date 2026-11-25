import * as THREE from 'three';

/**
 * Generates razor-sharp (2048×768) diffuse + emissive textures for the iconic
 * deep crimson-red enameled "Desert" retro script neon marquee.
 *
 * CRITICAL FOR LEGIBILITY:
 * - Emissive canvas is PURE BLACK (#000000) across the red enamel background so
 *   ONLY the crisp neon script strokes emit HDR light (zero background washout!).
 */
function createDesertMarqueeTextures(text = 'Desert') {
  const w = 2048;
  const h = 768;

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const ctx = diffCanvas.getContext('2d');

  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = w;
  emisCanvas.height = h;
  const ectx = emisCanvas.getContext('2d');

  // Deep vintage crimson porcelain-enamel face (rich matte-satin contrast behind neon)
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 110, w * 0.5, h * 0.5, w * 0.56);
  bg.addColorStop(0, '#9E181E');
  bg.addColorStop(0.65, '#851319');
  bg.addColorStop(1, '#5A0D12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle enameled weathering flecks & horizontal sheen
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 1);
  }

  // PURE BLACK emissive background — zero red washout!
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  // Thin crisp warm-gold inner pinstripe border on diffuse only (subtle glint on emissive)
  ctx.strokeStyle = '#E8BE7D';
  ctx.lineWidth = 8;
  ctx.strokeRect(48, 48, w - 96, h - 96);

  ectx.strokeStyle = '#523218';
  ectx.lineWidth = 6;
  ectx.strokeRect(48, 48, w - 96, h - 96);

  // Crisp retro Americana script "Desert" — tight clean neon tube stroke so letter interiors stay dark red!
  const drawScript = (targetCtx, isEmissive) => {
    targetCtx.save();
    targetCtx.translate(w * 0.5, h * 0.53);
    targetCtx.rotate(-0.022);

    const fontSpec = 'italic 510px "SignPainter", "Brush Script MT", "Segoe Script", Georgia, cursive';
    targetCtx.font = fontSpec;
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';

    if (!isEmissive) {
      // Crisp dark enamel cast shadow behind the glass neon tubing
      targetCtx.fillStyle = 'rgba(28, 3, 5, 0.88)';
      targetCtx.fillText(text, 14, 18);
      targetCtx.lineWidth = 10;
      targetCtx.strokeStyle = 'rgba(28, 3, 5, 0.72)';
      targetCtx.strokeText(text, 14, 18);
    }

    // Tight golden-amber outer edge (NO huge blur radius that fills letter loops!)
    targetCtx.shadowColor = '#FF9A3C';
    targetCtx.shadowBlur = isEmissive ? 12 : 8;
    targetCtx.lineWidth = 8;
    targetCtx.strokeStyle = '#FFBF5E';
    targetCtx.strokeText(text, 0, 0);

    // Crisp warm ivory-gold neon tube core
    targetCtx.shadowBlur = 4;
    targetCtx.shadowColor = '#FFF2D0';
    targetCtx.fillStyle = '#FFF6DF';
    targetCtx.fillText(text, 0, 0);

    // Clean retro underline flourish beneath "Desert"
    targetCtx.beginPath();
    targetCtx.moveTo(-600, 206);
    targetCtx.quadraticCurveTo(0, 176, 620, 192);
    targetCtx.lineCap = 'round';
    targetCtx.lineWidth = 12;
    targetCtx.strokeStyle = '#FFCE7A';
    targetCtx.shadowBlur = 6;
    targetCtx.stroke();

    targetCtx.lineWidth = 5;
    targetCtx.strokeStyle = '#FFF9E8';
    targetCtx.shadowBlur = 2;
    targetCtx.stroke();

    targetCtx.restore();
  };

  drawScript(ctx, false);
  drawScript(ectx, true);

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const emissiveMap = new THREE.CanvasTexture(emisCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 8;

  return { map, emissiveMap };
}

/**
 * Generates razor-sharp (1024×256) diffuse + emissive textures for the dark red-framed
 * "GAS & GO" condensed retro sub-marquee (zero background glow washout!).
 */
function createSubMarqueeTextures(text = 'GAS & GO') {
  const w = 1024;
  const h = 256;

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const ctx = diffCanvas.getContext('2d');

  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = w;
  emisCanvas.height = h;
  const ectx = emisCanvas.getContext('2d');

  // Deep dark burgundy-charcoal marquee backing
  ctx.fillStyle = '#1D0A0D';
  ctx.fillRect(0, 0, w, h);

  // Pure black emissive background so ONLY the condensed letters glow
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  // Subtle dark-red inner border on diffuse
  ctx.strokeStyle = '#9E1B1F';
  ctx.lineWidth = 14;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // Horizontal marquee letter-track rails
  ctx.strokeStyle = 'rgba(255, 220, 185, 0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(28, 46);
  ctx.lineTo(w - 28, 46);
  ctx.moveTo(28, h - 46);
  ctx.lineTo(w - 28, h - 46);
  ctx.stroke();

  const drawLetters = (targetCtx, isEmissive) => {
    targetCtx.save();
    targetCtx.font = 'bold 162px "DIN Condensed", "Arial Narrow", "Impact", "Helvetica Neue", sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';

    const chars = text.split('');
    const spacing = 106;
    const totalW = (chars.length - 1) * spacing;
    const startX = w * 0.5 - totalW * 0.5;
    const cy = h * 0.55;

    chars.forEach((ch, idx) => {
      const cx = startX + idx * spacing;
      targetCtx.shadowColor = '#FF9C40';
      targetCtx.shadowBlur = isEmissive ? 10 : 6;
      targetCtx.fillStyle = '#FFE8B6';
      targetCtx.fillText(ch, cx, cy);

      targetCtx.shadowBlur = 2;
      targetCtx.fillStyle = '#FFF9EA';
      targetCtx.fillText(ch, cx, cy);
    });
    targetCtx.restore();
  };

  drawLetters(ctx, false);
  drawLetters(ectx, true);

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const emissiveMap = new THREE.CanvasTexture(emisCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 8;

  return { map, emissiveMap };
}

/**
 * Creates a bevelled rounded-rectangle ExtrudeGeometry centered on origin.
 */
function createRoundedCabinetGeo(width, height, depth, radius = 0.08, bevel = 0.024) {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.min(radius, hw * 0.3, hh * 0.3);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a closed rounded-rectangle CurvePath in the XY plane at `z`.
 */
function createFrontRectTubePath(width, height, z, radius = 0.075) {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.min(radius, hw * 0.3, hh * 0.3);
  const path = new THREE.CurvePath();

  path.add(new THREE.LineCurve3(new THREE.Vector3(-hw + r, -hh, z), new THREE.Vector3(hw - r, -hh, z)));
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(hw - r, -hh, z),
      new THREE.Vector3(hw, -hh, z),
      new THREE.Vector3(hw, -hh + r, z)
    )
  );
  path.add(new THREE.LineCurve3(new THREE.Vector3(hw, -hh + r, z), new THREE.Vector3(hw, hh - r, z)));
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(hw, hh - r, z),
      new THREE.Vector3(hw, hh, z),
      new THREE.Vector3(hw - r, hh, z)
    )
  );
  path.add(new THREE.LineCurve3(new THREE.Vector3(hw - r, hh, z), new THREE.Vector3(-hw + r, hh, z)));
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-hw + r, hh, z),
      new THREE.Vector3(-hw, hh, z),
      new THREE.Vector3(-hw, hh - r, z)
    )
  );
  path.add(new THREE.LineCurve3(new THREE.Vector3(-hw, hh - r, z), new THREE.Vector3(-hw, -hh + r, z)));
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-hw, -hh + r, z),
      new THREE.Vector3(-hw, -hh, z),
      new THREE.Vector3(-hw + r, -hh, z)
    )
  );
  return path;
}

/**
 * Builds an extruded 3D 5-pointed star geometry + matching crisp 3D neon outline tube path.
 */
function createStarGeometryAndOutline(outerR = 0.42, innerR = 0.175, depth = 0.11) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI * 0.5 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? outerR : innerR;
    pts.push(new THREE.Vector2(Math.cos(angle) * rad, Math.sin(angle) * rad));
  }

  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i].x, pts[i].y);
  }
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  bodyGeo.translate(0, 0, -depth * 0.5);
  bodyGeo.computeVertexNormals();

  // Closed crisp 3D neon outline tracing all 10 star edges on front face
  const zFront = depth * 0.5 + 0.026;
  const frontPath = new THREE.CurvePath();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    frontPath.add(new THREE.LineCurve3(new THREE.Vector3(a.x, a.y, zFront), new THREE.Vector3(b.x, b.y, zFront)));
  }

  const outlineGeo = new THREE.TubeGeometry(frontPath, 90, 0.017, 8, true);

  return { bodyGeo, outlineGeo };
}

export function createSignage({ config }) {
  const group = new THREE.Group();
  group.name = 'RooftopNeonSignage';

  const cfg = config.station.signage;
  const [sx, sy, sz] = cfg.position;
  group.position.set(sx, sy, sz);
  group.rotation.y = cfg.rotationY ?? -0.12;

  const mainW = cfg.boxWidth || 2.65;
  const mainH = 0.88;
  const mainY = 1.28;
  const subW = mainW * 0.86;
  const subH = 0.42;
  const subY = 0.56;
  const starLocalY = (cfg.starCenterY ?? 5.72) - sy;

  // --- Materials (calibrated to stay crisp & saturated without nuclear bloom washout!) ---
  const steelPostMat = new THREE.MeshStandardMaterial({
    // Satin dark painted steel so posts, braces & star stem catch crimson-white neon spill cleanly
    color: '#2B242C',
    metalness: 0.56,
    roughness: 0.42,
  });

  const redEnamelMat = new THREE.MeshStandardMaterial({
    color: '#8C161B',
    metalness: 0.30,
    roughness: 0.34,
  });

  const darkRedCabinetMat = new THREE.MeshStandardMaterial({
    color: '#6B1318',
    metalness: 0.34,
    roughness: 0.38,
  });

  const whiteNeonBorderMat = new THREE.MeshStandardMaterial({
    color: '#FFF6EB',
    emissive: '#FFE8D2',
    emissiveIntensity: 1.8,
    roughness: 0.16,
  });

  const subBorderNeonMat = new THREE.MeshStandardMaterial({
    color: '#FFF0E2',
    emissive: '#FFD2B5',
    emissiveIntensity: 1.75,
    roughness: 0.16,
  });

  const starBodyMat = new THREE.MeshStandardMaterial({
    color: '#A81A1E',
    emissive: '#580A0C',
    emissiveIntensity: 0.22,
    metalness: 0.28,
    roughness: 0.32,
  });

  const starNeonMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    emissive: new THREE.Color(config.palette.starWhite || '#FFF5E8'),
    emissiveIntensity: 2.05,
    roughness: 0.12,
  });

  // =========================================================================
  // 1. TWIN DARK STEEL MOUNTING POSTS + REAR BRACES + ROOF UTILITY MAST/CONDUITS
  // =========================================================================
  const postGeo = new THREE.CylinderGeometry(0.052, 0.056, 1.72, 14);
  const footPlateGeo = new THREE.BoxGeometry(0.24, 0.03, 0.24);

  for (const px of [-0.74, 0.74]) {
    const post = new THREE.Mesh(postGeo, steelPostMat);
    post.position.set(px, 0.85, -0.06);
    post.castShadow = true;
    group.add(post);

    const foot = new THREE.Mesh(footPlateGeo, steelPostMat);
    foot.position.set(px, 0.015, -0.06);
    group.add(foot);

    const braceStart = new THREE.Vector3(px, 1.38, -0.10);
    const braceEnd = new THREE.Vector3(px, 0.02, -0.88);
    const braceLen = braceStart.distanceTo(braceEnd);
    const brace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, braceLen, 8),
      steelPostMat
    );
    brace.position.copy(braceStart).add(braceEnd).multiplyScalar(0.5);
    brace.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      braceEnd.clone().sub(braceStart).normalize()
    );
    group.add(brace);
  }

  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.055, 0.055), steelPostMat);
  crossBar.position.set(0, 0.82, -0.06);
  group.add(crossBar);

  // Weathered thin vertical utility mast & electrical conduits behind/left of sign
  const mastGroup = new THREE.Group();
  mastGroup.position.set(-1.95, 0, -0.62);

  const mainMast = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 1.85, 10), steelPostMat);
  mainMast.position.y = 0.925;
  mainMast.castShadow = true;
  mastGroup.add(mainMast);

  const weatherHead = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.036, 0.09, 10), steelPostMat);
  weatherHead.position.y = 1.86;
  mastGroup.add(weatherHead);

  const sideConduit = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 1.36, 8), steelPostMat);
  sideConduit.position.set(-0.26, 0.68, 0.14);
  mastGroup.add(sideConduit);

  const conduitCap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), steelPostMat);
  conduitCap.position.set(-0.26, 1.36, 0.14);
  mastGroup.add(conduitCap);

  const roofJBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.14), steelPostMat);
  roofJBox.position.set(-0.12, 0.11, 0.06);
  mastGroup.add(roofJBox);

  group.add(mastGroup);

  // =========================================================================
  // 2. MAIN BEVELLED DEEP-CRIMSON MARQUEE CABINET ("Desert")
  // =========================================================================
  const mainCabinetGroup = new THREE.Group();
  mainCabinetGroup.position.set(0, mainY, 0);
  group.add(mainCabinetGroup);

  const mainCabinet = new THREE.Mesh(
    createRoundedCabinetGeo(mainW, mainH, 0.22, 0.09, 0.025),
    redEnamelMat
  );
  mainCabinet.castShadow = true;
  mainCabinet.receiveShadow = true;
  mainCabinetGroup.add(mainCabinet);

  const { map: desertMap, emissiveMap: desertEmissive } = createDesertMarqueeTextures(
    cfg.mainText || 'Desert'
  );
  const desertFaceMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: desertMap,
    emissive: '#FFE8C4',
    emissiveMap: desertEmissive,
    emissiveIntensity: 1.25,
    roughness: 0.72,
    metalness: 0.02,
  });

  const mainFaceGeo = new THREE.PlaneGeometry(mainW - 0.08, mainH - 0.08);
  const mainFrontFace = new THREE.Mesh(mainFaceGeo, desertFaceMat);
  mainFrontFace.position.z = 0.138;
  mainCabinetGroup.add(mainFrontFace);

  const mainBackFace = new THREE.Mesh(mainFaceGeo, desertFaceMat);
  mainBackFace.rotation.y = Math.PI;
  mainBackFace.position.z = -0.138;
  mainCabinetGroup.add(mainBackFace);

  // Thin crisp perimeter warm-white neon border tube (radius 0.015 so it frames cleanly)
  const mainBorderPath = createFrontRectTubePath(mainW + 0.015, mainH + 0.015, 0.152, 0.09);
  const mainBorderTube = new THREE.Mesh(
    new THREE.TubeGeometry(mainBorderPath, 100, 0.015, 8, true),
    whiteNeonBorderMat
  );
  mainBorderTube.userData.noShadowCast = true;
  mainCabinetGroup.add(mainBorderTube);

  // =========================================================================
  // 3. DARK RED-FRAMED SUB-MARQUEE ("GAS & GO")
  // =========================================================================
  const subCabinetGroup = new THREE.Group();
  subCabinetGroup.position.set(0, subY, 0);
  group.add(subCabinetGroup);

  const subCabinet = new THREE.Mesh(
    createRoundedCabinetGeo(subW, subH, 0.19, 0.055, 0.02),
    darkRedCabinetMat
  );
  subCabinet.castShadow = true;
  subCabinet.receiveShadow = true;
  subCabinetGroup.add(subCabinet);

  const { map: subMap, emissiveMap: subEmissive } = createSubMarqueeTextures(
    cfg.subText || 'GAS & GO'
  );
  const subFaceMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: subMap,
    emissive: '#FFE4B8',
    emissiveMap: subEmissive,
    emissiveIntensity: 1.35,
    roughness: 0.72,
    metalness: 0.02,
  });

  const subFaceGeo = new THREE.PlaneGeometry(subW - 0.06, subH - 0.06);
  const subFrontFace = new THREE.Mesh(subFaceGeo, subFaceMat);
  subFrontFace.position.z = 0.118;
  subCabinetGroup.add(subFrontFace);

  const subBackFace = new THREE.Mesh(subFaceGeo, subFaceMat);
  subBackFace.rotation.y = Math.PI;
  subBackFace.position.z = -0.118;
  subCabinetGroup.add(subBackFace);

  const subBorderPath = createFrontRectTubePath(subW + 0.012, subH + 0.012, 0.130, 0.055);
  const subBorderTube = new THREE.Mesh(
    new THREE.TubeGeometry(subBorderPath, 80, 0.013, 8, true),
    subBorderNeonMat
  );
  subBorderTube.userData.noShadowCast = true;
  subCabinetGroup.add(subBorderTube);

  // =========================================================================
  // 4. EXTRUDED 3D 5-POINTED CRIMSON STAR (★) WITH WHITE-HOT NEON OUTLINE
  // =========================================================================
  const starGroup = new THREE.Group();
  starGroup.position.set(0, starLocalY, 0.02);
  group.add(starGroup);

  const stemH = Math.max(0.18, starLocalY - (mainY + mainH * 0.5) - 0.14);
  const starStem = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, stemH, 10), steelPostMat);
  starStem.position.set(0, -0.16 - stemH * 0.5, -0.02);
  starGroup.add(starStem);

  const { bodyGeo: starBodyGeo, outlineGeo: starOutlineGeo } = createStarGeometryAndOutline(
    0.42,
    0.175,
    0.11
  );

  const starBody = new THREE.Mesh(starBodyGeo, starBodyMat);
  starBody.castShadow = true;
  starGroup.add(starBody);

  const starNeonOutline = new THREE.Mesh(starOutlineGeo, starNeonMat);
  starNeonOutline.userData.noShadowCast = true;
  starGroup.add(starNeonOutline);

  const starBackOutline = new THREE.Mesh(starOutlineGeo, starNeonMat);
  starBackOutline.rotation.y = Math.PI;
  starBackOutline.userData.noShadowCast = true;
  starGroup.add(starBackOutline);

  // Master rooftop crimson-amber sign spill light lives centrally in src/lighting.js
  // (zero redundant overlapping point light here!).

  // =========================================================================
  // 5. SUBTLE LIVING WORLD NEON MICRO-FLICKER
  // =========================================================================
  function update(t, _dt, opts) {
    if (!opts?.livingWorld) {
      starNeonMat.emissiveIntensity = 2.05;
      subBorderNeonMat.emissiveIntensity = 1.75;
      return;
    }

    const cycle = t % 8.3;
    let flicker = 1.0;
    if (cycle > 6.1 && cycle < 6.32) {
      const p = (cycle - 6.1) / 0.22;
      flicker = 0.62 + 0.38 * Math.abs(Math.sin(p * Math.PI * 5.0));
    } else if (cycle > 2.4 && cycle < 2.47) {
      flicker = 0.82;
    }

    subBorderNeonMat.emissiveIntensity = 1.75 * flicker;
    const starBreath = 1.0 - (1.0 - flicker) * 0.22 + Math.sin(t * 17.0) * 0.015;
    starNeonMat.emissiveIntensity = 2.05 * starBreath;
  }

  return {
    group,
    lights: {
      sign: [],
    },
    update,
  };
}
