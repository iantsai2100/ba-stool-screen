import StepDots from "../StepDots.jsx";
import { ABSOLUTE_MODE, RELATIVE_MODE } from "../../lib/stoolCard.js";
import { button, card, color, radius } from "../../styles/theme.js";

const COMMON_STEPS = [
  { icon: "🌅", title: "充足光線", desc: "在自然光或白色日光燈下拍攝，避免黃色燈光" },
  { icon: "📐", title: "平放俯拍", desc: "尿布平放，相機從正上方垂直向下拍攝" },
  { icon: "💡", title: "同一光源", desc: "所有東西要在相同光線下，避免一半落在陰影中" },
];

const PAPER_STEP = {
  icon: "📄",
  title: "放置白紙",
  desc: "在尿布旁邊放一張白色衛生紙或 A4 紙",
};

const CARD_STEP = {
  icon: "📖",
  title: "攤開健兒手冊",
  desc: "把大便卡那一頁攤平放在尿布旁邊，和白紙、尿布一起入鏡",
};

function ModeChoice({ mode, onChange }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: color.muted, marginBottom: 10 }}>
        手邊有健兒手冊嗎？
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[RELATIVE_MODE, ABSOLUTE_MODE].map((option) => {
          const active = mode === option.key;
          return (
            <button
              key={option.key}
              onClick={() => onChange(option.key)}
              aria-pressed={active}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                background: active ? color.tint : "#fff",
                border: `1.5px solid ${active ? color.teal : color.line}`,
                borderRadius: radius.md,
                padding: "14px 16px",
                fontFamily: "inherit",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: `2px solid ${active ? color.teal : "#CBD5DA"}`,
                  background: active
                    ? `radial-gradient(circle, ${color.teal} 0 42%, #fff 46%)`
                    : "#fff",
                }}
              />
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: color.ink }}>
                  {option.label}
                </span>
                <span style={{ display: "block", fontSize: 12.5, color: color.muted, marginTop: 2 }}>
                  {option.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GuideScreen({ mode, onModeChange, onNext }) {
  const steps =
    mode === RELATIVE_MODE.key
      ? [CARD_STEP, PAPER_STEP, ...COMMON_STEPS]
      : [PAPER_STEP, ...COMMON_STEPS];

  return (
    <div style={{ padding: "0 20px 32px" }}>
      <StepDots current={0} total={4} />

      <h2 style={{ fontSize: 20, fontWeight: 700, color: color.ink, margin: "0 0 6px" }}>
        拍攝前準備
      </h2>
      <p style={{ fontSize: 14, color: color.muted, margin: "0 0 24px", lineHeight: 1.6 }}>
        白紙是顏色校正的基準，沒有它無法消除燈光造成的色偏。
      </p>

      <ModeChoice mode={mode} onChange={onModeChange} />

      <div
        style={{
          background: "#F8F9FA",
          borderRadius: radius.lg,
          padding: 20,
          marginBottom: 20,
          border: "2px dashed #B2D4E0",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          minHeight: 120,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 80,
              height: 60,
              background: "#F0E8D0",
              borderRadius: 8,
              border: "2px solid #D4C89A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 6,
            }}
          >
            💩
          </div>
          <div style={{ fontSize: 11, color: "#7F8C8D" }}>尿布（含大便）</div>
        </div>

        <div style={{ fontSize: 20, color: "#B2BEC3" }} aria-hidden="true">
          +
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 60,
              height: 60,
              background: "#fff",
              borderRadius: 8,
              border: "2px solid #E0E0E0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              marginBottom: 6,
            }}
          >
            📄
          </div>
          <div style={{ fontSize: 11, color: "#7F8C8D" }}>白紙（必要）</div>
        </div>

        {mode === RELATIVE_MODE.key && (
          <>
            <div style={{ fontSize: 20, color: "#B2BEC3" }} aria-hidden="true">
              +
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 46,
                  height: 60,
                  background: "#fff",
                  borderRadius: 6,
                  border: "2px solid #E0E0E0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                {["#E8E0D0", "#C8B870", "#B8A037", "#7A5820"].map((c) => (
                  <span
                    key={c}
                    style={{ width: 28, height: 8, borderRadius: 2, background: c }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#7F8C8D" }}>大便卡</div>
            </div>
          </>
        )}
      </div>

      <ol style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s) => (
          <li key={s.title} style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 16px" }}>
            <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }} aria-hidden="true">
              {s.icon}
            </span>
            <span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: color.ink, marginBottom: 2 }}>
                {s.title}
              </span>
              <span style={{ display: "block", fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                {s.desc}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div
        style={{
          background: color.tint,
          borderRadius: radius.sm,
          padding: "12px 16px",
          marginBottom: 24,
          fontSize: 13,
          color: color.tealDark,
        }}
      >
        📱 接下來手機會詢問相機權限，請選擇<strong>「允許」</strong>
      </div>

      <button onClick={onNext} style={button.primary}>
        開始拍照
      </button>
    </div>
  );
}
