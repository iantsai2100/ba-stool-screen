// ─────────────────────────────────────────────────────────────────────────────
// db.js — IndexedDB persistence layer for the BA stool colour screening PWA
//
// Drop this file into src/ and import from your React components:
//   import { addRecord, getAllRecords, deleteRecord, clearAll, exportRecords } from "./db";
//
// Design notes:
//   • One object store, "records", keyed by auto-incrementing id.
//   • An index on `date` lets us read newest-first without sorting in JS.
//   • An index on `uploaded` lets a future Supabase sync job find the backlog
//     of consented-but-not-yet-uploaded rows in one cursor pass.
//   • Thumbnails are stored as ~200px-wide JPEG data URLs, not full photos.
//     A full 12MP capture is 3–5 MB; at 200px it is ~8 KB, so a year of weekly
//     checks costs well under half a megabyte.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "ba-stool-db";
const DB_VERSION = 1;
const STORE = "records";

let dbPromise = null;

/** Returns true when the browser exposes a usable IndexedDB. */
export function isSupported() {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Opens (and on first run, creates) the database. Cached after the first call. */
function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!isSupported()) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("date", "date", { unique: false });
        store.createIndex("uploaded", "uploaded", { unique: false });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // If another tab triggers a version upgrade, close this handle so the
      // upgrade is not blocked, and drop the cache so the next call reopens.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => reject(req.error || new Error("Failed to open database"));
    req.onblocked = () => reject(new Error("Database upgrade blocked by another tab"));
  });

  return dbPromise;
}

/** Wraps a transaction so callers get a promise that settles on complete/error. */
function withStore(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;
        try {
          result = fn(store);
        } catch (err) {
          tx.abort();
          reject(err);
          return;
        }
        tx.oncomplete = () => resolve(result && result.value !== undefined ? result.value : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
      })
  );
}

// ─── Thumbnail generation ────────────────────────────────────────────────────

/**
 * Shrinks an image to `maxWidth` and returns a JPEG data URL.
 * Runs entirely on the device; the original capture is never retained.
 */
export function makeThumbnail(imageSource, maxWidth = 200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const draw = (img) => {
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    if (imageSource instanceof HTMLImageElement && imageSource.complete) {
      draw(imageSource);
      return;
    }
    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = typeof imageSource === "string" ? imageSource : imageSource.src;
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/**
 * Saves one screening result. Returns the stored record including its new id.
 *
 * @param {object} input
 * @param {number} input.saturation   HSV saturation %, the decision variable
 * @param {string} input.zone         "refer" | "unclear" | "normal"
 * @param {string} [input.method]     "relative" (card in frame) | "absolute"
 * @param {object} [input.boundary]   In relative mode, the in-photo saturation
 *                                    of card cells 3 and 4 that decided it
 * @param {number} input.cardId       Nearest card, 1–7, for display only
 * @param {string} input.cardLabel    e.g. "淡黃色"
 * @param {number[]} input.correctedRgb  White-balanced [r, g, b]
 * @param {number[]} [input.lab]      CIELAB of the corrected sample
 * @param {number} [input.chroma]     C*ab, recorded for later comparison
 * @param {number} [input.spread]     Saturation range across sample points
 * @param {number} [input.sampleCount] How many points were sampled
 * @param {string} [input.thumbnail]  Data URL from makeThumbnail()
 * @param {string} [input.note]       Optional parent note
 */
export async function addRecord(input) {
  const record = {
    date: new Date().toISOString(),
    saturation: input.saturation,
    zone: input.zone,
    method: input.method ?? "absolute",
    boundary: input.boundary ?? null,
    cardId: input.cardId,
    cardLabel: input.cardLabel,
    correctedRgb: input.correctedRgb,
    lab: input.lab ?? null,
    chroma: input.chroma ?? null,
    spread: input.spread ?? null,
    sampleCount: input.sampleCount ?? 1,
    thumbnail: input.thumbnail ?? null,
    note: input.note ?? "",
    // 0 = not uploaded. IndexedDB indexes cannot key on booleans, so use ints.
    uploaded: 0,
    consent: 0,
  };

  const id = await withStore("readwrite", (store) => {
    const req = store.add(record);
    const box = {};
    req.onsuccess = () => { box.value = req.result; };
    return box;
  });

  return { ...record, id };
}

/** Returns every record, newest first. */
export function getAllRecords() {
  return withStore("readonly", (store) => {
    const out = [];
    const box = { value: out };
    const req = store.index("date").openCursor(null, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push(cursor.value);
        cursor.continue();
      }
    };
    return box;
  });
}

/** Returns the `limit` most recent records, newest first. */
export async function getRecentRecords(limit = 10) {
  const all = await getAllRecords();
  return all.slice(0, limit);
}

/** Deletes one record by id. */
export function deleteRecord(id) {
  return withStore("readwrite", (store) => {
    store.delete(id);
  });
}

/** Deletes every record. Use behind an explicit confirmation in the UI. */
export function clearAll() {
  return withStore("readwrite", (store) => {
    store.clear();
  });
}

/** Marks a record as consented for future cloud upload. */
export function setConsent(id, consented) {
  return withStore("readwrite", (store) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const rec = req.result;
      if (rec) {
        rec.consent = consented ? 1 : 0;
        store.put(rec);
      }
    };
  });
}

/** Records that the parent consented to share but that have not yet synced. */
export async function getPendingUploads() {
  const all = await getAllRecords();
  return all.filter((r) => r.consent === 1 && r.uploaded === 0);
}

/** Marks a record as successfully synced to the cloud. */
export function markUploaded(id) {
  return withStore("readwrite", (store) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const rec = req.result;
      if (rec) {
        rec.uploaded = 1;
        store.put(rec);
      }
    };
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Builds a CSV of every record, thumbnails omitted.
 * Useful for a parent to hand their paediatrician a printed history.
 */
export async function exportRecords() {
  const rows = await getAllRecords();
  const header = [
    "日期",
    "校正後彩度(%)",
    "判讀",
    "判讀方式",
    "卡3彩度(%)",
    "卡4彩度(%)",
    "參考卡號",
    "顏色描述",
    "R",
    "G",
    "B",
    "備註",
  ];
  const zoneText = { refer: "異常", unclear: "不明確", normal: "無異常" };
  const body = rows.map((r) => {
    const [red, green, blue] = r.correctedRgb || [];
    return [
      new Date(r.date).toLocaleString("zh-TW"),
      Number.isFinite(r.saturation) ? r.saturation.toFixed(1) : "",
      zoneText[r.zone] || r.zone || "",
      r.method === "relative" ? "卡片入框" : "文獻閾值",
      r.boundary ? r.boundary.low.toFixed(1) : "",
      r.boundary ? r.boundary.high.toFixed(1) : "",
      r.cardId ?? "",
      r.cardLabel ?? "",
      Math.round(red ?? 0),
      Math.round(green ?? 0),
      Math.round(blue ?? 0),
      (r.note || "").replace(/"/g, '""'),
    ];
  });

  const escape = (cell) => `"${String(cell)}"`;
  // BOM so Excel on Windows reads the Chinese headers as UTF-8.
  return "\uFEFF" + [header, ...body].map((row) => row.map(escape).join(",")).join("\n");
}

/** Approximate storage footprint, for a "資料佔用空間" line in settings. */
export async function estimateSize() {
  if (navigator.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  }
  const all = await getAllRecords();
  const usage = all.reduce((sum, r) => sum + (r.thumbnail?.length ?? 0) + 200, 0);
  return { usage, quota: null };
}
