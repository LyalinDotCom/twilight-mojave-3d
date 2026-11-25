import * as THREE from 'three';
import { createSky } from './sky.js';
import { createMountains } from './mountains.js';
import { createTerrain } from './terrain.js';
import { createFoliage } from './foliage.js';

/**
 * Assembles the complete Twilight Mojave world environment:
 * - Procedural GLSL twilight sky dome with backlit cirrus clouds & PMREM IBL baker
 * - Two-layer eroded Mojave mountain massif + shimmering distant valley highway lights
 * - Displaced Mojave hardpan, bevelled concrete forecourt apron, pump island & 32,000 instanced pebbles
 * - Recursive 3D branching woody creosote bushes, sagebrush mounds & backlit dry foreground twigs
 */
export function createWorld({ scene, renderer, config, textures }) {
  const group = new THREE.Group();
  group.name = 'TwilightMojaveWorld';

  const sky = createSky({ config });
  group.add(sky.mesh);

  const mountains = createMountains({ config, textures });
  group.add(mountains.group);

  const terrain = createTerrain({ config, textures });
  group.add(terrain.group);

  const foliage = createFoliage({ config, textures });
  group.add(foliage.group);

  if (scene) {
    scene.add(group);
  }

  function update(t, dt, opts = {}) {
    sky.update(t, dt, opts);
    mountains.update(t, dt, opts);
    foliage.update(t, dt, opts);
  }

  function bakeEnvMap(targetRenderer = renderer) {
    if (!targetRenderer) return null;
    return sky.bakeEnvMap(targetRenderer);
  }

  return {
    group,
    skyMesh: sky.mesh,
    update,
    bakeEnvMap,
  };
}
