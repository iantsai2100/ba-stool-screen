import { ZONE, ZONE_THRESHOLD } from "../lib/stoolCard.js";
import { color, radius } from "../styles/theme.js";

/**
 * The reading on its actual axis: one continuous scale with the three zones
 * drawn to scale and a marker where this measurement landed.
 *
 * This replaces "you are card 3". A parent can see not just which zone they
 * are in but how close to a boundary, which is the information a 7-way label
 * throws away — and the thing that matters when the next reading shifts.
 */
export default function SaturationGauge({ saturation, zone, boundary = null }) {
  const clamped = Math.max(0, Math.min(100, saturation));

  // In relative mode the zone edges are the card's own cells as measured in
  // this photograph, so the scale is drawn from them rather than from the
  // stored thresholds. The gauge then shows literally what the parent would
  // be doing by eye: the stool held against cells 3 and 4.
  const lowEdge = boundary ? boundary.low : ZONE_THRESHOLD.refer;
  const highEdge = boundary ? boundary.high : ZONE_THRESHOLD.normal;

  const bands = [
    { width: lowEdge, fill: ZONE.refer.color, label: "異常" },
    { width: highEdge - lowEdge, fill: ZONE.unclear.color, label: "不明確" },
    { width: 100 - highEdge, fill: ZONE.normal.color, label: "無異常" },
  ];

  const ticks = boundary
    ? [
        { at: lowEdge, text: "卡3" },
        { at: highEdge, text: "卡4" },
      ]
    : [
        { at: lowEdge, text: String(lowEdge) },
        { at: highEdge, text: String(highEdge) },
      ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: color.muted }}>
          校正後彩度
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: zone.color }}>
          {saturation.toFixed(0)}%
        </span>
      </div>

      <div style={{ position: "relative", paddingTop: 18 }}>
        {/* Marker */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${clamped}%`,
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `8px solid ${color.ink}`,
            }}
          />
        </div>

        {/* Bands, drawn proportionally */}
        <div
          style={{
            display: "flex",
            height: 14,
            borderRadius: 7,
            overflow: "hidden",
          }}
          role="img"
          aria-label={`校正後彩度 ${saturation.toFixed(0)}%，判讀為${zone.short}`}
        >
          {bands.map((band) => (
            <div
              key={band.label}
              style={{ width: `${band.width}%`, background: `${band.fill}CC` }}
            />
          ))}
        </div>

        {/* Boundary ticks */}
        <div style={{ position: "relative", height: 16, marginTop: 4 }}>
          {ticks.map((tick) => (
            <span
              key={tick.text}
              style={{
                position: "absolute",
                left: `${Math.max(0, Math.min(100, tick.at))}%`,
                transform: "translateX(-50%)",
                fontSize: 10,
                color: color.faint,
                whiteSpace: "nowrap",
              }}
            >
              {tick.text}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
        {bands.map((band) => (
          <span
            key={band.label}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: color.muted }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: band.fill,
                display: "inline-block",
              }}
            />
            {band.label}
          </span>
        ))}
      </div>
    </div>
  );
}
