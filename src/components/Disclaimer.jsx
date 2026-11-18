import { radius } from "../styles/theme.js";

/**
 * Two registers: `prominent` on the landing screen where the user decides
 * whether to trust the tool, `quiet` under a result where it must be present
 * but must not outshout the advice above it.
 */
export default function Disclaimer({ variant = "quiet" }) {
  if (variant === "prominent") {
    return (
      <div
        style={{
          background: "#FFF9F0",
          border: "1px solid #F5CBA7",
          borderRadius: radius.lg,
          padding: "16px 20px",
        }}
      >
        <p style={{ fontSize: 13, color: "#784212", lineHeight: 1.6, margin: 0 }}>
          ⚠️ <strong>重要聲明</strong>：本工具為衛教輔助用途，
          <strong>不能取代醫師診斷</strong>。結果異常時請儘速就醫。
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#F8F9FA",
        borderRadius: radius.sm,
        padding: "12px 14px",
        fontSize: 12,
        color: "#7F8C8D",
        lineHeight: 1.6,
      }}
    >
      本工具僅供衛教參考，不能取代醫師診斷。若有疑慮，請儘速就醫。
    </div>
  );
}
