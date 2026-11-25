import * as THREE from 'three';

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vWorldDir;

  uniform float uTime;
  uniform float uEnvMode;
  uniform vec3 uSunDir;

  vec3 srgb(float r, float g, float b) {
    return pow(vec3(r, g, b), vec3(2.2));
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

  float fbm5(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += amp * noise2D(p);
      p = ROT * p * 2.05 + vec2(13.7, 9.2);
      amp *= 0.5;
    }
    return v;
  }

  float fbm3(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * noise2D(p);
      p = ROT * p * 2.02 + vec2(7.1, 15.4);
      amp *= 0.5;
    }
    return v;
  }

  // Sculpted domain-warped Mojave altocumulus / cirrus sheet with crisp wisps & gaps
  float cloudDeck(vec2 uv, float drift, float slope, float anisoY) {
    // Sweeping Mojave sunset cloud streaks (gentle ~10-15 deg diagonal slant, higher left -> lower right)
    vec2 p = vec2(uv.x * 0.55 - uv.y * 0.10, uv.y * anisoY + uv.x * slope);
    p.x -= drift * 0.032;
    p.y += drift * 0.006;

    // Two-stage organic wind shear warp for feathery billowing edges (NOT stiff parallel stripes!)
    vec2 w1 = vec2(
      fbm3(p * 0.52 + vec2(2.8, 7.1) - vec2(drift * 0.012, 0.0)),
      fbm3(p * 0.58 + vec2(11.4, 3.3))
    );
    vec2 wp = p + (w1 - 0.5) * vec2(1.35, 0.72);

    float body = fbm5(wp * vec2(0.95, 1.45));
    float billows = fbm5(wp * vec2(2.15, 3.65) + vec2(4.7, -3.2));
    float fineWisps = noise2D(wp * vec2(4.8, 9.6) + vec2(1.9, 8.4));

    float combined = body * 0.54 + billows * 0.34 + fineWisps * 0.12;
    return smoothstep(0.37, 0.76, combined);
  }

  float starField(vec3 dir, float t) {
    vec2 sph = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
    vec2 grid = sph * vec2(175.0, 175.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;

    float rnd = hash21(cell);
    if (rnd < 0.990) return 0.0;

    vec2 jitter = (vec2(hash21(cell + 17.3), hash21(cell + 43.1)) - 0.5) * 0.60;
    float d = length(local - jitter);
    float star = smoothstep(0.08, 0.01, d);
    float twinkle = 0.80 + 0.20 * sin(t * (1.8 + fract(rnd * 91.7) * 3.5) + rnd * 120.0);
    float mag = smoothstep(0.990, 0.9996, rnd);
    return star * twinkle * (0.28 + 0.72 * mag);
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float y = dir.y;
    float el = clamp(y, 0.0, 1.0);

    vec3 sunDir = normalize(uSunDir);
    vec2 hDir = normalize(dir.xz + vec2(1e-5));
    vec2 hSun = normalize(sunDir.xz + vec2(1e-5));
    float sunAz = clamp(dot(hDir, hSun) * 0.5 + 0.5, 0.0, 1.0);
    float sunGlowMask = pow(sunAz, 1.75);
    float sunCore = pow(max(dot(dir, sunDir), 0.0), 7.5);

    // -------------------------------------------------------------------------
    // Rich Mojave Twilight Sky Base (clear cool violet gaps contrast fiery clouds!)
    // -------------------------------------------------------------------------
    vec3 cGlow = srgb(1.00, 0.78, 0.42);      // Luminous golden-apricot horizon
    vec3 cHorizon = srgb(0.99, 0.55, 0.42);   // Coral-tangerine lower band
    vec3 cLower = srgb(0.90, 0.39, 0.55);     // Deep salmon-rose
    vec3 cMid = srgb(0.68, 0.33, 0.62);       // Rich twilight magenta-violet (lets coral clouds POP!)
    vec3 cUpper = srgb(0.41, 0.31, 0.65);     // Velvety twilight periwinkle-indigo
    vec3 cZenith = srgb(0.20, 0.16, 0.42);    // Deep dusk indigo overhead

    float coolShift = mix(0.055, -0.055, sunGlowMask);
    float e = clamp(el + coolShift * smoothstep(0.03, 0.46, el), 0.0, 1.0);

    vec3 col = mix(cGlow, cHorizon, smoothstep(0.00, 0.075, e));
    col = mix(col, cLower, smoothstep(0.065, 0.185, e));
    col = mix(col, cMid, smoothstep(0.17, 0.35, e));
    col = mix(col, cUpper, smoothstep(0.32, 0.56, e));
    col = mix(col, cZenith, smoothstep(0.54, 0.88, e));

    // Intense warm apricot-gold sunset afterglow above the left-center valley saddle
    float horizonBelt = exp(-el * 10.5) * (0.45 + 0.55 * sunGlowMask);
    col = mix(col, srgb(1.00, 0.80, 0.44), horizonBelt * 0.68);
    col += srgb(1.00, 0.68, 0.35) * sunCore * exp(-el * 5.0) * 0.32;

    // -------------------------------------------------------------------------
    // Perspective-Projected Layered Backlit Sunset Clouds
    // -------------------------------------------------------------------------
    if (y > 0.004) {
      // Curved perspective cloud plane: compresses naturally toward horizon for vast Mojave scale!
      vec2 domeUV = dir.xz / (max(y, 0.03) + 0.16);

      // Gentle upper-right twilight sky opening matching reference composition
      float rightClear = smoothstep(0.56, -0.22, dir.x - 0.16) * 0.58 + 0.42;

      // Deck 1: Fiery low-to-mid altocumulus streaks (el ~ 0.04..0.44)
      float elMask1 = smoothstep(0.025, 0.085, el) * (1.0 - smoothstep(0.29, 0.55, el));
      float c1 = cloudDeck(domeUV * 0.78 + vec2(0.9, -0.4), uTime, 0.24, 1.95);
      // Two-step lighting derivative toward low horizon sun for crisp golden-coral backlit rims
      vec2 sunStep = normalize(sunDir.xz) * 0.11;
      float c1Sun = cloudDeck((domeUV + sunStep) * 0.78 + vec2(0.9, -0.4), uTime, 0.24, 1.95);
      float c1Thick = cloudDeck((domeUV - sunStep * 0.7) * 0.78 + vec2(0.9, -0.4), uTime, 0.24, 1.95);
      float litEdge1 = clamp((c1 - c1Sun) * 3.1 + 0.56, 0.0, 1.0);
      float bellyShadow1 = clamp(c1 * c1Thick, 0.0, 1.0);

      // Deck 2: Higher silky rose-coral cirrus wisps (el ~ 0.15..0.58)
      float elMask2 = smoothstep(0.11, 0.22, el) * (1.0 - smoothstep(0.42, 0.72, el));
      float c2 = cloudDeck(domeUV * 1.18 + vec2(-2.4, 1.7), uTime * 0.65, 0.30, 2.35);
      float c2Sun = cloudDeck((domeUV + sunStep * 0.8) * 1.18 + vec2(-2.4, 1.7), uTime * 0.65, 0.30, 2.35);
      float litEdge2 = clamp((c2 - c2Sun) * 2.8 + 0.54, 0.0, 1.0);

      // High-contrast backlit twilight cloud palette:
      // Fiery apricot-gold & hot coral-pink undersides vs dusty magenta-violet cloud tops!
      float alt = smoothstep(0.05, 0.36, el);
      vec3 fireGold = srgb(1.00, 0.77, 0.40) * 1.12;   // Intense glowing apricot-gold underside
      vec3 fireCoral = srgb(1.00, 0.46, 0.48) * 1.08;  // Fiery salmon-coral backlit wisp
      vec3 firePink = srgb(0.98, 0.44, 0.62);          // Luminous sunset flamingo-pink
      vec3 topMagenta = srgb(0.62, 0.29, 0.54);        // Rich dusty magenta-violet cloud belly
      vec3 topViolet = srgb(0.42, 0.27, 0.58);         // Cool twilight plum cloud top

      vec3 c1Lit = mix(fireGold, fireCoral, smoothstep(0.04, 0.20, el));
      c1Lit = mix(c1Lit, firePink, smoothstep(0.19, 0.38, el));
      vec3 c1Dark = mix(topMagenta, topViolet, alt);

      float underLight = clamp(litEdge1 * (0.62 + 0.38 * sunGlowMask) - bellyShadow1 * 0.22, 0.0, 1.0);
      vec3 cloudCol1 = mix(c1Dark, c1Lit, underLight);
      // Extra fiery golden-orange rim scattering along lower cloud edges nearest the setting sun
      cloudCol1 += srgb(1.00, 0.66, 0.32) * pow(1.0 - alt, 1.55) * litEdge1 * (0.5 + 0.5 * sunGlowMask) * 0.44;

      vec3 c2Lit = mix(fireCoral, firePink, smoothstep(0.14, 0.40, el));
      vec3 c2Dark = mix(topMagenta, srgb(0.40, 0.28, 0.60), smoothstep(0.18, 0.48, el));
      vec3 cloudCol2 = mix(c2Dark, c2Lit, clamp(litEdge2 * (0.50 + 0.50 * sunGlowMask), 0.0, 1.0));

      float m1 = clamp(c1 * elMask1 * mix(0.76, 1.0, rightClear) * 0.90, 0.0, 0.92);
      float m2 = clamp(c2 * elMask2 * rightClear * 0.72, 0.0, 0.76);

      col = mix(col, cloudCol1, m1);
      col = mix(col, cloudCol2, m2);

      // Luminous warm horizon veil uniting sky & distant mountain ridge
      float horizonVeil = exp(-el * 15.5);
      vec3 veilCol = mix(srgb(0.95, 0.57, 0.53), srgb(1.00, 0.78, 0.45), sunGlowMask);
      col = mix(col, veilCol, horizonVeil * 0.45);

      // Subtle high-zenith twilight stars (above portrait frame)
      float starVis = smoothstep(0.48, 0.78, el) * (1.0 - clamp(m1 + m2, 0.0, 0.92));
      if (starVis > 0.01 && uEnvMode < 0.5) {
        float st = starField(dir, uTime);
        col += vec3(0.92, 0.90, 1.0) * st * starVis * 0.52;
      }
    } else {
      float down = clamp(-y, 0.0, 1.0);
      vec3 groundHorizon = mix(srgb(0.54, 0.34, 0.46), srgb(0.70, 0.42, 0.44), sunGlowMask);
      vec3 groundNadir = srgb(0.20, 0.14, 0.20);
      col = mix(groundHorizon, groundNadir, smoothstep(0.0, 0.45, down));
    }

    if (uEnvMode > 0.5) {
      col *= 1.15;
      float cyanSide = pow(max(dot(dir, normalize(vec3(0.75, 0.16, -0.35))), 0.0), 14.0);
      col += srgb(0.12, 0.88, 1.0) * cyanSide * 0.82;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeSkyMaterial(config, envMode = 0.0) {
  const pal = config.palette;
  const sunVec = new THREE.Vector3(...(pal.sunsetSunDir || [-0.62, 0.11, -0.78])).normalize();

  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uEnvMode: { value: envMode },
      uSunDir: { value: sunVec },
    },
  });
}

export function createSky({ config }) {
  const geometry = new THREE.SphereGeometry(560, 64, 40);
  const material = makeSkyMaterial(config, 0.0);

  const skyMesh = new THREE.Mesh(geometry, material);
  skyMesh.name = 'TwilightMojaveSkyDome';
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -100;

  let cloudClock = 0;

  function update(_t, dt, opts = {}) {
    if (opts.livingWorld) {
      cloudClock += Math.min(dt || 0.016, 0.1);
      material.uniforms.uTime.value = cloudClock;
    } else {
      cloudClock = 0;
      material.uniforms.uTime.value = 0;
    }
  }

  function bakeEnvMap(renderer) {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(80, 48, 32);
    const envMat = makeSkyMaterial(config, 1.0);
    const envDome = new THREE.Mesh(envGeo, envMat);
    envScene.add(envDome);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.025, 0.1, 200);

    envGeo.dispose();
    envMat.dispose();
    pmremGenerator.dispose();

    return renderTarget.texture;
  }

  return {
    mesh: skyMesh,
    update,
    bakeEnvMap,
  };
}
