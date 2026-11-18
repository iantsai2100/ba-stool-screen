import { color } from "../styles/theme.js";

export default function StepDots({ current, total }) {
  return (
    <div
      style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 24 }}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-label={`步驟 ${current + 1} / ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            borderRadius: 4,
            background:
              i === current ? color.teal : i < current ? "#A8D5E2" : "#DDE8EC",
            transition: "all .3s ease",
          }}
        />
      ))}
    </div>
  );
}
