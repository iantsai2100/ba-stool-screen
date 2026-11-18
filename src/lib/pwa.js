/**
 * Service-worker registration and the update handshake.
 *
 * The worker never takes over on its own (it does not call skipWaiting on
 * install). Instead a waiting worker is reported here, the app asks, and the
 * swap happens only when the user says so — and only when they are not in the
 * middle of a reading. Reloading mid-capture would throw away a photograph a
 * parent took of a dirty diaper, which is not a thing to ask them to redo.
 */

/**
 * Both derived from Vite's `base`, so a change of deployment path moves them
 * together. The worker's scope is its own directory by default, but it is
 * stated explicitly because a mismatch between scope and registration URL
 * fails in a way that looks like the worker simply never installing.
 */
const BASE = import.meta.env.BASE_URL;
const SW_URL = `${BASE}sw.js`;

// ── Install availability ─────────────────────────────────────────────────────
//
// `beforeinstallprompt` fires once, early, and the event is the ONLY handle on
// the real installer — miss it and there is no way to offer installation for
// the rest of the session. It is captured here at module load rather than in a
// component, because the component that shows the invitation lives on the
// welcome screen and unmounts the moment the parent starts a check.

let deferredInstall = null;
const installListeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event;
    installListeners.forEach((fn) => fn(event));
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    installListeners.forEach((fn) => fn(null));
  });
}

/** The captured install event, if the browser offered one. */
export function getInstallEvent() {
  return deferredInstall;
}

/** Subscribe to install availability. Returns an unsubscribe function. */
export function onInstallAvailable(fn) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

/** Triggers the browser's own install flow. Resolves to the user's choice. */
export async function promptInstall() {
  if (!deferredInstall) return null;
  deferredInstall.prompt();
  const choice = await deferredInstall.userChoice;
  // The event is single-use; the browser will fire a fresh one if it decides
  // the app is installable again.
  deferredInstall = null;
  installListeners.forEach((fn) => fn(null));
  return choice?.outcome ?? null;
}

/** Milliseconds between update checks while the app is open. */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function isSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Registers the worker and reports lifecycle changes.
 *
 * @param {object} handlers
 * @param {(waiting: ServiceWorker) => void} [handlers.onUpdateReady]
 *        A new version is installed and waiting for permission to take over.
 * @param {() => void} [handlers.onOfflineReady]
 *        First install finished; the app now works with no connection.
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker({ onUpdateReady, onOfflineReady } = {}) {
  // Dev runs without a worker so HMR is not fighting a cache.
  if (!import.meta.env.PROD || !isSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, {
      scope: BASE,
      updateViaCache: "none",
    });

    // Already waiting when the page loaded (user opened the app, closed it,
    // a new version installed, and they came back).
    if (registration.waiting && navigator.serviceWorker.controller) {
      onUpdateReady?.(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (installing.state !== "installed") return;

        if (navigator.serviceWorker.controller) {
          // There was a previous worker, so this is an update, not a first run.
          onUpdateReady?.(installing);
        } else {
          onOfflineReady?.();
        }
      });
    });

    // Check for a new deploy when the app is reopened from the home screen,
    // which for an installed PWA is the usual way it comes back to life.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update();
    });
    setInterval(() => registration.update(), UPDATE_INTERVAL_MS);

    return registration;
  } catch {
    // An unavailable worker costs offline support, nothing else. The app must
    // still run, so this is never surfaced as an error to the user.
    return null;
  }
}

/**
 * Tells the waiting worker to take over, then reloads once it has.
 * Guarded so a double tap cannot reload twice.
 */
export function applyUpdate(waiting) {
  if (!waiting) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  waiting.postMessage({ type: "SKIP_WAITING" });
}

/** The build id of the worker currently in control, or null. */
export function activeBuildId(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) {
      resolve(null);
      return;
    }

    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), timeoutMs);

    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data?.buildId ?? null);
    };

    controller.postMessage({ type: "GET_BUILD_ID" }, [channel.port2]);
  });
}

/**
 * Whether the app is running as an installed app rather than in a browser tab.
 * iOS predates the display-mode media query for this, hence the navigator
 * fallback.
 */
export function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
