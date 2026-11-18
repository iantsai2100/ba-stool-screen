/**
 * Colour pipeline: regional sampling → quality gates → user-assisted white
 * balance → HSV saturation → three-zone reading.
 *
 * The clinical decision runs on ONE continuous axis (saturation), not a 7-way
 * classification. See the long note at the top of stoolCard.js for why, and
 * for the three papers the thresholds come from.
 *
 * Everything here is pure and synchronous: no DOM, no browser APIs. That is
 * what makes `npm run verify:color` possible and what any validation study
 * should target.
 */

import {
  BOUNDARY_CARDS,
  QUALITY_ADVISORY,
  QUALITY_ISSUE,
  STOOL_CARD,
  ZONE,
  ZONE_THRESHOLD,
} from "./stoolCard.js";

// ── Saturation ───────────────────────────────────────────────────────────────

/**
 * HSV saturation as a percentage, 0–100.
 *
 * Computed on GAMMA-ENCODED sRGB (plain 0–255 channel values), deliberately,
 * because that is what Photoshop's HSB readout and the mobile colour-analysis
 * tools in the source papers operate on. Linearising first would give different
 * numbers and silently invalidate the published 56–60 cutoffs.
 */
export function saturationPct(r, g, b) {
  const max = Math.max(r, g, b);
  if (max <= 0) return 0;
  const min = Math.min(r, g, b);
  return ((max - min) / max) * 100;
}

export function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// ── CIELAB, kept for diagnostics only ────────────────────────────────────────
//
// Lab chroma is perceptually better behaved than HSV saturation, but no
// published cutoff exists in that space for this problem. It is recorded
// alongside each measurement so a future validation study can compare the two
// axes on the same images; it decides nothing today.

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** sRGB (0–255) → CIELAB under a D65 white point. */
export function rgbToLab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y / 1.0);
  const fz = f(z / 1.08883);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** C*ab — Lab chroma. Diagnostic companion to saturationPct. */
export function labChroma(lab) {
  return Math.sqrt(lab[1] ** 2 + lab[2] ** 2);
}

export function deltaE76(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  );
}

// ── Sampling ─────────────────────────────────────────────────────────────────

export const SAMPLE_RADIUS = 20; // px, in original image coordinates

/**
 * Mean RGB over a circular region. Averaging over a disc rather than reading a
 * single pixel keeps sensor noise and JPEG blocking out of the reading.
 */
export function sampleRegion(imageData, cx, cy, radius, width) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      if (px < 0 || py < 0 || px >= width) continue;
      const i = (py * width + px) * 4;
      r += imageData.data[i];
      g += imageData.data[i + 1];
      b += imageData.data[i + 2];
      n++;
    }
  }

  return n > 0 ? [r / n, g / n, b / n] : [128, 128, 128];
}

// ── Quality gates ────────────────────────────────────────────────────────────

/**
 * Exposure window for the white reference.
 *
 * The ceiling matters because a clipped white carries no information about the
 * illuminant — three channels pinned at 255 look neutral whatever the light
 * actually was. The floor matters because gain is 255/channel, so a dark
 * reference produces a large multiplier that pushes the stool sample into
 * clipping and destroys the saturation estimate. 120 is tight enough to keep
 * gain under ~2.1×.
 */
export const WHITE_CEILING = 250;
export const WHITE_FLOOR = 120;

/**
 * Chromaticity limits for the white reference.
 *
 * These are two different judgements and conflating them was a bug. White paper
 * under 2700K tungsten with daylight white balance reads around 30–35%
 * saturation in raw sRGB — strongly coloured, and precisely the capture the
 * correction is for. So the hard limit sits well above that, high enough to
 * only catch taps that landed on something genuinely coloured (a printed
 * pattern, a yellow towel), while the advisory threshold flags a strong cast
 * without withholding the reading.
 *
 * The 3× gain cap in whiteBalanceGain is the backstop for anything extreme
 * that slips through.
 */
export const WHITE_MAX_SATURATION = 45;
export const WHITE_CAST_ADVISORY = 25;

/** Two white taps further apart than this in Lab suggest more than one light. */
export const ILLUMINANT_TOLERANCE = 12;

/** Hard refusal check for the white tap. Returns an issue, or null. */
export function checkWhiteReference(rgb) {
  if (Math.max(...rgb) >= WHITE_CEILING) return QUALITY_ISSUE.whiteClipped;
  if (rgb.reduce((a, c) => a + c, 0) / 3 < WHITE_FLOOR)
    return QUALITY_ISSUE.whiteUnderexposed;
  if (saturationPct(...rgb) > WHITE_MAX_SATURATION)
    return QUALITY_ISSUE.whiteNotNeutral;
  return null;
}

/** Non-blocking note about how hard the correction had to work. */
export function checkWhiteCast(rgb) {
  return saturationPct(...rgb) > WHITE_CAST_ADVISORY
    ? QUALITY_ADVISORY.strongCast
    : null;
}

/** Kept from the first version so the UI can warn on the tap itself. */
export function isPlausibleWhiteReference(rgb) {
  return checkWhiteReference(rgb) === null;
}

/**
 * Compares two white taps from different parts of the frame. A large
 * difference means the diaper and the paper were not under the same light, in
 * which case correcting by one of them is worse than not correcting at all.
 *
 * Not yet wired into the UI, which takes a single white tap. Adding a second
 * tap is the cheapest remaining accuracy win.
 */
export function checkIlluminantConsistency(whiteA, whiteB) {
  const delta = deltaE76(rgbToLab(...whiteA), rgbToLab(...whiteB));
  return delta > ILLUMINANT_TOLERANCE ? QUALITY_ISSUE.mixedIllumination : null;
}

// ── White balance ────────────────────────────────────────────────────────────

/** Per-channel von Kries gain, capped so a poor reference degrades gracefully. */
export function whiteBalanceGain(whiteRgb) {
  return whiteRgb.map((c) => Math.min(255 / Math.max(c, 1), 3));
}

export function applyGain(rgb, gain) {
  return rgb.map((c, i) => c * gain[i]);
}

// ── Reading ──────────────────────────────────────────────────────────────────

export function zoneFor(saturation) {
  if (saturation < ZONE_THRESHOLD.refer) return ZONE.refer;
  if (saturation < ZONE_THRESHOLD.normal) return ZONE.unclear;
  return ZONE.normal;
}

/**
 * Card saturations, derived from the display swatches so the number shown to a
 * parent sits on the same axis as the decision. Presentational only.
 */
const CARD_SATURATION = STOOL_CARD.map((card) => ({
  card,
  saturation: saturationPct(...hexToRgb(card.hex)),
}));

export function nearestCard(saturation) {
  let best = CARD_SATURATION[0];
  for (const entry of CARD_SATURATION) {
    if (
      Math.abs(entry.saturation - saturation) <
      Math.abs(best.saturation - saturation)
    ) {
      best = entry;
    }
  }
  return best.card;
}

/**
 * Full reading for one capture.
 *
 * Stool samples are passed as an array and the LOWEST-saturation one decides,
 * because stool is heterogeneous and it is the palest region that carries the
 * clinical signal — averaging it away is exactly the wrong move. The spread
 * across samples is returned so the UI can say when a stool was patchy.
 *
 * @param {number[]} whiteRgb      Mean RGB at the white reference
 * @param {number[][]} stoolRgbs   One or more mean RGBs sampled on the stool
 * @param {number[]} [whiteRgbB]   Optional second white tap, for mixed light
 */
/**
 * Decides the zone by comparing the stool against card cells measured in the
 * SAME photograph, rather than against stored thresholds.
 *
 * The card's own cells are the scale: cells 1–3 are the acholic side and 4–7
 * the normal side, so a stool at or below cell 3 is referred, at or above cell
 * 4 is normal, and anything between the two is the unclear band. No absolute
 * reference value is needed anywhere in this path, which is what makes it
 * immune to print batch, phone, exposure and ambient light all at once.
 */
export function zoneFromCards(stoolSaturation, cardReadings) {
  const low = cardReadings.find((c) => c.id === BOUNDARY_CARDS.low);
  const high = cardReadings.find((c) => c.id === BOUNDARY_CARDS.high);
  if (!low || !high) return null;

  if (stoolSaturation <= low.saturation) return ZONE.refer;
  if (stoolSaturation >= high.saturation) return ZONE.normal;
  return ZONE.unclear;
}

/**
 * Card cells must get more saturated as the number rises. If they do not, the
 * taps landed somewhere other than where the parent was asked to tap, and a
 * confident answer built on them would be worse than no answer.
 */
export function checkCardOrder(cardReadings) {
  const ordered = [...cardReadings].sort((a, b) => a.id - b.id);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].saturation <= ordered[i - 1].saturation) {
      return QUALITY_ISSUE.cardOutOfOrder;
    }
  }
  return null;
}

/** Below this gap the boundary is too narrow to separate the zones usefully. */
export const MIN_BOUNDARY_GAP = 8;

/**
 * Full reading for one capture.
 *
 * Stool samples are passed as an array and the LOWEST-saturation one decides,
 * because stool is heterogeneous and it is the palest region that carries the
 * clinical signal — averaging it away is exactly the wrong move. The spread
 * across samples is returned so the UI can say when a stool was patchy.
 *
 * @param {number[]} whiteRgb   Mean RGB at the white reference
 * @param {number[][]} stoolRgbs One or more mean RGBs sampled on the stool
 * @param {object} [options]
 * @param {number[]} [options.whiteRgbB]
 *        A second white tap elsewhere in the frame. Two whites that disagree
 *        mean more than one light source, and correcting by either one is then
 *        worse than not correcting at all.
 * @param {{id: number, rgb: number[]}[]} [options.cardRefs]
 *        Card cells photographed in the same frame. Supplying the boundary
 *        pair (3 and 4) switches the reading from absolute to relative.
 */
export function analyse(whiteRgb, stoolRgbs, options = {}) {
  // Older call sites passed the second white as a bare third argument.
  const { whiteRgbB = null, cardRefs = [] } =
    Array.isArray(options) ? { whiteRgbB: options } : options;

  const samples = Array.isArray(stoolRgbs[0]) ? stoolRgbs : [stoolRgbs];

  const issues = [];
  const advisories = [];

  const whiteIssue = checkWhiteReference(whiteRgb);
  if (whiteIssue) issues.push(whiteIssue);

  const cast = checkWhiteCast(whiteRgb);
  if (cast) advisories.push(cast);

  if (whiteRgbB) {
    const secondIssue = checkWhiteReference(whiteRgbB);
    if (secondIssue && !whiteIssue) issues.push(secondIssue);

    const mixed = checkIlluminantConsistency(whiteRgb, whiteRgbB);
    if (mixed) issues.push(mixed);
  }

  // Averaging the two white taps gives a slightly steadier reference than
  // either alone; it is only reached once they have been shown to agree.
  const whiteReference =
    whiteRgbB && !issues.some((i) => i.key === "mixedIllumination")
      ? whiteRgb.map((c, i) => (c + whiteRgbB[i]) / 2)
      : whiteRgb;

  const gain = whiteBalanceGain(whiteReference);

  const correct = (rgb) => {
    const raw = applyGain(rgb, gain);
    const clipped = raw.some((c) => c > 255);
    const corrected = raw.map((c) => Math.min(c, 255));
    const lab = rgbToLab(...corrected);
    return {
      correctedRgb: corrected,
      saturation: saturationPct(...corrected),
      lab,
      chroma: labChroma(lab),
      clipped,
    };
  };

  const readings = samples.map(correct);
  if (readings.some((r) => r.clipped)) issues.push(QUALITY_ISSUE.stoolClipped);

  const cardReadings = cardRefs.map(({ id, rgb }) => ({ id, ...correct(rgb) }));
  if (cardReadings.some((c) => c.clipped)) issues.push(QUALITY_ISSUE.cardClipped);

  if (cardReadings.length >= 2) {
    const order = checkCardOrder(cardReadings);
    if (order) issues.push(order);
  }

  // The palest region decides.
  const decisive = readings.reduce((lo, r) => (r.saturation < lo.saturation ? r : lo));
  const saturations = readings.map((r) => r.saturation);
  const spread = Math.max(...saturations) - Math.min(...saturations);
  const patchy = spread > 15;
  if (patchy) advisories.push(QUALITY_ADVISORY.patchyStool);

  const relativeZone = issues.length
    ? null
    : zoneFromCards(decisive.saturation, cardReadings);

  const method = relativeZone ? "relative" : "absolute";
  if (method === "absolute") advisories.push(QUALITY_ADVISORY.noCardReference);

  const low = cardReadings.find((c) => c.id === BOUNDARY_CARDS.low);
  const high = cardReadings.find((c) => c.id === BOUNDARY_CARDS.high);
  const boundaryGap = low && high ? high.saturation - low.saturation : null;
  if (method === "relative" && boundaryGap !== null && boundaryGap < MIN_BOUNDARY_GAP) {
    advisories.push(QUALITY_ADVISORY.cardsVeryClose);
  }

  return {
    usable: issues.length === 0,
    issues,
    advisories,

    method,
    saturation: decisive.saturation,
    zone: relativeZone ?? zoneFor(decisive.saturation),
    card: nearestCard(decisive.saturation),

    // Present only in relative mode; the UI shows the stool against these.
    cardReadings,
    boundary: low && high ? { low: low.saturation, high: high.saturation } : null,
    boundaryGap,

    correctedRgb: decisive.correctedRgb,
    lab: decisive.lab,
    chroma: decisive.chroma,

    whiteUsed: whiteReference,
    sampleCount: readings.length,
    spread,
    patchy,
    readings,
  };
}

// ── Trend ────────────────────────────────────────────────────────────────────

/** Needs at least this many points before a slope means anything. */
export const TREND_MIN_POINTS = 3;

/** Saturation points lost per week that counts as a real decline. */
export const TREND_SLOPE_THRESHOLD = -5;

/**
 * Least-squares slope of saturation against time, in saturation points per week.
 *
 * This exists because the duct obliterates gradually, so a falling trend can be
 * the earliest signal there is — present before any single reading crosses a
 * threshold. The serum side already works this way: Harpavat's two-stage
 * newborn screening (JAMA 2020;323:1141-50, doi:10.1001/jama.2020.0837) calls
 * stage 2 positive when bilirubin is HIGHER THAN the stage 1 value, not when it
 * passes a fixed cutoff. Same logic, other end of the pathway.
 *
 * ⚠️ The threshold is a judgement call with no validation behind it yet. It is
 * the most obvious thing for a prospective study to calibrate.
 *
 * @param {{date: string|number|Date, saturation: number}[]} series
 */
export function assessTrend(series) {
  const points = series
    .filter((p) => Number.isFinite(p.saturation))
    .map((p) => ({ t: new Date(p.date).getTime(), s: p.saturation }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  if (points.length < TREND_MIN_POINTS) {
    return { available: false, reason: "insufficient", points: points.length };
  }

  const WEEK = 7 * 24 * 3600 * 1000;
  const t0 = points[0].t;
  const xs = points.map((p) => (p.t - t0) / WEEK);
  const ys = points.map((p) => p.s);

  const n = xs.length;
  const meanX = xs.reduce((a, v) => a + v, 0) / n;
  const meanY = ys.reduce((a, v) => a + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }

  // All readings on one day: no time base, so no slope.
  if (den === 0) {
    return { available: false, reason: "no-time-span", points: n };
  }

  const slope = num / den;

  return {
    available: true,
    points: n,
    spanWeeks: xs[n - 1],
    slopePerWeek: slope,
    declining: slope <= TREND_SLOPE_THRESHOLD,
    latest: ys[n - 1],
    first: ys[0],
  };
}
