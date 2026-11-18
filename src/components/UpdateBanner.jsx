import { color, radius } from "../styles/theme.js";

/**
 * Offered only on screens where a reload costs nothing (see App.jsx). A new
 * version taking over while a parent is part-way through tapping the white
 * paper and the stool would discard that capture, and the photograph is of a
 * dirty diaper that no longer exists.
 */
export default function UpdateBanner({ onApply, onDismiss }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: color.ink,
        color: "#fff",
        borderRadius: radius.md,
        padding: "12px 14px",
        marginBottom: 20,
      }}
      role="status"
    >
      <span style={{ fontSize: 18 }} aria-hidden="true">
        ✨
      </span>

      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
        有新版本可以使用
        <div style={{ fontSize: 12, opacity: 0.7 }}>歷史記錄不會受影響</div>
      </div>

      <button
        onClick={onApply}
        style={{
          background: "#fff",
          color: color.ink,
          border: "none",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        更新
      </button>

      <button
        onClick={onDismiss}
        aria-label="稍後再說"
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,.6)",
          fontSize: 18,
          cursor: "pointer",
          padding: "0 2px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
