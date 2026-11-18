/**
 * Self-check for the colour pipeline. No browser, no images — pure arithmetic
 * against the published figures.
 *
 *   npm run verify:color
 *
 * Every expectation below traces to a source cited in src/lib/stoolCard.js.
 */

import {
  analyse,
  assessTrend,
  checkCardOrder,
  hexToRgb,
  saturationPct,
  zoneFor,
  zoneFromCards,
} from "../src/lib/color.js";
import {
  CARD_SATURATION_BAND,
  PUBLISHED_CUTOFFS,
  STOOL_CARD,
  ZONE_THRESHOLD,
} from "../src/lib/stoolCard.js";

let failures = 0;

function check(label, condition, detail = "") {
  const mark = condition ? "ok  " : "FAIL";
  if (!condition) failures++;
  console.log(`  ${mark}  ${label}${detail ? `  — ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n${title}`);
}

// ── 1. Saturation definition ─────────────────────────────────────────────────

section("Saturation definition (HSV, gamma-encoded sRGB)");

check("pure white → 0%", saturationPct(255, 255, 255) === 0);
check("pure red → 100%", saturationPct(255, 0, 0) === 100);
check("mid grey → 0%", saturationPct(128, 128, 128) === 0);
check("black → 0% (guarded, not NaN)", saturationPct(0, 0, 0) === 0);

// ── 2. Zone boundaries ───────────────────────────────────────────────────────

section("Three-zone boundaries");

check(`S=20 → refer`, zoneFor(20).key === "refer");
check(`S=${ZONE_THRESHOLD.refer - 1} → refer`, zoneFor(ZONE_THRESHOLD.refer - 1).key === "refer");
check(`S=${ZONE_THRESHOLD.refer} → unclear`, zoneFor(ZONE_THRESHOLD.refer).key === "unclear");
check(`S=${ZONE_THRESHOLD.normal - 1} → unclear`, zoneFor(ZONE_THRESHOLD.normal - 1).key === "unclear");
check(`S=${ZONE_THRESHOLD.normal} → normal`, zoneFor(ZONE_THRESHOLD.normal).key === "normal");
check("S=85 (median normal card) → normal", zoneFor(85).key === "normal");
check("S=25 (median abnormal card) → refer", zoneFor(25).key === "refer");

section("Published cutoffs fall inside the unclear band");

for (const { value, source, note } of PUBLISHED_CUTOFFS) {
  check(
    `S=${value} (${source}) is unclear, not normal`,
    zoneFor(value).key === "unclear",
    note
  );
}

section("Sensitivity is preserved at Shen's 60% cutoff");

// Shen reported 100% sensitivity at S<60. Nothing below 60 may be called
// normal, or the app would be less sensitive than the published cutoff.
let sensitivityHolds = true;
for (let s = 0; s < 60; s += 0.5) {
  if (zoneFor(s).key === "normal") sensitivityHolds = false;
}
check("no saturation below 60 is reported as normal", sensitivityHolds);

// ── 3. Card swatches sit on the right side of the axis ───────────────────────

section("Display swatches agree with Shen's measured card bands");

for (const card of STOOL_CARD) {
  const s = saturationPct(...hexToRgb(card.hex));
  const zone = zoneFor(s);
  const band =
    card.id <= 3 ? CARD_SATURATION_BAND.abnormal : CARD_SATURATION_BAND.normal;
  const inBand = s >= band.min && s <= band.max;
  check(
    `card ${card.id} (${card.label}) inside ${band.min}–${band.max}%`,
    inBand,
    `S=${s.toFixed(1)}% → ${zone.short}`
  );
}

// ── 4. White balance under a warm illuminant ─────────────────────────────────

section("White balance under tungsten light");

// An acholic stool photographed under warm light. Raw pixels read yellowish,
// which inflates apparent saturation; correcting against paper under the same
// light should pull the reading back down into the referral zone.
//
// The white reference is deliberately kept under WHITE_CEILING (250): a warm
// white that reads 255 in the red channel is CLIPPED, and the pipeline refuses
// it rather than correcting from it. An earlier version of this test used
// [255, 214, 170] and so demonstrated the maths on a capture the app would
// have rejected outright.
const warmWhite = [245, 206, 164];
const warmAcholic = [221, 184, 143];

const corrected = analyse(warmWhite, warmAcholic);
const uncorrected = analyse([255, 255, 255], warmAcholic);

console.log(
  `  corrected    S=${corrected.saturation.toFixed(1)}% → ${corrected.zone.short}`
);
console.log(
  `  uncorrected  S=${uncorrected.saturation.toFixed(1)}% → ${uncorrected.zone.short}`
);
check("the warm capture is itself usable", corrected.usable,
  corrected.issues.map((i) => i.key).join(", ") || "no issues");
check(
  "correction lowers saturation toward the acholic end",
  corrected.saturation < uncorrected.saturation
);
check("corrected reading is referred", corrected.zone.key === "refer");
check("uncorrected reading would have read higher", uncorrected.saturation > 30);
check(
  "a strong cast is advised, not refused",
  corrected.advisories.some((a) => a.key === "strongCast")
);

// ── 5. Quality gates ────────────────────────────────────────────────────────

section("Quality gates reject unusable captures");

const gate = (label, white, stool) => {
  const out = analyse(white, stool);
  check(label, !out.usable, out.issues.map((i) => i.key).join(", ") || "none");
};

gate("clipped white reference", [255, 255, 255], [180, 160, 120]);
gate("underexposed frame", [90, 88, 85], [60, 55, 45]);
gate("tapped something strongly coloured, not paper", [200, 110, 40], [180, 160, 120]);

const goodWhite = [235, 233, 230];
const goodStool = [150, 120, 60];
const fine = analyse(goodWhite, goodStool);
check("a well-exposed neutral reference passes", fine.usable, `S=${fine.saturation.toFixed(1)}%`);

section("Mixed illumination detected from two white taps");

const mixed = analyse([235, 233, 230], goodStool, { whiteRgbB: [250, 205, 160] });
check(
  "two whites under different lights are rejected",
  mixed.issues.some((i) => i.key === "mixedIllumination")
);
const consistent = analyse([235, 233, 230], goodStool, { whiteRgbB: [231, 229, 227] });
check("two whites under the same light pass", consistent.usable);
check(
  "the two whites are averaged into the reference",
  Math.abs(consistent.whiteUsed[0] - 233) < 0.001,
  `R=${consistent.whiteUsed[0]}`
);

const secondBad = analyse([235, 233, 230], goodStool, { whiteRgbB: [255, 255, 255] });
check(
  "a clipped second tap is caught too",
  secondBad.issues.some((i) => i.key === "whiteClipped")
);

// ── Relative mode: the card in the frame ────────────────────────────────────

section("Relative mode decides against cells in the same photo");

// A warm cast applied to everything in the frame — stool and card alike.
const cast = ([r, g, b]) => [r * 0.96, g * 0.81, b * 0.64];
const castWhite = cast([255, 255, 255]);
const trueCard3 = [200, 185, 120];
const trueCard4 = [185, 160, 55];

const withCard = (trueStool) =>
  analyse(castWhite, [cast(trueStool)], {
    cardRefs: [
      { id: 3, rgb: cast(trueCard3) },
      { id: 4, rgb: cast(trueCard4) },
    ],
  });

const paler = withCard([225, 220, 205]);
const between = withCard([198, 182, 112]);
const richer = withCard([150, 110, 25]);

check("uses the relative method when both cells are given", paler.method === "relative");
check("paler than cell 3 → refer", paler.zone.key === "refer",
  `S=${paler.saturation.toFixed(1)} vs cell3 ${paler.boundary.low.toFixed(1)}`);
check("between the cells → unclear", between.zone.key === "unclear",
  `S=${between.saturation.toFixed(1)} in [${between.boundary.low.toFixed(1)}, ${between.boundary.high.toFixed(1)}]`);
check("richer than cell 4 → normal", richer.zone.key === "normal",
  `S=${richer.saturation.toFixed(1)} vs cell4 ${richer.boundary.high.toFixed(1)}`);

section("Relative mode survives what breaks the absolute path");

// The same true stool, photographed under two very different lights. An
// absolute reading shifts; a relative one must not, because the cast lands on
// the card cells too.
const warm = ([r, g, b]) => [r * 0.99, g * 0.80, b * 0.60];
const cool = ([r, g, b]) => [r * 0.80, g * 0.88, b * 0.99];
const trueStool = [198, 182, 112];

const underWarm = analyse(warm([255, 255, 255]), [warm(trueStool)], {
  cardRefs: [{ id: 3, rgb: warm(trueCard3) }, { id: 4, rgb: warm(trueCard4) }],
});
const underCool = analyse(cool([255, 255, 255]), [cool(trueStool)], {
  cardRefs: [{ id: 3, rgb: cool(trueCard3) }, { id: 4, rgb: cool(trueCard4) }],
});
check(
  "same verdict under warm and cool light",
  underWarm.zone.key === underCool.zone.key,
  `${underWarm.zone.short} / ${underCool.zone.short}`
);

// A card printed a shade off — the batch variation the foundation colour-
// matches by hand each year. Relative mode absorbs it because the shift moves
// the boundary with the card.
const offBatch = analyse([235, 233, 230], [[198, 182, 112]], {
  cardRefs: [
    { id: 3, rgb: [205, 191, 131] },
    { id: 4, rgb: [190, 166, 68] },
  ],
});
check(
  "a differently printed card still brackets the same stool",
  offBatch.method === "relative" && offBatch.zone.key === "unclear",
  `boundary ${offBatch.boundary.low.toFixed(1)}–${offBatch.boundary.high.toFixed(1)}`
);

section("Relative mode refuses taps that cannot be right");

const swapped = analyse([235, 233, 230], [[198, 182, 112]], {
  cardRefs: [
    { id: 3, rgb: trueCard4 },
    { id: 4, rgb: trueCard3 },
  ],
});
check("cells tapped in the wrong order are rejected", !swapped.usable,
  swapped.issues.map((i) => i.key).join(", "));
check("and it does not silently fall back to thresholds",
  swapped.method !== "relative" || !swapped.usable);

check("checkCardOrder accepts a rising series",
  checkCardOrder([{ id: 3, saturation: 40 }, { id: 4, saturation: 70 }]) === null);
check("checkCardOrder rejects a flat pair",
  checkCardOrder([{ id: 3, saturation: 50 }, { id: 4, saturation: 50 }]) !== null);

const tooClose = analyse([235, 233, 230], [[198, 182, 112]], {
  cardRefs: [
    { id: 3, rgb: [190, 170, 90] },
    { id: 4, rgb: [190, 168, 84] },
  ],
});
check("a barely-separated boundary is flagged",
  tooClose.advisories.some((a) => a.key === "cardsVeryClose"),
  `gap ${tooClose.boundaryGap?.toFixed(1)}`);

section("Absolute mode says so");

const noCard = analyse([235, 233, 230], goodStool);
check("falls back to published thresholds", noCard.method === "absolute");
check("and tells the user a card would be better",
  noCard.advisories.some((a) => a.key === "noCardReference"));

check("zoneFromCards needs both boundary cells",
  zoneFromCards(50, [{ id: 3, saturation: 40 }]) === null);

// ── 6. Palest region decides ─────────────────────────────────────────────────

section("Multi-point sampling: the palest region decides");

const patchy = analyse(goodWhite, [
  [150, 120, 60], // pigmented
  [205, 198, 180], // pale patch
]);
const pigmentedOnly = analyse(goodWhite, [[150, 120, 60]]);

console.log(`  pigmented alone  S=${pigmentedOnly.saturation.toFixed(1)}%`);
console.log(`  with pale patch  S=${patchy.saturation.toFixed(1)}%  spread=${patchy.spread.toFixed(1)}`);
check(
  "a pale patch pulls the reading down, not averaged away",
  patchy.saturation < pigmentedOnly.saturation
);
check("patchiness is flagged", patchy.patchy);

// ── 7. Trend ────────────────────────────────────────────────────────────────

section("Longitudinal trend");

const weekly = (sats) =>
  sats.map((s, i) => ({
    date: new Date(2026, 0, 1 + i * 7).toISOString(),
    saturation: s,
  }));

const falling = assessTrend(weekly([82, 70, 58, 44]));
check("declining series is flagged", falling.declining, `${falling.slopePerWeek.toFixed(1)}/week`);

const steady = assessTrend(weekly([80, 82, 79, 81]));
check("steady series is not flagged", !steady.declining, `${steady.slopePerWeek.toFixed(1)}/week`);

const tooFew = assessTrend(weekly([80, 70]));
check("two points give no verdict", !tooFew.available, tooFew.reason);

const sameDay = assessTrend([
  { date: "2026-01-01T09:00:00Z", saturation: 80 },
  { date: "2026-01-01T09:00:00Z", saturation: 70 },
  { date: "2026-01-01T09:00:00Z", saturation: 60 },
]);
check("no time span gives no verdict", !sameDay.available, sameDay.reason);

// A series that never crosses a threshold but falls steadily — the case the
// 7-way card model cannot see at all.
const subthreshold = assessTrend(weekly([88, 80, 73, 69]));
check(
  "steady decline is caught while every reading is still normal",
  subthreshold.declining && weekly([88, 80, 73, 69]).every((p) => zoneFor(p.saturation).key === "normal"),
  `${subthreshold.slopePerWeek.toFixed(1)}/week, latest ${subthreshold.latest}`
);

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
