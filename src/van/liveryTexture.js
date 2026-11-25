import * as THREE from 'three';

/**
 * Deterministic fast PRNG for organic desert dust & micro-variation.
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

/**
 * Shared VW T3 body longitudinal & vertical bounds used by both UV projection
 * in `van.js` and canvas drawing here so every stripe, decal, and seam aligns
 * to the millimeter.
 */
export const BODY_UV_BOUNDS = {
  xMin: -2.23,
  xMax: 2.22,
  yMin: 0.25,
  yMax: 1.96,
};

function xToPx(x, W) {
  return ((x - BODY_UV_BOUNDS.xMin) / (BODY_UV_BOUNDS.xMax - BODY_UV_BOUNDS.xMin)) * W;
}

function yToPy(y, H) {
  // CanvasTexture has flipY = true by default, so v=1 (yMax) is py=0 (top of canvas)
  const v = (y - BODY_UV_BOUNDS.yMin) / (BODY_UV_BOUNDS.yMax - BODY_UV_BOUNDS.yMin);
  return (1 - v) * H;
}

/**
 * Evaluates the iconic wavy lower boundary of the mustard-ochre stripe in world Y
 * as a function of local X (front = -2.23, rear = +2.22).
 * Rises cleanly over the front (-1.305) and rear (+1.155) wheel arches,
 * and swoops deep down into a bold belly wave between the axles.
 */
function stripeBottomY(x) {
  // Front nose & front wheel arch hump (clears 0.76m arch lip cleanly with turquoise collar)
  if (x < -0.78) {
    const d = (x - -1.305) / 0.54;
    const arch = Math.exp(-d * d * 1.4);
    return 0.65 + 0.20 * arch - 0.035 * Math.max(0, (-1.78 - x) * 2.0);
  }
  // Sweeping deep mid-body belly wave between front & rear wheels
  if (x <= 0.64) {
    const t = (x - -0.78) / (0.64 - -0.78); // 0..1
    const dip = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
    const skew = Math.sin(t * Math.PI) * 0.032;
    return 0.70 - 0.25 * dip - skew;
  }
  // Rear wheel arch hump (clears 0.76m arch lip cleanly) & rear quarter swoop
  const dRear = (x - 1.155) / 0.52;
  const archRear = Math.exp(-dRear * dRear * 1.45);
  const rearTailDrop = Math.max(0, (x - 1.56) / 0.66) * 0.11;
  return 0.65 + 0.20 * archRear - rearTailDrop;
}

/**
 * Draws a crisp retro 6-petal desert flower / sunburst medallion.
 */
function drawRetroFlower(ctx, cx, cy, radius, coralColor, darkCoral, centerGold) {
  ctx.save();
  ctx.translate(cx, cy);

  // Subtle dark turquoise drop shadow to pop cleanly off the paint
  ctx.save();
  ctx.translate(3, 4);
  ctx.fillStyle = 'rgba(14, 48, 66, 0.34)';
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3 - Math.PI / 6;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(ang) * radius * 0.52,
      Math.sin(ang) * radius * 0.52,
      radius * 0.44,
      radius * 0.33,
      ang,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();

  // Outer crisp petals
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3 - Math.PI / 6;
    ctx.save();
    ctx.rotate(ang);
    const grad = ctx.createRadialGradient(
      radius * 0.48,
      -radius * 0.06,
      radius * 0.06,
      radius * 0.52,
      0,
      radius * 0.52
    );
    grad.addColorStop(0, '#F0613B');
    grad.addColorStop(0.7, coralColor);
    grad.addColorStop(1, darkCoral);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(radius * 0.52, 0, radius * 0.44, radius * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle petal crease line
    ctx.strokeStyle = 'rgba(130, 26, 12, 0.42)';
    ctx.lineWidth = Math.max(2, radius * 0.045);
    ctx.beginPath();
    ctx.moveTo(radius * 0.24, 0);
    ctx.lineTo(radius * 0.72, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Center ring & warm golden pistil
  ctx.fillStyle = darkCoral;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.29, 0, Math.PI * 2);
  ctx.fill();

  const cGrad = ctx.createRadialGradient(-radius * 0.05, -radius * 0.05, 2, 0, 0, radius * 0.23);
  cGrad.addColorStop(0, '#F2DC5E');
  cGrad.addColorStop(1, centerGold);
  ctx.fillStyle = cGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws the crisp, 100% legible retro side panel graphic ("DESERT CRUISER")
 * on the upper solid mid-flank panel, paying faithful color-mass homage to the
 * reference van while eliminating all AI text garble.
 */
function drawSideBannerGraphic(ctx, W, H, mirrorText, coralColor, stripeColor) {
  const x0 = xToPx(-0.76, W);
  const x1 = xToPx(1.18, W);
  const yTop = yToPy(1.73, H);
  const yBot = yToPy(1.17, H);
  const cx = (x0 + x1) * 0.5;
  const cy = (yTop + yBot) * 0.5;
  const bw = x1 - x0;
  const bh = yBot - yTop;

  ctx.save();
  ctx.translate(cx, cy);
  if (mirrorText) {
    ctx.scale(-1, 1);
  }

  // Flowing lime-ochre retro pennant wave backdrop (matching reference color mass)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-bw * 0.49, bh * 0.24);
  ctx.bezierCurveTo(-bw * 0.32, -bh * 0.42, -bw * 0.05, -bh * 0.46, bw * 0.46, -bh * 0.36);
  ctx.quadraticCurveTo(bw * 0.51, -bh * 0.04, bw * 0.47, bh * 0.32);
  ctx.bezierCurveTo(bw * 0.16, bh * 0.45, -bw * 0.2, bh * 0.34, -bw * 0.49, bh * 0.38);
  ctx.closePath();

  const bannerGrad = ctx.createLinearGradient(-bw * 0.45, -bh * 0.4, bw * 0.45, bh * 0.4);
  bannerGrad.addColorStop(0, '#C7B438');
  bannerGrad.addColorStop(0.5, '#DEC842');
  bannerGrad.addColorStop(1, stripeColor);
  ctx.fillStyle = bannerGrad;
  ctx.fill();

  // Crisp turquoise-navy retro border outline
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#146284';
  ctx.stroke();

  // Inner bright lime-gold pinstripe
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255, 244, 168, 0.55)';
  ctx.stroke();
  ctx.restore();

  // Subtle decorative desert wave swoosh leading from front into the banner
  ctx.save();
  ctx.strokeStyle = '#E0CB48';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-bw * 0.54, bh * 0.32);
  ctx.quadraticCurveTo(-bw * 0.46, bh * 0.24, -bw * 0.39, bh * 0.25);
  ctx.stroke();
  ctx.restore();

  // Stacked retro bold typography: "DESERT" / "CRUISER"
  // Bold italic rounded display styling for authentic 70s/80s surf-van vibe
  const drawGroovyWord = (word, yOffset, fontSize, tiltRad) => {
    ctx.save();
    ctx.translate(0, yOffset);
    ctx.rotate(tiltRad);
    ctx.font = `900 italic ${fontSize}px "Arial Black", "Impact", "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Extruded dark teal/maroon 3D retro shadow
    ctx.fillStyle = '#144B66';
    for (let s = 10; s >= 1; s -= 2) {
      ctx.fillText(word, s * 0.8, s * 0.9);
    }

    // Thick dark red outer stroke
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.round(fontSize * 0.13);
    ctx.strokeStyle = '#7D1E12';
    ctx.strokeText(word, 0, 0);

    // Vibrant coral-orange vertical gradient fill
    const tGrad = ctx.createLinearGradient(0, -fontSize * 0.55, 0, fontSize * 0.55);
    tGrad.addColorStop(0, '#FF7844');
    tGrad.addColorStop(0.45, coralColor);
    tGrad.addColorStop(1, '#BE3018');
    ctx.fillStyle = tGrad;
    ctx.fillText(word, 0, 0);

    // Crisp upper highlight gloss line
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 226, 170, 0.48)';
    ctx.strokeText(word, -1.5, -2.5);
    ctx.restore();
  };

  drawGroovyWord('DESERT', -bh * 0.145, 114, -0.025);
  drawGroovyWord('CRUISER', bh * 0.185, 100, -0.02);

  // Two crisp 4-point retro starburst accents
  const drawStar4 = (sx, sy, r) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#FFF4C8';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : r * 0.28;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  drawStar4(-bw * 0.41, -bh * 0.18, 17);
  drawStar4(bw * 0.41, bh * 0.22, 14);

  ctx.restore();
}

/**
 * Generates high-resolution (2048x1024) PBR maps (albedo, roughness, bump)
 * for one side flank of the VW T3 Camper.
 *
 * @param {object} opts
 * @param {'left'|'right'} opts.side - 'left' (+Z camera-facing) or 'right' (-Z sliding door)
 * @param {object} opts.palette - CONFIG.palette colors
 */
export function createSideLiveryMaps({ side = 'left', palette = {} } = {}) {
  const W = 2048;
  const H = 1024;
  // Punchy vibrant turquoise, chartreuse-ochre stripe, and vivid coral-vermilion
  // calibrated to pop cleanly under magenta/coral twilight lighting!
  const turquoise = '#1EA8DC';
  const stripe = '#D6C430';
  const coral = '#EE4822';

  // --- 1. ALBEDO CANVAS ---
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = W;
  albedoCanvas.height = H;
  const ctx = albedoCanvas.getContext('2d');

  // Rich vibrant turquoise base body paint with subtle automotive depth gradient
  const baseGrad = ctx.createLinearGradient(0, 0, 0, H);
  baseGrad.addColorStop(0.0, '#26BCEF'); // Luminous upper roof crown edge
  baseGrad.addColorStop(0.35, turquoise);
  baseGrad.addColorStop(0.76, '#1593C4');
  baseGrad.addColorStop(1.0, '#0F739B'); // Deeper lower rocker
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle horizontal beltline metallic sheen highlight along window sill
  const yBelt = yToPy(1.08, H);
  const beltHighlight = ctx.createLinearGradient(0, yBelt - 18, 0, yBelt + 18);
  beltHighlight.addColorStop(0, 'rgba(255,255,255,0)');
  beltHighlight.addColorStop(0.42, 'rgba(255,255,255,0.14)');
  beltHighlight.addColorStop(0.55, 'rgba(8,32,48,0.24)');
  beltHighlight.addColorStop(1, 'rgba(8,32,48,0)');
  ctx.fillStyle = beltHighlight;
  ctx.fillRect(0, yBelt - 18, W, 36);

  // --- 2. WAVY MUSTARD-LIME OCHRE MID-BODY STRIPE ---
  const yStripeTop = yToPy(1.085, H);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, yStripeTop);
  ctx.lineTo(W, yStripeTop);
  const steps = 160;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const x = BODY_UV_BOUNDS.xMin + t * (BODY_UV_BOUNDS.xMax - BODY_UV_BOUNDS.xMin);
    const py = yToPy(stripeBottomY(x), H);
    ctx.lineTo(t * W, py);
  }
  ctx.closePath();

  const stripeGrad = ctx.createLinearGradient(0, yStripeTop, 0, yToPy(0.42, H));
  stripeGrad.addColorStop(0.0, '#E2D43C');
  stripeGrad.addColorStop(0.30, stripe);
  stripeGrad.addColorStop(0.72, '#C2B026');
  stripeGrad.addColorStop(1.0, '#A5951D');
  ctx.fillStyle = stripeGrad;
  ctx.fill();

  // Crisp subtle retro pinstripe along top and bottom edge of wave
  ctx.strokeStyle = 'rgba(12, 74, 102, 0.62)';
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // Subtle inner bright lime-yellow upper accent ribbon inside the stripe
  ctx.beginPath();
  ctx.moveTo(0, yStripeTop + 14);
  ctx.lineTo(W, yStripeTop + 14);
  ctx.lineTo(W, yStripeTop + 34);
  ctx.lineTo(0, yStripeTop + 34);
  ctx.closePath();
  ctx.fillStyle = 'rgba(246, 238, 110, 0.28)';
  ctx.fill();
  ctx.restore();

  // --- 3. RETRO SIDE GRAPHIC ("DESERT CRUISER") ---
  drawSideBannerGraphic(ctx, W, H, side === 'right', coral, stripe);

  // --- 4. TWO ORANGE-RED RETRO DESERT-FLOWER MEDALLIONS ---
  const frontFlowerX = xToPx(-1.79, W);
  const frontFlowerY = yToPy(0.75, H);
  drawRetroFlower(ctx, frontFlowerX, frontFlowerY, 80, coral, '#A8240E', '#ECE048');

  const rearFlowerX = xToPx(0.82, W);
  const rearFlowerY = yToPy(0.78, H);
  drawRetroFlower(ctx, rearFlowerX, rearFlowerY, 86, coral, '#A8240E', '#ECE048');

  // --- 5. PANEL SEAMS, DOOR SHUT LINES & VW T3 BODY CREASES ---
  // Also build matching bump canvas & roughness canvas simultaneously!
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, W, H);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = W;
  roughCanvas.height = H;
  const rCtx = roughCanvas.getContext('2d');
  // Base automotive clearcoated paint roughness ~0.27 (69/255)
  rCtx.fillStyle = 'rgb(70, 70, 70)';
  rCtx.fillRect(0, 0, W, H);

  const drawSeam = (pts, width = 3.5, alpha = 0.58) => {
    // Albedo dark crease
    ctx.save();
    ctx.strokeStyle = `rgba(10, 18, 26, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], idx) => {
      const px = xToPx(x, W);
      const py = yToPy(y, H);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Subtle specular bevel highlight beside seam
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.translate(2, 1);
    ctx.stroke();
    ctx.restore();

    // Bump recess
    bCtx.save();
    bCtx.strokeStyle = '#262626';
    bCtx.lineWidth = width + 1.5;
    bCtx.beginPath();
    pts.forEach(([x, y], idx) => {
      const px = xToPx(x, W);
      const py = yToPy(y, H);
      if (idx === 0) bCtx.moveTo(px, py);
      else bCtx.lineTo(px, py);
    });
    bCtx.stroke();
    bCtx.restore();

    // Roughness rise in seam
    rCtx.save();
    rCtx.strokeStyle = 'rgb(205, 205, 205)';
    rCtx.lineWidth = width + 3;
    rCtx.beginPath();
    pts.forEach(([x, y], idx) => {
      const px = xToPx(x, W);
      const py = yToPy(y, H);
      if (idx === 0) rCtx.moveTo(px, py);
      else rCtx.lineTo(px, py);
    });
    rCtx.stroke();
    rCtx.restore();
  };

  // Front cab door rear vertical seam (B-pillar down to rocker)
  drawSeam(
    [
      [-0.86, 1.83],
      [-0.86, 0.27],
    ],
    4.0,
    0.66
  );

  // Front door forward hinge seam
  drawSeam(
    [
      [-1.96, 1.15],
      [-2.04, 0.72],
      [-1.98, 0.36],
    ],
    3.2,
    0.55
  );

  // Mid-body vertical panel seam (and sliding door rear edge on passenger side)
  drawSeam(
    [
      [0.44, 1.83],
      [0.44, 0.27],
    ],
    side === 'right' ? 4.2 : 3.0,
    side === 'right' ? 0.68 : 0.45
  );

  // Rear corner vertical seam
  drawSeam(
    [
      [2.09, 1.82],
      [2.11, 0.28],
    ],
    3.2,
    0.48
  );

  // Horizontal VW T3 character beltline groove across entire flank
  drawSeam(
    [
      [-2.22, 1.085],
      [2.2, 1.085],
    ],
    3.0,
    0.42
  );

  // Lower character crease & sliding-door rail groove
  drawSeam(
    [
      [-0.86, 0.7],
      [2.1, 0.7],
    ],
    side === 'right' ? 5.2 : 2.6,
    side === 'right' ? 0.72 : 0.32
  );

  // Classic VW T3 rear engine-bay vertical cooling vents behind rear quarter window
  const ventX0 = 2.02;
  const ventX1 = 2.13;
  for (let i = 0; i < 8; i++) {
    const vy = 1.24 + i * 0.056;
    drawSeam(
      [
        [ventX0, vy],
        [ventX1, vy],
      ],
      4.5,
      0.72
    );
  }

  // Fuel filler cap recess on right front quarter (passenger side)
  if (side === 'right') {
    const fx = xToPx(-1.58, W);
    const fy = yToPy(0.84, H);
    ctx.strokeStyle = 'rgba(10, 18, 26, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(fx, fy, 26, 0, Math.PI * 2);
    ctx.stroke();
    bCtx.strokeStyle = '#303030';
    bCtx.lineWidth = 4;
    bCtx.beginPath();
    bCtx.arc(fx, fy, 26, 0, Math.PI * 2);
    bCtx.stroke();
  }

  // Subtle AO darkening around the wheel arch lips
  const drawArchAO = (wheelX) => {
    const wx = xToPx(wheelX, W);
    const wy = yToPy(0.34, H);
    const rOuter = (0.5 / (BODY_UV_BOUNDS.xMax - BODY_UV_BOUNDS.xMin)) * W;
    const rInner = (0.37 / (BODY_UV_BOUNDS.xMax - BODY_UV_BOUNDS.xMin)) * W;
    const grad = ctx.createRadialGradient(wx, wy, rInner, wx, wy, rOuter);
    grad.addColorStop(0, 'rgba(14, 10, 18, 0.58)');
    grad.addColorStop(0.55, 'rgba(20, 14, 22, 0.22)');
    grad.addColorStop(1, 'rgba(20, 14, 22, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(wx, wy, rOuter, Math.PI, Math.PI * 2);
    ctx.fill();
  };
  drawArchAO(-1.305);
  drawArchAO(1.155);

  // --- 6. LOWER ROCKER DESERT ROAD DUST & GRIME (ALBEDO + ROUGHNESS) ---
  const rand = mulberry32(side === 'left' ? 1984 : 2084);
  const yDustTop = yToPy(0.62, H);

  // Organic dusty Mojave rose-taupe silt wash rising from bottom rocker edge
  const dustGrad = ctx.createLinearGradient(0, yDustTop, 0, H);
  dustGrad.addColorStop(0.0, 'rgba(110, 78, 82, 0.0)');
  dustGrad.addColorStop(0.38, 'rgba(104, 72, 76, 0.18)');
  dustGrad.addColorStop(0.75, 'rgba(92, 64, 68, 0.44)');
  dustGrad.addColorStop(1.0, 'rgba(72, 50, 56, 0.68)');
  ctx.fillStyle = dustGrad;
  ctx.fillRect(0, yDustTop, W, H - yDustTop);

  // Matching matte roughness ramp in roughnessMap (0.27 -> 0.88 at dusty rocker)
  const rDustGrad = rCtx.createLinearGradient(0, yDustTop, 0, H);
  rDustGrad.addColorStop(0.0, 'rgba(220, 220, 220, 0.0)');
  rDustGrad.addColorStop(0.45, 'rgba(210, 210, 210, 0.45)');
  rDustGrad.addColorStop(1.0, 'rgba(240, 240, 240, 0.92)');
  rCtx.fillStyle = rDustGrad;
  rCtx.fillRect(0, yDustTop, W, H - yDustTop);

  // Extra wheel-splash dust kicks directly behind front (-1.305) & rear (+1.155) wheel wells
  const drawWheelSplash = (wheelX) => {
    const sx = xToPx(wheelX + 0.42, W);
    const sy = yToPy(0.32, H);
    const sg = ctx.createRadialGradient(sx, sy, 12, sx, sy, 165);
    sg.addColorStop(0.0, 'rgba(84, 58, 62, 0.42)');
    sg.addColorStop(0.55, 'rgba(96, 68, 70, 0.18)');
    sg.addColorStop(1.0, 'rgba(96, 68, 70, 0.0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, 165, 0, Math.PI * 2);
    ctx.fill();
  };
  drawWheelSplash(-1.305);
  drawWheelSplash(1.155);

  // Organic fine desert dust speckles concentrated along lower rocker & behind wheel wells
  for (let i = 0; i < 4200; i++) {
    const rx = rand() * W;
    // Bias heavily toward bottom 26% of panel
    const bias = Math.pow(rand(), 2.4);
    const ry = H - bias * (H - yDustTop) * 1.15;
    const rad = 0.8 + rand() * 3.8;
    const alpha = (1 - bias) * (0.04 + rand() * 0.12);
    ctx.fillStyle =
      rand() > 0.45 ? `rgba(138, 102, 92, ${alpha})` : `rgba(82, 58, 62, ${alpha})`;
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();

    rCtx.fillStyle = `rgba(230, 230, 230, ${alpha * 1.6})`;
    rCtx.beginPath();
    rCtx.arc(rx, ry, rad * 1.3, 0, Math.PI * 2);
    rCtx.fill();

    // Subtle micro-grit bump
    bCtx.fillStyle = `rgba(155, 155, 155, ${alpha * 0.7})`;
    bCtx.fillRect(rx, ry, rad, rad);
  }

  // Subtle metallic paint flake micro-roughness variation across whole body
  for (let i = 0; i < 1800; i++) {
    const rx = rand() * W;
    const ry = rand() * H;
    const v = 64 + Math.floor(rand() * 18);
    rCtx.fillStyle = `rgba(${v},${v},${v},0.18)`;
    rCtx.fillRect(rx, ry, 6, 6);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.anisotropy = 8;

  return { map, roughnessMap, bumpMap };
}

/**
 * Generates matching front nose & rear tailgate PBR textures so the turquoise
 * and mustard-ochre bands wrap seamlessly around the front and back of the van.
 */
export function createFrontRearLiveryMaps({ face = 'front', palette = {} } = {}) {
  const W = 1024;
  const H = 1024;
  const turquoise = '#1EA8DC';
  const stripe = '#D6C430';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const rCanvas = document.createElement('canvas');
  rCanvas.width = W;
  rCanvas.height = H;
  const rCtx = rCanvas.getContext('2d');
  rCtx.fillStyle = 'rgb(64, 64, 64)';
  rCtx.fillRect(0, 0, W, H);

  // Turquoise base
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, '#26BCEF');
  grad.addColorStop(0.4, turquoise);
  grad.addColorStop(0.8, '#1593C4');
  grad.addColorStop(1.0, '#0F739B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Mustard-lime wrap-around band!
  // On the front face (see van_crop4.png!), the band fills from just below
  // the windshield (y=1.16) down through the upper grille area (y=0.64) cleanly matching the sides!
  // On the rear face, it runs from beltline y=1.085 down to y=0.56.
  const yTopBand = face === 'front' ? yToPy(1.155, H) : yToPy(1.085, H);
  const yBotBand = face === 'front' ? yToPy(0.64, H) : yToPy(0.54, H);

  const sGrad = ctx.createLinearGradient(0, yTopBand, 0, yBotBand);
  sGrad.addColorStop(0, '#E2D43C');
  sGrad.addColorStop(0.5, stripe);
  sGrad.addColorStop(1, '#B3A120');
  ctx.fillStyle = sGrad;
  ctx.fillRect(0, yTopBand, W, yBotBand - yTopBand);

  // Crisp subtle band border lines
  ctx.fillStyle = 'rgba(16, 76, 102, 0.5)';
  ctx.fillRect(0, yTopBand - 2, W, 4);
  ctx.fillRect(0, yBotBand - 2, W, 4);

  // Subtle horizontal nose / tailgate body crease
  const yCrease = yToPy(1.085, H);
  ctx.fillStyle = 'rgba(10, 18, 28, 0.32)';
  ctx.fillRect(0, yCrease, W, 3);

  // Rear tailgate shut-line frame & crisp vintage "VANAGON" badge
  if (face === 'rear') {
    ctx.strokeStyle = 'rgba(10, 18, 28, 0.55)';
    ctx.lineWidth = 4;
    const xL = W * 0.12;
    const xR = W * 0.88;
    const yT = yToPy(1.78, H);
    const yB = yToPy(0.54, H);
    ctx.strokeRect(xL, yT, xR - xL, yB - yT);

    // Subtle crisp metallic silver "VANAGON" lettering on lower-left hatch
    ctx.save();
    ctx.font = '700 26px "Helvetica Neue", Arial, sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillStyle = 'rgba(10, 20, 28, 0.45)';
    ctx.fillText('VANAGON', xL + 36, yToPy(0.68, H) + 2);
    ctx.fillStyle = '#D8E2E8';
    ctx.fillText('VANAGON', xL + 34, yToPy(0.68, H));
    ctx.restore();
  }

  // Lower desert dust gradient matching the sides
  const yDustTop = yToPy(0.56, H);
  const dustGrad = ctx.createLinearGradient(0, yDustTop, 0, H);
  dustGrad.addColorStop(0.0, 'rgba(116, 82, 80, 0.0)');
  dustGrad.addColorStop(0.55, 'rgba(106, 74, 74, 0.22)');
  dustGrad.addColorStop(1.0, 'rgba(84, 58, 60, 0.55)');
  ctx.fillStyle = dustGrad;
  ctx.fillRect(0, yDustTop, W, H - yDustTop);

  const rDustGrad = rCtx.createLinearGradient(0, yDustTop, 0, H);
  rDustGrad.addColorStop(0.0, 'rgba(210, 210, 210, 0.0)');
  rDustGrad.addColorStop(1.0, 'rgba(225, 225, 225, 0.85)');
  rCtx.fillStyle = rDustGrad;
  rCtx.fillRect(0, yDustTop, W, H - yDustTop);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = 8;

  return { map, roughnessMap };
}

/**
 * Generates a crisp 1980s California sunset-plate license plate texture ("MOJAVE 84").
 */
export function createLicensePlateTexture(plateText = 'MOJAVE 84') {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Classic 1980s slightly dusty golden-sunset California plate background (calibrated so it won't bloom white!)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#CFC6B2');
  bg.addColorStop(0.55, '#C4B9A2');
  bg.addColorStop(1, '#B3A58C');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle retro sunset horizon arc behind "CALIFORNIA"
  const sunGrad = ctx.createLinearGradient(0, 12, 0, 88);
  sunGrad.addColorStop(0, '#F4A23A');
  sunGrad.addColorStop(1, '#E45B2A');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(W * 0.5, 84, 72, Math.PI, Math.PI * 2);
  ctx.fill();

  // Blue embossed perimeter rim
  ctx.strokeStyle = '#1D4480';
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // Header
  ctx.fillStyle = '#1B3E78';
  ctx.font = 'bold italic 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('California', W * 0.5, 52);

  // Registration stickers
  ctx.fillStyle = '#C93A2B';
  ctx.fillRect(34, 28, 52, 26);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText('OCT', 60, 42);

  ctx.fillStyle = '#E5B72E';
  ctx.fillRect(W - 86, 28, 52, 26);
  ctx.fillStyle = '#182438';
  ctx.fillText('84', W - 60, 42);

  // Main embossed plate characters
  ctx.font = '900 84px "Arial Narrow", "Impact", Arial, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillText(plateText, W * 0.5 + 3, 158);
  ctx.fillStyle = '#183C78';
  ctx.fillText(plateText, W * 0.5, 155);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates procedural tread bump + roughness maps for realistic rubber tires.
 */
export function createTireTreadMaps() {
  const W = 512;
  const H = 256;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bCtx = bumpCanvas.getContext('2d');

  // Dark rubber base
  bCtx.fillStyle = '#404040';
  bCtx.fillRect(0, 0, W, H);

  // Circumferential grooves & angled shoulder tread blocks
  const ribs = 48;
  const stepX = W / ribs;
  bCtx.fillStyle = '#C4C4C4';
  for (let i = 0; i < ribs; i++) {
    const x = i * stepX;
    // Outer shoulder lugs
    bCtx.fillRect(x + 2, 10, stepX * 0.68, 42);
    bCtx.fillRect(x + 2, H - 52, stepX * 0.68, 42);
    // Inner chevron tread blocks
    bCtx.fillRect(x + 3, 68, stepX * 0.64, 50);
    bCtx.fillRect(x + stepX * 0.35, 134, stepX * 0.64, 50);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 1);
  bumpMap.colorSpace = THREE.NoColorSpace;

  return { bumpMap };
}

/**
 * Generates a soft ambient-occlusion contact shadow texture for grounding
 * the chassis and all four rubber tires solidly onto the concrete apron.
 */
export function createContactShadowTexture() {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Deep grounded underbody shadow pool (dark core beneath chassis & bumpers, feathered softly outward)
  const bodyGrad = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.16, W * 0.5, H * 0.5, W * 0.48);
  bodyGrad.addColorStop(0.0, 'rgba(3, 2, 6, 0.94)');
  bodyGrad.addColorStop(0.45, 'rgba(5, 3, 10, 0.82)');
  bodyGrad.addColorStop(0.76, 'rgba(8, 5, 14, 0.42)');
  bodyGrad.addColorStop(1.0, 'rgba(10, 6, 16, 0.0)');
  ctx.save();
  ctx.scale(1.0, 0.58);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(W * 0.5, (H * 0.5) / 0.58, W * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Four extra-dark crisp tire contact patches (front x=-1.305, rear x=+1.155 on a 5.4m x 2.6m plane)
  const wheelXNorm = [0.5 + -1.305 / 5.4, 0.5 + 1.155 / 5.4];
  const wheelZNorm = [0.5 - 0.79 / 2.6, 0.5 + 0.79 / 2.6];

  for (const ux of wheelXNorm) {
    for (const uz of wheelZNorm) {
      const cx = ux * W;
      const cy = uz * H;
      const wg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 48);
      wg.addColorStop(0, 'rgba(0, 0, 2, 0.98)');
      wg.addColorStop(0.48, 'rgba(3, 2, 6, 0.78)');
      wg.addColorStop(1, 'rgba(4, 2, 8, 0.0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 48, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a soft warm elliptical headlight ground-spill decal texture
 * for subtle twilight gravel/apron illumination ahead of the front bumper.
 */
export function createHeadlightGlowTexture() {
  const W = 256;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const grad = ctx.createRadialGradient(W * 0.85, H * 0.5, 4, W * 0.46, H * 0.5, W * 0.52);
  grad.addColorStop(0.0, 'rgba(255, 244, 204, 0.85)');
  grad.addColorStop(0.28, 'rgba(255, 224, 158, 0.44)');
  grad.addColorStop(0.65, 'rgba(255, 198, 128, 0.14)');
  grad.addColorStop(1.0, 'rgba(255, 180, 110, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
