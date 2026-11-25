#!/usr/bin/env python3
"""
Asset Forge for Twilight Mojave 3D Showcase.
Generates photographic, lighting-neutral textures via `gemini-api image`,
post-processes them into mathematically seamless PBR maps (albedo, tangent-space normal,
calibrated roughness, emissive), and generates + loops the ~82 BPM twilight lo-fi
soundtrack via `gemini-api music` + `ffmpeg`.

Usage:
  python3 scripts/generate_assets.py                  # Generate & process all assets
  python3 scripts/generate_assets.py --only asphalt   # Regenerate one texture set
  python3 scripts/generate_assets.py --only audio     # Regenerate audio only
  python3 scripts/generate_assets.py --reprocess      # Re-run PBR post-processing on existing raws
"""

import argparse
import concurrent.futures
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
TEX_DIR = REPO_ROOT / "public" / "textures"
AUDIO_DIR = REPO_ROOT / "public" / "audio"
RAW_DIR = Path(
    os.environ.get(
        "ASSET_FORGE_RAW_DIR",
        "/Users/dmitrylyalin/.gemini/jetski/brain/ff909ff1-d9f2-4c27-8302-e67f95c2c0df/scratch/raw",
    )
)

IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-nano-banana-2.1")
MUSIC_MODEL = os.environ.get("GEMINI_MUSIC_MODEL", "lyria-3.5")

TEXTURE_SPECS = {
    "desert_ground": {
        "aspect_ratio": "1:1",
        "image_size": "1K",
        "target_size": (1024, 1024),
        "seamless": "organic",
        "flatten_strength": 0.85,
        "outputs": ["albedo", "normal", "roughness"],
        "normal_strength": 3.4,
        "roughness_range": (0.72, 0.96),
        "roughness_invert": True,  # bright pebbles smoother, dark dirt rougher
        "prompt": (
            "Orthographic straight top-down 90-degree flat photographic texture of Mojave desert "
            "ground hardpan covered evenly with fine dusty rose-umber soil, coarse sand, and dense "
            "small weathered desert gravel and tiny rounded pebbles in muted terracotta, dusty plum-brown, "
            "charcoal basalt, and pale sandstone specks. Completely uniform flat overcast diffuse lighting, "
            "zero directional shadows, zero lens vignette, zero perspective distortion, no large rocks, "
            "no plants or footprints, high-resolution seamless PBR albedo material scan."
        ),
    },
    "asphalt": {
        "aspect_ratio": "1:1",
        "image_size": "1K",
        "target_size": (1024, 1024),
        "seamless": "organic",
        "flatten_strength": 0.85,
        "outputs": ["albedo", "normal", "roughness"],
        "normal_strength": 2.4,
        "roughness_range": (0.48, 0.80),
        "roughness_invert": False,  # darker worn patches slightly smoother, dusty bright patches rougher
        "prompt": (
            "Orthographic straight top-down 90-degree flat photographic texture of uniform sun-weathered "
            "desert asphalt and concrete forecourt pavement. Evenly distributed fine dark-gray mineral "
            "aggregate stone grit, subtle delicate spiderweb hairline cracks, light uniform desert dust "
            "speckles, and subtle micro-mottled weathered wear. Completely uniform density across the "
            "entire frame with NO tire tracks, NO skid marks, NO large stains, NO geometric edges or "
            "painted lines. Flat overcast diffuse lighting, zero directional shadows, zero vignette."
        ),
    },
    "mountain_rock": {
        "aspect_ratio": "1:1",
        "image_size": "1K",
        "target_size": (1024, 1024),
        "seamless": "organic",
        "flatten_strength": 0.85,
        "outputs": ["albedo", "normal"],
        "normal_strength": 4.2,
        "prompt": (
            "Orthographic straight-on flat photographic texture of fine-scale stratified arid Mojave "
            "desert granite mountainside rock surface. Evenly distributed weathered sedimentary rock "
            "strata, fine eroded scree fissures, and natural desert granite mineral texture in muted "
            "dusty slate-brown, warm charcoal-gray, and subtle dusty terracotta-rose stone tones. "
            "Uniform scale and even visual weight across the entire frame with NO single large boulder "
            "and NO bright orange patches. Completely flat overcast diffuse lighting, zero harsh cast "
            "shadows, zero sky, zero plants, zero vignette."
        ),
    },
    "corrugated_metal": {
        "aspect_ratio": "1:1",
        "image_size": "1K",
        "target_size": (1024, 1024),
        "seamless": "vertical_ribs",
        "flatten_strength": 0.65,
        "outputs": ["albedo", "normal", "roughness"],
        "normal_strength": 5.5,
        "roughness_range": (0.38, 0.68),
        "roughness_invert": True,  # painted rib crests smoother, dusty grooves rougher
        "prompt": (
            "Full-frame macro architectural photograph looking straight head-on at a flat wall of "
            "painted ribbed steel cladding in warm faded pastel coral-salmon pink. Uniform vertical "
            "fluted metal ridges run straight from top edge to bottom edge with subtle sun-bleached "
            "matte finish, light desert dust in the narrow valleys, and fine weathered metal surface "
            "grain. Soft even overcast daylight across the entire frame, no harsh shadows, no edges "
            "or sky visible, pure flat architectural surface study."
        ),
    },
    "store_shelves": {
        "aspect_ratio": "16:9",
        "image_size": "2K",
        "target_size": (1024, 512),
        "seamless": "none",
        "flatten_strength": 0.0,
        "outputs": ["albedo", "emissive"],
        "prompt": (
            "Straight-on orthographic interior wall view inside a cozy retro American desert convenience "
            "store at night, brightly lit with warm tungsten overhead fluorescent lights. Left half features "
            "illuminated glass-door beverage refrigerator coolers densely stocked with colorful soda cans, "
            "juice bottles, and water bottles glowing brightly inside; right half features neatly organized "
            "horizontal convenience store gondola shelves stocked with colorful snack bags, cereal boxes, "
            "candy packs, and sundries. Clean small geometric packaging colors with NO readable words, "
            "NO large text, NO logos, NO people, NO window mullions in foreground. Crisp photographic detail, "
            "warm golden interior glow, completely level front-on architectural elevation."
        ),
    },
    "wood_bark": {
        "aspect_ratio": "1:1",
        "image_size": "1K",
        "target_size": (1024, 1024),
        "seamless": "organic",
        "flatten_strength": 0.80,
        "outputs": ["albedo"],
        "prompt": (
            "Orthographic straight-on close-up macro photographic texture of dark weathered gnarled Mojave "
            "desert creosote shrub wood bark. Dry fibrous twisted vertical ridges, fine sun-cracked woody "
            "bark fibers in dark umber brown, weathered charcoal-gray, and dusty warm brown tones (#362523). "
            "Completely flat overcast diffuse lighting, zero harsh directional shadows, no leaves, no sky, "
            "no vignette, high-resolution seamless PBR bark albedo material scan."
        ),
    },
}

MUSIC_PROMPT = (
    "Dreamy, nostalgic instrumental lo-fi chillhop twilight desert road-trip beat at 82 BPM. "
    "Warm slightly detuned Rhodes electric piano playing lush melancholic jazzy major-9th and minor-9th "
    "chords with subtle analog tape chorus, deep rounded warm sub-bass, soft dusty muted lo-fi hip-hop "
    "drums with gentle kick, soft brushed rimshot on beats 2 and 4, subtle swung closed hi-hats, and "
    "warm sunset ambient synth pad glow. Smooth, steady, hypnotic, purely instrumental, no vocals, "
    "no spoken words, no sudden tempo changes, clean studio mix ideal for seamless looping."
)


def run_cmd(cmd, cwd=None):
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(
            f"Command failed ({res.returncode}): {' '.join(cmd)}\n"
            f"STDOUT: {res.stdout}\nSTDERR: {res.stderr}"
        )
    return res.stdout.strip()


def gaussian_blur_periodic(arr: np.ndarray, sigma: float) -> np.ndarray:
    """Fast periodic 2D Gaussian blur via FFT (handles 2D or HxWxC arrays)."""
    if sigma <= 0.1:
        return arr.copy()
    h, w = arr.shape[:2]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    kernel_f = np.exp(-2.0 * (math.pi ** 2) * (sigma ** 2) * (fx ** 2 + fy ** 2))
    if arr.ndim == 2:
        return np.fft.ifft2(np.fft.fft2(arr) * kernel_f).real.astype(np.float32)
    out = np.empty_like(arr, dtype=np.float32)
    for c in range(arr.shape[2]):
        out[:, :, c] = np.fft.ifft2(np.fft.fft2(arr[:, :, c]) * kernel_f).real
    return out


def gaussian_blur_reflect(arr: np.ndarray, sigma: float) -> np.ndarray:
    """Non-periodic Gaussian blur using PIL (exact reflection padding via pad)."""
    if sigma <= 0.1:
        return arr.copy()
    pad = int(math.ceil(sigma * 3.0))
    if arr.ndim == 2:
        padded = np.pad(arr, ((pad, pad), (pad, pad)), mode="reflect")
        pil_img = Image.fromarray(np.clip(padded * 255.0, 0, 255).astype(np.uint8))
        blurred = np.asarray(pil_img.filter(ImageFilter.GaussianBlur(radius=sigma)), dtype=np.float32) / 255.0
        return blurred[pad:-pad, pad:-pad]
    out = np.empty_like(arr, dtype=np.float32)
    for c in range(arr.shape[2]):
        out[:, :, c] = gaussian_blur_reflect(arr[:, :, c], sigma)
    return out


def flatten_lighting(rgb: np.ndarray, strength: float, horizontal_only_preserve: bool = False) -> np.ndarray:
    """Remove low-frequency uneven illumination / vignette while preserving local albedo contrast."""
    if strength <= 0.0:
        return rgb
    h, w, _ = rgb.shape
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    sigma = min(h, w) / 7.5
    low_lum = gaussian_blur_reflect(lum, sigma)
    mean_lum = float(np.mean(low_lum)) + 1e-5
    ratio = np.clip(low_lum / mean_lum, 0.55, 1.85)
    correction = (1.0 / ratio) ** strength
    out = rgb * correction[:, :, None]
    # Soft roll-off to avoid harsh clipping
    return np.clip(out, 0.0, 1.0)


def periodic_fbm_noise(h: int, w: int, seed: int = 42) -> np.ndarray:
    """Generate smooth periodic low-frequency noise in [-1, 1] for organic seam contours."""
    rng = np.random.default_rng(seed)
    noise = np.zeros((h, w), dtype=np.float32)
    yy = np.linspace(0.0, 2.0 * math.pi, h, endpoint=False)[:, None]
    xx = np.linspace(0.0, 2.0 * math.pi, w, endpoint=False)[None, :]
    amp = 1.0
    total_amp = 0.0
    for freq in (1, 2, 3, 5):
        for _ in range(3):
            kx = int(rng.integers(-freq, freq + 1))
            ky = int(rng.integers(-freq, freq + 1))
            if kx == 0 and ky == 0:
                kx = freq
            phase = float(rng.uniform(0, 2.0 * math.pi))
            noise += amp * np.sin(kx * xx + ky * yy + phase)
            total_amp += amp
        amp *= 0.55
    return noise / max(total_amp, 1e-5)


def make_seamless_organic(rgb: np.ndarray, seed: int = 42) -> np.ndarray:
    """
    Two-band Laplacian organic seamless blending:
    - Low-frequency color/tone blends smoothly across a wide window -> zero tonal grid.
    - High-frequency detail switches along a noise-perturbed contour -> zero ghosting/blur.
    - Mathematically periodic at x=0/W and y=0/H.
    """
    h, w, _ = rgb.shape
    shifted = np.roll(np.roll(rgb, h // 2, axis=0), w // 2, axis=1)

    # Smooth periodic weight: 1 at image center (seamless in rgb), 0 at borders (seamless in shifted)
    y = np.linspace(0.0, math.pi, h, endpoint=False)[:, None]
    x = np.linspace(0.0, math.pi, w, endpoint=False)[None, :]
    base_w = (np.sin(y) * np.sin(x)) ** 1.35  # in [0, 1], 0 on all borders, 1 at center

    # Perturb interior contour organically while forcing exact 0 at borders and 1 near center
    n = periodic_fbm_noise(h, w, seed=seed)
    mask_interior = np.sin(y) * np.sin(x)
    perturbed = np.clip(base_w + 0.22 * n * mask_interior * (1.0 - base_w), 0.0, 1.0)

    # Low-frequency smooth weight (wide blend)
    w_low = np.clip((perturbed - 0.12) / 0.76, 0.0, 1.0)
    w_low = w_low * w_low * (3.0 - 2.0 * w_low)  # smoothstep

    # High-frequency crisp weight (narrow transition to eliminate double-exposure blur)
    w_high = 1.0 / (1.0 + np.exp(-26.0 * (perturbed - 0.5)))
    # Force exact 0 on border band (2px) so periodicity is mathematically exact
    border_fade = np.clip(mask_interior / 0.08, 0.0, 1.0)
    w_low *= border_fade
    w_high *= border_fade

    # Decompose both images into low + high bands (reflect blur is fine before blending)
    band_sigma = min(h, w) / 48.0
    rgb_low = gaussian_blur_reflect(rgb, band_sigma)
    rgb_high = rgb - rgb_low

    sh_low = gaussian_blur_reflect(shifted, band_sigma)
    sh_high = shifted - sh_low

    blended_low = rgb_low * w_low[:, :, None] + sh_low * (1.0 - w_low[:, :, None])
    blended_high = rgb_high * w_high[:, :, None] + sh_high * (1.0 - w_high[:, :, None])

    return np.clip(blended_low + blended_high, 0.0, 1.0)


def make_seamless_vertical_ribs(rgb: np.ndarray, target_size=(1024, 1024)) -> np.ndarray:
    """
    Phase-locked seamless tiling for vertical corrugated metal:
    1. Detect dominant horizontal corrugation frequency via 1D FFT of column luminance.
    2. Crop horizontally to an exact integer number of corrugation ribs (trough-to-trough).
    3. Resize back to target width, then perform narrow horizontal seam blend + organic vertical seam blend.
    """
    h, w, _ = rgb.shape
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    col_profile = np.mean(lum, axis=0)
    col_profile = col_profile - np.mean(col_profile)

    # Find dominant rib frequency between 8 and 60 cycles across image width
    fft_mag = np.abs(np.fft.rfft(col_profile))
    min_k = max(8, w // 128)
    max_k = min(64, w // 16)
    dom_k = min_k + int(np.argmax(fft_mag[min_k:max_k]))
    period = w / float(dom_k)

    # Refine period with autocorrelation around `period`
    ac = np.correlate(col_profile, col_profile, mode="full")[w - 1 :]
    lo = max(8, int(round(period * 0.85)))
    hi = min(w // 4, int(round(period * 1.15)))
    if hi > lo:
        refined_period = float(lo + int(np.argmax(ac[lo : hi + 1])))
    else:
        refined_period = period

    num_cycles = max(8, int(math.floor((w * 0.94) / refined_period)))
    crop_w = int(round(num_cycles * refined_period))
    crop_w = min(w, max(64, crop_w))
    start_x = (w - crop_w) // 2
    cropped = rgb[:, start_x : start_x + crop_w, :]

    # Resize to target_size cleanly
    pil_crop = Image.fromarray(np.clip(cropped * 255.0, 0, 255).astype(np.uint8))
    pil_res = pil_crop.resize(target_size, Image.Resampling.LANCZOS)
    img = np.asarray(pil_res, dtype=np.float32) / 255.0
    th, tw, _ = img.shape

    # Horizontal phase-locked seam blend (shift by half width, blend narrow seam band)
    # Wait: if num_cycles is odd, half-width shift shifts by half a rib!
    # Shift by integer number of rib cycles closest to tw // 2!
    half_cycles = max(1, num_cycles // 2)
    shift_x = int(round(half_cycles * (tw / float(num_cycles))))
    sh_x = np.roll(img, shift_x, axis=1)

    x = np.linspace(0.0, math.pi, tw, endpoint=False)[None, :]
    wx = np.sin(x)
    wx_smooth = np.clip((wx - 0.05) / 0.25, 0.0, 1.0)
    wx_smooth = wx_smooth * wx_smooth * (3.0 - 2.0 * wx_smooth)
    img_x = img * wx_smooth[:, :, None] + sh_x * (1.0 - wx_smooth[:, :, None])

    # Vertical seamless blend (ribs run straight vertically, so 2-band vertical blend is super clean)
    sh_y = np.roll(img_x, th // 2, axis=0)
    y = np.linspace(0.0, math.pi, th, endpoint=False)[:, None]
    n = periodic_fbm_noise(th, tw, seed=108)
    wy_base = np.sin(y) ** 1.25
    wy_pert = np.clip(wy_base + 0.15 * n * np.sin(y) * (1.0 - wy_base), 0.0, 1.0)
    wy_low = np.clip((wy_pert - 0.12) / 0.76, 0.0, 1.0)
    wy_low = wy_low * wy_low * (3.0 - 2.0 * wy_low)
    wy_high = 1.0 / (1.0 + np.exp(-24.0 * (wy_pert - 0.5)))
    bf = np.clip(np.sin(y) / 0.08, 0.0, 1.0)
    wy_low *= bf
    wy_high *= bf

    sigma = th / 48.0
    l1 = gaussian_blur_periodic(img_x, sigma)
    h1 = img_x - l1
    l2 = gaussian_blur_periodic(sh_y, sigma)
    h2 = sh_y - l2

    out = (l1 * wy_low[:, :, None] + l2 * (1.0 - wy_low[:, :, None])) + (
        h1 * wy_high[:, :, None] + h2 * (1.0 - wy_high[:, :, None])
    )
    return np.clip(out, 0.0, 1.0)


def generate_normal_map(rgb: np.ndarray, strength: float = 3.0, rib_emphasis: bool = False) -> np.ndarray:
    """
    Generate a seamless OpenGL tangent-space normal map (+X right, +Y up, +Z out)
    using multi-scale periodic Scharr derivatives.
    """
    # Linearize luminance for height estimate
    lin = np.power(np.clip(rgb, 0.0, 1.0), 2.2)
    h_raw = 0.25 * lin[:, :, 0] + 0.55 * lin[:, :, 1] + 0.20 * lin[:, :, 2]

    # Normalize heightfield contrast gently (robust percentiles)
    p5, p95 = np.percentile(h_raw, [3, 97])
    height = np.clip((h_raw - p5) / max(p95 - p5, 1e-4), 0.0, 1.0)

    # Multi-scale height fusion: fine + medium + macro relief
    h_fine = gaussian_blur_periodic(height, 0.7)
    h_med = gaussian_blur_periodic(height, 2.2)
    h_macro = gaussian_blur_periodic(height, 6.0)
    if rib_emphasis:
        h_fused = 0.25 * h_fine + 0.45 * h_med + 0.30 * h_macro
    else:
        h_fused = 0.45 * h_fine + 0.38 * h_med + 0.17 * h_macro

    # Periodic 3x3 Scharr kernel for dx and dy (row-downward)
    def scharr_grad(img):
        tl = np.roll(np.roll(img, 1, axis=0), 1, axis=1)
        tc = np.roll(img, 1, axis=0)
        tr = np.roll(np.roll(img, 1, axis=0), -1, axis=1)
        ml = np.roll(img, 1, axis=1)
        mr = np.roll(img, -1, axis=1)
        bl = np.roll(np.roll(img, -1, axis=0), 1, axis=1)
        bc = np.roll(img, -1, axis=0)
        br = np.roll(np.roll(img, -1, axis=0), -1, axis=1)
        gx = (3.0 * tr + 10.0 * mr + 3.0 * br - 3.0 * tl - 10.0 * ml - 3.0 * bl) / 32.0
        gy = (3.0 * bl + 10.0 * bc + 3.0 * br - 3.0 * tl - 10.0 * tc - 3.0 * tr) / 32.0
        return gx, gy

    gx_f, gy_f = scharr_grad(h_fused)
    gx_m, gy_m = scharr_grad(h_macro)
    gx = gx_f + 1.4 * gx_m
    gy = gy_f + 1.4 * gy_m

    if rib_emphasis:
        # Emphasize vertical rib curvature along X, keep Y subtle
        gx *= 1.35
        gy *= 0.45

    nx = -gx * strength
    ny = gy * strength  # OpenGL +Y up: downward height increase => upward-facing normal
    nz = np.ones_like(nx, dtype=np.float32)

    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)
    nx *= inv_len
    ny *= inv_len
    nz *= inv_len

    normal_rgb = np.stack([nx * 0.5 + 0.5, ny * 0.5 + 0.5, nz * 0.5 + 0.5], axis=-1)
    return np.clip(normal_rgb, 0.0, 1.0)


def generate_roughness_map(rgb: np.ndarray, low: float, high: float, invert: bool = True) -> np.ndarray:
    """Derive a calibrated seamless grayscale roughness map from albedo micro-detail + luminance."""
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    # Add local high-frequency texture variance (grainier areas -> rougher)
    local_mean = gaussian_blur_periodic(lum, 2.5)
    local_var = np.sqrt(np.maximum(gaussian_blur_periodic((lum - local_mean) ** 2, 3.0), 0.0))

    p5, p95 = np.percentile(lum, [5, 95])
    lum_n = np.clip((lum - p5) / max(p95 - p5, 1e-4), 0.0, 1.0)
    vp95 = float(np.percentile(local_var, 95)) + 1e-5
    var_n = np.clip(local_var / vp95, 0.0, 1.0)

    if invert:
        # Higher albedo (pebbles, painted crests) -> smoother; crevices -> rougher
        t = 0.72 * (1.0 - lum_n) + 0.28 * var_n
    else:
        # Darker worn concrete/asphalt -> smoother; dusty/brighter grit -> rougher
        t = 0.68 * lum_n + 0.32 * var_n

    t = np.clip(t, 0.0, 1.0)
    return low + t * (high - low)


def generate_store_emissive(rgb: np.ndarray) -> np.ndarray:
    """
    Create a vivid, warm interior emissive map for store_shelves:
    - Keeps brightly lit cooler bays, shelf light strips, and glowing product silhouettes.
    - Suppresses dark frames, mullions, and deep shadows to pure black so only genuine light glows.
    """
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    # Smooth threshold suppressing dark structural frames (< 0.22) and boosting illuminated interiors
    mask = np.clip((lum - 0.18) / 0.58, 0.0, 1.0)
    mask = np.power(mask, 1.35)
    # Warm subtle tungsten lift on brightly lit areas while keeping cooler whites crisp
    emissive = rgb * mask[:, :, None]
    # Gentle boost to make brightly lit shelves pop cleanly in HDR
    emissive = np.clip(np.power(emissive, 0.88) * 1.12, 0.0, 1.0)
    return emissive


def generate_raw_texture(name: str, spec: dict, force: bool = False) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    raw_base = RAW_DIR / f"{name}_raw.png"
    # gemini-api may adjust extension to .jpg or .png depending on mime; check both
    existing = list(RAW_DIR.glob(f"{name}_raw.*"))
    if existing and not force:
        return existing[0]
    for p in existing:
        p.unlink()

    cmd = [
        "gemini-api",
        "image",
        spec["prompt"],
        "-m",
        IMAGE_MODEL,
        "--aspect-ratio",
        spec["aspect_ratio"],
        "--image-size",
        spec["image_size"],
        "--out",
        str(raw_base),
    ]
    print(f"[image] Generating {name} ({IMAGE_MODEL}, {spec['aspect_ratio']}, {spec['image_size']})...")
    out_path_str = run_cmd(cmd)
    out_path = Path(out_path_str.splitlines()[-1].strip())
    print(f"[image] Saved raw {name} -> {out_path}")
    return out_path


def process_texture(name: str, spec: dict, raw_path: Path):
    TEX_DIR.mkdir(parents=True, exist_ok=True)
    img = Image.open(raw_path).convert("RGB")
    target_w, target_h = spec["target_size"]

    if spec["seamless"] == "vertical_ribs":
        rgb = np.asarray(img, dtype=np.float32) / 255.0
        rgb = flatten_lighting(rgb, spec.get("flatten_strength", 0.65))
        albedo = make_seamless_vertical_ribs(rgb, target_size=(target_w, target_h))
    else:
        if img.size != (target_w, target_h):
            img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        rgb = np.asarray(img, dtype=np.float32) / 255.0
        rgb = flatten_lighting(rgb, spec.get("flatten_strength", 0.0))
        if spec["seamless"] == "organic":
            seed = sum(ord(c) for c in name) + 17
            albedo = make_seamless_organic(rgb, seed=seed)
        else:
            albedo = np.clip(rgb, 0.0, 1.0)

    outputs = spec["outputs"]
    if "albedo" in outputs:
        out_albedo = TEX_DIR / f"{name}_albedo.jpg"
        Image.fromarray(np.clip(albedo * 255.0, 0, 255).astype(np.uint8)).save(
            out_albedo, format="JPEG", quality=92, optimize=True
        )
        print(f"[pbr] Wrote {out_albedo.relative_to(REPO_ROOT)} ({out_albedo.stat().st_size // 1024} KB)")

    if "normal" in outputs:
        out_normal = TEX_DIR / f"{name}_normal.png"
        normal = generate_normal_map(
            albedo,
            strength=spec.get("normal_strength", 3.0),
            rib_emphasis=(spec["seamless"] == "vertical_ribs"),
        )
        Image.fromarray(np.clip(normal * 255.0, 0, 255).astype(np.uint8)).save(
            out_normal, format="PNG", optimize=True
        )
        print(f"[pbr] Wrote {out_normal.relative_to(REPO_ROOT)} ({out_normal.stat().st_size // 1024} KB)")

    if "roughness" in outputs:
        out_rough = TEX_DIR / f"{name}_roughness.png"
        lo, hi = spec.get("roughness_range", (0.5, 0.9))
        rough = generate_roughness_map(
            albedo, low=lo, high=hi, invert=spec.get("roughness_invert", True)
        )
        Image.fromarray(np.clip(rough * 255.0, 0, 255).astype(np.uint8), mode="L").save(
            out_rough, format="PNG", optimize=True
        )
        print(f"[pbr] Wrote {out_rough.relative_to(REPO_ROOT)} ({out_rough.stat().st_size // 1024} KB)")

    if "emissive" in outputs:
        out_emissive = TEX_DIR / f"{name}_emissive.jpg"
        emissive = generate_store_emissive(albedo)
        Image.fromarray(np.clip(emissive * 255.0, 0, 255).astype(np.uint8)).save(
            out_emissive, format="JPEG", quality=92, optimize=True
        )
        print(f"[pbr] Wrote {out_emissive.relative_to(REPO_ROOT)} ({out_emissive.stat().st_size // 1024} KB)")


def generate_and_process_audio(force: bool = False):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    existing = list(RAW_DIR.glob("twilight_lofi_raw.*"))
    if existing and not force:
        raw_audio = existing[0]
    else:
        for p in existing:
            p.unlink()
        raw_target = RAW_DIR / "twilight_lofi_raw.mp3"
        cmd = [
            "gemini-api",
            "music",
            MUSIC_PROMPT,
            "-m",
            MUSIC_MODEL,
            "--out",
            str(raw_target),
        ]
        print(f"[music] Generating twilight lo-fi track ({MUSIC_MODEL})...")
        out_path_str = run_cmd(cmd)
        raw_audio = Path(out_path_str.splitlines()[-1].strip())
        print(f"[music] Saved raw audio -> {raw_audio}")

    # Probe duration
    dur_str = run_cmd(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(raw_audio),
        ]
    )
    dur = float(dur_str)
    print(f"[music] Raw audio duration: {dur:.2f}s")

    # Build a clean seamless loop (~23.39s = exact 8-bar harmonic/beat loop @ ~82 BPM)
    # Start at 16.0s inside the full Rhodes + sub-bass + muted-drum groove (skipping quiet intro).
    xfade = 0.85
    target_loop = 23.390
    start_offset = 16.0 if dur > target_loop + xfade + 18.0 else (2.0 if dur > target_loop + xfade + 3.0 else 0.5)
    if dur < target_loop + xfade + start_offset:
        target_loop = max(11.695, dur - xfade - start_offset - 0.5)

    out_mp3 = AUDIO_DIR / "twilight_lofi.mp3"
    # Slice:
    #   head = [start_offset, start_offset + target_loop]
    #   tail = [start_offset + target_loop, start_offset + target_loop + xfade]
    # Overlap tail onto the very beginning [0, xfade] of head with smooth equal-power fade-in/out!
    # Wait: even simpler & mathematically seamless:
    # Take body = [start_offset + xfade, start_offset + target_loop]
    # Take pre  = [start_offset, start_offset + xfade] (fade-in 0->1)
    # Take post = [start_offset + target_loop, start_offset + target_loop + xfade] (fade-out 1->0)
    # Mix pre + post -> seamless_intro (length xfade), then concat seamless_intro + body!
    # At loop wrap (end of body -> start of seamless_intro), end of body flows smoothly into post (which was contiguous after body!) while pre fades in!
    t0 = start_offset
    t1 = start_offset + xfade
    t2 = start_offset + target_loop
    t3 = start_offset + target_loop + xfade

    filter_complex = (
        f"[0:a]atrim=start={t0:.4f}:end={t1:.4f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d={xfade:.4f}:curve=qsin[pre];"
        f"[0:a]atrim=start={t2:.4f}:end={t3:.4f},asetpts=PTS-STARTPTS,"
        f"afade=t=out:st=0:d={xfade:.4f}:curve=qsin[post];"
        f"[pre][post]amix=inputs=2:duration=shortest:normalize=0[seam];"
        f"[0:a]atrim=start={t1:.4f}:end={t2:.4f},asetpts=PTS-STARTPTS[body];"
        f"[seam][body]concat=n=2:v=0:a=1,"
        f"loudnorm=I=-16:TP=-1.5:LRA=11[out]"
    )

    run_cmd(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw_audio),
            "-filter_complex",
            filter_complex,
            "-map",
            "[out]",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "160k",
            "-ar",
            "44100",
            "-ac",
            "2",
            str(out_mp3),
        ]
    )
    size_kb = out_mp3.stat().st_size / 1024.0
    out_dur = float(
        run_cmd(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(out_mp3),
            ]
        )
    )
    print(f"[music] Wrote {out_mp3.relative_to(REPO_ROOT)} ({size_kb:.1f} KB, {out_dur:.2f}s seamless loop)")


def build_tiling_check_sheet():
    """Save 2x2 tiled preview sheets in RAW_DIR/checks so we can visually inspect seams."""
    check_dir = RAW_DIR / "checks"
    check_dir.mkdir(parents=True, exist_ok=True)
    for name, spec in TEXTURE_SPECS.items():
        albedo_p = TEX_DIR / f"{name}_albedo.jpg"
        if not albedo_p.exists():
            continue
        img = Image.open(albedo_p)
        if spec["seamless"] != "none":
            thumb = img.resize((512, 512), Image.Resampling.LANCZOS)
            tile2x2 = Image.new("RGB", (1024, 1024))
            for ty in (0, 512):
                for tx in (0, 512):
                    tile2x2.paste(thumb, (tx, ty))
            tile2x2.save(check_dir / f"{name}_2x2_check.jpg", quality=90)
        else:
            img.save(check_dir / f"{name}_check.jpg", quality=92)


def main():
    parser = argparse.ArgumentParser(description="Generate and post-process Twilight Mojave PBR + Audio assets")
    parser.add_argument("--only", nargs="*", help="Subset of assets to run (texture names and/or 'audio')")
    parser.add_argument("--reprocess", action="store_true", help="Reuse cached raw files and only re-run PBR/ffmpeg processing")
    parser.add_argument("--force", action="store_true", help="Force regeneration of raw assets even if cached")
    args = parser.parse_args()

    targets = args.only if args.only else list(TEXTURE_SPECS.keys()) + ["audio"]
    tex_targets = [t for t in targets if t in TEXTURE_SPECS]
    do_audio = "audio" in targets

    # Run Gemini API calls in parallel for speed!
    raw_paths = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {}
        for name in tex_targets:
            futures[ex.submit(generate_raw_texture, name, TEXTURE_SPECS[name], args.force and not args.reprocess)] = ("tex", name)
        if do_audio:
            futures[ex.submit(generate_and_process_audio, args.force and not args.reprocess)] = ("audio", "audio")

        for fut in concurrent.futures.as_completed(futures):
            kind, name = futures[fut]
            res = fut.result()
            if kind == "tex":
                raw_paths[name] = res

    for name in tex_targets:
        process_texture(name, TEXTURE_SPECS[name], raw_paths[name])

    build_tiling_check_sheet()
    print("[done] Asset Forge complete.")


if __name__ == "__main__":
    main()
