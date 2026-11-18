/**
 * Checks a built-and-served app against the base path it was built for.
 *
 *   npm run build && npm run preview          # in one terminal
 *   npm run verify:deploy                     # in another
 *
 * or against any origin and base:
 *
 *   node scripts/verify-deploy.mjs https://bastoolscreen.example.com /
 *   node scripts/verify-deploy.mjs http://localhost:4175 /bastoolscreen/
 *
 * Worth running after any change to BASE in vite.config.js. A wrong base path
 * is invisible online — the app loads and looks fine — and total offline,
 * because the service worker's scope or its precache URLs no longer match what
 * the browser asks for. These assertions are what separate the two.
 */
import { chromium } from "playwright-core";

const ORIGIN = process.argv[2] ?? "http://localhost:4173";
const BASE = process.argv[3] ?? "/";
const APP = ORIGIN + BASE;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

let failed = 0;
const ok = (l, c, d = "") => { if (!c) failed++; console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? "  — " + d : ""}`); };

console.log(`\n=== base ${BASE} ===`);
await page.goto(APP, { waitUntil: "networkidle" });
ok("app renders", (await page.textContent("h1")) === "新生兒大便顏色辨識");

const man = await page.evaluate(async () => {
  const href = document.querySelector("link[rel=manifest]").href;
  const m = await (await fetch(href)).json();
  return {
    href: new URL(href).pathname,
    start: new URL(m.start_url, href).pathname,
    scope: new URL(m.scope, href).pathname,
    icons: m.icons.map(i => new URL(i.src, href).pathname),
  };
});
ok("manifest served at the base", man.href === BASE + "manifest.json", man.href);
ok("start_url resolves to the app root", man.start === BASE, man.start);
ok("scope resolves to the app root", man.scope === BASE, man.scope);
ok("icons resolve under the base", man.icons.every(p => p.startsWith(BASE + "icons/")), man.icons[0]);

const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.ready;
  return { scope: new URL(r.scope).pathname, state: r.active?.state };
});
ok("worker scoped to the base", reg.scope === BASE, reg.scope);
ok("worker activated", reg.state === "activated");

const meta = await page.evaluate(() => new Promise(res => {
  const ch = new MessageChannel();
  ch.port1.onmessage = e => res(e.data);
  navigator.serviceWorker.controller.postMessage({ type: "GET_BUILD_ID" }, [ch.port2]);
  setTimeout(() => res(null), 2000);
}));
ok("worker reports its base", meta?.base === BASE, JSON.stringify(meta));

const urls = await page.evaluate(async () => {
  const c = await caches.open((await caches.keys())[0]);
  return (await c.keys()).map(r => new URL(r.url).pathname);
});
ok("every precached URL sits under the base", urls.every(u => u.startsWith(BASE)), `${urls.length} entries`);
ok("the app root itself is precached", urls.includes(BASE));
if (BASE !== "/") {
  // Only meaningful off-root: at the root these are the same URL.
  ok("nothing cached outside the base", !urls.includes("/"));
}

await ctx.setOffline(true);
await page.reload({ waitUntil: "load" });
ok("shell loads offline", (await page.textContent("h1").catch(() => null)) === "新生兒大便顏色辨識");
ok("stylesheet applied offline",
  await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)"));
await page.getByRole("button", { name: "開始檢測" }).click();
await page.waitForTimeout(250);
ok("capture flow reachable offline", await page.getByRole("button", { name: "開始拍照" }).isVisible());
await ctx.setOffline(false);

console.log(errors.length ? "  page errors:\n" + errors.map(e => "    " + e).join("\n") : "  no page errors");
await browser.close();
process.exit(failed ? 1 : 0);
