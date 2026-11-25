#!/usr/bin/env node
/**
 * Headless Chrome (Apple Metal WebGL2) QA & Screenshot Verification Harness
 * for the Twilight Mojave Desert Gas Station & Retro Van Showcase.
 *
 * Zero external npm dependencies (uses Node 24 native fetch + WebSocket + Chrome CDP).
 *
 * Usage:
 *   node scripts/verify_scene.mjs [--url http://localhost:5173] [--round v1] [--port 4177]
 */

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const VERIFY_DIR = join(ROOT, 'verification');
const REF_PORTRAIT = join(VERIFY_DIR, 'ref', 'ref_right_portrait_05s.png');
const REF_SPLIT = join(VERIFY_DIR, 'ref', 'ref_05s.png');

function parseArgs(argv) {
  const args = { url: null, round: null, port: 4177, usePreview: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) args.url = argv[++i];
    else if (argv[i] === '--round' && argv[i + 1]) args.round = argv[++i];
    else if (argv[i] === '--port' && argv[i + 1]) args.port = Number(argv[++i]);
    else if (argv[i] === '--preview') args.usePreview = true;
  }
  return args;
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error('Could not locate Chrome or Chromium binary');
}

async function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          if (msg.error) entry.reject(new Error(`${msg.error.message} (${msg.error.code})`));
          else entry.resolve(msg.result);
        }
      } else if (msg.method) {
        const cbs = this.listeners.get(msg.method);
        if (cbs) for (const cb of cbs) cb(msg.params);
      }
    });
  }

  on(method, cb) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(cb);
  }

  once(method, cb) {
    const wrapped = (params) => {
      const list = this.listeners.get(method);
      if (list) {
        const idx = list.indexOf(wrapped);
        if (idx !== -1) list.splice(idx, 1);
      }
      cb(params);
    };
    this.on(method, wrapped);
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function launchChromeCDP(debugPort) {
  const profileDir = mkdtempSync(join(tmpdir(), 'van-qa-chrome-'));
  const chromePath = findChrome();
  const proc = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1280,720',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stderr = '';
  proc.stderr.on('data', (d) => (stderr += d.toString()));

  let targets = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const list = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
      if (list.some((t) => t.type === 'page')) {
        targets = list;
        break;
      }
    } catch {}
  }
  if (!targets) {
    proc.kill('SIGKILL');
    rmSync(profileDir, { recursive: true, force: true });
    throw new Error(`Chrome CDP failed to start:\n${stderr}`);
  }

  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const cdp = new CDPClient(ws);
  return {
    cdp,
    cleanup: () => {
      try { cdp.close(); } catch {}
      try { proc.kill('SIGKILL'); } catch {}
      try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function waitForSceneReady(cdp, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await cdp.eval(`(() => {
      const dbg = window.__SCENE_DEBUG__;
      if (!dbg) return { hasDebug: false, hasCanvas: !!document.querySelector('canvas') };
      const stats = typeof dbg.getStats === 'function' ? dbg.getStats() : {};
      return { hasDebug: true, ready: stats.ready !== false, stats };
    })()`);
    if (status?.hasDebug && status?.ready) {
      // Wait 8 animation frames so textures, PMREM, shadows, and bloom settle
      await cdp.eval(`new Promise(r => {
        let n = 0;
        function step() { if (++n >= 8) r(true); else requestAnimationFrame(step); }
        requestAnimationFrame(step);
      })`);
      return status.stats;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timed out waiting for window.__SCENE_DEBUG__ ready');
}

async function captureView(cdp, baseUrl, shot) {
  const { name, width, height, query, afterLoad } = shot;
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const url = `${baseUrl}${query}`;
  const loadPromise = new Promise((resolve) => {
    const timer = setTimeout(resolve, 12000);
    cdp.once('Page.loadEventFired', () => {
      clearTimeout(timer);
      resolve();
    });
  });

  await cdp.send('Page.navigate', { url });
  await loadPromise;
  await waitForSceneReady(cdp);

  if (afterLoad) {
    await cdp.eval(afterLoad);
    await cdp.eval(`new Promise(r => {
      let n = 0;
      function step() { if (++n >= 6) r(true); else requestAnimationFrame(step); }
      requestAnimationFrame(step);
    })`);
  }

  // Brief settle pause
  await new Promise((r) => setTimeout(r, 250));

  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
  });
  const outPath = join(VERIFY_DIR, name);
  writeFileSync(outPath, Buffer.from(data, 'base64'));
  console.log(`Captured ${name} (${width}x${height})`);
  return outPath;
}

function buildComposites() {
  const render05 = join(VERIFY_DIR, 'render_portrait_05s.png');
  const render00 = join(VERIFY_DIR, 'render_portrait_00s.png');
  const render10 = join(VERIFY_DIR, 'render_portrait_10s.png');
  const renderSplit = join(VERIFY_DIR, 'render_split_screen.png');

  if (existsSync(REF_PORTRAIT) && existsSync(render05)) {
    const out = join(VERIFY_DIR, 'compare_ref_vs_render.png');
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i', REF_PORTRAIT,
        '-i', render05,
        '-filter_complex',
        '[0:v]scale=720:1280,pad=732:1280:0:0:white[l];' +
        '[1:v]scale=720:1280[r];' +
        '[l][r]hstack=inputs=2[out]',
        '-map', '[out]',
        out,
      ],
      { stdio: 'pipe' }
    );
    console.log('Built verification/compare_ref_vs_render.png');
  }

  if (existsSync(render00) && existsSync(render05) && existsSync(render10)) {
    const out = join(VERIFY_DIR, 'compare_parallax_strip.png');
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i', render00,
        '-i', render05,
        '-i', render10,
        '-filter_complex',
        '[0:v]scale=360:640,pad=368:640:0:0:white[a];' +
        '[1:v]scale=360:640,pad=368:640:0:0:white[b];' +
        '[2:v]scale=360:640[c];' +
        '[a][b][c]hstack=inputs=3[out]',
        '-map', '[out]',
        out,
      ],
      { stdio: 'pipe' }
    );
    console.log('Built verification/compare_parallax_strip.png');
  }

  if (existsSync(REF_SPLIT) && existsSync(renderSplit)) {
    const out = join(VERIFY_DIR, 'compare_split_vs_ref.png');
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i', REF_SPLIT,
        '-i', renderSplit,
        '-filter_complex',
        '[0:v]scale=758:705,pad=768:705:0:0:white[l];' +
        '[1:v]scale=758:705[r];' +
        '[l][r]hstack=inputs=2[out]',
        '-map', '[out]',
        out,
      ],
      { stdio: 'pipe' }
    );
    console.log('Built verification/compare_split_vs_ref.png');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(VERIFY_DIR, { recursive: true });

  let serverProc = null;
  let baseUrl = args.url;

  if (!baseUrl) {
    const cmd = args.usePreview
      ? ['vite', 'preview', '--port', String(args.port), '--strictPort', '--host', '127.0.0.1']
      : ['vite', '--port', String(args.port), '--strictPort', '--host', '127.0.0.1'];
    console.log(`Starting local server: npx ${cmd.join(' ')}`);
    serverProc = spawn('npx', cmd, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    baseUrl = `http://127.0.0.1:${args.port}`;
    await waitForHttp(baseUrl);
    console.log(`Server ready at ${baseUrl}`);
  }

  const debugPort = 9300 + Math.floor(Math.random() * 400);
  const { cdp, cleanup } = await launchChromeCDP(debugPort);

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageExceptions = [];
  const networkFailures = [];
  const httpErrors = [];

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    cdp.on('Runtime.consoleAPICalled', (p) => {
      const text = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      if (p.type === 'error') consoleErrors.push(text);
      else if (p.type === 'warning') consoleWarnings.push(text);
    });
    cdp.on('Runtime.exceptionThrown', (p) => {
      pageExceptions.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || JSON.stringify(p));
    });
    cdp.on('Network.responseReceived', (p) => {
      if (p.response.status >= 400) {
        httpErrors.push({ status: p.response.status, url: p.response.url });
      }
    });
    cdp.on('Network.loadingFailed', (p) => {
      if (!p.canceled) {
        networkFailures.push({ errorText: p.errorText, type: p.type });
      }
    });

    const shots = [
      { name: 'render_portrait_00s.png', width: 720, height: 1280, query: '/?mode=portrait&t=0&hud=0' },
      { name: 'render_portrait_05s.png', width: 720, height: 1280, query: '/?mode=portrait&t=5.5&hud=0' },
      { name: 'render_portrait_10s.png', width: 720, height: 1280, query: '/?mode=portrait&t=10.5&hud=0' },
      { name: 'render_widescreen_hero.png', width: 1280, height: 720, query: '/?mode=widescreen&preset=widescreen&hud=0' },
      { name: 'render_split_screen.png', width: 1516, height: 1410, query: '/?mode=split&t=5.5&hud=0' },
      { name: 'render_closeup_van.png', width: 1280, height: 720, query: '/?mode=widescreen&preset=van&hud=0' },
      { name: 'render_closeup_station.png', width: 1280, height: 720, query: '/?mode=widescreen&preset=station&hud=0' },
      { name: 'render_closeup_ground.png', width: 1280, height: 720, query: '/?mode=widescreen&preset=ground&hud=0' },
    ];

    for (const shot of shots) {
      await captureView(cdp, baseUrl, shot);
    }

    // Measure live FPS & runtime stats on the hero widescreen view
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${baseUrl}/?mode=widescreen&hud=0` });
    await waitForSceneReady(cdp);

    const perf = await cdp.eval(`new Promise((resolve) => {
      const times = [];
      let last = performance.now();
      function tick(now) {
        times.push(now - last);
        last = now;
        if (times.length >= 45) {
          const slice = times.slice(5);
          const avgDt = slice.reduce((a, b) => a + b, 0) / slice.length;
          const stats = window.__SCENE_DEBUG__?.getStats?.() || {};
          const state = window.__SCENE_DEBUG__?.getState?.() || {};
          resolve({
            measuredFps: Math.round((1000 / avgDt) * 10) / 10,
            avgFrameMs: Math.round(avgDt * 100) / 100,
            stats,
            state,
          });
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    })`);

    buildComposites();

    const report = {
      timestamp: new Date().toISOString(),
      round: args.round || 'latest',
      url: baseUrl,
      webgl2: perf?.stats?.webgl2 ?? null,
      measuredFps: perf?.measuredFps ?? null,
      avgFrameMs: perf?.avgFrameMs ?? null,
      drawCalls: perf?.stats?.drawCalls ?? null,
      triangles: perf?.stats?.triangles ?? null,
      sceneReportedErrors: perf?.stats?.errors ?? [],
      consoleErrors,
      consoleWarnings,
      pageExceptions,
      httpErrors,
      networkFailures,
      passTechnicalGate:
        consoleErrors.length === 0 &&
        pageExceptions.length === 0 &&
        httpErrors.length === 0 &&
        networkFailures.length === 0 &&
        (perf?.stats?.webgl2 === true),
    };

    writeFileSync(join(VERIFY_DIR, 'qa_report.json'), JSON.stringify(report, null, 2));

    if (args.round) {
      const roundDir = join(VERIFY_DIR, args.round);
      mkdirSync(roundDir, { recursive: true });
      const files = [
        ...shots.map((s) => s.name),
        'compare_ref_vs_render.png',
        'compare_parallax_strip.png',
        'compare_split_vs_ref.png',
        'qa_report.json',
      ];
      for (const f of files) {
        const src = join(VERIFY_DIR, f);
        if (existsSync(src)) copyFileSync(src, join(roundDir, f));
      }
      console.log(`Archived round snapshots to verification/${args.round}/`);
    }

    console.log('\n=== QA TECHNICAL SUMMARY ===');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    cleanup();
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
