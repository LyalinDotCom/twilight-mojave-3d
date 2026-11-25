import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createLighting } from './lighting.js';
import { createPostFX } from './postfx.js';
import { createCameraRig } from './cameraRig.js';
import { createLowPolyScene } from './lowPolyScene.js';
import { createUI, updateSplitOverlay } from './ui.js';
import { createWorld } from './world/index.js';
import { createVan } from './van/index.js';
import { createStation } from './station/index.js';

const runtimeErrors = [];
window.addEventListener('error', (ev) => {
  runtimeErrors.push(ev.message || String(ev.error || 'Unknown error'));
});
window.addEventListener('unhandledrejection', (ev) => {
  runtimeErrors.push(String(ev.reason || 'Unhandled promise rejection'));
});

function parseQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const rawMode = (params.get('mode') || 'hero').toLowerCase();
  const mode = rawMode === 'split' ? 'split' : rawMode === 'portrait' ? 'portrait' : rawMode === 'widescreen' ? 'widescreen' : 'hero';
  const preset = params.get('preset') || (mode === 'widescreen' ? 'widescreen' : 'hero');
  const tParam = params.get('t');
  const seekTime = tParam !== null && tParam !== '' && !Number.isNaN(Number(tParam)) ? Number(tParam) : null;
  const hudParam = params.get('hud');
  const hudVisible = hudParam === null ? true : hudParam !== '0' && hudParam !== 'false';
  const livingParam = params.get('living');
  const livingWorld = livingParam === '1' || livingParam === 'true';

  return { mode, preset, seekTime, hudVisible, livingWorld };
}

async function loadTextures(config, renderer) {
  const loader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const entries = Object.entries(config.assets.textures);
  const result = {};

  await Promise.all(
    entries.map(
      ([key, spec]) =>
        new Promise((resolve) => {
          loader.load(
            spec.url,
            (tex) => {
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              if (spec.repeat) {
                tex.repeat.set(spec.repeat[0], spec.repeat[1]);
              }
              tex.colorSpace = spec.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
              tex.anisotropy = maxAniso;
              tex.needsUpdate = true;
              result[key] = tex;
              resolve();
            },
            undefined,
            () => {
              result[key] = null;
              resolve();
            }
          );
        })
    )
  );

  return result;
}

async function bootstrap() {
  const canvas = document.getElementById('webgl-canvas');
  const query = parseQueryParams();

  // 1. Renderer setup
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.lighting.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // 2. Main Photoreal Scene & Camera Rig
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.palette.skyZenith);

  const cameraRig = createCameraRig({ canvas, config: CONFIG });

  // 3. Load shared PBR textures (with graceful fallback to null)
  const textures = await loadTextures(CONFIG, renderer);

  // 4. Master Lighting Rig
  const lighting = createLighting({ scene, config: CONFIG });

  // 5. Build World (Sky, Mountains, Desert Ground + Pebbles, Creosote Foliage)
  const world = createWorld({ scene, renderer, config: CONFIG, textures });
  if (world?.group && !world.group.parent) {
    scene.add(world.group);
  }

  // Bake procedural sky dome into PMREM IBL reflections
  if (typeof world?.bakeEnvMap === 'function') {
    const envMap = world.bakeEnvMap(renderer);
    lighting.applyEnvMap(envMap);
  }

  // 6. Build Hero VW T3 Van
  const van = createVan({ config: CONFIG, textures });
  if (van?.group) {
    scene.add(van.group);
  }

  // 7. Build Retro Gas Station (Canopy, 3 Pumps, Store w/ 3D Interior, Desert GAS & GO Neon Sign)
  const station = createStation({ config: CONFIG, textures });
  if (station?.group) {
    scene.add(station.group);
  }
  if (station?.lights) {
    lighting.harmonizeWithStation(station.lights);
  }

  // 8. Build Synchronized Low-Poly "Before" Scene for Split-Screen Benchmark Mode
  const lowPoly = createLowPolyScene(CONFIG);

  // 9. HDR Post-Processing Stack
  const postfx = createPostFX({
    renderer,
    scene,
    camera: cameraRig.camera,
    config: CONFIG,
  });

  // 10. App State & Layout
  const appState = {
    mode: query.mode,
    preset: query.preset,
    autoCamera: query.seekTime === null && query.preset === 'hero',
    livingWorld: query.livingWorld,
    hudVisible: query.hudVisible,
    deterministic: query.seekTime !== null,
    ready: false,
    fps: 60,
    splitLayout: null,
  };

  let ui = null;

  function applyViewportLayout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);

    if (appState.mode === 'split') {
      const layout = updateSplitOverlay(w, h);
      appState.splitLayout = layout;
      const panelAspect = layout.rightRect.w / Math.max(1, layout.rightRect.h);
      cameraRig.setViewportAspect(panelAspect);
      postfx.setSize(layout.rightRect.w, layout.rightRect.h, pr);
    } else {
      appState.splitLayout = null;
      cameraRig.setViewportAspect(w / Math.max(1, h));
      postfx.setSize(w, h, pr);
    }
  }

  function setMode(nextMode) {
    const normalized =
      nextMode === 'split'
        ? 'split'
        : nextMode === 'portrait'
          ? 'portrait'
          : nextMode === 'widescreen'
            ? 'widescreen'
            : 'hero';
    appState.mode = normalized;
    document.body.classList.toggle('mode-split', normalized === 'split');
    applyViewportLayout();
    if (ui) ui.sync();
  }

  function setPreset(name, instant = false) {
    if (!CONFIG.camera.presets[name]) return false;
    appState.preset = name;
    appState.deterministic = false;
    cameraRig.setPreset(name, { instant });
    appState.autoCamera = cameraRig.state.autoPlay;
    if (ui) ui.sync();
    return true;
  }

  function setAutoCamera(enabled) {
    appState.autoCamera = Boolean(enabled);
    if (appState.autoCamera) {
      appState.deterministic = false;
      appState.preset = 'hero';
    }
    cameraRig.setAutoPlay(appState.autoCamera);
    if (ui) ui.sync();
  }

  function setLivingWorld(enabled) {
    appState.livingWorld = Boolean(enabled);
    if (ui) ui.sync();
  }

  function setHudVisible(visible) {
    appState.hudVisible = Boolean(visible);
    document.body.classList.toggle('hud-hidden', !appState.hudVisible);
    if (ui) ui.sync();
  }

  function setTime(seconds) {
    appState.deterministic = true;
    appState.autoCamera = false;
    appState.preset = 'hero';
    cameraRig.seekTime(seconds);
    if (ui) ui.sync();
  }

  // Sync UI if user drags OrbitControls
  cameraRig.onUserInteract(() => {
    appState.autoCamera = false;
    appState.deterministic = false;
    if (ui) ui.sync();
  });

  // 11. Floating Glass HUD & Keyboard Controls
  ui = createUI({
    config: CONFIG,
    state: appState,
    callbacks: {
      setMode,
      setPreset: (name) => setPreset(name, false),
      setAutoCamera,
      setLivingWorld,
      setHudVisible,
    },
  });

  // Apply initial query params cleanly
  applyViewportLayout();
  if (query.seekTime !== null) {
    setTime(query.seekTime);
  } else if (query.preset && query.preset !== 'hero') {
    setPreset(query.preset, true);
  } else {
    setAutoCamera(true);
  }
  setHudVisible(query.hudVisible);

  window.addEventListener('resize', applyViewportLayout);

  // 12. Render Loop
  let lastNow = performance.now();
  let elapsed = query.seekTime !== null ? query.seekTime : 0;
  let fpsFrames = 0;
  let fpsAccum = 0;

  function renderFrame() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (appState.mode === 'split' && appState.splitLayout) {
      const { leftRect: L, rightRect: R } = appState.splitLayout;

      // 1) Render photoreal scene with full HDR + Bloom + ACES + 35mm Grade into offscreen texture
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = CONFIG.lighting.exposure;
      renderer.setScissorTest(false);
      const photorealTex = postfx.renderToTexture(elapsed, appState.deterministic);

      // 2) Draw white card background + Left (Low-Poly) + Right (Photoreal) onto canvas
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, w, h);
      renderer.setScissorTest(false);
      renderer.setClearColor(0xffffff, 1);
      renderer.clear(true, true, true);

      renderer.setScissorTest(true);

      // Left Panel: Un-graded low-poly flat-shaded scene (exact same camera!)
      const leftBottomY = h - L.y - L.h;
      renderer.setViewport(L.x, leftBottomY, L.w, L.h);
      renderer.setScissor(L.x, leftBottomY, L.w, L.h);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.render(lowPoly.scene, cameraRig.camera);

      // Right Panel: 1:1 blit of post-processed photoreal render
      const rightBottomY = h - R.y - R.h;
      renderer.setViewport(R.x, rightBottomY, R.w, R.h);
      renderer.setScissor(R.x, rightBottomY, R.w, R.h);
      postfx.blitTexture(photorealTex);

      renderer.setScissorTest(false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    } else {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = CONFIG.lighting.exposure;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      postfx.render(elapsed, appState.deterministic);
    }
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now;

    if (!appState.deterministic) {
      elapsed += dt;
    }

    const opts = { livingWorld: appState.livingWorld };
    cameraRig.update(dt);
    lighting.update(elapsed, dt, opts);
    if (typeof world?.update === 'function') world.update(elapsed, dt, opts);
    if (typeof van?.update === 'function') van.update(elapsed, dt, opts);
    if (typeof station?.update === 'function') station.update(elapsed, dt, opts);

    renderFrame();

    // Update rolling FPS readout
    fpsFrames++;
    fpsAccum += dt;
    if (fpsAccum >= 0.4) {
      appState.fps = fpsFrames / fpsAccum;
      ui.updateFps(appState.fps);
      fpsFrames = 0;
      fpsAccum = 0;
    }
  }

  // Expose deterministic QA & Art-Direction Debug Hook for @critic
  window.__SCENE_DEBUG__ = {
    setTime(t) {
      setTime(t);
      renderFrame();
    },
    setMode(mode) {
      setMode(mode);
      renderFrame();
    },
    setPreset(name) {
      const ok = setPreset(name, true);
      renderFrame();
      return ok;
    },
    setHud(visible) {
      setHudVisible(visible);
    },
    setLivingWorld(on) {
      setLivingWorld(on);
    },
    setAutoCamera(on) {
      setAutoCamera(on);
    },
    getState() {
      return {
        mode: appState.mode,
        preset: appState.preset,
        autoCamera: appState.autoCamera,
        livingWorld: appState.livingWorld,
        hudVisible: appState.hudVisible,
        trackTime: cameraRig.state.trackTime,
        frozenTime: cameraRig.state.frozenTime,
        cameraPos: cameraRig.camera.position.toArray(),
        cameraTarget: cameraRig.controls.target.toArray(),
        cameraFov: cameraRig.camera.fov,
      };
    },
    getStats() {
      return {
        ready: appState.ready,
        fps: Math.round(appState.fps * 10) / 10,
        webgl2: renderer.capabilities.isWebGL2,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        texturesLoaded: Object.values(textures).filter(Boolean).length,
        texturesTotal: Object.keys(textures).length,
        errors: [...runtimeErrors],
      };
    },
    // Internal handles for live inspection
    scene,
    camera: cameraRig.camera,
    renderer,
    lighting,
    postfx,
  };

  // Render initial frame synchronously before marking ready
  const initOpts = { livingWorld: appState.livingWorld };
  cameraRig.update(0);
  lighting.update(elapsed, 0, initOpts);
  if (typeof world?.update === 'function') world.update(elapsed, 0, initOpts);
  if (typeof van?.update === 'function') van.update(elapsed, 0, initOpts);
  if (typeof station?.update === 'function') station.update(elapsed, 0, initOpts);
  renderFrame();
  appState.ready = true;

  requestAnimationFrame(animate);
}

bootstrap().catch((err) => {
  runtimeErrors.push(err?.message || String(err));
  console.error('Bootstrap error:', err);
});
