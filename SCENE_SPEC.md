# Scene Replication Spec: Twilight Mojave Desert Gas Station & Retro Van

> **Objective**: Take the viral fake-joke comparison video ([tFeMuURbfQRLZsSf.mp4](file:///Users/dmitrylyalin/source/van-video/tFeMuURbfQRLZsSf.mp4))—where a simple low-poly Three.js scene was paired with an AI-restyled photorealistic video—and **actually build the jaw-dropping right-hand scene in real-time 3D (WebGL2 / Three.js)** from code alone, with **zero external 3D models or image textures**, **razor-sharp real neon typography** (fixing the joke video's garbled `"Doserl / OAO & OO"` text), **interactive camera freedom**, and an optional **live synchronized Split-Screen Comparison Mode** that proves it's 100% real-time.

---

## 1. Strategic Framing: How to Actually Blow Everyone's Mind

The viral punch of the original video comes from **immediate visual contrast** + **twilight color chemistry** + **high-frequency foreground parallax**. To make our real-time model-generated build hit *harder* than the fake video:

1. **Zero AI-Artifact Compromise**: Every sign (`DESERT` / `GAS & GO`), fuel pump dial, van emblem, and storefront shelf is genuine procedural 3D geometry & crisp canvas-baked PBR textures—no garbled glyphs, no melting pixels.
2. **Real-Time Proof Hooks**:
   - **Default View**: Pure cinematic full-viewport render (or toggleable **Split-Screen Benchmark Mode** replicating the exact `Before vs. After` dual 9:16 portrait layout side-by-side with locked synchronized cameras).
   - **Interactive Controls**: Drag to orbit, scroll to dolly, press `Space` to pause/resume the cinematic 11s parallax sweep, press `C` to toggle **Split-Screen Low-Poly vs. Photoreal Mode**, press `M` to toggle procedural Web Audio lo-fi Rhodes soundtrack, press `L` to toggle subtle **"Living World"** motion (wind in creosote bushes, drifting cirrus clouds, shimmering distant highway lights, faint neon micro-flicker—going *beyond* the frozen fake video!).
3. **Zero External Dependencies / Asset Breakage**: 100% self-contained procedural geometry, GLSL shaders, `InstancedMesh` scattering, procedural `PMREMGenerator` environment lighting, and HTML5 Canvas PBR maps (`diffuse`, `roughness`, `bump`, `emissive`)—loads fast, never 404s, runs at **60 FPS** on standard laptops.

---

## 2. Architecture & Tech Stack

- **Runtime**: Vanilla ES Modules + **Three.js** (r165+) with `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass` (or custom combined Film/ACES/Grade post-pass) and `OrbitControls`.
- **Optional Single-File or Vite Build**: Clean modular structure (`src/sky.js`, `src/terrain.js`, `src/foliage.js`, `src/van.js`, `src/gasStation.js`, `src/lighting.js`, `src/postfx.js`, `src/audio.js`, `src/lowPolyScene.js`) or cleanly bundled single HTML build for instant demo/sharing.
- **Renderer Settings**:
  ```js
  renderer.antialias = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ```

---

## 3. World Coordinate System, Composition & Camera Rig

Use metric units (`1 unit = 1 meter`), Y-up, right-handed coordinates.

### 3.1 Spatial Layout Map (Top-Down)

| Scene Element | Position `(X, Y, Z)` | Rotation / Orientation | Scale / Footprint |
| :--- | :--- | :--- | :--- |
| **Camera (Start `t=0`)** | `(-2.2, 1.38, 17.5)` | Looks at `(1.2, 1.85, 0.0)` | ~34mm equiv (`fov: 38°` portrait / `32°` landscape) |
| **Camera (End `t=11s`)** | `(-6.8, 1.38, 16.4)` | Looks at `(1.0, 1.85, 0.0)` | Smooth constant-velocity **truck-left / gentle CCW orbit** |
| **Hero Foreground Scrub Clumps** | `(-5.2, 0, 9.5)`, `(-0.4, 0, 12.2)`, `(2.6, 0, 13.8)` | Randomized Y rotation | `0.4m – 1.45m` tall gnarled creosote bushes |
| **Hero Van (VW T3 Camper)** | `(-3.8, 0, 1.8)` | **Facing Left** (`rotY ≈ -0.14 rad`, slight 3/4 nose-out angle) | `4.57m L × 1.85m W × 1.96m H` |
| **Gas Station Concrete Apron** | `(2.0, 0.02, -0.5)` | Flat horizontal | `18m W × 11m D` weathered asphalt/concrete pad |
| **Canopy Structure** | `(2.0, 0, -0.4)` | Aligned with X-axis | `8.8m W × 4.6m D`, roof soffit at `Y = 3.85m`, fascia `0.55m` tall |
| **3 Fuel Dispensers** | `(-0.3, 0, -0.2)`, `(1.8, 0, -0.2)`, `(3.9, 0, -0.2)` | Facing camera (`+Z`) on raised curb islands | `0.85m W × 0.55m D × 2.1m H` each |
| **Convenience Store** | `(9.2, 0, -2.2)` | Front glass facing `+Z`, corrugated wall facing `-X` | `7.6m W × 6.2m D × 3.55m H` |
| **Rooftop Neon Marquee + Star** | `(8.8, 3.55, -0.4)` | Facing `+Z` (angled slightly toward camera) | Sign box `2.6m W × 1.5m H`, star center at `Y = 5.65m` |
| **Distant Valley & Horizon Lights** | `X ∈ [-120, 40], Z ∈ [-180, -240]` | Stretched along far-left desert floor | Subtle warm amber/white pinpoint light strip |
| **Desert Mountain Ridge** | `Z ∈ [-160, -280]` | Sweeping horizon silhouette across full frustum | Peaks `28m – 65m` tall (higher on right behind station, saddle dip left-of-center) |

### 3.2 Camera Motion & Parallax Spec
- **Exact Replication Motion**: Smooth **leftward orbital truck** over an 11-second seamless loop (or ping-pong / ease-in-out optional). Because the camera translates left while tracking the van/canopy midpoint:
  - Foreground pebbles & creosote bushes (`Z = 8..15m`) glide smoothly **left → right** across the lower viewport.
  - The van and gas station (`Z = -2..2m`) stay compositionally locked while shifting perspective subtly across the 4 canopy pillars and 3 pumps.
  - The mountain ridge (`Z = -200m`) shifts barely a few pixels, reinforcing massive desert depth.

---

## 4. Hero Visual Systems & Asset Specifications

### 4.1 Procedural Twilight Sky Dome & Volumetric Wispy Clouds (`ShaderMaterial`)
This occupies ~45% of the frame and establishes the entire emotional color palette.
- **Sky Gradient Stops (bottom → zenith)**:
  - Horizon band (`0°–4°`): Luminous golden-peach `#FFB067` → coral-tangerine `#F98456`
  - Lower sky (`4°–18°`): Fiery salmon-rose `#E95F7B`
  - Mid sky (`18°–42°`): Rich twilight magenta-violet `#9E4784`
  - Zenith (`42°–90°`): Deep dusk indigo-purple `#3A3064` → `#241D44`
- **Cloud Layer (Custom Fragment Shader)**:
  - Domain-warped 5-octave FBM stretched horizontally and sheared diagonally (~`14°–18°` upward from mid-right to upper-left) to recreate sweeping Mojave cirrus/altocumulus streaks.
  - **Under-lit sunset shading**: Compute directional derivative toward the setting sun (positioned just below the far-left horizon, azimuth `~-35°`, elevation `-3°`) so cloud undersides glow fiery coral-gold (`#FF9966` / `#FF6E7A`) while thicker upper bellies cool to dusty plum (`#6D3A6E`).
  - Subtle high-zenith starfield (barely visible pinpoints above `55°` elevation).
- **PMREM IBL Reflection Bake**: Render this exact procedural sky dome into a `PMREMGenerator` cubemap at startup so **every metallic, glass, clearcoat, and concrete surface reflects the true sunset sky**.

### 4.2 Eroded Mojave Mountain Ridge & Valley Horizon
- **Geometry**: Multi-layered wide terrain strip (`240 × 48` subdivided grid) shaped by ridged multifractal noise + gullied hydraulic-erosion creases, with a lower saddle valley on the left and taller craggy peaks rising behind the gas station on the right.
- **Shader / Material**:
  - Matte rocky albedo (`#2A1E3A` deep twilight indigo-plum) with slope-based strata lines and faint warm sunset grazing highlights (`#8C495C`) along west-facing upper ridge crests.
  - **Atmospheric Distance Haze**: Custom height + distance fog blending the mountain base seamlessly into rose-violet horizon mist (`#7D456D` → `#B85E7A`), creating layered silhouette separation between front foothills and rear peaks.
- **Distant Valley Lights**: 45–60 tiny instanced additive glow sprites (`#FFD28A`, `#FFF2CC`, subtle warm shimmer) clustered in thin horizontal streaks along the far-left valley floor between the desert scrub plain and mountain base.

### 4.3 Desert Hardpan, 25,000 Instanced Pebbles & Concrete Forecourt
This is the single biggest differentiator between "flat WebGL demo" and "photorealistic jaw-drop."
- **Base Desert Terrain**:
  - `140m × 140m` displaced plane with gentle rolling desert washes, flattened seamlessly under the forecourt pad (`Y = 0`), plus faint parallel tire tracks curving from the foreground-left onto the apron.
  - Procedural canvas/shader **PBR maps** (1024px tiled with macro noise breakup to eliminate repetition): dusty plum-umber soil (`#382633` to `#5D3B3E`), coarse sand micro-bump, `roughness: 0.88–0.96`.
- **Instanced Pebble & Cobble Field (`InstancedMesh`)**:
  - **20,000–35,000 instanced low-poly displaced icosahedra** (3–4 rock variants, non-uniformly flattened & rotated) distributed densely across the camera foreground frustum (`Z ∈ [3.5, 19]`, `X ∈ [-14, 14]`), with density falloff with distance and exclusion mask on the paved forecourt.
  - Per-instance color variation (cool slate-purple `#362839`, warm dusty terracotta `#684546`, pale desert quartz `#8E6B6B`) and slightly lower roughness (`0.65–0.78`) so pebble tops catch crisp **coral sunset rim light and subtle cyan/amber station spill**, while casting/receiving contact darkening!
- **Paved Forecourt Apron & Curbs**:
  - Slightly elevated (`Y = 0.025m`) bevelled concrete/asphalt pad with procedural expansion joints, subtle tire wear darkening, fine aggregate roughness map (`0.52–0.75`—smooth enough to show **soft glowing reflections of the cyan neon canopy and warm storefront light!**), and 3D rounded concrete pump islands (`0.14m` tall) with weathered edges.

### 4.4 Woody Desert Scrub & Creosote Bushes (Procedural Branching)
Never use flat triangles or flat grass blades in the hero scene!
- **Hero Midground Creosote Bush** (lower-left foreground/midground near the van) + **16–24 varied desert sagebrush/scrub clumps**:
  - Generate **recursive 3D branching woody skeletons** (base root cluster → 12–18 gnarled primary stems → secondary forks → fine tapering terminal twigs) merged into 3–4 reusable `BufferGeometry` templates and placed via `InstancedMesh` / transforms.
  - Add sparse tiny dry desert leaf/seed clusters (`alphaTest` micro-sprigs) along outer twig tips.
  - **Material**: Dark weathered desert bark (`#362523`, `roughness: 0.92`) with subtle custom **sunset rim-light / fresnel backlight** (`#D86E58`) along thin outer twigs so the silhouette glows naturally against the gravel and horizon.
  - Optional "Living World" vertex wind sway (`sin(time + worldPos) * height^2`) when enabled.

### 4.5 Hero Vehicle — Retro 1980s VW T3 Vanagon Camper (Facing Left)
Built from crisp compound procedural geometry (extruded bevelled cabin shell, wheel well cutouts, recessed window frames, separate trim & hardware):
- **Silhouette & Proportions**: Classic boxy-yet-bevelled VW T3 Vanagon (`4.57m × 1.85m × 1.96m`), flat vertical rear, gently raked front windshield on the **left**, horizontal black radiator grille with central round emblem, dual rectangular recessed warm halogen headlights (`#FFF0C4`) + amber lower turn indicators (`#FF8C1A`), black metal wrap-around front/rear bumpers with rubber endcaps, roof rain-gutter drip rails, dual side-view mirrors, door seams/handles, rubber tires with recessed steel rims & metallic hubcaps (`#B8C4CC`).
- **Paint & Livery** (clean high-res procedural Canvas texture, zero garbled text):
  - **Default "Desert Mystery" Livery** (faithful, clean homage to the viral clip):
    - Base body: vibrant turquoise-teal (`#239AC8`)
    - Mid-body wavy retro stripe: warm mustard-lime ochre (`#CFB338`)
    - Accent decals: clean retro orange-red desert sun/flower medallions (`#DF4D2B`) on the front door and rear flank + crisp retro badge (`"DESERT CRUISER"` or clean geometric wave graphic—100% legible!).
  - **Material**: `MeshPhysicalMaterial` (`clearcoat: 0.85`, `clearcoatRoughness: 0.18`, `metalness: 0.28`, `roughness: 0.32`) with subtle lower-rocker desert dust gradient so the bottom edge blends realistically with the dusty forecourt!
- **Windows & Interior**:
  - Recessed dark-tinted glass (`MeshPhysicalMaterial`: `roughness: 0.06`, `metalness: 0.1`, `envMapIntensity: 1.6`, `transparent: true`, `opacity: 0.72`) reflecting the fiery sunset sky and electric cyan canopy glow.
  - Visible dark interior cabin cavity with front seats, dashboard silhouette, steering wheel, and a faint warm dashboard glow.
- **Grounding**: Soft dark ambient occlusion contact shadow decal directly beneath the chassis and all four tires + subtle warm headlight spill cones onto the gravel just ahead of the left bumper.

### 4.6 Retro Americana Desert Gas Station (`DESERT — GAS & GO`)
- **Canopy**:
  - Dimensions: `8.8m W × 4.6m D × 0.55m H` slab at `Y = 3.85m`.
  - **Dual-Tube Electric Cyan Neon Trim**: Two parallel continuous thin glowing tubes wrapping all four fascia sides (`#2CE6FF`, emissive `#00D8FF`, `emissiveIntensity: 3.4`) mounted over a brushed salmon-coral metal fascia band (`#D66C76`).
  - **4 Slim Cylindrical/Square Steel Pillars**: Positioned on the pump islands, clad in brushed off-white/silver paint with dark base collars and **red safety bollards** flanking the islands.
  - **Under-Canopy Soffit Lighting**: 6 recessed glowing square/round warm tungsten ceiling fixtures (`#FFE9B8`, `emissiveIntensity: 2.8`) casting rich golden pools onto the pumps and concrete.
- **3 Detailed Retro Fuel Dispensers**:
  - Placed evenly along the canopy line (`X = -0.3, 1.8, 3.9`).
  - Each dispenser features: brushed stainless steel frame, cream-white lower skirt, metallic side trim, **illuminated amber-warm price/gallon display bezel** (sharp canvas texture: `$3.49 / GAL`, `REGULAR / PLUS / SUPER`), nozzle holster, curved black rubber fuel hose (`TubeGeometry` along a `CatmullRomCurve3`), and chrome nozzle handle.
  - Flanking props: Red cylindrical metal trash receptacle / fire extinguisher unit at the right end of the pump line (`X = 5.1`), concrete wheel stops, and red bollards.
- **Convenience Store Building**:
  - Left-facing side wall (`X = 5.4`): Ribbed **corrugated salmon-pink metal siding** (`#D56F7C`, bump/normal corrugated texture) catching warm canopy bounce.
  - Front storefront (`Z = +0.9`): Painted retro **powder-blue paneling & mullions** (`#3B82C4`) topped with a matching **cyan neon eave strip** (`#2CE6FF`), glass entrance door on the left, 3 wide storefront picture windows, a dark trash bin by the door, and 3 **yellow steel parking bollards** along the front curb.
  - **True 3D Lit Interior Room** (critical for parallax & realism!):
    - Recessed `4.5m` deep interior box behind real reflective window glass (`opacity: 0.22`).
    - Warm-lit interior walls, glowing overhead fluorescent ceiling strips (`#FFF0C2`), 2–3 aisles of miniature stocked product shelves (colorful crisp canvas textures representing snacks/drinks), cooler display case along the back wall, and a checkout counter—radiating a warm golden glow (`#FFB44C`) out onto the concrete apron!
- **Rooftop Neon Marquee & Star Sign**:
  - Mounted on twin dark steel support posts above the right-front roof corner (plus a thin weathered utility mast/conduit behind it).
  - **Main Sign Box**: Red-enameled bevelled cabinet (`#A82328`) rimmed in crisp warm-white/red neon tubing, displaying sharp retro script **`Desert`** (crisp high-res Canvas emissive texture, `emissiveIntensity: 2.2`).
  - **Sub-Marquee**: Dark charcoal cabinet bordered in red neon directly beneath, reading crisp condensed **`GAS & GO`** in warm backlit amber-white lettering.
  - **Crowning 5-Pointed Star**: Extruded 3D 5-pointed star (`#D93829` body with glowing white-hot neon outline `#FFF5E8`, `emissiveIntensity: 3.6`) floating cleanly above the marquee.

---

## 5. Lighting Rig & Post-Processing Pipeline

### 5.1 Multi-Source Lighting Budget (Warm vs. Cool Twilight Contrast)
| Light | Type | Color & Intensity | Purpose |
| :--- | :--- | :--- | :--- |
| **Sunset Rim Key** | `DirectionalLight` (shadow-casting, 2048px PCFSoft) | `#FF8C5A`, `1.8` from `(-35, 7, -22)` | Low-angle grazing coral sunset key across pebbles, scrub twigs, mountains, and van |
| **Twilight Sky Fill** | `HemisphereLight` | Sky `#5C4B8A` / Ground `#3B232D`, `0.85` | Cool dusk shadows + warm dusty earth bounce |
| **Canopy Tungsten Pools** | 2× `SpotLight` (or 3× `PointLight`, decay `2`, distance `14`) | `#FFD48A`, `intensity: 24` under canopy | Bright golden light pools across pumps, concrete pad, and right side of van |
| **Cyan Neon Spill** | 1× `PointLight` (or `RectAreaLight`) along canopy edge | `#28DCFF`, `intensity: 9`, distance `12` | Subtle cool electric cyan rim on van roof, canopy columns, and asphalt |
| **Storefront Interior Glow** | 1× `PointLight` inside/just outside glass | `#FFA947`, `intensity: 16`, distance `12` | Warm inviting amber light spilling onto front curb, bollards, and gravel edge |
| **Van Headlights** | 2× subtle `SpotLight` / additive ground glow decals | `#FFF0C2`, `intensity: 6`, distance `9` | Soft warm beams grazing the dirt just ahead of the van's left nose |
| **Sky IBL Environment** | `PMREMGenerator` from procedural sky dome | `envMapIntensity: 1.0–1.5` | Crisp sky reflections in glass, car clearcoat, chrome, and concrete |

### 5.2 Post-Processing Stack
1. **HDR Render Pass** (`HalfFloatType` multisampled render target to prevent aliasing on glowing cyan neon tubes!).
2. **Selective Cinematic Bloom (`UnrealBloomPass`)**:
   - `threshold: 0.92`, `strength: 0.42`, `radius: 0.58`
   - Only emissives (`> 1.0` HDR: cyan neon tubes, under-canopy lamps, rooftop star/marquee, van headlights, interior ceiling fixtures) bloom into soft optical halation—keeping the sunset sky crisp and un-washed-out.
3. **Filmic Tone Mapping & Twilight Grade (`OutputPass` + lightweight custom shader)**:
   - `ACESFilmicToneMapping`
   - Subtle optical vignette (`0.18` strength), ultra-fine animated 35mm film grain (`0.022`), and micro-chromatic aberration (`0.0008`) at far corners for authentic dusk lens feel.

---

## 6. Optional Split-Screen "Before vs. After" Mode

To replicate (and publicly one-up!) the viral video directly in the browser:
- Include a toggleable **`Split Comparison Mode`** (`C` key or subtle bottom-right HUD pill):
  - Renders two side-by-side rounded-corner `9:16` viewports on a crisp `#FFFFFF` canvas with customizable headers (e.g. `Low-Poly Baseline` vs. `Gemini Real-Time 3D`), separated by a narrow white gutter.
  - **Left Viewport**: Renders a faithful **low-poly flat-shaded scene** (`flatShading: true` faceted mountains & terrain, 7 flat pill clouds, spiky low-poly grass blades, blocky 2-tone van, basic 3-pump gas station, flat yellow windows, zero bloom) sharing the **exact same camera matrix**!
  - **Right Viewport**: Renders the full photorealistic scene above with HDR bloom & ACES tone mapping.
  - Dragging the mouse in **either** panel orbits **both** worlds simultaneously—instantly proving to any viewer that the jaw-dropping right-hand render is 100% live interactive 3D, not a pre-rendered video joke!

---

## 7. Procedural Web Audio Lo-Fi Synth Bed (Optional)

Recreates the exact ~82 BPM nostalgic twilight road-trip mood from [tFeMuURbfQRLZsSf.mp4](file:///Users/dmitrylyalin/source/van-video/tFeMuURbfQRLZsSf.mp4) with zero audio files:
- **Tempo**: `82 BPM`, muted by default with a clean floating `Sound: Off / On` button (respecting browser autoplay policy).
- **Voices (Web Audio API)**:
  - **Warm Rhodes Electric Piano**: 4-bar jazzy twilight loop (`Fmaj9 → Em7 → Dm9 → Cmaj9`), sine + subtle 3rd harmonic bell attack, gentle stereo chorus/detune (`±4 cents`), warm low-pass filter (`1400 Hz`), soft reverb tail.
  - **Sub-Bass**: Smooth triangle/sine wave following chord roots with soft envelope.
  - **Muted Lo-Fi Drums**: Low-pass filtered soft kick, gentle filtered noise rimshot on beats 2 & 4, and subtle swung closed hi-hat + whisper-quiet vinyl warmth.

---

## 8. Acceptance & Visual Verification Checklist

Before declaring the build complete, verify every item in headless/live browser screenshots at `t = 0s`, `t = 5.5s`, and `t = 10.5s`:

- [ ] **Instant Visual Punch (0.5s Test)**: Fiery coral-to-indigo sunset clouds, electric cyan neon canopy, warm tungsten pools, and dense foreground pebbles read unmistakably as cinematic twilight photography—not flat CG.
- [ ] **Zero Garbled Text**: Rooftop sign reads crisp **`Desert`** / **`GAS & GO`** topped by a glowing 5-pointed star; fuel pump faces and van graphics are clean and artifact-free.
- [ ] **Accurate Composition & Direction**: Van is a detailed VW T3 facing **left** on the left side of the apron; canopy has **4 pillars** and **3 fuel pumps**; convenience store sits on the right with a visible 3D lit interior and yellow curb bollards; distant horizon highway lights sparkle on the far left.
- [ ] **Parallax Verification**: Camera smoothly trucks left / orbits CCW over 11s; foreground creosote bushes and pebbles sweep left → right across the bottom while the van and gas station remain anchored.
- [ ] **Reflection & Light Check**: Van windows and clearcoat paint clearly reflect the coral sunset sky and cyan canopy neon; concrete apron shows warm tungsten pools + subtle cyan bounce; pebbles cast crisp low-angle shadows.
- [ ] **Performance & Interactivity**: Runs smoothly at 60 FPS, zero console errors, interactive mouse orbit/zoom works seamlessly, and `Split-Screen Mode` locks both cameras in sync.
