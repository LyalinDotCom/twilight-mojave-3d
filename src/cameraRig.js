import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Cinematic Camera Rig + Interactive OrbitControls.
 *
 * - Default auto-camera replays the exact 11s smooth leftward truck / gentle CCW orbit
 *   from tFeMuURbfQRLZsSf.mp4.
 * - Dragging or zooming seamlessly transfers control to OrbitControls.
 * - Presets smoothly interpolate (or snap instantaneously when seeked via debug/URL).
 * - Automatically selects Portrait vs. Landscape FOV based on active viewport aspect.
 */
export function createCameraRig({ canvas, config }) {
  const C = config.camera;
  const loopDuration = config.loopDuration;

  const camera = new THREE.PerspectiveCamera(
    C.fovLandscape,
    window.innerWidth / Math.max(1, window.innerHeight),
    C.near,
    C.far
  );

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = true;
  controls.minDistance = 2.4;
  controls.maxDistance = 68;
  controls.maxPolarAngle = Math.PI * 0.495; // Keep camera above ground
  controls.minPolarAngle = 0.08;

  const startPos = new THREE.Vector3(...C.trackStart.pos);
  const endPos = new THREE.Vector3(...C.trackEnd.pos);
  const startTarget = new THREE.Vector3(...C.trackStart.target);
  const endTarget = new THREE.Vector3(...C.trackEnd.target);

  const state = {
    autoPlay: true,
    frozenTime: null, // When set via ?t= or debug.setTime(), locks exact track timestamp
    trackTime: 0,
    activePreset: 'hero',
    transition: null,
    viewportAspect: window.innerWidth / Math.max(1, window.innerHeight),
  };

  let onUserInteractCb = null;

  // Seamless OrbitControls takeover when user grabs the viewport
  controls.addEventListener('start', () => {
    state.autoPlay = false;
    state.frozenTime = null;
    state.transition = null;
    if (onUserInteractCb) onUserInteractCb();
  });

  function computeTargetFov(presetKey, aspect) {
    const preset = C.presets[presetKey] || C.presets.hero;
    return aspect < 1.05 ? preset.fovPortrait : preset.fovLandscape;
  }

  function applyTrackAtTime(seconds) {
    // Exact constant-velocity 0 -> 11s sweep (wraps cleanly after 11s)
    const wrapped = ((seconds % loopDuration) + loopDuration) % loopDuration;
    const u = wrapped / loopDuration;

    camera.position.lerpVectors(startPos, endPos, u);
    controls.target.lerpVectors(startTarget, endTarget, u);
    camera.lookAt(controls.target);

    const targetFov = computeTargetFov('hero', state.viewportAspect);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }

  function setViewportAspect(aspect) {
    state.viewportAspect = Math.max(0.1, aspect);
    camera.aspect = state.viewportAspect;
    camera.fov = computeTargetFov(state.activePreset, state.viewportAspect);
    camera.updateProjectionMatrix();
  }

  function setPreset(presetKey, { instant = false } = {}) {
    const preset = C.presets[presetKey];
    if (!preset) return false;

    state.activePreset = presetKey;
    state.frozenTime = null;

    if (presetKey === 'hero' && !instant) {
      // Smoothly ease back into the hero track
      state.autoPlay = true;
      return true;
    }

    state.autoPlay = false;
    const dstPos = new THREE.Vector3(...preset.pos);
    const dstTarget = new THREE.Vector3(...preset.target);
    const dstFov = computeTargetFov(presetKey, state.viewportAspect);

    if (instant) {
      state.transition = null;
      camera.position.copy(dstPos);
      controls.target.copy(dstTarget);
      camera.fov = dstFov;
      camera.updateProjectionMatrix();
      controls.update();
    } else {
      state.transition = {
        elapsed: 0,
        duration: 0.95,
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        fromFov: camera.fov,
        toPos: dstPos,
        toTarget: dstTarget,
        toFov: dstFov,
      };
    }
    return true;
  }

  function setAutoPlay(enabled) {
    state.autoPlay = Boolean(enabled);
    if (state.autoPlay) {
      state.frozenTime = null;
      state.transition = null;
      state.activePreset = 'hero';
    }
  }

  function seekTime(seconds) {
    state.frozenTime = Number(seconds);
    state.trackTime = state.frozenTime;
    state.autoPlay = false;
    state.transition = null;
    state.activePreset = 'hero';
    applyTrackAtTime(state.frozenTime);
    controls.update();
  }

  function update(dt) {
    if (state.frozenTime !== null) {
      applyTrackAtTime(state.frozenTime);
      return;
    }

    if (state.transition) {
      const tr = state.transition;
      tr.elapsed += Math.min(dt, 0.1);
      const raw = Math.min(1, tr.elapsed / tr.duration);
      // Smooth cubic ease-out
      const ease = 1 - Math.pow(1 - raw, 3);
      camera.position.lerpVectors(tr.fromPos, tr.toPos, ease);
      controls.target.lerpVectors(tr.fromTarget, tr.toTarget, ease);
      camera.fov = THREE.MathUtils.lerp(tr.fromFov, tr.toFov, ease);
      camera.updateProjectionMatrix();
      controls.update();
      if (raw >= 1) state.transition = null;
      return;
    }

    if (state.autoPlay) {
      state.trackTime = (state.trackTime + dt) % loopDuration;
      applyTrackAtTime(state.trackTime);
    } else {
      controls.update();
    }
  }

  // Initialize at t=0
  applyTrackAtTime(0);

  return {
    camera,
    controls,
    state,
    setViewportAspect,
    setPreset,
    setAutoPlay,
    seekTime,
    update,
    onUserInteract(cb) {
      onUserInteractCb = cb;
    },
  };
}
