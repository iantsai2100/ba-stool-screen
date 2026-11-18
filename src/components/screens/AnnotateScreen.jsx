import { useCallback, useEffect, useRef, useState } from "react";
import StepDots from "../StepDots.jsx";
import {
  SAMPLE_RADIUS,
  analyse,
  checkWhiteReference,
  sampleRegion,
} from "../../lib/color.js";
import { BOUNDARY_CARDS, cardById } from "../../lib/stoolCard.js";
import { button, color, radius } from "../../styles/theme.js";

/**
 * One tap per entry, in order. Two taps replace an automatic white-patch
 * detector; in relative mode two more replace the whole idea of a stored
 * reference value.
 */
const STEP = {
  whiteA: {
    kind: "white",
    pill: "白紙 ①",
    marker: "白紙",
    stroke: "#3498DB",
    title: "請點擊照片中的白紙",
    hint: "點白紙最乾淨的區域，用來校正光線色偏",
    nudge: "先點擊照片中的白紙",
  },
  whiteB: {
    kind: "white",
    pill: "白紙 ②",
    marker: "白紙 2",
    stroke: "#5DADE2",
    title: "請點白紙上的另一個位置",
    hint: "離第一點遠一些。兩點若顏色不同，表示畫面裡有兩種光源",
    nudge: "再點白紙上另一處",
  },
  cardLow: {
    kind: "card",
    cardId: BOUNDARY_CARDS.low,
    pill: "卡 3 號",
    marker: "3號",
    stroke: "#AF7AC5",
    title: "請點大便卡的 3 號格",
    hint: "手冊上標示 3 的那一格，點在顏色最均勻的地方",
    nudge: "點大便卡的 3 號格",
  },
  cardHigh: {
    kind: "card",
    cardId: BOUNDARY_CARDS.high,
    pill: "卡 4 號",
    marker: "4號",
    stroke: "#8E44AD",
    title: "請點大便卡的 4 號格",
    hint: "手冊上標示 4 的那一格。3 號與 4 號之間就是正常與異常的分界",
    nudge: "點大便卡的 4 號格",
  },
  stool: {
    kind: "stool",
    pill: "大便",
    marker: "大便",
    stroke: "#E67E22",
    title: "請點大便顏色最深處",
    hint: "點最有代表性的大便顏色區域",
    nudge: "最後點大便顏色區域",
  },
};

const SEQUENCE = {
  relative: ["whiteA", "whiteB", "cardLow", "cardHigh", "stool"],
  absolute: ["whiteA", "whiteB", "stool"],
};

export default function AnnotateScreen({ imageUrl, mode = "absolute", onAnalyse }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const sequence = SEQUENCE[mode] ?? SEQUENCE.absolute;

  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [marks, setMarks] = useState({});
  const [index, setIndex] = useState(0);
  const [warning, setWarning] = useState("");

  const done = index >= sequence.length;
  const currentKey = done ? null : sequence[index];
  const current = currentKey ? STEP[currentKey] : null;

  // Load the capture and size the canvas to the viewport, keeping the backing
  // store at full resolution so sampling reads original pixels.
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = Math.min(window.innerWidth - 44, 560);
      const s = maxWidth / img.naturalWidth;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = `${maxWidth}px`;
      canvas.style.height = `${img.naturalHeight * s}px`;

      canvas.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0);
      setScale(s);
      setReady(true);
    };
    img.onerror = () => setWarning("照片載入失敗，請重新拍攝");
    img.src = imageUrl;
  }, [imageUrl]);

  const redraw = useCallback((placed) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    for (const [key, point] of Object.entries(placed)) {
      const spec = STEP[key];
      ctx.beginPath();
      ctx.arc(point.x, point.y, SAMPLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = `${spec.stroke}44`;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = spec.stroke;
      ctx.stroke();

      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.strokeText(spec.marker, point.x, point.y - SAMPLE_RADIUS - 10);
      ctx.fillStyle = "#fff";
      ctx.fillText(spec.marker, point.x, point.y - SAMPLE_RADIUS - 10);
    }
  }, []);

  useEffect(() => {
    if (ready) redraw(marks);
  }, [ready, marks, redraw]);

  const handleTap = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || !ready || done) return;

    const rect = canvas.getBoundingClientRect();
    const touch = event.changedTouches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;

    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = sampleRegion(data, x, y, SAMPLE_RADIUS, canvas.width);

    // The white reference is checked at the tap so a bad one is caught while
    // the parent is still looking at the photo, not after analysis.
    if (current.kind === "white") {
      const issue = checkWhiteReference(rgb);
      if (issue) {
        setWarning(`${issue.message}。${issue.fix}`);
        return;
      }
    }

    setWarning("");
    setMarks((prev) => ({ ...prev, [currentKey]: { x, y, rgb } }));
    setIndex((i) => i + 1);
  };

  const undo = () => {
    if (index === 0) return;
    const key = sequence[index - 1];
    setMarks((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setIndex((i) => i - 1);
    setWarning("");
  };

  const reset = () => {
    setMarks({});
    setIndex(0);
    setWarning("");
  };

  const run = () => {
    const cardRefs = sequence
      .filter((k) => STEP[k].kind === "card" && marks[k])
      .map((k) => ({ id: STEP[k].cardId, rgb: marks[k].rgb }));

    onAnalyse(
      analyse(marks.whiteA.rgb, [marks.stool.rgb], {
        whiteRgbB: marks.whiteB?.rgb ?? null,
        cardRefs,
      })
    );
  };

  return (
    <div style={{ padding: "0 20px 32px" }}>
      <StepDots current={2} total={4} />

      <h2 style={{ fontSize: 19, fontWeight: 700, color: color.ink, margin: "0 0 4px" }}>
        {done ? "標記完成" : current.title}
      </h2>
      <p style={{ fontSize: 13, color: color.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
        {done ? "確認標記位置正確後，開始分析" : current.hint}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {sequence.map((key, i) => {
          const spec = STEP[key];
          const placed = Boolean(marks[key]);
          const active = i === index;
          return (
            <div
              key={key}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: placed ? spec.stroke : active ? color.tint : "#F0F4F6",
                color: placed ? "#fff" : active ? color.tealDark : color.faint,
                border: active && !placed ? `1.5px solid ${spec.stroke}` : "1.5px solid transparent",
              }}
            >
              {spec.pill}
              {placed ? " ✓" : ""}
            </div>
          );
        })}
      </div>

      {warning && (
        <div
          role="alert"
          style={{
            background: "#FDF2F2",
            border: "1px solid #F5B7B1",
            borderRadius: radius.sm,
            padding: "10px 14px",
            fontSize: 13,
            color: "#C0392B",
            marginBottom: 12,
          }}
        >
          ⚠️ {warning}
        </div>
      )}

      <div
        onClick={handleTap}
        onTouchEnd={handleTap}
        style={{
          borderRadius: radius.lg,
          overflow: "hidden",
          marginBottom: 20,
          border: "2px solid #D5E8F0",
          cursor: done ? "default" : "crosshair",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          lineHeight: 0,
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%" }} />
      </div>

      {done ? (
        <button onClick={run} style={button.primary}>
          開始分析顏色
        </button>
      ) : (
        <div
          style={{
            background: color.tint,
            borderRadius: radius.sm,
            padding: "12px 16px",
            fontSize: 13,
            color: color.tealDark,
            textAlign: "center",
          }}
        >
          {current.nudge}（{index + 1} / {sequence.length}）
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={undo}
          disabled={index === 0}
          style={{
            ...button.quiet,
            opacity: index === 0 ? 0.35 : 1,
            cursor: index === 0 ? "default" : "pointer",
          }}
        >
          退回上一點
        </button>
        <button onClick={reset} style={button.quiet}>
          全部重新標記
        </button>
      </div>

      {mode === "relative" && (
        <p style={{ fontSize: 12, color: color.faint, lineHeight: 1.6, margin: "14px 0 0" }}>
          3 號與 4 號格是手冊上正常與異常的分界。把它們和大便拍在同一張照片裡，
          判讀就不受印刷批次、手機機型與光線影響——
          因為那些因素對卡片和對大便的影響是一樣的，比較時會互相抵消。
          {cardById(BOUNDARY_CARDS.low) && ""}
        </p>
      )}
    </div>
  );
}
