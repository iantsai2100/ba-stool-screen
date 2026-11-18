import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Where the app is served from, as a path with leading and trailing slashes.
 *
 * "/" because the app is deployed to its own subdomain
 * (bastoolscreen.<domain>), which means it owns the whole origin: no base
 * path, no nesting, and a service worker whose scope is the entire site.
 *
 * This stays the ONE place a deployment path would be written down. Asset
 * URLs, the service worker's precache list, its scope and its registration URL
 * all derive from it, because a base path that is right in four places and
 * wrong in the fifth produces an app that loads and then fails to go offline —
 * the worst of both outcomes.
 *
 * `manifest.json` needs nothing from this at any path: its URLs are relative,
 * so they resolve against wherever the manifest itself is served.
 *
 * To serve from a sub-path of a larger site instead:
 *   BASE_PATH=/bastoolscreen/ npm run build
 */
const BASE = process.env.BASE_PATH ?? "/";

/**
 * At the root this is plain `dist`. For a sub-path build the output is nested
 * to match, since a static host publishes one directory and the app has to sit
 * at the right depth inside it.
 */
const OUT_DIR = BASE === "/" ? "dist" : `dist${BASE.replace(/\/$/, "")}`;

/**
 * Emits sw.js from scripts/sw-template.js with the base path, the precache
 * list and a build id substituted in.
 *
 * The build id is a hash of the precached URLs, so it changes exactly when the
 * app's content changes. Since the cache name is keyed to it, a new build gets
 * a fresh cache and the activate handler drops the old one — no stale-asset
 * class of bug to reason about, and a rebuild that changes nothing reuses the
 * cache the user already has rather than re-downloading it.
 *
 * Only runs on build. In dev there is no service worker at all, which keeps
 * HMR honest; src/lib/pwa.js registers only in production.
 */
function pwa() {
  const atBase = (path) => `${BASE}${path}`.replace(/\/{2,}/g, "/");

  const extraPrecache = [
    BASE,
    atBase("index.html"),
    atBase("manifest.json"),
    atBase("icons/icon-192.png"),
    atBase("icons/icon-512.png"),
    atBase("icons/maskable-512.png"),
    atBase("icons/icon-180.png"),
  ];

  return {
    name: "ba-stool-pwa",
    apply: "build",
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((name) => /\.(js|css|woff2?)$/.test(name))
        .map((name) => atBase(name));

      const precache = [...new Set([...extraPrecache, ...assets])].sort();

      const buildId = createHash("sha256")
        .update([BASE, ...precache].join("\n"))
        .digest("hex")
        .slice(0, 12);

      // replaceAll, not replace: a string pattern only swaps the first match,
      // which silently left the real declarations untouched when a placeholder
      // also appeared in a comment above them.
      const source = readFileSync("scripts/sw-template.js", "utf8")
        .replaceAll("__BUILD_ID__", buildId)
        .replaceAll("__BASE__", JSON.stringify(BASE))
        .replaceAll("__PRECACHE__", JSON.stringify(precache, null, 2));

      if (/__BUILD_ID__|__PRECACHE__|__BASE__/.test(source)) {
        this.error("sw-template.js still contains unsubstituted placeholders");
      }

      this.emitFile({ type: "asset", fileName: "sw.js", source });

      // Surfaced so a deploy log says what is going out; the same values are
      // readable at runtime via the GET_BUILD_ID message.
      this.warn(`service worker: base ${BASE}, build id ${buildId}`);
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [react(), pwa()],
  server: {
    port: 5173,
    // `npm run dev:host` exposes the dev server on the LAN so a phone on the
    // same Wi-Fi can open it. Note that getUserMedia and the camera capture
    // attribute are restricted over plain HTTP; for real device testing,
    // deploy and use the HTTPS URL.
    host: false,
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    sourcemap: false,
  },
});
