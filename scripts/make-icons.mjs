/**
 * Renders public/icons/icon.svg to the PNG sizes the manifest and iOS need.
 *
 *   npm run icons
 *
 * Uses the Chromium that Playwright already provides rather than adding an
 * image library: the icon is vector art, and a browser is the one renderer
 * guaranteed to agree with how the SVG would look if a platform rendered it
 * itself.
 *
 * Sizes:
 *   icon-192.png       Android home screen
 *   icon-512.png       install prompt / splash
 *   icon-180.png       iOS apple-touch-icon (iOS ignores the manifest for this)
 *   maskable-512.png   Android adaptive icon — artwork inset into the centre
 *                      80% so a circular or squircle mask cannot clip the bars
 */

import { chromium } from "playwright-core";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, "..", "public", "icons");

const TARGETS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-180.png", size: 180, maskable: false },
  { file: "maskable-512.png", size: 512, maskable: true },
];

/** Android's adaptive-icon safe zone: content must sit in the centre 80%. */
const SAFE_ZONE = 0.8;

const svg = await readFile(join(iconsDir, "icon.svg"), "utf8");

/**
 * For the maskable variant the background must bleed to the full canvas while
 * the artwork shrinks into the safe zone, so the two are composited rather
 * than simply scaling the whole SVG down.
 */
function page(size, maskable) {
  const inner = maskable
    ? `<div class="bleed"></div>
       <div class="safe">${svg}</div>`
    : svg;

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; }
  html, body { width: ${size}px; height: ${size}px; overflow: hidden; }
  body { position: relative; }
  svg { display: block; width: 100%; height: 100%; }
  .bleed {
    position: absolute; inset: 0;
    background: linear-gradient(145deg, #2D7D9A 0%, #1F6A85 55%, #174F66 100%);
  }
  .safe {
    position: absolute;
    inset: ${((1 - SAFE_ZONE) / 2) * 100}%;
  }
  /* The inset artwork keeps its own background, which would read as a square
     badge inside the mask; drop it and let .bleed show through. */
  .safe svg > rect:first-of-type { display: none; }
</style></head><body>${inner}</body></html>`;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

for (const { file, size, maskable } of TARGETS) {
  const p = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await p.setContent(page(size, maskable), { waitUntil: "load" });
  const buffer = await p.screenshot({ omitBackground: false });
  await writeFile(join(iconsDir, file), buffer);
  await p.close();
  console.log(`  ${file}  ${size}×${size}${maskable ? "  (maskable)" : ""}`);
}

await browser.close();
console.log("\nIcons written to public/icons/");
