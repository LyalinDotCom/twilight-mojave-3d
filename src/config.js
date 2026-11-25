/**
 * Single Source of Truth for the Twilight Mojave Desert Gas Station & Retro Van Showcase.
 *
 * Units: 1 unit = 1 meter, Y-up, right-handed.
 *
 * MODULE EXPORT CONTRACTS:
 * -----------------------------------------------------------------------------
 * 1) src/world/index.js:
 *    export function createWorld({ scene, renderer, config, textures })
 *      -> returns {
 *           group: THREE.Group,
 *           skyMesh?: THREE.Object3D,
 *           update(t, dt, opts),      // opts: { livingWorld: boolean }
 *           bakeEnvMap(renderer),     // returns THREE.Texture (PMREM envMap)
 *         }
 *
 * 2) src/van/index.js:
 *    export function createVan({ config, textures })
 *      -> returns {
 *           group: THREE.Group,       // positioned at config.van.position / rotationY
 *           headlightTargets?: THREE.Object3D[],
 *           update(t, dt, opts),      // opts: { livingWorld: boolean }
 *         }
 *
 * 3) src/station/index.js:
 *    export function createStation({ config, textures })
 *      -> returns {
 *           group: THREE.Group,
 *           lights: {
 *             canopy?: THREE.Light[],
 *             neon?: THREE.Light[],
 *             store?: THREE.Light[],
 *             sign?: THREE.Light[],
 *           },
 *           update(t, dt, opts),      // opts: { livingWorld: boolean }
 *         }
 *
 * NOTE on `textures`:
 * `src/main.js` preloads all textures listed in `CONFIG.assets.textures` gracefully:
 * if a texture file exists in `public/textures/...`, it is passed as a configured
 * THREE.Texture (SRGBColorSpace for albedo/emissive, NoColorSpace for normal/roughness,
 * RepeatWrapping + anisotropy). If any texture is not yet present or fails to load,
 * its entry in `textures` will be `null` — every module MUST have a crisp procedural
 * fallback when `textures.<key>` is null!
 */

export const CONFIG = {
  // Exact 11s loop matching tFeMuURbfQRLZsSf.mp4
  loopDuration: 11.0,

  // Camera rig & presets (trig-verified against ref_right_portrait_05s.png)
  camera: {
    near: 0.1,
    far: 700,
    fovPortrait: 62,
    fovLandscape: 35,
    // Leftward lateral truck / gentle CCW orbit matching reference frames 0s -> 11s
    trackStart: {
      pos: [1.5, 1.5, 33.4],
      target: [0.3, 4.42, 0.0],
    },
    trackEnd: {
      pos: [-6.7, 1.5, 31.6],
      target: [-0.2, 4.42, 0.0],
    },
    presets: {
      hero: {
        label: 'Hero',
        pos: [-2.6, 1.5, 32.5],
        target: [0.05, 4.42, 0.0],
        fovPortrait: 62,
        fovLandscape: 35,
      },
      widescreen: {
        label: 'Cinema',
        pos: [-3.0, 1.72, 24.6],
        target: [1.6, 2.45, -0.4],
        fovPortrait: 60,
        fovLandscape: 35,
      },
      van: {
        label: 'Van',
        pos: [-7.6, 1.35, 6.4],
        target: [-3.6, 1.05, 1.75],
        fovPortrait: 48,
        fovLandscape: 33,
      },
      station: {
        label: 'Neon Sign',
        pos: [2.4, 2.45, 10.6],
        target: [6.5, 3.25, -0.6],
        fovPortrait: 54,
        fovLandscape: 36,
      },
      ground: {
        label: 'Ground',
        pos: [-3.6, 0.62, 22.0],
        target: [0.2, 1.45, 1.5],
        fovPortrait: 54,
        fovLandscape: 36,
      },
    },
  },

  // Palette constants shared across sky, mountains, ground, lighting, low-poly mirror
  palette: {
    skyZenith: '#241D44',
    skyUpper: '#3A3064',
    skyMid: '#9E4784',
    skyLower: '#E95F7B',
    skyHorizon: '#F98456',
    skyGlow: '#FFB067',
    sunsetSunDir: [-0.62, 0.11, -0.78], // Low sun on far-left horizon
    mountainBase: '#2A1E3A',
    mountainRim: '#8C495C',
    hazeColor: '#7D456D',
    soilDark: '#382633',
    soilWarm: '#5D3B3E',
    cyanNeon: '#2CE6FF',
    cyanEmissive: '#00D8FF',
    tungstenWarm: '#FFE8B5',
    storeAmber: '#FFA947',
    vanTurquoise: '#239AC8',
    vanStripe: '#CFB338',
    vanCoral: '#DF4D2B',
    fasciaSalmon: '#D66C76',
    storeBlue: '#3B82C4',
    signRed: '#A82328',
    starWhite: '#FFF5E8',
  },

  // World & terrain layout
  world: {
    terrainSize: 180,
    pebbleCount: 34000,
    pebbleBounds: {
      xMin: -22,
      xMax: 22,
      zMin: 4.5,
      zMax: 35.0,
    },
    apron: {
      center: [2.0, 0.025, -0.5],
      width: 19.0,
      depth: 11.4,
      thickness: 0.05,
    },
    pumpIsland: {
      center: [1.8, 0.025, -0.2],
      width: 6.4,
      depth: 1.35,
      height: 0.14,
    },
    heroScrubPositions: [
      { pos: [-7.8, 0, 12.2], scale: 1.25, seed: 101 }, // Hero gnarled creosote bush mid-left below van
      { pos: [1.6, 0, 20.4], scale: 0.62, seed: 202 },  // Small mound lower-mid-right
      { pos: [-2.8, 0, 26.8], scale: 0.72, seed: 303 }, // Delicate foreground bottom-left tuft
      { pos: [0.2, 0, 27.6], scale: 0.64, seed: 404 },  // Delicate foreground bottom-right tuft
      { pos: [-11.4, 0, 14.5], scale: 1.05, seed: 505 },
      { pos: [6.8, 0, 14.0], scale: 0.78, seed: 606 },
    ],
    mountainRange: {
      zNear: -155,
      zFar: -275,
      width: 520,
      peakMin: 24,
      peakMax: 66,
    },
    horizonLights: {
      count: 64,
      xMin: -135,
      xMax: 18,
      zMin: -175,
      zMax: -225,
      yBase: 0.6,
    },
  },

  // Hero VW T3 Vanagon Camper (facing LEFT, -X; +rotY angles nose 3/4 toward viewer +Z)
  van: {
    position: [-3.8, 0.025, 1.8],
    rotationY: 0.48, // Iconic 3/4 nose-out stance showing black grille & headlights cleanly in 5.5s portrait
    dimensions: {
      length: 4.57,
      width: 1.85,
      height: 1.96,
      wheelRadius: 0.34,
      wheelWidth: 0.22,
      wheelbase: 2.46,
    },
  },

  // Retro Americana Desert Gas Station ("Desert / GAS & GO")
  station: {
    canopy: {
      center: [2.0, 0, -0.4],
      width: 8.8,
      depth: 4.6,
      soffitY: 3.85,
      fasciaHeight: 0.55,
      // 4 slim pillars supporting canopy
      pillars: [
        [-1.35, 0, -1.65],
        [-1.35, 0, 0.85],
        [4.95, 0, -1.65],
        [4.95, 0, 0.85],
      ],
    },
    pumps: {
      yBase: 0.165, // Sits cleanly on top of pumpIsland (0.025 + 0.14)
      positions: [
        [-0.3, 0.165, -0.2],
        [1.8, 0.165, -0.2],
        [3.9, 0.165, -0.2],
      ],
      size: { width: 0.85, depth: 0.55, height: 2.1 },
      trashBinPos: [5.15, 0.025, -0.2],
    },
    store: {
      center: [9.2, 0.025, -2.2],
      width: 7.6,
      depth: 6.2,
      height: 3.55,
      // Front glass wall is at Z = -2.2 + 3.1 = +0.9; left corrugated wall at X = 9.2 - 3.8 = 5.4
      frontZ: 0.9,
      leftX: 5.4,
      bollards: [
        [6.8, 0.025, 1.55],
        [8.9, 0.025, 1.55],
        [11.0, 0.025, 1.55],
      ],
    },
    signage: {
      // Mounted above right-front corner of store roof
      position: [8.4, 3.575, 0.15],
      rotationY: -0.12, // Angled subtly toward hero camera
      boxWidth: 2.65,
      boxHeight: 1.5,
      starCenterY: 5.72,
      mainText: 'Desert',
      subText: 'GAS & GO',
    },
  },

  // Lighting & Post-Processing defaults (Round 4 calibrated: 60fps 2K tight shadows, rich cyan-vs-warm contrast)
  lighting: {
    exposure: 1.07,
    sunsetKey: {
      color: '#FF925E',
      intensity: 2.15,
      position: [-38, 6.2, -16],
      shadowMapSize: 2048,
    },
    hemi: {
      skyColor: '#7A5EA0',
      groundColor: '#4D3838',
      intensity: 0.64,
    },
    canopyPool: {
      color: '#FFD288',
      intensity: 64,
      distance: 17.0,
      decay: 2,
    },
    cyanSpill: {
      color: '#00DDFF',
      intensity: 5.8,
      distance: 15.5,
      decay: 2,
    },
    storeGlow: {
      color: '#FFB24A',
      intensity: 68,
      distance: 16.5,
      decay: 2,
    },
    headlights: {
      color: '#FFE6B3',
      intensity: 44,
      distance: 18,
      decay: 2,
    },
  },

  postfx: {
    bloomThreshold: 1.44,
    bloomStrength: 0.31,
    bloomRadius: 0.44,
    vignetteStrength: 0.16,
    grainAmount: 0.014,
    chromaticAberration: 0.0005,
  },

  // Shared asset URLs produced by @asset-forge (served from public/)
  assets: {
    textures: {
      desertGroundAlbedo: { url: '/textures/desert_ground_albedo.jpg', srgb: true, repeat: [26, 26] },
      desertGroundNormal: { url: '/textures/desert_ground_normal.png', srgb: false, repeat: [26, 26] },
      desertGroundRoughness: { url: '/textures/desert_ground_roughness.png', srgb: false, repeat: [26, 26] },

      asphaltAlbedo: { url: '/textures/asphalt_albedo.jpg', srgb: true, repeat: [5, 3] },
      asphaltNormal: { url: '/textures/asphalt_normal.png', srgb: false, repeat: [5, 3] },
      asphaltRoughness: { url: '/textures/asphalt_roughness.png', srgb: false, repeat: [5, 3] },

      mountainRockAlbedo: { url: '/textures/mountain_rock_albedo.jpg', srgb: true, repeat: [14, 4] },
      mountainRockNormal: { url: '/textures/mountain_rock_normal.png', srgb: false, repeat: [14, 4] },

      corrugatedMetalAlbedo: { url: '/textures/corrugated_metal_albedo.jpg', srgb: true, repeat: [3, 2] },
      corrugatedMetalNormal: { url: '/textures/corrugated_metal_normal.png', srgb: false, repeat: [3, 2] },
      corrugatedMetalRoughness: { url: '/textures/corrugated_metal_roughness.png', srgb: false, repeat: [3, 2] },

      storeShelvesAlbedo: { url: '/textures/store_shelves_albedo.jpg', srgb: true, repeat: [1, 1] },
      storeShelvesEmissive: { url: '/textures/store_shelves_emissive.jpg', srgb: true, repeat: [1, 1] },

      woodBarkAlbedo: { url: '/textures/wood_bark_albedo.jpg', srgb: true, repeat: [2, 6] },
    },
    audio: {
      lofiLoop: '/audio/twilight_lofi.mp3',
    },
  },
};

export default CONFIG;
