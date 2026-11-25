import { CONFIG } from '../config.js';
import { buildHeroVan } from './van.js';

/**
 * Creates the Hero 1980s VW T3 Vanagon Camper positioned and oriented per `config.van`.
 * Contract: `createVan({ config, textures }) -> { group, headlightTargets, lights, update(t, dt, opts) }`
 */
export function createVan({ config = CONFIG, textures = {} } = {}) {
  const vanCfg = config?.van || CONFIG.van;
  const built = buildHeroVan({ config, textures });
  const {
    group,
    headlightTargets,
    headlightMat,
    headlightLights,
    headlightCones,
    turnSignalLights,
    tailLight,
  } = built;

  // Position tires cleanly on top of concrete apron (local tire bottom = 0.0 -> world Y = 0.025)
  if (Array.isArray(vanCfg.position)) {
    group.position.set(vanCfg.position[0], vanCfg.position[1], vanCfg.position[2]);
  }
  if (typeof vanCfg.rotationY === 'number') {
    group.rotation.y = vanCfg.rotationY;
  }

  const baseEmissive = headlightMat.emissiveIntensity;
  const baseLightIntensities = headlightLights.map((l) => l.intensity);
  const baseConeOpacities = headlightCones.map((c) => c.material.uniforms.uOpacity.value);

  function update(t, _dt, opts = {}) {
    if (!opts.livingWorld) {
      headlightMat.emissiveIntensity = baseEmissive;
      headlightLights.forEach((l, i) => {
        l.intensity = baseLightIntensities[i];
      });
      headlightCones.forEach((c, i) => {
        c.material.uniforms.uOpacity.value = baseConeOpacities[i];
      });
      return;
    }

    // Subtle vintage 12V alternator warm micro-shimmer when Living World is active
    const shimmer = 1.0 + Math.sin(t * 14.5) * 0.015 + Math.sin(t * 3.7) * 0.012;
    headlightMat.emissiveIntensity = baseEmissive * shimmer;
    headlightLights.forEach((l, i) => {
      l.intensity = baseLightIntensities[i] * shimmer;
    });
    headlightCones.forEach((c, i) => {
      c.material.uniforms.uOpacity.value = baseConeOpacities[i] * shimmer;
    });
  }

  return {
    group,
    headlightTargets,
    lights: {
      headlights: headlightLights,
      turnSignals: turnSignalLights,
      tailLight,
    },
    update,
  };
}

export default createVan;
