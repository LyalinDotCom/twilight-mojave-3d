import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

let rectAreaInitialized = false;

/**
 * Master Physical Twilight Mojave Lighting Rig.
 *
 * Uses physically accurate inverse-square decay (decay = 2) + LTC RectAreaLights
 * so the gas station genuinely illuminates the twilight desert as a warm-tungsten &
 * electric-cyan oasis, with real grounded shadows under the pumps, pillars, bollards,
 * and van, and real rectangular area reflections across the concrete apron and clearcoat.
 *
 * LIGHT OWNERSHIP MAP (Zero Conflicts):
 * - lighting.js (Master Rig):
 *     1. Low-angle Coral Sunset DirectionalLight (2048px shadows)
 *     2. Cool-rose Twilight HemisphereLight + subtle horizon bounce
 *     3. Under-Canopy: 1× full-soffit warm tungsten RectAreaLight + 2× shadow-casting
 *        wide-penumbra tungsten SpotLights + 1× soft concrete up-bounce PointLight
 *     4. Electric Cyan Neon Perimeter: 3× linear cyan RectAreaLights (front fascia,
 *        left overhang toward van, storefront eave) — ZERO point-light glare orbs!
 *     5. Storefront Exterior Spill: 1× window warm-gold RectAreaLight + 1× shadow-casting
 *        golden SpotLight casting forward bollard shadows across the apron
 *     6. Rooftop Neon Sign (`Desert / GAS & GO` + Star): warm crimson-amber PointLight
 * - station/store.js: Interior ceiling/shelf illumination inside the convenience store
 * - station/pumps.js: Localized micro-glow on pump display bays
 * - van/van.js: Twin physical raking headlight SpotLights + volumetric cones +
 *   amber turn signals, red taillight kiss, and warm cabin dashboard glow
 */
export function createLighting({ scene, config }) {
  if (!rectAreaInitialized) {
    RectAreaLightUniformsLib.init();
    rectAreaInitialized = true;
  }

  const group = new THREE.Group();
  group.name = 'MasterLightingRig';

  const L = config.lighting;
  const canopy = config.station.canopy;
  const store = config.station.store;
  const sign = config.station.signage;

  // =========================================================================
  // 1. TWILIGHT DESERT ENVIRONMENT (Moody Dusk Dynamic Range)
  // =========================================================================

  // Low-angle Coral Sunset Grazing Rim / Key Light (tight 4096px PCFSoft hero shadow frustum!)
  const sunsetKey = new THREE.DirectionalLight(L.sunsetKey.color, L.sunsetKey.intensity);
  sunsetKey.position.set(...L.sunsetKey.position);
  sunsetKey.target.position.set(0.0, 0.5, 6.0);
  sunsetKey.castShadow = true;
  sunsetKey.shadow.mapSize.set(L.sunsetKey.shadowMapSize, L.sunsetKey.shadowMapSize);
  sunsetKey.shadow.camera.near = 6;
  sunsetKey.shadow.camera.far = 92;
  sunsetKey.shadow.camera.left = -20;
  sunsetKey.shadow.camera.right = 20;
  sunsetKey.shadow.camera.top = 14;
  sunsetKey.shadow.camera.bottom = -18;
  sunsetKey.shadow.bias = -0.00025;
  sunsetKey.shadow.normalBias = 0.022;
  sunsetKey.shadow.radius = 1.8;
  group.add(sunsetKey);
  group.add(sunsetKey.target);

  // Subtle warm-mauve dusk sky bounce (neutralized to keep gravel warm-taupe, not over-magenta)
  const twilightFillDir = new THREE.DirectionalLight('#C2868A', 0.14);
  twilightFillDir.position.set(14, 7, 24);
  group.add(twilightFillDir);

  // Cool Twilight Sky / Warm Dusty Taupe Earth Hemisphere Fill
  const hemiLight = new THREE.HemisphereLight(
    L.hemi.skyColor,
    L.hemi.groundColor,
    L.hemi.intensity
  );
  hemiLight.position.set(0, 30, 0);
  group.add(hemiLight);

  // =========================================================================
  // 2. UNDER-CANOPY WARM TUNGSTEN OASIS (Area + Shadow-Casting Spots)
  // =========================================================================

  // Full-soffit downward tungsten RectAreaLight: smooth golden illumination +
  // genuine rectangular specular reflection across concrete apron & van roof!
  const canopyAreaLight = new THREE.RectAreaLight('#FFD694', 5.0, 8.0, 3.8);
  canopyAreaLight.position.set(canopy.center[0], canopy.soffitY - 0.12, canopy.center[2]);
  canopyAreaLight.lookAt(canopy.center[0], 0.0, canopy.center[2]);
  group.add(canopyAreaLight);

  // Two wide-penumbra shadow-casting tungsten SpotLights illuminating the 3 pumps,
  // pillars, concrete pad, corrugated pink store wall, and right flank of the van
  const canopySpots = [];
  const spotSpecs = [
    { pos: [-0.2, canopy.soffitY - 0.14, canopy.center[2] + 0.05], target: [-0.45, 0.0, 0.2], intensity: L.canopyPool.intensity },
    { pos: [3.8, canopy.soffitY - 0.14, canopy.center[2] + 0.05], target: [3.95, 0.0, 0.15], intensity: L.canopyPool.intensity },
  ];
  for (const spec of spotSpecs) {
    const spot = new THREE.SpotLight('#FFD288', spec.intensity, L.canopyPool.distance, 1.12, 0.72, 2);
    spot.position.set(...spec.pos);
    spot.target.position.set(...spec.target);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.5;
    spot.shadow.camera.far = 16.5;
    spot.shadow.bias = -0.00035;
    spot.shadow.normalBias = 0.02;
    spot.shadow.radius = 2.2;
    group.add(spot);
    group.add(spot.target);
    canopySpots.push(spot);
  }

  // Soft upward concrete bounce light so the canopy soffit underside & pump tops glow warmly
  const apronBounce = new THREE.PointLight('#FFB666', 11.5, 9.0, 2);
  apronBounce.position.set(canopy.center[0], 1.35, canopy.center[2] + 0.1);
  group.add(apronBounce);

  // =========================================================================
  // 3. ELECTRIC CYAN NEON PERIMETER SPILL (Linear RectAreaLights — Zero Orbs!)
  // =========================================================================
  const cyanAreaLights = [];

  // Front canopy cyan neon strip: washes front apron, gravel transition & pump tops in cool cyan
  const cyanFront = new THREE.RectAreaLight('#00DDFF', 5.8, 8.6, 0.52);
  cyanFront.position.set(
    canopy.center[0],
    canopy.soffitY + 0.18,
    canopy.center[2] + canopy.depth * 0.5 + 0.18
  );
  cyanFront.lookAt(canopy.center[0], 0.35, canopy.center[2] + canopy.depth * 0.5 + 3.4);
  group.add(cyanFront);
  cyanAreaLights.push(cyanFront);

  // Left canopy cyan neon overhang: paints cool electric-cyan rim across the VW van roof & flank!
  const cyanLeft = new THREE.RectAreaLight('#00DDFF', 5.4, 4.4, 0.52);
  cyanLeft.position.set(
    canopy.center[0] - canopy.width * 0.5 - 0.18,
    canopy.soffitY + 0.18,
    canopy.center[2]
  );
  cyanLeft.lookAt(-5.4, 0.75, 1.35);
  group.add(cyanLeft);
  cyanAreaLights.push(cyanLeft);

  // Storefront cyan eave strip: cool cyan highlight along upper blue facade & front curb
  const cyanStoreEave = new THREE.RectAreaLight('#00DDFF', 3.0, 7.2, 0.24);
  cyanStoreEave.position.set(store.center[0], store.height - 0.02, store.frontZ + 0.22);
  cyanStoreEave.lookAt(store.center[0], 0.5, store.frontZ + 2.8);
  group.add(cyanStoreEave);
  cyanAreaLights.push(cyanStoreEave);

  // =========================================================================
  // 4. STOREFRONT GOLDEN INTERIOR SPILL (Window Area + Bollard Shadow Spot)
  // =========================================================================

  // Broad golden RectAreaLight spanning the glowing storefront picture windows (+Z)
  const storeWindowArea = new THREE.RectAreaLight('#FFAF46', 7.2, 6.4, 2.05);
  storeWindowArea.position.set(store.center[0] - 0.15, 1.85, store.frontZ + 0.14);
  storeWindowArea.lookAt(store.center[0] - 0.15, 0.35, store.frontZ + 4.8);
  group.add(storeWindowArea);

  // Shadow-casting warm golden spill SpotLight pushing interior light across the sidewalk,
  // casting authentic forward shadows from the 3 yellow bollards & trash bin onto the apron!
  const storeSpillSpot = new THREE.SpotLight('#FFB24A', L.storeGlow.intensity, L.storeGlow.distance, 1.15, 0.78, 2);
  storeSpillSpot.position.set(store.center[0] - 0.2, 2.55, store.frontZ - 0.25);
  storeSpillSpot.target.position.set(store.center[0] - 0.4, 0.0, store.frontZ + 3.2);
  storeSpillSpot.castShadow = true;
  storeSpillSpot.shadow.mapSize.set(1024, 1024);
  storeSpillSpot.shadow.camera.near = 0.4;
  storeSpillSpot.shadow.camera.far = 15.5;
  storeSpillSpot.shadow.bias = -0.00035;
  storeSpillSpot.shadow.normalBias = 0.02;
  storeSpillSpot.shadow.radius = 2.4;
  group.add(storeSpillSpot);
  group.add(storeSpillSpot.target);

  // =========================================================================
  // 5. ROOFTOP NEON SIGN ("Desert / GAS & GO" + Star) CRIMSON-AMBER GLOW
  //    Positioned slightly below/forward of the marquee so it washes posts &
  //    roof parapet cleanly with ZERO center hot-spot on the "Desert" lettering!
  // =========================================================================
  const signBounce = new THREE.PointLight('#FF5238', 7.8, 8.5, 2);
  signBounce.position.set(sign.position[0] - 0.2, sign.position[1] + 0.32, sign.position[2] + 1.15);
  group.add(signBounce);

  scene.add(group);

  // Rose-violet atmospheric distance haze blending desert floor seamlessly into foothills
  scene.fog = new THREE.FogExp2('#6E3E68', 0.002);

  function applyEnvMap(envMap) {
    if (!envMap) return;
    scene.environment = envMap;
    scene.environmentIntensity = 0.88;
  }

  // Prevent redundant local canopy point lights from double-counting or creating fascia glare dots
  function harmonizeWithStation(stationLights) {
    if (!stationLights) return;
    if (Array.isArray(stationLights.canopy)) {
      for (const l of stationLights.canopy) {
        if (l.isPointLight) l.intensity = Math.min(l.intensity, 2.0);
      }
    }
    if (Array.isArray(stationLights.neon)) {
      for (const l of stationLights.neon) {
        if (l.isPointLight) l.intensity = 0;
      }
    }
  }

  const baseCyanIntensities = cyanAreaLights.map((l) => l.intensity);
  const baseSignIntensity = signBounce.intensity;

  function update(t, _dt, opts = {}) {
    if (!opts.livingWorld) {
      cyanAreaLights.forEach((l, i) => {
        l.intensity = baseCyanIntensities[i];
      });
      signBounce.intensity = baseSignIntensity;
      return;
    }

    // Subtle organic neon transformer hum in Living World mode
    const hum = 1.0 + Math.sin(t * 2.3) * 0.028 + Math.sin(t * 17.0) * 0.01;
    cyanAreaLights.forEach((l, i) => {
      l.intensity = baseCyanIntensities[i] * hum;
    });

    // Rare organic neon micro-flicker pulse on rooftop sign bounce
    const pulse = Math.sin(t * 1.7 + 0.8) * Math.sin(t * 6.3);
    const flicker = pulse > 0.92 ? 0.72 : 1.0 + Math.sin(t * 3.1) * 0.03;
    signBounce.intensity = baseSignIntensity * flicker;
  }

  return {
    group,
    lights: {
      sunsetKey,
      twilightFillDir,
      hemiLight,
      canopyAreaLight,
      canopySpots,
      apronBounce,
      cyanAreaLights,
      storeWindowArea,
      storeSpillSpot,
      signBounce,
    },
    applyEnvMap,
    harmonizeWithStation,
    update,
  };
}
