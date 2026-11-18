import { useCallback, useEffect, useMemo, useState } from "react";

import WelcomeScreen from "./components/screens/WelcomeScreen.jsx";
import GuideScreen from "./components/screens/GuideScreen.jsx";
import CameraScreen from "./components/screens/CameraScreen.jsx";
import AnnotateScreen from "./components/screens/AnnotateScreen.jsx";
import ResultScreen from "./components/screens/ResultScreen.jsx";
import HistoryScreen from "./components/screens/HistoryScreen.jsx";

import {
  addRecord,
  clearAll,
  deleteRecord,
  exportRecords,
  getAllRecords,
  makeThumbnail,
} from "./lib/db.js";
import UpdateBanner from "./components/UpdateBanner.jsx";

import { assessTrend } from "./lib/color.js";
import { applyUpdate, registerServiceWorker } from "./lib/pwa.js";
import { color, font } from "./styles/theme.js";

const BACK_TO = {
  guide: "welcome",
  camera: "guide",
  annotate: "camera",
  result: "welcome",
  history: "welcome",
};

/**
 * Screens where swapping the app out from under the user costs nothing. The
 * capture flow is excluded on purpose: a reload between the photograph and the
 * reading throws away a picture of a diaper that has since been thrown away.
 */
const SAFE_TO_UPDATE = new Set(["welcome", "history"]);

const TITLES = {
  guide: "拍攝指引",
  camera: "拍攝照片",
  annotate: "標記區域",
  result: "檢測結果",
  history: "歷史記錄",
};

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [imageUrl, setImageUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [saveState, setSaveState] = useState("idle");
  const [loading, setLoading] = useState(true);
  // Whether the parent has the 健兒手冊 to hand rarely changes between
  // checks, so the choice is remembered rather than asked every week.
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem("ba-stool:mode") === "relative"
        ? "relative"
        : "absolute";
    } catch {
      return "absolute";
    }
  });
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  // Hydrate from IndexedDB once. A failure here is not fatal: the parent can
  // still run a check, they just won't see past ones.
  useEffect(() => {
    let alive = true;
    getAllRecords()
      .then((rows) => alive && setRecords(rows))
      .catch(() => alive && setRecords([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    registerServiceWorker({
      onUpdateReady: (worker) => {
        setWaitingWorker(worker);
        setUpdateDismissed(false);
      },
    });
  }, []);

  // Each capture mints an object URL; release the previous one when it changes.
  useEffect(() => {
    if (!imageUrl) return undefined;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const chooseMode = useCallback((next) => {
    setMode(next);
    try {
      localStorage.setItem("ba-stool:mode", next);
    } catch {
      /* private mode — the choice just is not remembered */
    }
  }, []);

  const handleCapture = useCallback((url) => {
    setImageUrl(url);
    setScreen("annotate");
  }, []);

  const handleAnalyse = useCallback(
    async (analysis) => {
      // Show the verdict immediately; persistence is reported separately so a
      // storage failure never delays the advice a worried parent came for.
      setResult(analysis);
      setScreen("result");

      // A capture the pipeline rejected is not a measurement, so it does not
      // enter the history — a trend built partly from untrusted readings is
      // worse than a shorter trend.
      if (!analysis.usable) {
        setSaveState("idle");
        return;
      }

      setSaveState("saving");

      try {
        const thumbnail = await makeThumbnail(imageUrl).catch(() => null);
        const saved = await addRecord({
          saturation: analysis.saturation,
          zone: analysis.zone.key,
          method: analysis.method,
          boundary: analysis.boundary,
          cardId: analysis.card.id,
          cardLabel: analysis.card.label,
          correctedRgb: analysis.correctedRgb,
          lab: analysis.lab,
          chroma: analysis.chroma,
          spread: analysis.spread,
          sampleCount: analysis.sampleCount,
          thumbnail,
        });
        setRecords((prev) => [saved, ...prev]);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [imageUrl]
  );

  // Recomputed from storage rather than kept as state, so deleting a record
  // immediately corrects the trend it contributed to.
  const trend = useMemo(
    () => assessTrend(records.map((r) => ({ date: r.date, saturation: r.saturation }))),
    [records]
  );

  const handleDelete = useCallback(async (id) => {
    await deleteRecord(id).catch(() => {});
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleClearAll = useCallback(async () => {
    await clearAll().catch(() => {});
    setRecords([]);
  }, []);

  const handleExport = useCallback(async () => {
    const csv = await exportRecords();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `大便顏色記錄_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const restart = useCallback(() => {
    setResult(null);
    setSaveState("idle");
    setScreen("guide");
  }, []);

  const showUpdate =
    Boolean(waitingWorker) && !updateDismissed && SAFE_TO_UPDATE.has(screen);

  return (
    <div style={{ minHeight: "100vh", background: color.canvas, fontFamily: font.stack }}>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          minHeight: "100vh",
          background: color.surface,
          boxShadow: "0 0 40px rgba(0,0,0,.08)",
        }}
      >
        {screen !== "welcome" && (
          <div style={{ display: "flex", alignItems: "center", padding: "16px 20px 0", gap: 10 }}>
            <button
              onClick={() => setScreen(BACK_TO[screen] ?? "welcome")}
              aria-label="返回"
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
                color: color.teal,
                padding: "4px 8px",
                marginLeft: -8,
              }}
            >
              ←
            </button>

            <div style={{ flex: 1, textAlign: "center", fontSize: 15, fontWeight: 600, color: color.ink }}>
              {TITLES[screen]}
            </div>

            <button
              onClick={() => setScreen("history")}
              aria-label={`歷史記錄，共 ${records.length} 筆`}
              style={{
                background: "none",
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                color: "#7F8C8D",
                position: "relative",
              }}
            >
              📋
              {records.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -4,
                    background: color.teal,
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 8,
                    padding: "1px 5px",
                  }}
                >
                  {records.length}
                </span>
              )}
            </button>
          </div>
        )}

        {showUpdate && (
          <div style={{ padding: "0 20px", paddingTop: 16 }}>
            <UpdateBanner
              onApply={() => applyUpdate(waitingWorker)}
              onDismiss={() => setUpdateDismissed(true)}
            />
          </div>
        )}

        <div style={{ paddingTop: screen === "welcome" ? 0 : 16 }}>
          {loading && screen === "welcome" ? (
            <div style={{ padding: 80, textAlign: "center", color: color.faint, fontSize: 14 }}>
              載入中…
            </div>
          ) : (
            <>
              {screen === "welcome" && (
                <WelcomeScreen
                  onStart={() => setScreen("guide")}
                  onHistory={() => setScreen("history")}
                  recordCount={records.length}
                />
              )}
              {screen === "guide" && (
                <GuideScreen
                  mode={mode}
                  onModeChange={chooseMode}
                  onNext={() => setScreen("camera")}
                />
              )}
              {screen === "camera" && <CameraScreen onCapture={handleCapture} />}
              {screen === "annotate" && (
                <AnnotateScreen
                  imageUrl={imageUrl}
                  mode={mode}
                  onAnalyse={handleAnalyse}
                />
              )}
              {screen === "result" && (
                <ResultScreen
                  result={result}
                  saveState={saveState}
                  trend={trend}
                  onRestart={restart}
                  onHistory={() => setScreen("history")}
                />
              )}
              {screen === "history" && (
                <HistoryScreen
                  records={records}
                  trend={trend}
                  onBack={() => setScreen("welcome")}
                  onDelete={handleDelete}
                  onClearAll={handleClearAll}
                  onExport={handleExport}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
