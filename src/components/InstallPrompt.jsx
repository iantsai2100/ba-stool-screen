import { useEffect, useState } from "react";
import {
  getInstallEvent,
  isInstalled,
  onInstallAvailable,
  promptInstall,
} from "../lib/pwa.js";
import { button, color, radius } from "../styles/theme.js";

const DISMISS_KEY = "ba-stool:install-dismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* private mode — the invitation simply reappears next time */
  }
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit;
}

/**
 * Invitation to add the app to the home screen.
 *
 * Worth doing for this tool specifically: the point is a weekly check across
 * three months, and an icon on the home screen is the difference between
 * remembering and not. Installed, it also opens without browser chrome and
 * keeps working with no signal.
 *
 * Two routes, because the platforms differ. Chrome fires beforeinstallprompt
 * and lets the page trigger the real installer — that event is captured in
 * lib/pwa.js at module load, since it fires once and this component is not
 * always mounted when it does. iOS Safari has no such event, so the only
 * option is to say where the button is, which is why the iOS copy spells out
 * the Share menu instead of offering a button that cannot exist.
 */
export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(getInstallEvent);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(wasDismissed);

  useEffect(() => {
    if (isInstalled() || wasDismissed()) return undefined;

    const unsubscribe = onInstallAvailable(setInstallEvent);

    // Chrome will have fired by now if it was going to; on iOS it never fires,
    // so fall back to the written instructions.
    const timer = setTimeout(() => {
      if (isIosSafari() && !isInstalled() && !getInstallEvent()) {
        setShowIosHint(true);
      }
    }, 1200);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  if (dismissed || isInstalled() || (!installEvent && !showIosHint)) return null;

  const close = () => {
    remember();
    setDismissed(true);
  };

  return (
    <div
      style={{
        background: color.tint,
        border: `1px solid ${color.teal}33`,
        borderRadius: radius.md,
        padding: "14px 16px",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 20, lineHeight: 1.2 }} aria-hidden="true">
          📲
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: color.ink, marginBottom: 4 }}>
            加到主畫面
          </div>
          <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.6 }}>
            {installEvent
              ? "之後直接從桌面開啟，沒有網路也能使用。"
              : "點選瀏覽器下方的「分享」按鈕，選擇「加入主畫面」。之後直接從桌面開啟，沒有網路也能使用。"}
          </div>
        </div>
        <button
          onClick={close}
          aria-label="不再顯示"
          style={{
            background: "none",
            border: "none",
            color: color.faint,
            fontSize: 18,
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {installEvent && (
        <button
          onClick={promptInstall}
          style={{ ...button.soft, background: "#fff", marginTop: 12 }}
        >
          加到主畫面
        </button>
      )}
    </div>
  );
}
