import { useState } from "react";
import { ZONE, ZONE_THRESHOLD, cardById } from "../../lib/stoolCard.js";
import { button, card, color, radius } from "../../styles/theme.js";

const CHART_HEIGHT = 96;

/**
 * Saturation over time. Bar height is the reading itself, so a decline is
 * visible as a slope rather than having to be inferred from card numbers —
 * which is the whole point of putting the decision on a continuous axis.
 */
function TrendStrip({ records, trend }) {
  // Oldest first, so time reads left to right the way a chart should.
  const chrono = [...records].reverse();
  const { refer, normal } = ZONE_THRESHOLD;

  const band = (value) => (value / 100) * CHART_HEIGHT;

  return (
    <div style={{ ...card, padding: "16px 16px 12px", marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: color.muted }}>彩度變化趨勢</span>
        {trend?.available && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: trend.declining ? ZONE.refer.color : color.faint,
            }}
          >
            {trend.declining
              ? `每週下降 ${Math.abs(trend.slopePerWeek).toFixed(1)}%`
              : "無下降趨勢"}
          </span>
        )}
      </div>

      <div style={{ position: "relative", height: CHART_HEIGHT }}>
        {/* Boundaries are drawn OVER the bars: a tall bar would otherwise hide
            the very line the reader needs to judge its height against. */}
        {[refer, normal].map((value) => (
          <div
            key={value}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: band(value),
              borderTop: `1px dashed ${ZONE[value === refer ? "refer" : "normal"].color}99`,
              fontSize: 9,
              color: color.muted,
              lineHeight: 1,
              paddingLeft: 2,
              zIndex: 2,
              pointerEvents: "none",
              textShadow:
                "0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff, 0 0 2px #fff",
            }}
          >
            {value}
          </div>
        ))}

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 4,
            height: "100%",
            position: "relative",
            zIndex: 1,
            borderBottom: "1px solid #E8EDF0",
          }}
        >
          {chrono.map((r) => {
            const zone = ZONE[r.zone] ?? ZONE.unclear;
            const value = Number.isFinite(r.saturation) ? r.saturation : 0;
            return (
              <div
                key={r.id}
                title={`${new Date(r.date).toLocaleDateString("zh-TW")}　彩度 ${value.toFixed(0)}%　${zone.short}`}
                style={{
                  flex: 1,
                  height: Math.max(band(value), 3),
                  borderRadius: "3px 3px 0 0",
                  background: r.correctedRgb
                    ? `rgb(${r.correctedRgb.map(Math.round).join(",")})`
                    : cardById(r.cardId)?.hex,
                  border: `1px solid ${zone.color}66`,
                  borderBottom: "none",
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, color: color.faint, marginTop: 8, textAlign: "center" }}>
        由左至右為時間順序，高度為校正後彩度，虛線為判讀分界
      </div>
    </div>
  );
}

function RecordRow({ record, onDelete }) {
  const zone = ZONE[record.zone] ?? ZONE.unclear;

  return (
    <li
      style={{
        ...card,
        border: `1.5px solid ${zone.color}33`,
        padding: "12px 14px",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      {record.thumbnail ? (
        <img
          src={record.thumbnail}
          alt=""
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            objectFit: "cover",
            flexShrink: 0,
            border: "1px solid #E0E0E0",
          }}
        />
      ) : (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            flexShrink: 0,
            border: "2px solid #E0E0E0",
            background: record.correctedRgb
            ? `rgb(${record.correctedRgb.map(Math.round).join(",")})`
            : cardById(record.cardId)?.hex,
          }}
        />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: color.ink }}>
          彩度 {Number.isFinite(record.saturation) ? record.saturation.toFixed(0) : "—"}%
          <span style={{ fontWeight: 500, color: zone.color, marginLeft: 6 }}>{zone.short}</span>
        </div>
        <div style={{ fontSize: 12, color: "#7F8C8D" }}>
          {new Date(record.date).toLocaleString("zh-TW", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      <span style={{ fontSize: 16 }} aria-hidden="true">
        {zone.icon}
      </span>

      <button
        onClick={() => onDelete(record.id)}
        aria-label={`刪除 ${new Date(record.date).toLocaleDateString("zh-TW")} 的記錄`}
        style={{
          background: "none",
          border: "none",
          color: "#BDC3C7",
          fontSize: 18,
          cursor: "pointer",
          padding: "4px 2px",
        }}
      >
        ×
      </button>
    </li>
  );
}

export default function HistoryScreen({ records, trend, onBack, onDelete, onClearAll, onExport }) {
  const [confirmClear, setConfirmClear] = useState(false);

  if (records.length === 0) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">
          📋
        </div>
        <h2 style={{ fontSize: 18, color: color.ink, marginBottom: 8 }}>尚無記錄</h2>
        <p style={{ fontSize: 14, color: "#7F8C8D" }}>完成第一次檢測後，記錄會顯示在這裡</p>
        <button onClick={onBack} style={{ ...button.soft, width: "auto", padding: "14px 32px", marginTop: 24 }}>
          返回
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px 32px" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: color.ink, margin: "0 0 4px" }}>
        歷史記錄
      </h2>
      <p style={{ fontSize: 13, color: "#7F8C8D", margin: "0 0 20px" }}>
        共 {records.length} 筆，儲存在此裝置
      </p>

      {records.length > 1 && <TrendStrip records={records} trend={trend} />}

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {records.map((r) => (
          <RecordRow key={r.id} record={r} onDelete={onDelete} />
        ))}
      </ul>

      <button onClick={onExport} style={{ ...button.soft, marginBottom: 10 }}>
        匯出 CSV 給醫師
      </button>

      {confirmClear ? (
        <div
          style={{
            background: "#FDF2F2",
            border: "1px solid #F5B7B1",
            borderRadius: radius.md,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <p style={{ fontSize: 13, color: "#C0392B", margin: "0 0 12px", lineHeight: 1.6 }}>
            刪除全部 {records.length} 筆記錄後無法復原。確定要繼續嗎？
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                onClearAll();
                setConfirmClear(false);
              }}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: radius.sm,
                background: "#C0392B",
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              刪除全部
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: radius.sm,
                background: "#fff",
                color: "#7F8C8D",
                border: "1px solid #DDD",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmClear(true)}
          style={{ ...button.quiet, color: "#C0392B", padding: 14, marginBottom: 10 }}
        >
          清除所有記錄
        </button>
      )}

      <button onClick={onBack} style={button.soft}>
        返回首頁
      </button>
    </div>
  );
}
