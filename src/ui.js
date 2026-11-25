/**
 * Minimal Floating Glass HUD, Split-Screen Benchmark Card Frame,
 * Keyboard Shortcuts, and Lo-Fi Twilight Audio Player (MP3 + Web Audio fallback).
 */

function createProceduralLofiAudio() {
  let ctx = null;
  let masterGain = null;
  let timerId = null;
  let step = 0;
  let playing = false;

  // 4-bar twilight Rhodes progression: Fmaj9 -> Em7 -> Dm9 -> Cmaj9 (82 BPM)
  const chords = [
    [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
    [164.81, 196.0, 246.94, 293.66, 392.0], // Em7
    [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
    [130.81, 164.81, 196.0, 246.94, 293.66], // Cmaj9
  ];
  const bassNotes = [87.31, 82.41, 73.42, 65.41];

  function playRhodesChord(freqs, time, dur) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1450, time);
    filter.frequency.exponentialRampToValueAtTime(720, time + dur);
    filter.connect(masterGain);

    for (const f of freqs) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, time);
        osc.detune.setValueAtTime(detune, time);

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(0.032, time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.012, time + dur * 0.65);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(time);
        osc.stop(time + dur + 0.05);
      }
    }
  }

  function playBass(freq, time, dur) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function playKick(time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  function playRim(time) {
    const bufSize = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.065, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(masterGain);
    src.start(time);
  }

  function tick() {
    if (!playing || !ctx) return;
    const now = ctx.currentTime + 0.02;
    const beatSec = 60 / 82;
    const barStep = step % 8; // eighth notes
    const barIdx = Math.floor(step / 8) % chords.length;

    if (barStep === 0) {
      playRhodesChord(chords[barIdx], now, beatSec * 3.85);
      playBass(bassNotes[barIdx], now, beatSec * 3.6);
    }
    if (barStep === 0 || barStep === 5) playKick(now);
    if (barStep === 2 || barStep === 6) playRim(now);

    step++;
  }

  return {
    start() {
      if (playing) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!ctx) {
        ctx = new AudioCtx();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.55;
        masterGain.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      playing = true;
      tick();
      const eighthMs = (60 / 82 / 2) * 1000;
      timerId = window.setInterval(tick, eighthMs);
    },
    stop() {
      playing = false;
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    },
  };
}

export function createAudioController(audioUrl) {
  let enabled = false;
  let audioEl = null;
  let useFallback = false;
  const synth = createProceduralLofiAudio();

  async function start() {
    if (enabled) return;
    enabled = true;
    if (!useFallback && audioUrl) {
      try {
        if (!audioEl) {
          audioEl = new Audio(audioUrl);
          audioEl.loop = true;
          audioEl.volume = 0.45;
          audioEl.crossOrigin = 'anonymous';
        }
        await audioEl.play();
        return;
      } catch {
        useFallback = true;
      }
    }
    synth.start();
  }

  function stop() {
    enabled = false;
    if (audioEl) {
      audioEl.pause();
    }
    synth.stop();
  }

  async function toggle() {
    if (enabled) stop();
    else await start();
    return enabled;
  }

  return {
    start,
    stop,
    toggle,
    isEnabled: () => enabled,
  };
}

/**
 * Computes pixel layout for the dual 9:16 rounded white-framed Split-Screen Benchmark Card
 * matching the iconic composition of tFeMuURbfQRLZsSf.mp4.
 */
export function computeSplitLayout(viewportW, viewportH) {
  const aspect = 9 / 16;
  const topLabelBand = Math.max(46, Math.min(82, Math.round(viewportH * 0.085)));
  const bottomPad = Math.max(22, Math.min(48, Math.round(viewportH * 0.035)));
  const sidePad = Math.max(20, Math.min(48, Math.round(viewportW * 0.025)));
  const gutter = Math.max(12, Math.min(26, Math.round(viewportW * 0.014)));

  const availH = Math.max(120, viewportH - topLabelBand - bottomPad);
  const availW = Math.max(180, viewportW - sidePad * 2 - gutter);

  let panelH = availH;
  let panelW = Math.round(panelH * aspect);
  if (panelW * 2 > availW) {
    panelW = Math.floor(availW / 2);
    panelH = Math.round(panelW / aspect);
  }

  const totalW = panelW * 2 + gutter;
  const totalH = panelH + topLabelBand;
  const startX = Math.round((viewportW - totalW) / 2);
  const startY = Math.max(topLabelBand, Math.round((viewportH - totalH) / 2) + topLabelBand);
  const radius = Math.max(12, Math.round(panelW * 0.034));

  return {
    leftRect: { x: startX, y: startY, w: panelW, h: panelH },
    rightRect: { x: startX + panelW + gutter, y: startY, w: panelW, h: panelH },
    radius,
    labelY: Math.max(10, startY - Math.round(topLabelBand * 0.62)),
    fontSize: Math.max(16, Math.min(34, Math.round(panelW * 0.056))),
  };
}

export function updateSplitOverlay(viewportW, viewportH) {
  const layout = computeSplitLayout(viewportW, viewportH);
  const svg = document.getElementById('split-frame');
  const labelLeft = document.getElementById('split-label-left');
  const labelRight = document.getElementById('split-label-right');

  if (svg) {
    const { leftRect: L, rightRect: R, radius } = layout;
    svg.setAttribute('viewBox', `0 0 ${viewportW} ${viewportH}`);
    svg.setAttribute('width', String(viewportW));
    svg.setAttribute('height', String(viewportH));
    svg.innerHTML = `
      <defs>
        <mask id="split-cutout">
          <rect x="0" y="0" width="${viewportW}" height="${viewportH}" fill="white" />
          <rect x="${L.x}" y="${L.y}" width="${L.w}" height="${L.h}" rx="${radius}" ry="${radius}" fill="black" />
          <rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" rx="${radius}" ry="${radius}" fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="${viewportW}" height="${viewportH}" fill="#ffffff" mask="url(#split-cutout)" />
    `;
  }

  if (labelLeft && labelRight) {
    const { leftRect: L, rightRect: R, labelY, fontSize } = layout;
    labelLeft.style.left = `${L.x + L.w / 2}px`;
    labelLeft.style.top = `${labelY}px`;
    labelLeft.style.fontSize = `${fontSize}px`;

    labelRight.style.left = `${R.x + R.w / 2}px`;
    labelRight.style.top = `${labelY}px`;
    labelRight.style.fontSize = `${fontSize}px`;
  }

  return layout;
}

export function createUI({ config, state, callbacks }) {
  const hud = document.getElementById('hud');
  const audio = createAudioController(config.assets.audio.lofiLoop);

  const presetKeys = Object.keys(config.camera.presets);

  hud.innerHTML = `
    <div class="hud-top-left">
      <div class="glass-pill">
        <span class="hud-badge">MOJAVE DUSK</span>
        <span class="hud-sep"></span>
        <span>Real-Time Three.js</span>
      </div>
      <div class="glass-pill" id="fps-pill">
        <span class="fps-dot"></span>
        <span id="fps-value">60 FPS</span>
      </div>
    </div>

    <div class="hud-top-right">
      <button class="glass-pill" id="btn-split" title="Toggle Split-Screen Benchmark (C)">Split Compare</button>
      <button class="glass-pill" id="btn-auto" title="Play/Pause 11s Camera Sweep (Space)">Auto-Cam</button>
      <button class="glass-pill" id="btn-living" title="Toggle Subtle Living World Motion (L)">Living World</button>
      <button class="glass-pill" id="btn-audio" title="Toggle Lo-Fi Twilight Audio (M)">Sound: Off</button>
    </div>

    <div class="hud-bottom">
      <div class="preset-group" id="preset-group">
        ${presetKeys
          .map(
            (key, idx) =>
              `<button class="preset-btn" data-preset="${key}" title="Camera Preset ${idx + 1}">${config.camera.presets[key].label}</button>`
          )
          .join('')}
      </div>
      <div class="glass-pill hint-text">Drag to Orbit · Scroll to Zoom · C Split · Space Track · H Hide HUD</div>
    </div>
  `;

  const btnSplit = document.getElementById('btn-split');
  const btnAuto = document.getElementById('btn-auto');
  const btnLiving = document.getElementById('btn-living');
  const btnAudio = document.getElementById('btn-audio');
  const fpsVal = document.getElementById('fps-value');
  const presetBtns = Array.from(hud.querySelectorAll('.preset-btn'));

  function sync() {
    btnSplit.classList.toggle('active', state.mode === 'split');
    btnSplit.textContent = state.mode === 'split' ? 'Split: On' : 'Split Compare';

    btnAuto.classList.toggle('active', state.autoCamera);
    btnAuto.textContent = state.autoCamera ? 'Auto-Cam: On' : 'Auto-Cam: Off';

    btnLiving.classList.toggle('active', state.livingWorld);
    btnLiving.textContent = state.livingWorld ? 'Living: On' : 'Living: Off';

    const audioOn = audio.isEnabled();
    btnAudio.classList.toggle('active', audioOn);
    btnAudio.textContent = audioOn ? 'Sound: On' : 'Sound: Off';

    for (const b of presetBtns) {
      b.classList.toggle('active', b.dataset.preset === state.preset);
    }

    document.body.classList.toggle('mode-split', state.mode === 'split');
    document.body.classList.toggle('hud-hidden', !state.hudVisible);
  }

  btnSplit.addEventListener('click', () => {
    callbacks.setMode(state.mode === 'split' ? 'hero' : 'split');
    sync();
  });

  btnAuto.addEventListener('click', () => {
    callbacks.setAutoCamera(!state.autoCamera);
    sync();
  });

  btnLiving.addEventListener('click', () => {
    callbacks.setLivingWorld(!state.livingWorld);
    sync();
  });

  btnAudio.addEventListener('click', async () => {
    await audio.toggle();
    sync();
  });

  for (const b of presetBtns) {
    b.addEventListener('click', () => {
      callbacks.setPreset(b.dataset.preset);
      sync();
    });
  }

  window.addEventListener('keydown', async (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      callbacks.setAutoCamera(!state.autoCamera);
      sync();
    } else if (e.key === 'c' || e.key === 'C') {
      callbacks.setMode(state.mode === 'split' ? 'hero' : 'split');
      sync();
    } else if (e.key === 'l' || e.key === 'L') {
      callbacks.setLivingWorld(!state.livingWorld);
      sync();
    } else if (e.key === 'm' || e.key === 'M') {
      await audio.toggle();
      sync();
    } else if (e.key === 'h' || e.key === 'H') {
      callbacks.setHudVisible(!state.hudVisible);
      sync();
    } else if (e.key >= '1' && e.key <= '9') {
      const idx = Number(e.key) - 1;
      if (presetKeys[idx]) {
        callbacks.setPreset(presetKeys[idx]);
        sync();
      }
    }
  });

  function updateFps(fps) {
    if (fpsVal) fpsVal.textContent = `${Math.round(fps)} FPS`;
  }

  sync();

  return {
    sync,
    updateFps,
    audio,
  };
}
