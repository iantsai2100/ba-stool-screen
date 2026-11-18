import { useEffect, useRef } from "react";
import StepDots from "../StepDots.jsx";
import { button, color, radius } from "../../styles/theme.js";

/**
 * Uses a file input with `capture="environment"` rather than getUserMedia.
 * The native camera gives the parent the full capture UI they already know —
 * tap to focus, exposure lock, retake — and returns a full-resolution frame,
 * which matters because the colour sample is drawn from the original pixels.
 */
export default function CameraScreen({ onCapture }) {
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  // Open the camera straight away; the parent is standing over a dirty diaper.
  useEffect(() => {
    cameraRef.current?.click();
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onCapture(URL.createObjectURL(file));
    e.target.value = ""; // let the same file be picked twice in a row
  };

  return (
    <div style={{ padding: "0 20px 32px" }}>
      <StepDots current={1} total={4} />

      <div
        style={{
          background: color.ink,
          borderRadius: radius.xl,
          minHeight: 260,
          marginBottom: 24,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16 }} aria-hidden="true">
          📸
        </div>
        <p style={{ color: "rgba(255,255,255,.85)", fontSize: 15, lineHeight: 1.7, margin: 0 }}>
          請確認白紙和大便
          <br />
          都在畫面中
        </p>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
      />

      <button
        onClick={() => cameraRef.current?.click()}
        style={{ ...button.primary, marginBottom: 12 }}
      >
        拍攝照片
      </button>
      <button onClick={() => libraryRef.current?.click()} style={button.soft}>
        從相簿選擇照片
      </button>
    </div>
  );
}
