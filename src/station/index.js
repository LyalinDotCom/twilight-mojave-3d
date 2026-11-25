import * as THREE from 'three';
import { createCanopy } from './canopy.js';
import { createPumps } from './pumps.js';
import { createStore } from './store.js';
import { createSignage } from './signage.js';

/**
 * Entry point for the Twilight Mojave Retro Desert Gas Station ("Desert / GAS & GO").
 * Matches @architect's src/config.js contract:
 *   createStation({ config, textures }) -> { group, lights, update(t, dt, opts) }
 */
export function createStation({ config, textures = {} }) {
  const group = new THREE.Group();
  group.name = 'DesertGasStation';

  const canopy = createCanopy({ config, textures });
  const pumps = createPumps({ config, textures });
  const store = createStore({ config, textures });
  const signage = createSignage({ config, textures });

  group.add(canopy.group);
  group.add(pumps.group);
  group.add(store.group);
  group.add(signage.group);

  // Authoritative shadow audit across all station architecture, pumps, store interior & props:
  // Every solid mesh casts & receives crisp 3D shadows; transparent glass panes & emissive neon/lamp
  // tubes skip castShadow so light passes cleanly through windows and fixtures never self-shadow!
  group.traverse((obj) => {
    if (!obj.isMesh && !obj.isInstancedMesh) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const isTransparent = Boolean(mat?.transparent);
    const isPureEmitter = Boolean(obj.userData?.noShadowCast) || (mat?.emissiveIntensity ?? 0) >= 1.5;

    if (isTransparent || isPureEmitter) {
      obj.castShadow = false;
      obj.receiveShadow = !isTransparent && !obj.userData?.noShadowCast;
    } else {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  const lights = {
    canopy: canopy.lights?.canopy || [],
    neon: canopy.lights?.neon || [],
    store: store.lights?.store || [],
    storeInterior: store.lights?.storeInterior || [],
    pumps: pumps.lights?.pumps || [],
    sign: signage.lights?.sign || [],
  };

  function update(t, dt, opts = {}) {
    canopy.update(t, dt, opts);
    pumps.update(t, dt, opts);
    store.update(t, dt, opts);
    signage.update(t, dt, opts);
  }

  return {
    group,
    lights,
    update,
  };
}

export default createStation;
