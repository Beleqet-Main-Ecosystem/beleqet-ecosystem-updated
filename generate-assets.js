/**
 * generate-assets.js
 * Generates all required Expo mobile app PNG assets using sharp.
 * Run: node generate-assets.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'apps', 'mobile', 'assets');
fs.mkdirSync(OUT, { recursive: true });

// ── Beleqet brand colours ──────────────────────────────────────────────────
const PRIMARY   = { r: 4,   g: 22,  b: 3   };   // #041603
const GREEN     = { r: 216, g: 255, b: 62  };   // #d8ff3e
const WHITE     = { r: 255, g: 255, b: 255 };

// ── Helper: generate raw RGBA pixel buffer ─────────────────────────────────

/**
 * Draw a centred "B" letter mark on a dark-green background.
 * Returns a { data: Buffer, info } from sharp.
 */
async function makeIconBuffer(size) {
  // Background: solid PRIMARY
  const bg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { ...PRIMARY, alpha: 255 },
    },
  })
    .png()
    .toBuffer();

  // Rounded-rectangle mask (simulates rounded corners)
  const radius = Math.round(size * 0.22);
  const roundedSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}"
            rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`;

  // Letter "B" centred, bold
  const fontSize = Math.round(size * 0.52);
  const letterSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%" y="56%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900"
        font-size="${fontSize}"
        fill="#d8ff3e"
      >B</text>
    </svg>`;

  // Accent dot (top-right corner, brandGreen)
  const dotR   = Math.round(size * 0.08);
  const dotX   = Math.round(size * 0.72);
  const dotY   = Math.round(size * 0.16);
  const dotSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="#d8ff3e" opacity="0.85"/>
    </svg>`;

  const composed = await sharp(bg)
    .composite([
      // Apply rounded-corner mask
      { input: Buffer.from(roundedSvg), blend: 'dest-in' },
      // Letter
      { input: Buffer.from(letterSvg), blend: 'over' },
      // Accent dot
      { input: Buffer.from(dotSvg),    blend: 'over' },
    ])
    .png()
    .toBuffer();

  return composed;
}

// ── 1. icon.png — 1024×1024 ───────────────────────────────────────────────

async function makeIcon() {
  const buf = await makeIconBuffer(1024);
  const out = path.join(OUT, 'icon.png');
  await sharp(buf).png().toFile(out);
  console.log(`✅  icon.png            (1024×1024)  →  ${out}`);
}

// ── 2. adaptive-icon.png — 1024×1024 (no rounding, full bleed) ───────────

async function makeAdaptiveIcon() {
  const size = 1024;
  const fontSize = Math.round(size * 0.52);

  const letterSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%" y="56%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900"
        font-size="${fontSize}"
        fill="#d8ff3e"
      >B</text>
    </svg>`;

  const out = path.join(OUT, 'adaptive-icon.png');
  await sharp({
    create: {
      width: size, height: size, channels: 4,
      background: { ...PRIMARY, alpha: 255 },
    },
  })
    .composite([{ input: Buffer.from(letterSvg), blend: 'over' }])
    .png()
    .toFile(out);

  console.log(`✅  adaptive-icon.png   (1024×1024)  →  ${out}`);
}

// ── 3. splash.png — 1284×2778 ─────────────────────────────────────────────

async function makeSplash() {
  const W = 1284, H = 2778;

  // Logo mark (centred, 280px)
  const logoSize = 280;
  const logoBuffer = await makeIconBuffer(logoSize);

  // "Beleqet Jobs" wordmark SVG
  const wordmarkSvg = `
    <svg width="${W}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%" y="68"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900"
        font-size="72"
        fill="white"
        letter-spacing="-2"
      >Beleqet Jobs</text>
    </svg>`;

  // Tagline SVG
  const taglineSvg = `
    <svg width="${W}" height="60" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%" y="36"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="38"
        fill="rgba(255,255,255,0.45)"
      >Ethiopia's Jobs &amp; Freelance Marketplace</text>
    </svg>`;

  // Green accent bar at bottom
  const accentSvg = `
    <svg width="${W}" height="8" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="8" rx="4" fill="#d8ff3e"/>
    </svg>`;

  const logoTop      = Math.round(H * 0.36);    // logo centred slightly above middle
  const wordmarkTop  = logoTop + logoSize + 40;
  const taglineTop   = wordmarkTop + 130;
  const accentBottom = H - 80;

  const out = path.join(OUT, 'splash.png');
  await sharp({
    create: { width: W, height: H, channels: 4, background: { ...PRIMARY, alpha: 255 } },
  })
    .composite([
      { input: logoBuffer,                    top: logoTop,      left: Math.round((W - logoSize) / 2) },
      { input: Buffer.from(wordmarkSvg),      top: wordmarkTop,  left: 0 },
      { input: Buffer.from(taglineSvg),       top: taglineTop,   left: 0 },
      { input: Buffer.from(accentSvg),        top: accentBottom, left: Math.round((W - 120) / 2) },
    ])
    .png()
    .toFile(out);

  console.log(`✅  splash.png          (1284×2778)  →  ${out}`);
}

// ── 4. notification-icon.png — 96×96, white on transparent ───────────────

async function makeNotificationIcon() {
  const size = 96;
  const fontSize = Math.round(size * 0.56);

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%" y="58%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900"
        font-size="${fontSize}"
        fill="white"
      >B</text>
    </svg>`;

  const out = path.join(OUT, 'notification-icon.png');
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toFile(out);

  console.log(`✅  notification-icon.png (96×96)    →  ${out}`);
}

// ── 5. favicon.png — 48×48 ────────────────────────────────────────────────

async function makeFavicon() {
  const buf = await makeIconBuffer(48);
  const out = path.join(OUT, 'favicon.png');
  await sharp(buf).resize(48, 48).png().toFile(out);
  console.log(`✅  favicon.png          (48×48)     →  ${out}`);
}

// ── Run all ────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n🎨  Generating Beleqet mobile assets…\n');
  await makeIcon();
  await makeAdaptiveIcon();
  await makeSplash();
  await makeNotificationIcon();
  await makeFavicon();
  console.log('\n✅  All assets generated in apps/mobile/assets/\n');
})().catch((err) => {
  console.error('❌  Asset generation failed:', err);
  process.exit(1);
});
