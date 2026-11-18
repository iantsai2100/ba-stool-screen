import Disclaimer from "../Disclaimer.jsx";
import InstallPrompt from "../InstallPrompt.jsx";
import { button, color, radius } from "../../styles/theme.js";

export default function WelcomeScreen({ onStart, onHistory, recordCount }) {
  return (
    <div style={{ paddingBottom: 32 }}>
      <header
        style={{
          background: `linear-gradient(160deg, ${color.tealDark} 0%, ${color.teal} 60%, ${color.tealLight} 100%)`,
          padding: "48px 24px 40px",
          textAlign: "center",
          borderRadius: "0 0 32px 32px",
          marginBottom: 28,
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden="true">
          👶
        </div>
        <h1
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: 700,
            margin: "0 0 8px",
            letterSpacing: -0.5,
          }}
        >
          新生兒大便顏色辨識
        </h1>
        <p style={{ color: "rgba(255,255,255,.82)", fontSize: 15, margin: 0, lineHeight: 1.6 }}>
          協助早期發現膽道閉鎖
          <br />
          <span style={{ fontSize: 13, opacity: 0.7 }}>依台灣官方七色大便卡比對</span>
        </p>
      </header>

      <div style={{ padding: "0 20px" }}>
        <InstallPrompt />

        {recordCount > 0 && (
          <button
            onClick={onHistory}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              background: color.surface,
              border: `1.5px solid ${color.teal}33`,
              borderRadius: radius.md,
              padding: "14px 16px",
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 22 }} aria-hidden="true">
              📋
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: color.ink }}>
                已有 {recordCount} 筆檢測記錄
              </span>
              <span style={{ display: "block", fontSize: 12, color: color.muted }}>
                查看顏色變化趨勢
              </span>
            </span>
            <span style={{ color: color.teal, fontSize: 18 }} aria-hidden="true">
              ›
            </span>
          </button>
        )}

        <section
          style={{
            background: color.tint,
            borderRadius: radius.lg,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, color: color.tealDark, margin: "0 0 12px" }}>
            關於膽道閉鎖
          </h2>
          <p style={{ fontSize: 14, color: "#2C3E50", lineHeight: 1.7, margin: 0 }}>
            膽道閉鎖是新生兒最常見的嚴重肝臟疾病。灰白色或淡黃色的大便是最早出現的警訊之一，
            在 <strong>60 天內</strong>接受 Kasai 手術的預後明顯優於延誤診斷的案例。
          </p>
        </section>

        <div style={{ marginBottom: 28 }}>
          <Disclaimer variant="prominent" />
        </div>

        <button onClick={onStart} style={button.primary}>
          開始檢測
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: color.faint, margin: "16px 0 0" }}>
          拍攝前請先準備一張白紙
        </p>
      </div>
    </div>
  );
}
