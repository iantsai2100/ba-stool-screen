/**
 * Design tokens. Kept as a plain module rather than CSS variables so the
 * screens can compose inline styles without a build-time CSS dependency.
 */

export const color = {
  teal: "#2D7D9A",
  tealDark: "#1A5F7A",
  tealLight: "#3DA5C2",
  tint: "#EBF6FA",
  ink: "#1A3A4A",
  muted: "#5D7080",
  faint: "#95A5A6",
  line: "#E8EDF0",
  surface: "#FFFFFF",
  canvas: "#F4F8FB",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
};

export const font = {
  stack:
    "-apple-system, BlinkMacSystemFont, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
};

export const button = {
  primary: {
    width: "100%",
    padding: 18,
    borderRadius: radius.lg,
    border: "none",
    cursor: "pointer",
    background: `linear-gradient(135deg, ${color.teal}, ${color.tealDark})`,
    color: "#fff",
    fontSize: 17,
    fontWeight: 700,
    boxShadow: "0 4px 20px rgba(45,125,154,0.3)",
    fontFamily: "inherit",
  },
  soft: {
    width: "100%",
    padding: 14,
    borderRadius: radius.lg,
    border: "none",
    cursor: "pointer",
    background: color.tint,
    color: color.tealDark,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
  },
  quiet: {
    width: "100%",
    padding: 12,
    borderRadius: radius.sm,
    border: "none",
    cursor: "pointer",
    background: "transparent",
    color: color.faint,
    fontSize: 14,
    fontFamily: "inherit",
  },
};

export const card = {
  width: "100%",
  background: color.surface,
  border: `1px solid ${color.line}`,
  borderRadius: radius.md,
  boxSizing: "border-box",
};
