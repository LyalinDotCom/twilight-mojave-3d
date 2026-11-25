import * as THREE from 'three';
import {
  BODY_UV_BOUNDS,
  createContactShadowTexture,
  createFrontRearLiveryMaps,
  createLicensePlateTexture,
  createSideLiveryMaps,
  createTireTreadMaps,
} from './liveryTexture.js';

// ============================================================================
// VW T3 Vanagon Parametric Profile Curves (1 unit = 1 meter)
// Local Space: Front = -X (facing LEFT), Rear = +X, Up = +Y, Driver/Cam Side = +Z
// Dimensions: 4.57m L x 1.85m W x 1.96m H, Wheelbase = 2.46m, Tire R = 0.34m
// ============================================================================

const FRONT_AXLE_X = -1.305;
const REAR_AXLE_X = 1.155; // wheelbase = 2.46m exact
const WHEEL_Y = 0.34;
const ARCH_RADIUS = 0.412;
const CORNER_R = 0.075; // smooth vertical corner bevel radius

function samplePiecewise(val, pts) {
  if (val <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (val <= x1) {
      const t = (val - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return pts[pts.length - 1][1];
}

// Authentic VW T3 cross-section half-width(y): tucked rocker, lower character
// crease at y=0.70, max beltline width 0.925m at y=1.04, swage groove at 1.085,
// graceful greenhouse tumblehome tapering to 0.788m at rain-gutter rail y=1.84.
const HALF_WIDTH_PROFILE = [
  [0.27, 0.842],
  [0.36, 0.892],
  [0.50, 0.918],
  [0.675, 0.925],
  [0.70, 0.916],
  [0.73, 0.923],
  [1.045, 0.925],
  [1.085, 0.910],
  [1.14, 0.902],
  [1.46, 0.858],
  [1.76, 0.815],
  [1.84, 0.788],
];

// Longitudinal front nose profile frontX(y) (facing -X):
// Smoothly sampled across the hood curve (0.98..1.24) so reflections glide cleanly!
const FRONT_X_PROFILE = [
  [0.27, -2.140],
  [0.43, -2.212],
  [0.98, -2.220],
  [1.03, -2.214],
  [1.085, -2.195],
  [1.135, -2.162],
  [1.185, -2.120],
  [1.24, -2.075],
  [1.77, -1.785],
  [1.81, -1.756],
  [1.84, -1.720],
];

// Longitudinal rear tailgate profile rearX(y) (+X):
const REAR_X_PROFILE = [
  [0.27, 2.150],
  [0.45, 2.210],
  [1.12, 2.210],
  [1.77, 2.145],
  [1.84, 2.095],
];

function halfWidth(y) {
  return samplePiecewise(y, HALF_WIDTH_PROFILE);
}

function frontX(y) {
  return samplePiecewise(y, FRONT_X_PROFILE);
}

function rearX(y) {
  return samplePiecewise(y, REAR_X_PROFILE);
}

// ============================================================================
// Geometry Utilities: 2D-Plane Subdivision -> 3D Curved Automotive Skin
// ============================================================================

/**
 * Computes silky-smooth averaged vertex normals across non-indexed BufferGeometry
 * by welding co-located vertices whose face normals lie within `creaseAngleDeg`.
 * Eliminates flat quad/triangle faceting on curved automotive sheetmetal while
 * keeping sharp intentional creases crisp!
 */
function computeSmoothCreaseNormals(geom, creaseAngleDeg = 52) {
  const pos = geom.getAttribute('position');
  const count = pos.count;
  const faceNormals = new Float32Array(count * 3);
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();

  // Map quantized spatial key -> list of vertex indices at that 3D position
  const buckets = new Map();
  const quant = 2000; // 0.5mm spatial tolerance

  for (let i = 0; i < count; i += 3) {
    vA.fromBufferAttribute(pos, i);
    vB.fromBufferAttribute(pos, i + 1);
    vC.fromBufferAttribute(pos, i + 2);
    e1.subVectors(vB, vA);
    e2.subVectors(vC, vA);
    fn.crossVectors(e1, e2); // area-weighted face normal!
    const len = fn.length();
    if (len > 1e-10) fn.divideScalar(len);

    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      faceNormals[vi * 3] = fn.x;
      faceNormals[vi * 3 + 1] = fn.y;
      faceNormals[vi * 3 + 2] = fn.z;

      const kx = Math.round(pos.getX(vi) * quant);
      const ky = Math.round(pos.getY(vi) * quant);
      const kz = Math.round(pos.getZ(vi) * quant);
      const key = `${kx},${ky},${kz}`;
      let list = buckets.get(key);
      if (!list) {
        list = [];
        buckets.set(key, list);
      }
      list.push(vi);
    }
  }

  const cosThresh = Math.cos((creaseAngleDeg * Math.PI) / 180);
  const normals = new Float32Array(count * 3);

  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) {
      const ia = list[a];
      const nax = faceNormals[ia * 3];
      const nay = faceNormals[ia * 3 + 1];
      const naz = faceNormals[ia * 3 + 2];

      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (let b = 0; b < list.length; b++) {
        const ib = list[b];
        const nbx = faceNormals[ib * 3];
        const nby = faceNormals[ib * 3 + 1];
        const nbz = faceNormals[ib * 3 + 2];
        if (nax * nbx + nay * nby + naz * nbz >= cosThresh) {
          sx += nbx;
          sy += nby;
          sz += nbz;
        }
      }
      const slen = Math.hypot(sx, sy, sz) || 1;
      normals[ia * 3] = sx / slen;
      normals[ia * 3 + 1] = sy / slen;
      normals[ia * 3 + 2] = sz / slen;
    }
  }

  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}

/**
 * Splits a list of 2D triangles (flat array [x0,y0, x1,y1, x2,y2, ...]) along a
 * horizontal line y = yCut so subsequent 3D Z(y) displacement conforms cleanly
 * to automotive beltline creases & tumblehome curvature without faceting.
 */
function splitTris2DByY(tris, yCut) {
  const out = [];
  const eps = 1e-5;
  for (let i = 0; i < tris.length; i += 6) {
    const p = [
      [tris[i], tris[i + 1]],
      [tris[i + 2], tris[i + 3]],
      [tris[i + 4], tris[i + 5]],
    ];
    const d = [p[0][1] - yCut, p[1][1] - yCut, p[2][1] - yCut];
    const above = [];
    const below = [];
    for (let k = 0; k < 3; k++) {
      if (d[k] >= -eps) above.push(k);
      if (d[k] <= eps) below.push(k);
    }
    if (above.length === 3 || below.length === 3) {
      out.push(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);
      continue;
    }

    // Find the lone vertex on one side and the two vertices on the opposite side
    // Preserve CCW winding order of (p[0], p[1], p[2])
    const pos = [d[0] > 0, d[1] > 0, d[2] > 0];
    let lone = 0;
    if (pos[0] !== pos[1] && pos[0] !== pos[2]) lone = 0;
    else if (pos[1] !== pos[0] && pos[1] !== pos[2]) lone = 1;
    else lone = 2;

    const i0 = lone;
    const i1 = (lone + 1) % 3;
    const i2 = (lone + 2) % 3;
    const v0 = p[i0];
    const v1 = p[i1];
    const v2 = p[i2];

    const t1 = (yCut - v0[1]) / (v1[1] - v0[1]);
    const t2 = (yCut - v0[1]) / (v2[1] - v0[1]);
    const m1 = [v0[0] + (v1[0] - v0[0]) * t1, yCut];
    const m2 = [v0[0] + (v2[0] - v0[0]) * t2, yCut];

    // Emit 3 triangles with identical winding to (v0, v1, v2)
    out.push(v0[0], v0[1], m1[0], m1[1], m2[0], m2[1]);
    out.push(m1[0], m1[1], v1[0], v1[1], v2[0], v2[1]);
    out.push(m1[0], m1[1], v2[0], v2[1], m2[0], m2[1]);
  }
  return out;
}

/**
 * Adds a rounded rectangle hole to a THREE.Shape in the (x, y) plane.
 */
function createRoundedWindowHole(x0, y0, x1, y1, r = 0.05) {
  const hole = new THREE.Path();
  hole.moveTo(x0 + r, y0);
  hole.lineTo(x1 - r, y0);
  hole.quadraticCurveTo(x1, y0, x1, y0 + r);
  hole.lineTo(x1, y1 - r);
  hole.quadraticCurveTo(x1, y1, x1 - r, y1);
  hole.lineTo(x0 + r, y1);
  hole.quadraticCurveTo(x0, y1, x0, y1 - r);
  hole.lineTo(x0, y0 + r);
  hole.quadraticCurveTo(x0, y0, x0 + r, y0);
  return hole;
}

/**
 * Creates a sloped front cab door window hole matching the VW T3 A-pillar rake.
 */
function createFrontDoorWindowHole() {
  const y0 = 1.155;
  const y1 = 1.735;
  const xBack = -0.92;
  const xFrontBot = frontX(y0) + 0.165; // ~ -1.97
  const xFrontTop = frontX(y1) + 0.165; // ~ -1.64
  const r = 0.045;

  const hole = new THREE.Path();
  hole.moveTo(xFrontBot + r, y0);
  hole.lineTo(xBack - r, y0);
  hole.quadraticCurveTo(xBack, y0, xBack, y0 + r);
  hole.lineTo(xBack, y1 - r);
  hole.quadraticCurveTo(xBack, y1, xBack - r, y1);
  hole.lineTo(xFrontTop + r, y1);
  hole.quadraticCurveTo(xFrontTop, y1, xFrontTop - 0.02, y1 - r);
  hole.lineTo(xFrontBot + 0.015, y0 + r);
  hole.quadraticCurveTo(xFrontBot, y0, xFrontBot + r, y0);
  return hole;
}

/**
 * Builds one contoured curved VW T3 side panel (+Z left or -Z right)
 * with real semicircular wheel-arch cutouts and real recessed window apertures.
 */
function buildContouredSidePanel(sideSign) {
  const shape = new THREE.Shape();

  // Start at bottom-front corner (y=0.27, x=frontX(0.27)+CORNER_R)
  const yBot = 0.27;
  const yTop = 1.84;

  shape.moveTo(frontX(yBot) + CORNER_R, yBot);

  // Bottom rocker edge with crisp semicircular front & rear wheel-arch cutouts
  const frontArchStartX = FRONT_AXLE_X - Math.sqrt(ARCH_RADIUS * ARCH_RADIUS - (WHEEL_Y - yBot) ** 2);
  const frontArchEndX = FRONT_AXLE_X + Math.sqrt(ARCH_RADIUS * ARCH_RADIUS - (WHEEL_Y - yBot) ** 2);
  const rearArchStartX = REAR_AXLE_X - Math.sqrt(ARCH_RADIUS * ARCH_RADIUS - (WHEEL_Y - yBot) ** 2);
  const rearArchEndX = REAR_AXLE_X + Math.sqrt(ARCH_RADIUS * ARCH_RADIUS - (WHEEL_Y - yBot) ** 2);

  shape.lineTo(frontArchStartX, yBot);
  const archAngleStart = Math.atan2(yBot - WHEEL_Y, frontArchStartX - FRONT_AXLE_X);
  const archAngleEnd = Math.atan2(yBot - WHEEL_Y, frontArchEndX - FRONT_AXLE_X);
  // Arc clockwise over the top of the front wheel
  shape.absarc(FRONT_AXLE_X, WHEEL_Y, ARCH_RADIUS, archAngleStart, archAngleEnd, true);

  shape.lineTo(rearArchStartX, yBot);
  shape.absarc(REAR_AXLE_X, WHEEL_Y, ARCH_RADIUS, archAngleStart, archAngleEnd, true);

  shape.lineTo(rearX(yBot) - CORNER_R, yBot);

  // Rear edge up to roof rail following rearX(y)
  for (let i = 1; i < REAR_X_PROFILE.length; i++) {
    const [py, rx] = REAR_X_PROFILE[i];
    shape.lineTo(rx - CORNER_R, py);
  }

  // Top roof rain-gutter edge from rear to front
  shape.lineTo(frontX(yTop) + CORNER_R, yTop);

  // Front edge down following frontX(y)
  for (let i = FRONT_X_PROFILE.length - 2; i >= 0; i--) {
    const [py, fx] = FRONT_X_PROFILE[i];
    shape.lineTo(fx + CORNER_R, py);
  }
  shape.closePath();

  // Real window openings: front cab door window + rear quarter window
  // (middle panel stays solid painted metal for the iconic DESERT CRUISER graphic!)
  shape.holes.push(createFrontDoorWindowHole());
  shape.holes.push(createRoundedWindowHole(1.26, 1.165, 1.98, 1.735, 0.048));

  const flatGeom = new THREE.ShapeGeometry(shape, 16);
  const idx = flatGeom.getIndex();
  const posAttr = flatGeom.getAttribute('position');

  let tris = [];
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      tris.push(
        posAttr.getX(a),
        posAttr.getY(a),
        posAttr.getX(b),
        posAttr.getY(b),
        posAttr.getX(c),
        posAttr.getY(c)
      );
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      tris.push(
        posAttr.getX(i),
        posAttr.getY(i),
        posAttr.getX(i + 1),
        posAttr.getY(i + 1),
        posAttr.getX(i + 2),
        posAttr.getY(i + 2)
      );
    }
  }
  flatGeom.dispose();

  // Subdivide along exact profile Y-levels for smooth automotive contours
  const yCuts = [0.36, 0.50, 0.675, 0.70, 0.73, 0.88, 1.045, 1.085, 1.14, 1.30, 1.46, 1.62, 1.76];
  for (const yc of yCuts) {
    tris = splitTris2DByY(tris, yc);
  }

  // Lift 2D triangles onto the curved 3D side surface z = sideSign * halfWidth(y)
  const vertCount = tris.length / 2;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  const xRange = BODY_UV_BOUNDS.xMax - BODY_UV_BOUNDS.xMin;
  const yRange = BODY_UV_BOUNDS.yMax - BODY_UV_BOUNDS.yMin;

  for (let t = 0; t < vertCount; t += 3) {
    // Flip winding for -Z side so normals point strictly outward (-Z)
    const order = sideSign > 0 ? [0, 1, 2] : [0, 2, 1];
    for (let k = 0; k < 3; k++) {
      const srcIdx = (t + order[k]) * 2;
      const dstIdx = t + k;
      const x = tris[srcIdx];
      const y = tris[srcIdx + 1];
      const z = sideSign * halfWidth(y);

      positions[dstIdx * 3] = x;
      positions[dstIdx * 3 + 1] = y;
      positions[dstIdx * 3 + 2] = z;

      uvs[dstIdx * 2] = (x - BODY_UV_BOUNDS.xMin) / xRange;
      uvs[dstIdx * 2 + 1] = (y - BODY_UV_BOUNDS.yMin) / yRange;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  computeSmoothCreaseNormals(geom, 54);
  return geom;
}

/**
 * Evaluates a point on the wrapped front (-X) or rear (+X) contoured face
 * for normalized horizontal parameter s in [-1, 1] and height y.
 * Matches the side panels seamlessly at s = ±1 (z = ±halfWidth(y), x = edgeX ± CORNER_R)!
 */
function evalEndFacePoint(isFront, s, y) {
  const hw = halfWidth(y);
  const baseX = isFront ? frontX(y) : rearX(y);
  const flatZ = hw - CORNER_R;
  const bow = 0.032; // subtle automotive nose/tail crown curvature across center

  // Map s in [-1, 1] -> corner bevels on |s| > 0.80, gentle curved flat across |s| <= 0.80
  const sign = s < 0 ? -1 : 1;
  const absS = Math.abs(s);
  let z, xOffset;

  if (absS <= 0.80) {
    const u = absS / 0.80; // 0..1 across front face
    z = sign * u * flatZ;
    // Gentle cosine crown bow peaking at centerline z=0
    xOffset = -bow * Math.cos(u * Math.PI * 0.5);
  } else {
    // Quarter-ellipse wrap from (x=baseX, z=flatZ) cleanly to (x=baseX+CORNER_R, z=hw)
    const ang = ((absS - 0.80) / 0.20) * (Math.PI * 0.5); // 0..pi/2
    z = sign * (flatZ + Math.sin(ang) * CORNER_R);
    xOffset = (1 - Math.cos(ang)) * CORNER_R;
  }

  const x = isFront ? baseX + xOffset : baseX - xOffset;
  return [x, y, z];
}

/**
 * Builds the contoured front nose or rear tailgate skin with a real open window
 * aperture (windshield on front, rear hatch window on rear) so the 3D cabin interior
 * is clearly visible behind physical reflective glass!
 */
function buildContouredEndFace(isFront) {
  const yLevels = [
    0.27, 0.36, 0.44, 0.56, 0.675, 0.70, 0.73, 0.86, 0.98, 1.03,
    1.085, 1.135, 1.185, 1.24, 1.40, 1.58, 1.74, 1.77, 1.81, 1.84,
  ];
  // Window opening bounds in (s, y) space
  const winYMin = isFront ? 1.24 : 1.185;
  const winYMax = isFront ? 1.77 : 1.74;
  const winSMax = isFront ? 0.67 : 0.63;

  // High-resolution s samples across curved front nose bow & corner bevels for silky clearcoat reflections!
  const sLevels = [
    -1.0, -0.96, -0.92, -0.88, -0.84, -0.80, -0.73,
    -winSMax, -0.56, -0.45, -0.34, -0.22, -0.11, 0.0, 0.11, 0.22, 0.34, 0.45, 0.56, winSMax,
    0.73, 0.80, 0.84, 0.88, 0.92, 0.96, 1.0,
  ];

  const positions = [];
  const uvs = [];
  const yRange = BODY_UV_BOUNDS.yMax - BODY_UV_BOUNDS.yMin;

  for (let iy = 0; iy < yLevels.length - 1; iy++) {
    const y0 = yLevels[iy];
    const y1 = yLevels[iy + 1];
    const yMid = 0.5 * (y0 + y1);

    for (let is = 0; is < sLevels.length - 1; is++) {
      const s0 = sLevels[is];
      const s1 = sLevels[is + 1];
      const sMid = 0.5 * (s0 + s1);

      // Skip quads inside the windshield / rear-window opening!
      if (yMid > winYMin && yMid < winYMax && Math.abs(sMid) < winSMax) {
        continue;
      }

      const p00 = evalEndFacePoint(isFront, s0, y0);
      const p10 = evalEndFacePoint(isFront, s1, y0);
      const p11 = evalEndFacePoint(isFront, s1, y1);
      const p01 = evalEndFacePoint(isFront, s0, y1);

      const u0 = (s0 + 1) * 0.5;
      const u1 = (s1 + 1) * 0.5;
      const v0 = (y0 - BODY_UV_BOUNDS.yMin) / yRange;
      const v1 = (y1 - BODY_UV_BOUNDS.yMin) / yRange;

      // Ensure outward normals: front faces -X, rear faces +X
      if (isFront) {
        // s increases from -Z to +Z; (s+ -> y+) cross product points -X!
        positions.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      } else {
        // Rear faces +X -> flip winding
        positions.push(...p00, ...p11, ...p10, ...p00, ...p01, ...p11);
        uvs.push(u0, v0, u1, v1, u1, v0, u0, v0, u0, v1, u1, v1);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  computeSmoothCreaseNormals(geom, 54);
  return geom;
}

/**
 * Builds the gracefully crowned VW T3 roof shell (`y = 1.84` at rain-gutter
 * rails arching up to `y = 1.96` at centerline), seamlessly joined to the front,
 * rear, and side skins!
 */
function buildCrownedRoof() {
  const yRail = 1.84;
  const hwRail = halfWidth(yRail);
  const nx = 36;
  const nz = 24;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let ix = 0; ix <= nx; ix++) {
    const u = ix / nx; // 0 (front) -> 1 (rear)
    for (let iz = 0; iz <= nz; iz++) {
      const v = iz / nz; // 0 (-Z) -> 1 (+Z)
      const s = v * 2 - 1; // -1..+1

      // Evaluate exact front and rear boundary points at y = yRail for this s
      const pFront = evalEndFacePoint(true, s, yRail);
      const pRear = evalEndFacePoint(false, s, yRail);

      const x = pFront[0] + (pRear[0] - pFront[0]) * u;
      const z = s * hwRail;

      // Smooth compound roof crown: rises 12cm at center, feathers smoothly to 0
      // along front brow, rear header, and side rain-gutter rails!
      const lateralArch = Math.pow(Math.max(0, 1 - s * s), 0.72);
      const lonFrontEase = Math.min(1, u / 0.14);
      const lonRearEase = Math.min(1, (1 - u) / 0.12);
      const lonArch = Math.sin(lonFrontEase * Math.PI * 0.5) * Math.sin(lonRearEase * Math.PI * 0.5);

      // Subtle classic VW T3 longitudinal stamped roof ribs
      const rib =
        u > 0.16 && u < 0.86 && Math.abs(s) < 0.62
          ? Math.pow(Math.max(0, Math.cos(s * Math.PI * 5)), 6) * 0.006
          : 0;

      const y = yRail + 0.12 * lateralArch * lonArch + rib;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const a = ix * (nz + 1) + iz;
      const b = (ix + 1) * (nz + 1) + iz;
      const c = (ix + 1) * (nz + 1) + (iz + 1);
      const d = ix * (nz + 1) + (iz + 1);
      // Outward normal (+Y): x increases (+X), z increases (+Z); (d-a) x (b-a) = (+Z) x (+X) = +Y!
      indices.push(a, d, c, a, c, b);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a smooth curved glass pane matching the front windshield or rear window.
 */
function buildCurvedEndGlass(isFront, inset = 0.022) {
  const yMin = isFront ? 1.245 : 1.19;
  const yMax = isFront ? 1.765 : 1.735;
  const sMax = isFront ? 0.665 : 0.625;
  const ny = 6;
  const ns = 12;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= ny; iy++) {
    const ty = iy / ny;
    const y = yMin + (yMax - yMin) * ty;
    for (let is = 0; is <= ns; is++) {
      const ts = is / ns;
      const s = -sMax + 2 * sMax * ts;
      const [px, py, pz] = evalEndFacePoint(isFront, s, y);
      const x = isFront ? px + inset : px - inset;
      positions.push(x, py, pz);
      uvs.push(ts, ty);
    }
  }

  for (let iy = 0; iy < ny; iy++) {
    for (let is = 0; is < ns; is++) {
      const a = iy * (ns + 1) + is;
      const b = iy * (ns + 1) + (is + 1);
      const c = (iy + 1) * (ns + 1) + (is + 1);
      const d = (iy + 1) * (ns + 1) + is;
      if (isFront) indices.push(a, b, c, a, c, d);
      else indices.push(a, c, b, a, d, c);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds a dark matte rubber gasket frame around the front windshield or rear window.
 */
function buildEndWindowGasket(isFront, material) {
  const group = new THREE.Group();
  const yMin = isFront ? 1.235 : 1.18;
  const yMax = isFront ? 1.775 : 1.745;
  const sMax = isFront ? 0.675 : 0.635;
  const inset = 0.012;

  // Trace closed 3D curve right around the recessed opening perimeter
  const pts = [];
  const nH = 10;
  const nV = 6;
  // Bottom edge (-s -> +s)
  for (let i = 0; i <= nH; i++) {
    const s = -sMax + (2 * sMax * i) / nH;
    const [x, y, z] = evalEndFacePoint(isFront, s, yMin);
    pts.push(new THREE.Vector3(isFront ? x + inset : x - inset, y, z));
  }
  // Right edge (yMin -> yMax)
  for (let i = 1; i <= nV; i++) {
    const y = yMin + ((yMax - yMin) * i) / nV;
    const [x, py, z] = evalEndFacePoint(isFront, sMax, y);
    pts.push(new THREE.Vector3(isFront ? x + inset : x - inset, py, z));
  }
  // Top edge (+s -> -s)
  for (let i = 1; i <= nH; i++) {
    const s = sMax - (2 * sMax * i) / nH;
    const [x, y, z] = evalEndFacePoint(isFront, s, yMax);
    pts.push(new THREE.Vector3(isFront ? x + inset : x - inset, y, z));
  }
  // Left edge (yMax -> yMin)
  for (let i = 1; i < nV; i++) {
    const y = yMax - ((yMax - yMin) * i) / nV;
    const [x, py, z] = evalEndFacePoint(isFront, -sMax, y);
    pts.push(new THREE.Vector3(isFront ? x + inset : x - inset, py, z));
  }

  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.12);
  const tubeGeom = new THREE.TubeGeometry(curve, 64, 0.022, 8, true);
  const mesh = new THREE.Mesh(tubeGeom, material);
  group.add(mesh);
  return group;
}

/**
 * Builds a recessed side window glass pane + black rubber gasket + optional front
 * vent-window divider bar on sideSign (+1 left / -1 right).
 */
function buildSideWindowAssembly(sideSign, isFrontDoor, glassMat, rubberMat) {
  const group = new THREE.Group();
  const inset = 0.024;

  // Build contoured side glass pane following halfWidth(y)
  const y0 = isFrontDoor ? 1.155 : 1.165;
  const y1 = 1.735;
  const ny = 6;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= ny; iy++) {
    const ty = iy / ny;
    const y = y0 + (y1 - y0) * ty;
    const xL = isFrontDoor ? frontX(y) + 0.165 : 1.26;
    const xR = isFrontDoor ? -0.92 : 1.98;
    const z = sideSign * (halfWidth(y) - inset);

    positions.push(xL, y, z, xR, y, z);
    uvs.push(0, ty, 1, ty);
  }

  for (let iy = 0; iy < ny; iy++) {
    const a = iy * 2;
    const b = iy * 2 + 1;
    const c = (iy + 1) * 2 + 1;
    const d = (iy + 1) * 2;
    if (sideSign > 0) indices.push(a, b, c, a, c, d);
    else indices.push(a, c, b, a, d, c);
  }

  const glassGeom = new THREE.BufferGeometry();
  glassGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  glassGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  glassGeom.setIndex(indices);
  glassGeom.computeVertexNormals();

  const glassMesh = new THREE.Mesh(glassGeom, glassMat);
  glassMesh.renderOrder = 2;
  group.add(glassMesh);

  // Rubber perimeter gasket following the aperture edge
  const gInset = 0.011;
  const gPts = [];
  const xBotL = isFrontDoor ? frontX(y0) + 0.165 : 1.26;
  const xTopL = isFrontDoor ? frontX(y1) + 0.165 : 1.26;
  const xR = isFrontDoor ? -0.92 : 1.98;
  const zBot = sideSign * (halfWidth(y0) - gInset);
  const zMid = sideSign * (halfWidth(0.5 * (y0 + y1)) - gInset);
  const zTop = sideSign * (halfWidth(y1) - gInset);

  gPts.push(
    new THREE.Vector3(xBotL + 0.03, y0, zBot),
    new THREE.Vector3(xR - 0.03, y0, zBot),
    new THREE.Vector3(xR, 0.5 * (y0 + y1), zMid),
    new THREE.Vector3(xR - 0.03, y1, zTop),
    new THREE.Vector3(xTopL + 0.03, y1, zTop),
    new THREE.Vector3(0.5 * (xBotL + xTopL), 0.5 * (y0 + y1), zMid)
  );
  const gCurve = new THREE.CatmullRomCurve3(gPts, true, 'catmullrom', 0.12);
  const gasketMesh = new THREE.Mesh(new THREE.TubeGeometry(gCurve, 48, 0.02, 7, true), rubberMat);
  group.add(gasketMesh);

  // Classic VW T3 front door triangular quarter-vent vertical divider mullion!
  if (isFrontDoor) {
    const xVent = -1.60;
    const vPts = [
      new THREE.Vector3(xVent, y0 + 0.01, sideSign * (halfWidth(y0) - 0.018)),
      new THREE.Vector3(xVent, 0.5 * (y0 + y1), sideSign * (halfWidth(0.5 * (y0 + y1)) - 0.018)),
      new THREE.Vector3(xVent, y1 - 0.01, sideSign * (halfWidth(y1) - 0.018)),
    ];
    const vCurve = new THREE.CatmullRomCurve3(vPts);
    const ventBar = new THREE.Mesh(new THREE.TubeGeometry(vCurve, 8, 0.013, 6, false), rubberMat);
    group.add(ventBar);
  }

  return group;
}

/**
 * Builds one museum-grade VW T3 wheel assembly:
 * - Rounded LatheGeometry tire with highway tread bump & matte rubber sidewalls
 * - Recessed silver-white painted steel wheel rim with lug/vent ring
 * - Gleaming domed chrome VW dog-dish hubcap
 * - Dark steel inner brake drum backing
 */
function buildVWWheel({ radius, width, tireMat, rimMat, chromeMat, darkSteelMat }) {
  const wheel = new THREE.Group();
  const halfW = width * 0.5;
  const rimR = radius * 0.59; // Classic 14" rim inside chunky 185R14C sidewall!

  // 1. Rounded cross-section tire profile revolved around Y, then rotated so axle = Z
  const profile = [
    new THREE.Vector2(rimR - 0.005, -halfW * 0.80),
    new THREE.Vector2(rimR + 0.035, -halfW * 0.98),
    new THREE.Vector2(radius - 0.055, -halfW * 1.03), // subtle sidewall bulge
    new THREE.Vector2(radius - 0.015, -halfW * 0.92), // tire shoulder curve
    new THREE.Vector2(radius, -halfW * 0.72),         // flat tread crown
    new THREE.Vector2(radius, halfW * 0.72),
    new THREE.Vector2(radius - 0.015, halfW * 0.92),
    new THREE.Vector2(radius - 0.055, halfW * 1.03),
    new THREE.Vector2(rimR + 0.035, halfW * 0.98),
    new THREE.Vector2(rimR - 0.005, halfW * 0.80),
  ];
  const tireGeom = new THREE.LatheGeometry(profile, 36);
  tireGeom.rotateX(Math.PI * 0.5); // axle now aligns along Z!
  const tireMesh = new THREE.Mesh(tireGeom, tireMat);
  tireMesh.castShadow = true;
  tireMesh.receiveShadow = true;
  wheel.add(tireMesh);

  // 2. Deep recessed steel rim (painted bright silver/off-white matching van_crop4.png!)
  const rimProfile = [
    new THREE.Vector2(0.01, -halfW * 0.48),
    new THREE.Vector2(rimR - 0.01, -halfW * 0.50),
    new THREE.Vector2(rimR, -halfW * 0.80),
    new THREE.Vector2(rimR + 0.006, halfW * 0.82), // bright outer steel lip!
    new THREE.Vector2(rimR - 0.015, halfW * 0.84),
    new THREE.Vector2(rimR - 0.025, halfW * 0.50), // deep steel dish recess
    new THREE.Vector2(rimR * 0.68, halfW * 0.36),
    new THREE.Vector2(0.01, halfW * 0.38),
  ];
  const rimGeom = new THREE.LatheGeometry(rimProfile, 32);
  rimGeom.rotateX(Math.PI * 0.5);
  const rimMesh = new THREE.Mesh(rimGeom, rimMat);
  rimMesh.castShadow = true;
  wheel.add(rimMesh);

  // Dark cooling vent slots around steel wheel face
  const slotGeom = new THREE.BoxGeometry(0.024, 0.012, 0.015);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const slot = new THREE.Mesh(slotGeom, darkSteelMat);
    const sr = rimR * 0.81;
    slot.position.set(Math.cos(ang) * sr, Math.sin(ang) * sr, halfW * 0.44);
    slot.rotation.z = ang + Math.PI * 0.5;
    wheel.add(slot);
  }

  // 3. Gleaming domed chrome VW dog-dish hubcap!
  const capR = rimR * 0.65;
  const capProfile = [
    new THREE.Vector2(0.0001, halfW * 0.82), // smooth dome peak
    new THREE.Vector2(capR * 0.35, halfW * 0.80),
    new THREE.Vector2(capR * 0.68, halfW * 0.72),
    new THREE.Vector2(capR * 0.90, halfW * 0.58),
    new THREE.Vector2(capR, halfW * 0.40),
    new THREE.Vector2(capR * 0.96, halfW * 0.36),
  ];
  const capGeom = new THREE.LatheGeometry(capProfile, 28);
  capGeom.rotateX(Math.PI * 0.5);
  const capMesh = new THREE.Mesh(capGeom, chromeMat);
  wheel.add(capMesh);

  // Subtle dark chrome chamfer groove around outer base of chrome cap
  const capRingMat = new THREE.MeshStandardMaterial({
    color: '#343B44',
    metalness: 0.72,
    roughness: 0.34,
  });
  const capRing = new THREE.Mesh(
    new THREE.TorusGeometry(capR * 0.96, 0.0032, 8, 28),
    capRingMat
  );
  capRing.position.z = halfW * 0.43;
  wheel.add(capRing);

  // 4. Inner brake drum backing so wheel is opaque from underneath
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(rimR * 0.78, rimR * 0.78, width * 0.45, 20),
    darkSteelMat
  );
  drum.rotation.x = Math.PI * 0.5;
  drum.position.z = -halfW * 0.25;
  wheel.add(drum);

  return wheel;
}

/**
 * Builds the real 3D interior cabin (seats, dashboard, steering wheel, warm gauge
 * glow, rear camper bench & cabinet) visible through the tinted reflective glass!
 */
function buildInteriorCabin({ darkTrimMat, seatMat, woodMat, chromeMat }) {
  const cabin = new THREE.Group();

  // Dark enclosed interior tub so no bright sky leaks through window apertures
  const floor = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.05, 1.56), darkTrimMat);
  floor.position.set(0.05, 0.48, 0);
  cabin.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.04, 1.44), darkTrimMat);
  ceiling.position.set(0.18, 1.81, 0);
  cabin.add(ceiling);

  // Side inner walls along the solid mid-section (between front & rear windows)
  const midWallGeom = new THREE.BoxGeometry(2.15, 1.28, 0.04);
  for (const s of [-1, 1]) {
    const mw = new THREE.Mesh(midWallGeom, darkTrimMat);
    mw.position.set(0.18, 1.15, s * 0.79);
    cabin.add(mw);

    // Lower door cards beneath windows
    const lowerCard = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.62, 0.04), darkTrimMat);
    lowerCard.position.set(0.05, 0.80, s * 0.81);
    cabin.add(lowerCard);
  }

  // Front bulkhead & contoured VW T3 dashboard
  const dashBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 1.54), darkTrimMat);
  dashBase.position.set(-1.82, 1.09, 0);
  cabin.add(dashBase);

  const dashTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 1.54), darkTrimMat);
  dashTop.position.set(-1.84, 1.21, 0);
  dashTop.rotation.z = -0.15;
  cabin.add(dashTop);

  // Driver's instrument binnacle hood (+Z driver side!)
  const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.44), darkTrimMat);
  binnacle.position.set(-1.76, 1.26, 0.40);
  cabin.add(binnacle);

  // Warm vintage dashboard instrument cluster glow softly lighting wheel & seats through glass!
  const dashGlowMat = new THREE.MeshStandardMaterial({
    color: '#FFCC78',
    emissive: '#FF9E38',
    emissiveIntensity: 1.15,
    roughness: 0.4,
  });
  const gaugeFace = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.09), dashGlowMat);
  gaugeFace.position.set(-1.628, 1.24, 0.40);
  gaugeFace.rotation.y = Math.PI * 0.5;
  cabin.add(gaugeFace);

  // Physical warm dashboard/cabin light illuminating steering wheel & front bucket seats
  const dashLight = new THREE.PointLight('#FFA442', 1.45, 2.5, 2);
  dashLight.position.set(-1.42, 1.32, 0.26);
  cabin.add(dashLight);

  // Faint warm vintage cab dome-light kiss above front seats
  const domeLight = new THREE.PointLight('#FFC074', 0.65, 2.2, 2);
  domeLight.position.set(-1.22, 1.68, 0.0);
  cabin.add(domeLight);

  // Steering column & classic large tilted VW bus steering wheel (driver side +Z)
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.45, 10), darkTrimMat);
  col.position.set(-1.64, 1.13, 0.40);
  col.rotation.z = 0.62;
  cabin.add(col);

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(-1.49, 1.26, 0.40);
  wheelGroup.rotation.y = Math.PI * 0.5;
  wheelGroup.rotation.x = -0.58; // iconic bus steering wheel tilt!

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.018, 10, 24), darkTrimMat);
  wheelGroup.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 14), darkTrimMat);
  hub.rotation.x = Math.PI * 0.5;
  wheelGroup.add(hub);
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.015), darkTrimMat);
  wheelGroup.add(spoke);
  cabin.add(wheelGroup);

  // Center gear shifter stalk
  const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.42, 8), chromeMat);
  shifter.position.set(-1.45, 0.72, 0.02);
  shifter.rotation.z = -0.18;
  cabin.add(shifter);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 10), darkTrimMat);
  knob.position.set(-1.41, 0.93, 0.02);
  cabin.add(knob);

  // Two sculpted 3D front bucket seats (warm vintage rust-brown vinyl visible through window!)
  const makeBucketSeat = (zPos) => {
    const seat = new THREE.Group();
    // Pedestal base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.44), darkTrimMat);
    base.position.set(0, 0.64, 0);
    seat.add(base);
    // Seat cushion
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.50), seatMat);
    cushion.position.set(-0.04, 0.84, 0);
    seat.add(cushion);
    // Slightly reclined backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.48), seatMat);
    back.position.set(0.18, 1.15, 0);
    back.rotation.z = -0.16;
    seat.add(back);
    // Headrest on twin chrome posts
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.17, 0.24), seatMat);
    head.position.set(0.24, 1.54, 0);
    head.rotation.z = -0.10;
    seat.add(head);
    for (const pz of [-0.06, 0.06]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 6), chromeMat);
      post.position.set(0.22, 1.45, pz);
      seat.add(post);
    }
    seat.position.set(-1.26, 0, zPos);
    return seat;
  };
  cabin.add(makeBucketSeat(0.42));
  cabin.add(makeBucketSeat(-0.42));

  // Rear camper rock-and-roll bench seat
  const benchBase = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 1.38), woodMat);
  benchBase.position.set(1.12, 0.68, 0.08);
  cabin.add(benchBase);
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 1.40), seatMat);
  benchSeat.position.set(1.08, 0.92, 0.08);
  cabin.add(benchSeat);
  const benchBack = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.52, 1.40), seatMat);
  benchBack.position.set(1.36, 1.22, 0.08);
  benchBack.rotation.z = -0.14;
  cabin.add(benchBack);

  // Retro Westfalia wood camper kitchenette cabinet along left-mid interior wall
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.72, 0.42), woodMat);
  cabinet.position.set(0.12, 0.86, 0.56);
  cabin.add(cabinet);

  // Interior rear-view mirror hanging from top windshield header
  const rvStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.10, 6), darkTrimMat);
  rvStalk.position.set(-1.74, 1.71, 0);
  cabin.add(rvStalk);
  const rvMirror = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.065, 0.21), darkTrimMat);
  rvMirror.position.set(-1.72, 1.65, 0);
  cabin.add(rvMirror);

  return cabin;
}

/**
 * Builds wrap-around matte-black steel bumpers with curved rubber endcaps
 * and retro California license plates for both front (-X) and rear (+X).
 */
function buildWrapAroundBumper({ isFront, steelMat, rubberMat, chromeMat, plateMat }) {
  const group = new THREE.Group();
  const dir = isFront ? -1 : 1;
  const xFace = isFront ? -2.265 : 2.255;
  const yCenter = 0.455;
  const mainW = 1.66;

  // Main horizontal steel bumper beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.125, mainW), steelMat);
  beam.position.set(xFace, yCenter, 0);
  beam.castShadow = true;
  beam.receiveShadow = true;
  group.add(beam);

  // Subtle horizontal metallic impact strip along bumper face
  const trimStrip = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.028, mainW - 0.06), rubberMat);
  trimStrip.position.set(xFace + dir * 0.048, yCenter, 0);
  group.add(trimStrip);

  // Curved matte-black molded rubber corner endcaps wrapping cleanly onto the side fenders!
  for (const s of [-1, 1]) {
    const cornerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xFace, yCenter, s * (mainW * 0.5 - 0.02)),
      new THREE.Vector3(xFace - dir * 0.03, yCenter, s * 0.915),
      new THREE.Vector3(xFace - dir * 0.14, yCenter, s * 0.935),
      new THREE.Vector3(xFace - dir * 0.30, yCenter, s * 0.930),
    ]);
    const capProfile = new THREE.Shape();
    capProfile.moveTo(-0.062, -0.042);
    capProfile.lineTo(0.062, -0.042);
    capProfile.lineTo(0.062, 0.042);
    capProfile.lineTo(-0.062, 0.042);
    capProfile.closePath();

    const endcapGeom = new THREE.ExtrudeGeometry(capProfile, {
      steps: 10,
      bevelEnabled: false,
      extrudePath: cornerCurve,
    });
    const endcap = new THREE.Mesh(endcapGeom, rubberMat);
    endcap.castShadow = true;
    group.add(endcap);

    // Subtle bumper mounting bracket underneath
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.05), steelMat);
    bracket.position.set(xFace - dir * 0.10, yCenter - 0.02, s * 0.46);
    group.add(bracket);
  }

  // California "MOJAVE 84" license plate centered in dark bezel
  const plateW = 0.31;
  const plateH = 0.155;
  const plateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.016, plateH + 0.016, plateW + 0.016), rubberMat);
  const plateY = isFront ? yCenter - 0.01 : 0.72;
  const plateX = isFront ? xFace + dir * 0.056 : 2.238;
  plateFrame.position.set(plateX, plateY, 0);
  group.add(plateFrame);

  const plateFace = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateH), plateMat);
  plateFace.position.set(plateX + dir * 0.0095, plateY, 0);
  plateFace.rotation.y = isFront ? -Math.PI * 0.5 : Math.PI * 0.5;
  group.add(plateFace);

  // Subtle chrome mounting bolts
  for (const bz of [-0.11, 0.11]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.01, 8), chromeMat);
    bolt.rotation.z = Math.PI * 0.5;
    bolt.position.set(plateX + dir * 0.011, plateY + 0.055, bz);
    group.add(bolt);
  }

  return group;
}

/**
 * Builds the iconic VW T3 front radiator grille, central circular emblem,
 * recessed dual rectangular halogen headlights with reflector bowls,
 * lower grille, and glowing amber lower turn signals!
 */
function buildFrontFasciaHardware({ matteBlackMat, chromeMat, headlightMat, reflectorMat, amberMat, glassLensMat }) {
  const fascia = new THREE.Group();
  // Positioned cleanly proud of the curved nose bow (frontX - 0.032 = -2.252)
  // so ZERO yellow paint ever pokes through the jet-black radiator grille slats!
  const xBase = -2.258;

  // 1. Upper Radiator Grille Housing (full width between corners)
  const upperW = 1.64;
  const upperH = 0.215;
  const upperY = 0.885;

  const upperBack = new THREE.Mesh(new THREE.BoxGeometry(0.055, upperH, upperW), matteBlackMat);
  upperBack.position.set(xBase + 0.020, upperY, 0);
  fascia.add(upperBack);

  // Outer upper & lower bezel bars
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.022, upperW + 0.02), matteBlackMat);
  barTop.position.set(xBase + 0.002, upperY + upperH * 0.5 - 0.008, 0);
  fascia.add(barTop);

  const barBot = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.022, upperW + 0.02), matteBlackMat);
  barBot.position.set(xBase + 0.002, upperY - upperH * 0.5 + 0.008, 0);
  fascia.add(barBot);

  // 5 horizontal slatted grille fins spanning between headlights
  const slatW = 1.08;
  for (let i = 0; i < 5; i++) {
    const sy = upperY - 0.072 + i * 0.036;
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.013, slatW), matteBlackMat);
    slat.position.set(xBase - 0.010, sy, 0);
    fascia.add(slat);
  }

  // 2. Central Crisp Circular VW-Style Metallic Emblem
  const emblemGroup = new THREE.Group();
  emblemGroup.position.set(xBase - 0.022, upperY, 0);
  const embDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.070, 0.014, 24), matteBlackMat);
  embDisk.rotation.z = Math.PI * 0.5;
  emblemGroup.add(embDisk);

  const emblemSilverMat = new THREE.MeshStandardMaterial({
    color: '#B8C4CE',
    metalness: 0.90,
    roughness: 0.22,
    envMapIntensity: 1.35,
  });

  const embRing = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.008, 10, 28), emblemSilverMat);
  embRing.rotation.y = Math.PI * 0.5;
  embRing.position.x = -0.006;
  emblemGroup.add(embRing);

  // Clean geometric chevron bars inside the circular emblem (crisp, non-garbled)
  const barGeom = new THREE.BoxGeometry(0.009, 0.078, 0.011);
  const vLeft = new THREE.Mesh(barGeom, emblemSilverMat);
  vLeft.position.set(-0.008, 0.006, -0.016);
  vLeft.rotation.x = 0.34;
  emblemGroup.add(vLeft);

  const vRight = new THREE.Mesh(barGeom, emblemSilverMat);
  vRight.position.set(-0.008, 0.006, 0.016);
  vRight.rotation.x = -0.34;
  emblemGroup.add(vRight);

  const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.010, 0.084), emblemSilverMat);
  hBar.position.set(-0.008, -0.012, 0);
  emblemGroup.add(hBar);
  fascia.add(emblemGroup);

  // 3. Recessed Dual Rectangular Halogen Headlights with Chrome Reflector Bowls
  for (const s of [-1, 1]) {
    const hlGroup = new THREE.Group();
    hlGroup.position.set(xBase - 0.002, upperY, s * 0.655);

    // Outer recessed rectangular deep-black housing
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.178, 0.258), matteBlackMat);
    hlGroup.add(housing);

    // Crisp recessed dark bezel frame around headlight aperture
    const bezelTop = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.018, 0.236), matteBlackMat);
    bezelTop.position.set(-0.026, 0.078, 0);
    hlGroup.add(bezelTop);
    const bezelBot = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.018, 0.236), matteBlackMat);
    bezelBot.position.set(-0.026, -0.078, 0);
    hlGroup.add(bezelBot);

    // Inner gleaming chrome parabolic reflector bezel
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.042, 0.045, 20, 1, true), reflectorMat);
    bowl.rotation.z = Math.PI * 0.5;
    bowl.position.set(-0.012, 0, 0);
    hlGroup.add(bowl);

    // Warm emissive rectangular halogen glowing lens core (#FFF0C4)
    const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.126, 0.195), headlightMat);
    emitter.position.set(-0.020, 0, 0);
    hlGroup.add(emitter);

    // Extra bright warm round central bulb hotspot inside reflector
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 14), headlightMat);
    bulb.scale.set(0.32, 1.0, 1.0);
    bulb.position.set(-0.025, 0, 0);
    hlGroup.add(bulb);

    // Clear protective outer headlight glass cover
    const lensCover = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.144, 0.214), glassLensMat);
    lensCover.position.set(-0.030, 0, 0);
    hlGroup.add(lensCover);

    fascia.add(hlGroup);
  }

  // 4. Lower Radiator Intake Grille (above front bumper, cleanly proud of curved nose bow)
  const lowerY = 0.625;
  const lowerBack = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.11, 1.04), matteBlackMat);
  lowerBack.position.set(xBase + 0.022, lowerY, 0);
  fascia.add(lowerBack);

  for (let i = 0; i < 3; i++) {
    const lSlat = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.012, 1.00), matteBlackMat);
    lSlat.position.set(xBase + 0.002, lowerY - 0.032 + i * 0.032, 0);
    fascia.add(lSlat);
  }

  // 5. Lower Amber Turn Signals (#FF8C1A) flanking the lower grille
  for (const s of [-1, 1]) {
    const tsBezel = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.074, 0.165), matteBlackMat);
    tsBezel.position.set(xBase + 0.008, lowerY, s * 0.685);
    fascia.add(tsBezel);

    const tsLens = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.056, 0.145), amberMat);
    tsLens.position.set(xBase - 0.006, lowerY, s * 0.685);
    fascia.add(tsLens);
  }

  return fascia;
}

/**
 * Builds crisp vertical VW T3 rear taillight clusters (amber / ruby / white / reflector).
 */
function buildRearTaillights({ matteBlackMat, amberMat }) {
  const group = new THREE.Group();
  const xRear = 2.222;

  const redTailMat = new THREE.MeshStandardMaterial({
    color: '#D62020',
    emissive: '#B81414',
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.1,
  });

  const whiteRevMat = new THREE.MeshStandardMaterial({
    color: '#E8EDF2',
    emissive: '#FFF5E0',
    emissiveIntensity: 0.25,
    roughness: 0.16,
  });

  for (const s of [-1, 1]) {
    const zPos = s * 0.725;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.145), matteBlackMat);
    housing.position.set(xRear - 0.006, 0.785, zPos);
    group.add(housing);

    // Top amber turn indicator
    const segAmber = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.085, 0.122), amberMat);
    segAmber.position.set(xRear + 0.012, 0.895, zPos);
    group.add(segAmber);

    // Upper-mid ruby brake/tail lamp
    const segRed = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.115, 0.122), redTailMat);
    segRed.position.set(xRear + 0.012, 0.79, zPos);
    group.add(segRed);

    // Lower white reverse lamp
    const segRev = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.055, 0.122), whiteRevMat);
    segRev.position.set(xRear + 0.012, 0.70, zPos);
    group.add(segRev);

    // Bottom reflector strip
    const segRefl = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.045, 0.122), redTailMat);
    segRefl.position.set(xRear + 0.012, 0.648, zPos);
    group.add(segRefl);
  }

  return group;
}

/**
 * Builds iconic VW T3 side-view mirrors on angled stalks, windshield wipers,
 * chrome door handles, rain-gutter drip rails, wheel-arch flares, and dark fender liners.
 */
function buildExteriorDetails({ matteBlackMat, rubberMat, chromeMat, bodySolidMat, mirrorGlassMat }) {
  const details = new THREE.Group();

  // 1. Continuous Black Rain-Gutter Drip Rails wrapping the roofline at y = 1.84
  const yRail = 1.84;
  const hwRail = halfWidth(yRail) + 0.012;
  const xFrontRail = frontX(yRail) + CORNER_R;
  const xRearRail = rearX(yRail) - CORNER_R;

  const railPts = [
    new THREE.Vector3(xFrontRail, yRail, hwRail),
    new THREE.Vector3(xRearRail, yRail, hwRail),
    new THREE.Vector3(rearX(yRail) + 0.015, yRail, 0),
    new THREE.Vector3(xRearRail, yRail, -hwRail),
    new THREE.Vector3(xFrontRail, yRail, -hwRail),
    new THREE.Vector3(frontX(yRail) - 0.015, yRail, 0),
  ];
  const railCurve = new THREE.CatmullRomCurve3(railPts, true, 'catmullrom', 0.08);
  const rainGutter = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 84, 0.013, 6, true), rubberMat);
  details.add(rainGutter);

  // 2. Sculpted Flared Wheel-Arch Lips + Deep Dark Recessed Fender Liner Tubs!
  // Strictly bounded above Y >= WHEEL_Y (0.34m) so nothing ever protrudes near tire contact!
  const wheelXs = [FRONT_AXLE_X, REAR_AXLE_X];
  const linerMat = new THREE.MeshStandardMaterial({
    color: '#08080C',
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  for (const wx of wheelXs) {
    for (const s of [-1, 1]) {
      // Subtle painted fender lip proud by ~1.2cm hugging the upper wheel arch
      const lipPts = [];
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        const ang = Math.PI - (i / steps) * Math.PI; // PI -> 0 (strictly upper semicircle!)
        const lx = wx + Math.cos(ang) * (ARCH_RADIUS + 0.005);
        const ly = WHEEL_Y + Math.sin(ang) * (ARCH_RADIUS + 0.005);
        const lz = s * (halfWidth(ly) + 0.009);
        lipPts.push(new THREE.Vector3(lx, ly, lz));
      }
      const lipCurve = new THREE.CatmullRomCurve3(lipPts);
      const archLip = new THREE.Mesh(new THREE.TubeGeometry(lipCurve, 36, 0.015, 12, false), bodySolidMat);
      archLip.castShadow = true;
      details.add(archLip);

      // Deep matte-black recessed fender liner cylinder strictly arching OVER the tire (+Y)!
      // In Three.js CylinderGeometry, theta in [PI/2, 3*PI/2] lies on -Z;
      // after rotateX(+PI/2), (x, y, z) -> (x, -z, y), so -Z maps strictly to +Y (UPWARD)!
      const linerGeom = new THREE.CylinderGeometry(
        ARCH_RADIUS - 0.006,
        ARCH_RADIUS - 0.006,
        0.30,
        24,
        1,
        true,
        Math.PI * 0.5,
        Math.PI
      );
      linerGeom.rotateX(Math.PI * 0.5);
      const liner = new THREE.Mesh(linerGeom, linerMat);
      liner.position.set(wx, WHEEL_Y, s * (halfWidth(0.55) - 0.16));
      details.add(liner);

      // Upper semicircle dark wheel-well bulkhead strictly above Y = WHEEL_Y (0.34m)
      const bulkhead = new THREE.Mesh(
        new THREE.CircleGeometry(ARCH_RADIUS - 0.006, 20, 0, Math.PI),
        linerMat
      );
      bulkhead.position.set(wx, WHEEL_Y, s * (halfWidth(0.55) - 0.31));
      bulkhead.rotation.y = s > 0 ? 0 : Math.PI;
      details.add(bulkhead);
    }
  }

  // 3. Dual Side-View Mirrors on Angled Stalks (left +Z and right -Z front doors)
  for (const s of [-1, 1]) {
    const mirrorGroup = new THREE.Group();
    const mountZ = s * halfWidth(1.13);
    // Door mounting foot
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.025), matteBlackMat);
    foot.position.set(-1.78, 1.13, mountZ);
    mirrorGroup.add(foot);

    // Lower & upper angled tubular stalks
    const stalk1 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.18, 8), matteBlackMat);
    stalk1.position.set(-1.77, 1.20, mountZ + s * 0.075);
    stalk1.rotation.x = s * 0.85;
    mirrorGroup.add(stalk1);

    // Classic rectangular VW T3 mirror housing
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.165, 0.115), matteBlackMat);
    head.position.set(-1.75, 1.28, mountZ + s * 0.155);
    head.rotation.y = s * 0.12;
    head.castShadow = true;
    mirrorGroup.add(head);

    // Reflective glass face pointing backward (+X)
    const mGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.098, 0.145), mirrorGlassMat);
    mGlass.position.set(-1.721, 1.28, mountZ + s * 0.155);
    mGlass.rotation.y = Math.PI * 0.5 + s * 0.12;
    mirrorGroup.add(mGlass);

    details.add(mirrorGroup);
  }

  // 4. Twin Front Windshield Wipers resting along lower windshield cowl
  const wiperPositions = [-0.34, 0.28];
  for (const wz of wiperPositions) {
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.025, 8), matteBlackMat);
    pivot.position.set(-2.075, 1.238, wz);
    pivot.rotation.z = 0.5;
    details.add(pivot);

    // Arm lying close to the raked windshield plane
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.085, 1.242, wz),
      new THREE.Vector3(-2.055, 1.305, wz - 0.18),
      new THREE.Vector3(-2.025, 1.355, wz - 0.36),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.006, 6, false), matteBlackMat);
    details.add(arm);

    // Wiper rubber blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.38), rubberMat);
    blade.position.set(-2.045, 1.325, wz - 0.26);
    blade.rotation.y = 0.14;
    blade.rotation.x = 0.20;
    details.add(blade);
  }

  // 5. Recessed Chrome Door Handles (front cab doors + passenger sliding door + rear hatch)
  const addDoorHandle = (x, y, s) => {
    const hz = s * (halfWidth(y) + 0.006);
    const cup = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.044, 0.016), matteBlackMat);
    cup.position.set(x, y, hz);
    details.add(cup);

    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.022, 0.028), chromeMat);
    pull.position.set(x, y, hz + s * 0.012);
    details.add(pull);
  };
  addDoorHandle(-0.97, 0.96, 1);  // Driver front door (+Z)
  addDoorHandle(-0.97, 0.96, -1); // Passenger front door (-Z)
  addDoorHandle(-0.76, 0.96, -1); // Sliding side door (-Z)

  // Subtle 3D recessed sliding-door rail trim channel on right (-Z) side
  const slideTrack = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.024, 0.014), matteBlackMat);
  slideTrack.position.set(1.24, 0.70, -(halfWidth(0.70) + 0.002));
  details.add(slideTrack);

  // Rear tailgate push-button chrome latch
  const rearLatch = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.048, 0.11), chromeMat);
  rearLatch.position.set(2.225, 0.85, 0);
  details.add(rearLatch);

  // 6. Subtle Dark Undercarriage Chassis, Axles & Exhaust Tailpipe
  const chassisMat = new THREE.MeshStandardMaterial({
    color: '#111216',
    roughness: 0.9,
    metalness: 0.25,
  });
  const underpan = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.12, 1.48), chassisMat);
  underpan.position.set(0.0, 0.31, 0);
  underpan.castShadow = true;
  details.add(underpan);

  // Front & rear axle beams + rear engine sump housing
  for (const ax of [FRONT_AXLE_X, REAR_AXLE_X]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 1.44, 10), chassisMat);
    axle.rotation.x = Math.PI * 0.5;
    axle.position.set(ax, WHEEL_Y, 0);
    details.add(axle);
  }
  const sump = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.56), chassisMat);
  sump.position.set(1.55, 0.27, 0);
  details.add(sump);

  // Metallic exhaust tailpipe peeking cleanly below rear-left bumper
  const exhaustMat = new THREE.MeshStandardMaterial({
    color: '#7A7E85',
    metalness: 0.75,
    roughness: 0.45,
  });
  const tailpipe = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 12), exhaustMat);
  tailpipe.rotation.z = Math.PI * 0.5;
  tailpipe.position.set(2.14, 0.26, 0.44);
  details.add(tailpipe);

  // Subtle radio antenna whip on front-left A-pillar cowl
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.004, 0.68, 6), chromeMat);
  antenna.position.set(-1.99, 1.56, 0.86);
  antenna.rotation.z = -0.35;
  details.add(antenna);

  return details;
}

// ============================================================================
// Main Hero Van Builder
// ============================================================================

export function buildHeroVan({ config } = {}) {
  const palette = config?.palette || {};
  const dims = config?.van?.dimensions || {
    length: 4.57,
    width: 1.85,
    height: 1.96,
    wheelRadius: 0.34,
    wheelWidth: 0.22,
    wheelbase: 2.46,
  };

  const vanGroup = new THREE.Group();
  vanGroup.name = 'HeroVWT3Van';

  // --- 1. HIGH-RES PROCEDURAL PBR LIVERY & MATERIAL PALETTE ---
  const leftSideMaps = createSideLiveryMaps({ side: 'left', palette });
  const rightSideMaps = createSideLiveryMaps({ side: 'right', palette });
  const frontMaps = createFrontRearLiveryMaps({ face: 'front', palette });
  const rearMaps = createFrontRearLiveryMaps({ face: 'rear', palette });
  const plateTex = createLicensePlateTexture('MOJAVE 84');
  const tireMaps = createTireTreadMaps();
  const contactShadowTex = createContactShadowTexture();

  // Shared physical automotive clearcoat paint factory (glossy twilight sky & cyan neon reflections!)
  const makePaintMat = ({ map, roughnessMap, bumpMap, color }) =>
    new THREE.MeshPhysicalMaterial({
      color: color || '#FFFFFF',
      map: map || null,
      roughnessMap: roughnessMap || null,
      bumpMap: bumpMap || null,
      bumpScale: bumpMap ? 0.008 : 0,
      metalness: 0.22,
      roughness: roughnessMap ? 1.0 : 0.27, // roughnessMap encodes ~0.27 glossy paint -> ~0.88 dusty rocker
      clearcoat: 0.86,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.55,
    });

  const leftSideMat = makePaintMat(leftSideMaps);
  const rightSideMat = makePaintMat(rightSideMaps);
  const frontMat = makePaintMat(frontMaps);
  const rearMat = makePaintMat(rearMaps);
  const roofMat = makePaintMat({ color: '#1EA8DC' });

  // Deep dark-tinted physical glass strongly reflecting the fiery coral-pink twilight sky & cyan neon
  const windowGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#040A13',
    roughness: 0.035,
    metalness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.025,
    envMapIntensity: 2.3,
    transparent: true,
    opacity: 0.84,
    side: THREE.DoubleSide,
  });

  // Deep velvety matte black for slatted radiator grille & headlight bezels (crisp dark contrast!)
  const matteBlackMat = new THREE.MeshStandardMaterial({
    color: '#0A0B0E',
    roughness: 0.80,
    metalness: 0.06,
    envMapIntensity: 0.35,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: '#0D0E12',
    roughness: 0.88,
    metalness: 0.03,
    envMapIntensity: 0.35,
  });

  const steelBumperMat = new THREE.MeshStandardMaterial({
    color: '#0E1015',
    roughness: 0.52,
    metalness: 0.30,
    envMapIntensity: 0.55,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#EEF4FA',
    metalness: 0.96,
    roughness: 0.12,
    envMapIntensity: 1.85,
  });

  const mirrorGlassMat = new THREE.MeshStandardMaterial({
    color: '#D4E0EA',
    metalness: 0.98,
    roughness: 0.05,
    envMapIntensity: 1.85,
  });

  const reflectorMat = new THREE.MeshStandardMaterial({
    color: '#F5F4EE',
    metalness: 0.96,
    roughness: 0.08,
    side: THREE.DoubleSide,
  });

  // Calibrated warm halogen emissive glass (1.45 -> razor-sharp glowing bulbs with zero white fog washout!)
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#FFF4D0',
    emissive: '#FFF0C4',
    emissiveIntensity: 1.45,
    roughness: 0.12,
    metalness: 0.05,
  });

  const headlightCoverMat = new THREE.MeshPhysicalMaterial({
    color: '#FFFFFF',
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: 0.24,
    envMapIntensity: 1.35,
  });

  const amberMat = new THREE.MeshStandardMaterial({
    color: '#FF921A',
    emissive: '#FF8C1A',
    emissiveIntensity: 1.25,
    roughness: 0.18,
    metalness: 0.05,
  });

  // Slightly toned-down license plate material so plate stays legible without clipping white
  const plateMat = new THREE.MeshStandardMaterial({
    color: '#B8B4AC',
    map: plateTex,
    roughness: 0.64,
    metalness: 0.12,
    envMapIntensity: 0.55,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: '#17181D',
    roughness: 0.87,
    metalness: 0.02,
    bumpMap: tireMaps.bumpMap,
    bumpScale: 0.012,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: '#D4DDE4',
    metalness: 0.55,
    roughness: 0.28,
    envMapIntensity: 1.4,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: '#111216',
    metalness: 0.42,
    roughness: 0.68,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: '#0B0B10',
    roughness: 0.90,
    metalness: 0.04,
  });

  const seatMat = new THREE.MeshStandardMaterial({
    color: '#4F221A', // deep vintage rust-vinyl visible subtly through dark tinted front window
    roughness: 0.80,
    metalness: 0.02,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: '#4B2E1C',
    roughness: 0.74,
    metalness: 0.04,
  });

  // --- 2. SCULPTED CONTOURED BODYWORK SHELL ---
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'VanBodyShell';

  const leftSideMesh = new THREE.Mesh(buildContouredSidePanel(1), leftSideMat);
  leftSideMesh.castShadow = true;
  leftSideMesh.receiveShadow = true;
  bodyGroup.add(leftSideMesh);

  const rightSideMesh = new THREE.Mesh(buildContouredSidePanel(-1), rightSideMat);
  rightSideMesh.castShadow = true;
  rightSideMesh.receiveShadow = true;
  bodyGroup.add(rightSideMesh);

  const frontMesh = new THREE.Mesh(buildContouredEndFace(true), frontMat);
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;
  bodyGroup.add(frontMesh);

  const rearMesh = new THREE.Mesh(buildContouredEndFace(false), rearMat);
  rearMesh.castShadow = true;
  rearMesh.receiveShadow = true;
  bodyGroup.add(rearMesh);

  const roofMesh = new THREE.Mesh(buildCrownedRoof(), roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  bodyGroup.add(roofMesh);

  vanGroup.add(bodyGroup);

  // --- 3. REAL 3D INTERIOR CABIN CAVITY ---
  const cabin = buildInteriorCabin({ darkTrimMat, seatMat, woodMat, chromeMat });
  vanGroup.add(cabin);

  // --- 4. RECESSED RUBBER GASKETS & REFLECTIVE TINTED WINDOWS ---
  const windowsGroup = new THREE.Group();
  windowsGroup.name = 'VanWindows';

  const frontWindshield = new THREE.Mesh(buildCurvedEndGlass(true, 0.022), windowGlassMat);
  frontWindshield.renderOrder = 2;
  windowsGroup.add(frontWindshield);
  windowsGroup.add(buildEndWindowGasket(true, rubberMat));

  const rearGlass = new THREE.Mesh(buildCurvedEndGlass(false, 0.022), windowGlassMat);
  rearGlass.renderOrder = 2;
  windowsGroup.add(rearGlass);
  windowsGroup.add(buildEndWindowGasket(false, rubberMat));

  for (const s of [-1, 1]) {
    windowsGroup.add(buildSideWindowAssembly(s, true, windowGlassMat, rubberMat));
    windowsGroup.add(buildSideWindowAssembly(s, false, windowGlassMat, rubberMat));
  }
  vanGroup.add(windowsGroup);

  // --- 5. FRONT GRILLE, HEADLIGHTS, SIGNALS, BUMPERS & HARDWARE ---
  vanGroup.add(
    buildFrontFasciaHardware({
      matteBlackMat,
      chromeMat,
      headlightMat,
      reflectorMat,
      amberMat,
      glassLensMat: headlightCoverMat,
    })
  );

  vanGroup.add(buildRearTaillights({ matteBlackMat, amberMat }));

  vanGroup.add(
    buildWrapAroundBumper({
      isFront: true,
      steelMat: steelBumperMat,
      rubberMat,
      chromeMat,
      plateMat,
    })
  );
  vanGroup.add(
    buildWrapAroundBumper({
      isFront: false,
      steelMat: steelBumperMat,
      rubberMat,
      chromeMat,
      plateMat,
    })
  );

  vanGroup.add(
    buildExteriorDetails({
      matteBlackMat,
      rubberMat,
      chromeMat,
      bodySolidMat: roofMat,
      mirrorGlassMat,
    })
  );

  // --- 6. FOUR GROUNDED WHEELS (TIRE BOTTOM AT LOCAL Y = 0.000) ---
  const wheelsGroup = new THREE.Group();
  wheelsGroup.name = 'VanWheels';
  const wheelR = dims.wheelRadius || 0.34;
  const wheelW = dims.wheelWidth || 0.22;
  const wheelTrackZ = 0.785; // tucked cleanly inside 0.925m wheel-arch lips

  const wheelCoords = [
    [FRONT_AXLE_X, wheelR, wheelTrackZ, 1],
    [FRONT_AXLE_X, wheelR, -wheelTrackZ, -1],
    [REAR_AXLE_X, wheelR, wheelTrackZ, 1],
    [REAR_AXLE_X, wheelR, -wheelTrackZ, -1],
  ];

  for (const [wx, wy, wz, sideSign] of wheelCoords) {
    const w = buildVWWheel({
      radius: wheelR,
      width: wheelW,
      tireMat,
      rimMat,
      chromeMat,
      darkSteelMat,
    });
    w.position.set(wx, wy, wz);
    // Hubcap faces outward (+Z on left side, -Z on right side)
    if (sideSign < 0) {
      w.rotation.y = Math.PI;
    }
    wheelsGroup.add(w);
  }
  vanGroup.add(wheelsGroup);

  // --- 7. GROUNDING AO CONTACT SHADOW PLANE ---
  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2.7), shadowMat);
  contactShadow.rotation.x = -Math.PI * 0.5;
  contactShadow.position.set(-0.04, 0.005, 0);
  contactShadow.renderOrder = 1;
  vanGroup.add(contactShadow);

  // --- 8. REAL PHYSICAL RAKING HEADLIGHTS, VOLUMETRIC HAZE CONES, TURN SIGNALS & TAILLIGHTS ---
  const headlightTargets = [];
  const headlightLights = [];
  const headlightCones = [];
  const turnSignalLights = [];

  // Custom Fresnel-softened volumetric dusty-desert headlight haze shader (zero hard cone edges!)
  const makeBeamConeMat = () =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      uniforms: {
        uColorNear: { value: new THREE.Color('#FFE8B8') },
        uColorFar: { value: new THREE.Color('#F2BA7E') },
        uOpacity: { value: 0.085 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorNear;
        uniform vec3 uColorFar;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        void main() {
          // CylinderGeometry open-ended UV.y: 1.0 at small lens end -> 0.0 at wide far end
          float distFrac = 1.0 - vUv.y;
          float nearFade = smoothstep(0.0, 0.09, distFrac);
          float farFade = pow(max(0.0, 1.0 - distFrac), 2.35);
          // Smooth view-angle grazing rolloff eliminates hard geometric silhouette edges!
          float edgeSoft = pow(abs(dot(normalize(vNormalView), normalize(vViewDir))), 2.1);
          vec3 col = mix(uColorNear, uColorFar, distFrac);
          float alpha = uOpacity * nearFade * farFade * edgeSoft;
          gl_FragColor = vec4(col * alpha, alpha);
        }
      `,
    });

  // Open-ended frustum cone (small end at lens r=0.095 -> wide end r=1.18 over 6.0m length)
  const beamLen = 6.0;
  const beamGeom = new THREE.CylinderGeometry(0.095, 1.18, beamLen, 24, 1, true);
  // Shift geometry so small lens tip sits at local origin (0,0,0) and extends along -X
  beamGeom.translate(0, -beamLen * 0.5, 0);
  beamGeom.rotateZ(-Math.PI * 0.5);

  for (const s of [-1, 1]) {
    // Physical raking halogen SpotLight aimed downward & left-forward across concrete, pebbles & creosote bush
    const target = new THREE.Object3D();
    target.position.set(-9.4, -0.08, s * 0.88);
    vanGroup.add(target);
    headlightTargets.push(target);

    const spot = new THREE.SpotLight(
      '#FFE6B3',
      28.0,   // physical candela with decay:2 -> rich grazing pools across 4..12m of apron, gravel & twigs!
      18.0,
      0.45,   // realistic focused automotive low-beam cone
      0.84,   // smooth feathered penumbra
      2
    );
    spot.position.set(-2.38, 0.885, s * 0.655);
    spot.target = target;
    // Enable crisp shadow-casting on camera-side headlight so foreground creosote bush & pebbles cast dramatic long shadows!
    if (s === 1) {
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.camera.near = 0.55;
      spot.shadow.camera.far = 18.0;
      spot.shadow.bias = -0.0004;
      spot.shadow.normalBias = 0.025;
      spot.shadow.radius = 2.4;
    } else {
      spot.castShadow = false;
    }
    vanGroup.add(spot);
    headlightLights.push(spot);

    // Ultra-subtle volumetric dusty twilight haze cone aligned with the SpotLight beam axis
    const coneMat = makeBeamConeMat();
    const cone = new THREE.Mesh(beamGeom, coneMat);
    cone.name = 'HeadlightHazeCone';
    cone.position.set(-2.30, 0.885, s * 0.655);
    cone.rotation.z = 0.125; // gentle downward rake matching the SpotLight target
    cone.rotation.y = -s * 0.032; // slight outward toe-out
    cone.renderOrder = 4;
    vanGroup.add(cone);
    headlightCones.push(cone);

    // Subtle local glow for lower amber front turn signals (calm micro-kiss, zero bumper glare!)
    const tsLight = new THREE.PointLight('#FF8A18', 0.22, 1.4, 2);
    tsLight.position.set(-2.33, 0.62, s * 0.69);
    vanGroup.add(tsLight);
    turnSignalLights.push(tsLight);
  }

  // Authentic crimson rear taillight glow kissing rear black bumper, exhaust & concrete behind the van
  const tailLight = new THREE.PointLight('#FF2218', 2.8, 4.5, 2);
  tailLight.position.set(2.48, 0.76, 0.0);
  vanGroup.add(tailLight);

  // --- 9. UNIVERSAL SHADOW GROUNDING TRAVERSAL ---
  // Guarantee every solid body panel, bumper, wheel, mirror & interior seat casts & receives crisp 3D shadows,
  // while glass panes, volumetric haze cones, AO contact plane & emissive lenses never block light!
  const nonShadowMats = new Set([windowGlassMat, headlightMat, headlightCoverMat, amberMat, shadowMat]);
  vanGroup.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj === contactShadow || obj.name === 'HeadlightHazeCone') {
      obj.castShadow = false;
      obj.receiveShadow = false;
      return;
    }
    if (nonShadowMats.has(obj.material)) {
      obj.castShadow = false;
      obj.receiveShadow = obj.material === windowGlassMat;
      return;
    }
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

  return {
    group: vanGroup,
    headlightTargets,
    headlightMat,
    headlightLights,
    headlightCones,
    turnSignalLights,
    tailLight,
  };
}
