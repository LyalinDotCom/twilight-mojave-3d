import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * 35mm Twilight Cinema Finish Shader:
 * - Micro lateral chromatic aberration at screen corners (lens optics)
 * - Subtle twilight contrast & warm-highlight / plum-shadow micro-grade
 * - Optical lens vignette
 * - Ultra-fine animated 35mm film grain
 */
const TwilightFilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.16 },
    uGrain: { value: 0.014 },
    uChromaticAberration: { value: 0.0005 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChromaticAberration;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);

      // Corner-weighted subtle chromatic aberration
      vec2 caOffset = centered * r2 * uChromaticAberration * 4.0;
      float r = texture2D(tDiffuse, clamp(vUv + caOffset, 0.0, 1.0)).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, clamp(vUv - caOffset, 0.0, 1.0)).b;
      vec3 col = vec3(r, g, b);

      // Subtle twilight filmic split-tone: rich dusk plum in deep shadows, coral warmth in highs
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.022, 0.004, 0.032) * (1.0 - smoothstep(0.0, 0.45, luma));
      vec3 highTint = vec3(0.014, 0.004, -0.006) * smoothstep(0.55, 1.0, luma);
      col = clamp(col + shadowTint + highTint, 0.0, 1.0);

      // Gentle optical vignette
      float vig = 1.0 - r2 * uVignette * 2.15;
      col *= clamp(vig, 0.65, 1.0);

      // Ultra-fine 35mm film grain (luma-attenuated so shadows stay clean)
      float grainSeed = hash12(gl_FragCoord.xy + fract(uTime * 17.31) * 100.0) - 0.5;
      float grainWeight = mix(0.65, 1.0, smoothstep(0.05, 0.6, luma));
      col += grainSeed * uGrain * grainWeight;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

/**
 * High-performance 60 FPS HDR HalfFloat multisampled EffectComposer:
 * - Zero redundant full-scene G-buffer pass (relies on 5 baked crisp shadow maps + vertex/contact AO)
 * - Half-resolution selective UnrealBloomPass (4× faster Gaussian mip chain, identical optical halation)
 * - ACES Filmic OutputPass + lightweight 35mm twilight lens finishing
 */
export function createPostFX({ renderer, scene, camera, config }) {
  const P = config.postfx;
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const pixelRatio = renderer.getPixelRatio();
  const rtWidth = Math.max(1, Math.floor(size.x * pixelRatio));
  const rtHeight = Math.max(1, Math.floor(size.y * pixelRatio));

  const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
    type: THREE.HalfFloatType,
    samples: renderer.capabilities.isWebGL2 ? 2 : 0,
  });

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Run UnrealBloomPass at half resolution (4× faster with identical silky optical halation!)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(Math.max(1, Math.floor(size.x * 0.5)), Math.max(1, Math.floor(size.y * 0.5))),
    P.bloomStrength,
    P.bloomRadius,
    P.bloomThreshold
  );
  const origBloomSetSize = bloomPass.setSize.bind(bloomPass);
  bloomPass.setSize = (w, h) => {
    origBloomSetSize(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
  };
  bloomPass.setSize(rtWidth, rtHeight);
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const filmPass = new ShaderPass(TwilightFilmShader);
  filmPass.uniforms.uVignette.value = P.vignetteStrength;
  filmPass.uniforms.uGrain.value = P.grainAmount;
  filmPass.uniforms.uChromaticAberration.value = P.chromaticAberration;
  composer.addPass(filmPass);

  // 1:1 raw sRGB blit quad used in Split-Screen Mode to draw the post-processed
  // right-hand panel into its exact scissor/viewport rectangle without double-gamma.
  const blitScene = new THREE.Scene();
  const blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tDiffuse: { value: null },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(tDiffuse, vUv);
      }
    `,
  });
  const blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat);
  blitScene.add(blitQuad);

  let currentW = size.x;
  let currentH = size.y;
  let currentPR = pixelRatio;

  function setSize(width, height, pr = renderer.getPixelRatio()) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === currentW && h === currentH && pr === currentPR) return;
    currentW = w;
    currentH = h;
    currentPR = pr;
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloomPass.resolution.set(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
  }

  function render(t = 0, deterministic = false) {
    composer.renderToScreen = true;
    filmPass.uniforms.uTime.value = deterministic ? 0.42 : t;
    composer.render();
  }

  function renderToTexture(t = 0, deterministic = false) {
    composer.renderToScreen = false;
    filmPass.uniforms.uTime.value = deterministic ? 0.42 : t;
    composer.render();
    return composer.readBuffer.texture;
  }

  function blitTexture(tex) {
    blitMat.uniforms.tDiffuse.value = tex;
    renderer.render(blitScene, blitCamera);
  }

  function setBloom({ threshold, strength, radius } = {}) {
    if (threshold !== undefined) bloomPass.threshold = threshold;
    if (strength !== undefined) bloomPass.strength = strength;
    if (radius !== undefined) bloomPass.radius = radius;
  }

  function dispose() {
    renderTarget.dispose();
    bloomPass.dispose();
    blitQuad.geometry.dispose();
    blitMat.dispose();
    composer.dispose();
  }

  return {
    composer,
    renderPass,
    bloomPass,
    outputPass,
    filmPass,
    setSize,
    render,
    renderToTexture,
    blitTexture,
    setBloom,
    dispose,
  };
}
