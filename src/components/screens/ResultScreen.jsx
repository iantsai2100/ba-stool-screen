import StepDots from "../StepDots.jsx";
import StoolCardStrip from "../StoolCardStrip.jsx";
import Disclaimer from "../Disclaimer.jsx";
import SaturationGauge from "../SaturationGauge.jsx";
import { button, card, color, radius } from "../../styles/theme.js";

function SaveStatus({ state }) {
  const map = {
    saving: { icon: "⏳", text: "正在儲存記錄…", fg: "#1E7E4A", bg: "#F0FDF4" },
    saved: {
      icon: "💾",
      text: "已儲存至此裝置，不會上傳到任何伺服器",
      fg: "#1E7E4A",
      bg: "#F0FDF4",
    },
    error: {
      icon: "⚠️",
      text: "儲存失敗，本次結果未加入歷史記錄",
      fg: "#C0392B",
      bg: "#FDF2F2",
    },
  };
  const s = map[state];
  if (!s) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: radius.sm,
        padding: "11px 14px",
        fontSize: 13,
        background: s.bg,
        color: s.fg,
      }}
    >
      <span aria-hidden="true">{s.icon}</span>
      <span>{s.text}</span>
    </div>
  );
}

function Note({ tone = "warn", children }) {
  const palette = {
    warn: { bg: "#FEF9F0", border: "#F5CBA7", fg: "#784212" },
    info: { bg: color.tint, border: "#B2D4E0", fg: color.tealDark },
  }[tone];

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.sm,
        padding: "12px 14px",
        fontSize: 13,
        color: palette.fg,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Capture was rejected before any reading was attempted. Showing a colour here
 * would be worse than showing nothing — the parent would act on a number the
 * pipeline itself does not trust.
 */
function UnusableResult({ issues, onRetake, onHistory }) {
  return (
    <div style={{ padding: "0 20px 40px" }}>
      <StepDots current={3} total={4} />

      <div
        style={{
          background: "#FEF9F0",
          border: "2px solid #F5CBA7",
          borderRadius: radius.xl,
          padding: "24px 20px",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }} aria-hidden="true">
          📷
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: "#B9770E", marginBottom: 6 }}>
          這張照片無法判讀
        </div>
        <div style={{ fontSize: 14, color: "#784212", lineHeight: 1.6 }}>
          顏色校正的條件不成立，重拍一次會比勉強判讀可靠。
        </div>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {issues.map((issue) => (
          <li key={issue.key} style={{ ...card, padding: "14px 16px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: color.ink, marginBottom: 4 }}>
              {issue.message}
            </div>
            <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
              {issue.fix}
            </div>
          </li>
        ))}
      </ul>

      <div style={{ marginBottom: 24 }}>
        <Disclaimer />
      </div>

      <button onClick={onRetake} style={{ ...button.primary, fontSize: 16, marginBottom: 10 }}>
        重新拍攝
      </button>
      <button onClick={onHistory} style={button.soft}>
        查看歷史記錄
      </button>
    </div>
  );
}

export default function ResultScreen({
  result,
  saveState,
  trend,
  onRestart,
  onHistory,
}) {
  if (!result.usable) {
    return (
      <UnusableResult issues={result.issues} onRetake={onRestart} onHistory={onHistory} />
    );
  }

  const {
    zone,
    card: matched,
    saturation,
    correctedRgb,
    patchy,
    spread,
    method,
    boundary,
  } = result;
  const relative = method === "relative";
  const swatch = `rgb(${correctedRgb.map(Math.round).join(",")})`;

  return (
    <div style={{ padding: "0 20px 40px" }}>
      <StepDots current={3} total={4} />

      <div
        style={{
          background: zone.bg,
          border: `2px solid ${zone.color}33`,
          borderRadius: radius.xl,
          padding: "24px 20px",
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }} aria-hidden="true">
          {zone.icon}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: zone.color, marginBottom: 12 }}>
          {zone.label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#2C3E50",
            lineHeight: 1.6,
            background: "#fff",
            borderRadius: radius.sm,
            padding: "12px 14px",
          }}
        >
          {zone.action}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <SaveStatus state={saveState} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <SaturationGauge saturation={saturation} zone={zone} boundary={boundary} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: color.muted,
          marginBottom: 20,
          lineHeight: 1.6,
        }}
      >
        <span aria-hidden="true">{relative ? "📖" : "📄"}</span>
        <span>
          {relative
            ? "與同一張照片中的大便卡 3、4 號格直接比對，不受印刷批次與手機差異影響"
            : "依文獻閾值判讀（Shen 2016、Waitayagitgumjon 2024）"}
        </span>
      </div>

      {/* Trend outranks the single reading: the duct obliterates gradually, so a
          falling series can be the earliest signal there is. */}
      {trend?.available && trend.declining && (
        <div style={{ marginBottom: 20 }}>
          <Note tone="warn">
            <strong>顏色正在逐漸變淡。</strong>
            過去 {trend.spanWeeks.toFixed(0)} 週共 {trend.points} 次記錄，彩度平均每週下降
            約 {Math.abs(trend.slopePerWeek).toFixed(1)} 個百分點
            （{trend.first.toFixed(0)}% → {trend.latest.toFixed(0)}%）。
            即使單次判讀無異常，這個趨勢本身值得讓醫師看一下。
          </Note>
        </div>
      )}

      {result.advisories?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {result.advisories.map((a) => (
            <Note key={a.key} tone="info">
              <strong>
                {a.message}
                {a.key === "patchyStool" && patchy
                  ? `（各取樣點差距 ${spread.toFixed(0)} 個百分點）`
                  : ""}
                。
              </strong>
              {a.fix}
            </Note>
          ))}
        </div>
      )}

      <div
        style={{
          ...card,
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "14px 16px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.sm,
            flexShrink: 0,
            border: "2px solid #E0E0E0",
            background: swatch,
          }}
        />
        <div>
          <div style={{ fontSize: 12, color: "#7F8C8D", marginBottom: 3 }}>
            色彩校正後的大便顏色
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2C3E50" }}>
            {relative && boundary
              ? saturation <= boundary.low
                ? "比手冊的 3 號格更淡"
                : saturation >= boundary.high
                  ? "比手冊的 4 號格更深"
                  : "介於手冊的 3 號與 4 號格之間"
              : `約相當於大便卡 ${matched.id}號（${matched.label}）`}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <StoolCardStrip matchId={matched.id} />
        <p style={{ fontSize: 12, color: color.faint, lineHeight: 1.6, margin: "10px 0 0" }}>
          {relative
            ? "上排色塊僅供對照手冊之用；判讀依據是這張照片中大便與 3、4 號格的彩度比較。"
            : "卡號僅供對照健兒手冊之用。判讀依據是校正後的彩度，不是卡片的印刷色。"}
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Disclaimer />
      </div>

      <button onClick={onRestart} style={{ ...button.primary, fontSize: 16, marginBottom: 10 }}>
        再次檢測
      </button>
      <button onClick={onHistory} style={button.soft}>
        查看歷史記錄
      </button>
    </div>
  );
}
