/**
 * The Taiwanese infant stool colour card (七色大便卡), and the three-zone
 * reading the app reports.
 *
 * ── Why there are no Lab reference values here any more ──────────────────────
 *
 * Each cell of the physical card is a PHOTOGRAPH of real stool, not a flat
 * colour patch: it has shading, texture and an internal colour gradient. The
 * Taiwan Children's Liver Foundation confirmed this directly — the programme
 * deliberately keeps no CMYK or Pantone definition, and sends a person to the
 * printing plant each year to colour-match by eye, because (in Prof. Chang's
 * words) the colours within one cell cannot be pinned to a single number.
 *
 * So "the Lab value of card 3" is not a number that exists. An earlier version
 * of this file carried seven Lab triplets and matched by nearest centroid; that
 * model was built on a premise the card itself does not support.
 *
 * ── What replaced it ────────────────────────────────────────────────────────
 *
 * The decision now runs on HSV saturation, a single continuous axis, because
 * that is what the literature has actually validated:
 *
 *   • Shen Z, Zheng S, Dong R, Chen G. Saturation of stool color in HSV color
 *     model is a promising objective parameter for screening biliary atresia.
 *     J Pediatr Surg. 2016;51(12):2091-4. doi:10.1016/j.jpedsurg.2016.09.044
 *     Read saturations off the validated Taiwan, Japan and Britain cards:
 *     normal colours 67–99% (median 85), abnormal 7–47% (median 25) — two
 *     non-overlapping ranges with an empty band between 47 and 67. On real
 *     stools (40 BA / 40 control), S < 60% gave 100% sensitivity, 85%
 *     specificity.
 *
 *   • Waitayagitgumjon K, et al. A Multicenter Pilot Study of Biliary Atresia
 *     Screening Using Digital Stool Color Imaging. Pediatr Gastroenterol
 *     Hepatol Nutr. 2024;27(3):168-75. doi:10.5223/pghn.2024.27.3.168
 *     Independent prospective replication, 5 Thai hospitals: ROC-optimal
 *     S ≤ 56 reached 81.8% accuracy.
 *
 *   • Hoshino E, et al. An iPhone application using a novel stool color
 *     detection algorithm for biliary atresia screening. Pediatr Surg Int.
 *     2017;33(10):1115-21. doi:10.1007/s00383-017-4146-8
 *     States the premise plainly: BA stools are not always acholic, "as
 *     obliteration of the bile duct occurs gradually" — the colour change is
 *     progressive, so a 7-way classification is the wrong shape for it. Their
 *     HSV algorithm separated visually non-acholic (still pigmented) BA stools
 *     from pale non-BA stools, i.e. the continuous parameter caught what the
 *     card and the eye miss.
 *
 * Saturation also happens to dodge the foundation's objection: within one
 * photograph, lightness varies a great deal between highlight and shadow while
 * chroma stays comparatively stable, so a one-dimensional chroma reading
 * survives the internal variation that defeats a three-dimensional Lab point.
 *
 * The seven cells are kept below purely as the on-screen reference a parent
 * recognises from the 健兒手冊. The hex values are illustrative swatches for
 * that display, NOT a measurement standard, and nothing clinical is decided
 * from them.
 */

/**
 * Illustrative swatches for display only. Cards 1–3 are the acholic end.
 *
 * The hex values are chosen so that each one's HSV saturation lands inside the
 * band Shen et al. measured for its side of the card — 7–47% for 1–3, 67–99%
 * for 4–7 — so the swatch a parent sees agrees with the axis the app decides
 * on. (Card 4 was originally #B8A040, which came out at 65.2% and fell just
 * outside the normal band; verify:color now asserts this alignment.)
 *
 * They remain approximations for rendering, not a measurement standard.
 */
export const STOOL_CARD = [
  { id: 1, hex: "#E8E0D0", label: "灰白色" },
  { id: 2, hex: "#D4C9A8", label: "淡黃色" },
  { id: 3, hex: "#C8B870", label: "淡黃綠" },
  { id: 4, hex: "#B8A037", label: "黃綠色" },
  { id: 5, hex: "#9A8030", label: "黃褐色" },
  { id: 6, hex: "#7A5820", label: "褐色" },
  { id: 7, hex: "#5A3810", label: "深褐色" },
];

/** Saturation bands reported for the validated cards in Shen et al. 2016. */
export const CARD_SATURATION_BAND = {
  abnormal: { min: 7, max: 47, median: 25 },
  normal: { min: 67, max: 99, median: 85 },
};

export function cardById(id) {
  return STOOL_CARD.find((c) => c.id === id) ?? null;
}

/**
 * The boundary pair on the Taiwanese card: 1–3 are the acholic side, 4–7 the
 * normal side, so the clinical question the card asks is whether a stool sits
 * below cell 3 or above cell 4.
 *
 * Photographing those two cells alongside the nappy turns the whole reading
 * relative — see RELATIVE_MODE below.
 */
export const BOUNDARY_CARDS = { low: 3, high: 4 };

/**
 * Why putting the parent's own card in the frame is worth five taps.
 *
 * Everything that distorts the measurement — the print batch of their
 * particular 健兒手冊, their phone's sensor and colour pipeline, the exposure
 * the camera chose, the colour of the light in the room — lands on the stool
 * and on the card cells in the same photograph equally, and cancels when the
 * two are compared against each other. The question stops being "what is this
 * colour, absolutely?", which needs a reference value that does not exist for
 * this card, and becomes "in this photo, is the stool paler than cell 3 or
 * richer than cell 4?" — which is exactly what the card was designed to ask.
 *
 * It is also the answer to the obstacle that stopped the earlier NTU attempt:
 * rather than trying to standardise the photographing conditions, the
 * conditions are allowed to vary and are measured out.
 */
export const RELATIVE_MODE = {
  key: "relative",
  label: "有健兒手冊",
  blurb: "把大便卡拍進同一張照片，準確度最高",
};

export const ABSOLUTE_MODE = {
  key: "absolute",
  label: "只用白紙",
  blurb: "手邊沒有手冊時使用，依文獻閾值判讀",
};

/**
 * Zone boundaries on HSV saturation (%), taken from the empty band between the
 * normal and abnormal card ranges in Shen et al. Both published decision
 * cutoffs (56 and 60) fall inside this band, which is why the band is reported
 * as "unclear" rather than split at either one.
 *
 * The consequence is deliberate: everything below 67 prompts medical contact,
 * so the 100%-sensitivity behaviour at Shen's 60% cutoff is preserved while the
 * genuinely ambiguous readings are labelled ambiguous instead of being forced
 * to a side. Misclassification was the foundation's stated concern, and a wide
 * honest uncertain band is the answer to it.
 *
 * ⚠️ These are literature-derived starting values, not locally validated ones.
 */
export const ZONE_THRESHOLD = {
  /** Below this, saturation lies within the cards' abnormal range. */
  refer: 47,
  /** At or above this, saturation lies within the cards' normal range. */
  normal: 67,
};

export const PUBLISHED_CUTOFFS = [
  { value: 60, source: "Shen 2016", note: "sens 100%, spec 85%" },
  { value: 56, source: "Waitayagitgumjon 2024", note: "accuracy 81.8%" },
];

/**
 * Wording rules, which matter as much as the arithmetic:
 *   • The normal zone never says just "正常" — a single normal reading does not
 *     predict the next one, and the duct obliterates gradually.
 *   • The unclear zone sends the parent to a doctor, not back to reassurance.
 *   • Nothing here is phrased as a diagnosis.
 */
export const ZONE = {
  refer: {
    key: "refer",
    label: "大便顏色異常，請盡快就醫",
    action: "建議於 48 小時內至小兒外科或小兒腸胃科就診，並出示本次照片",
    color: "#C0392B",
    bg: "#FDF2F2",
    icon: "⚠️",
    short: "異常",
  },
  unclear: {
    key: "unclear",
    label: "顏色判讀不明確，建議諮詢醫師",
    action: "請在光線更充足時重拍一次；若顏色持續偏淡，請於門診主動告知醫師",
    color: "#E67E22",
    bg: "#FEF9F0",
    icon: "🔶",
    short: "不明確",
  },
  normal: {
    key: "normal",
    label: "此次顏色無異常，請持續觀察",
    action: "建議每週拍照記錄一次，持續至滿 3 個月大",
    color: "#27AE60",
    bg: "#F0FDF4",
    icon: "✅",
    short: "無異常",
  },
};

/**
 * Hard refusals. Any one of these means no clinical reading is reported at
 * all, because the arithmetic the reading depends on has broken down.
 */
export const QUALITY_ISSUE = {
  whiteClipped: {
    key: "whiteClipped",
    message: "白紙過曝（亮度已達上限），無法計算色彩校正",
    fix: "請降低曝光或避開直射光後重拍",
  },
  whiteUnderexposed: {
    key: "whiteUnderexposed",
    message: "照片太暗，雜訊會影響顏色判讀",
    fix: "請到光線更充足的地方重拍",
  },
  whiteNotNeutral: {
    key: "whiteNotNeutral",
    message: "所點位置顏色太深或太鮮豔，應該不是白紙",
    fix: "請重新點擊白紙最乾淨的區域",
  },
  mixedIllumination: {
    key: "mixedIllumination",
    message: "畫面中似有兩種以上光源（例如一半窗光、一半燈光）",
    fix: "請在單一光源下重拍，避免一半落在陰影中",
  },
  stoolClipped: {
    key: "stoolClipped",
    message: "校正後顏色超出可量測範圍，彩度估計不可靠",
    fix: "請降低曝光後重拍",
  },
  cardOutOfOrder: {
    key: "cardOutOfOrder",
    message: "大便卡各格的顏色深淺順序不對，可能點錯了格子",
    fix: "請重新標記，確認依照手冊上的號碼順序點選",
  },
  cardClipped: {
    key: "cardClipped",
    message: "大便卡過曝或反光，無法作為比對基準",
    fix: "請調整角度避開反光後重拍",
  },
};

/**
 * Advisories. The reading still stands, but something about the capture makes
 * it less trustworthy and the parent should know.
 *
 * The distinction matters: white paper photographed under tungsten light is
 * genuinely, strongly chromatic in raw sRGB, and that is exactly the capture
 * white-balance correction exists to rescue. Refusing it would defeat the
 * purpose. A strong cast is a reason to mention that a cleaner retake would be
 * more reliable, not a reason to withhold the reading.
 */
export const QUALITY_ADVISORY = {
  strongCast: {
    key: "strongCast",
    message: "光源偏色較強，校正幅度較大",
    fix: "若方便，建議在白色日光燈或窗邊自然光下再拍一次確認",
  },
  patchyStool: {
    key: "patchyStool",
    message: "大便顏色不均勻，判讀採用最淡的區域",
    fix: "下次可多取幾個點，或換個角度再拍一張",
  },
  noCardReference: {
    key: "noCardReference",
    message: "這次沒有把大便卡拍進畫面，採用文獻閾值判讀",
    fix: "下次把健兒手冊的大便卡放在尿布旁一起拍，判讀會更準",
  },
  cardsVeryClose: {
    key: "cardsVeryClose",
    message: "大便卡 3 號與 4 號格在這張照片裡的顏色差距很小",
    fix: "判讀的分界因此較不明確，建議在光線更好時重拍",
  },
};
