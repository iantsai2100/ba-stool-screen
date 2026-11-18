import { STOOL_CARD } from "../lib/stoolCard.js";
import { color } from "../styles/theme.js";

/** The seven cards in order, with the matched one called out. */
export default function StoolCardStrip({ matchId }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: color.muted, marginBottom: 10 }}>
        台灣七色大便卡對照
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {STOOL_CARD.map((c) => {
          const active = c.id === matchId;
          return (
            <div key={c.id} style={{ flex: 1, textAlign: "center" }}>
              <div
                title={`${c.id}號 ${c.label}`}
                style={{
                  height: 36,
                  borderRadius: 8,
                  background: c.hex,
                  border: active ? `3px solid ${color.ink}` : "2px solid #E0E0E0",
                  transform: active ? "scale(1.12)" : "none",
                  transition: "transform .2s",
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  marginTop: 4,
                  fontWeight: active ? 700 : 400,
                  color: active ? color.ink : color.faint,
                }}
              >
                {c.id}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", fontSize: 11, marginTop: 6, justifyContent: "space-between" }}>
        <span style={{ color: "#C0392B", fontWeight: 600 }}>← 異常</span>
        <span style={{ color: "#27AE60", fontWeight: 600 }}>正常 →</span>
      </div>
    </div>
  );
}
