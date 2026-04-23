/**
 * Half-width ↔ Full-width conversion tables — single source of truth.
 *
 * Used by:
 *   - Internal kusanaji pipeline: normalize-input.js (FW→HW), full-width-output.js (HW→FW).
 *   - jala-dict-api /v2/width endpoint (via width-convert.js wrapper).
 *   - Downstream consumers that need the raw mappings (jala-ui batch/width pages
 *     can re-export to keep their local Edge-runtime path, or forward to the
 *     dict-api endpoint for a thinner Vercel function).
 *
 * Pure data + constants. Zero runtime deps. ESM. Works in Node and Edge
 * runtimes alike.
 */

// ─── Unicode ranges / constants ────────────────────────────────────────
export const HALFWIDTH_ASCII_START = 0x0021  // '!'
export const HALFWIDTH_ASCII_END   = 0x007e  // '~'
export const FULLWIDTH_ASCII_START = 0xff01  // '！'
export const FULLWIDTH_ASCII_END   = 0xff5e  // '～'
export const ASCII_OFFSET          = 0xfee0  // FW - HW

export const HALFWIDTH_SPACE = 0x0020  // ' '
export const FULLWIDTH_SPACE = 0x3000  // '　' ideographic

export const HALFWIDTH_KATAKANA_START = 0xff61  // includes JIS X 0201 punct
export const HALFWIDTH_KATAKANA_END   = 0xff9f
export const FULLWIDTH_KATAKANA_START = 0x30a0
export const FULLWIDTH_KATAKANA_END   = 0x30ff

// ─── Katakana 1:1 mapping (base chars + JIS X 0201 punct) ──────────────
// Full-width katakana → half-width katakana for single-char bases (no
// voiced/semi-voiced composition here; those are handled separately).
export const FULLWIDTH_TO_HALFWIDTH_KATAKANA = Object.freeze({
    '。': '｡', '「': '｢', '」': '｣', '、': '､', '・': '･',
    'ヲ': 'ｦ',
    'ァ': 'ｧ', 'ィ': 'ｨ', 'ゥ': 'ｩ', 'ェ': 'ｪ', 'ォ': 'ｫ',
    'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ', 'ッ': 'ｯ', 'ー': 'ｰ',
    'ア': 'ｱ', 'イ': 'ｲ', 'ウ': 'ｳ', 'エ': 'ｴ', 'オ': 'ｵ',
    'カ': 'ｶ', 'キ': 'ｷ', 'ク': 'ｸ', 'ケ': 'ｹ', 'コ': 'ｺ',
    'サ': 'ｻ', 'シ': 'ｼ', 'ス': 'ｽ', 'セ': 'ｾ', 'ソ': 'ｿ',
    'タ': 'ﾀ', 'チ': 'ﾁ', 'ツ': 'ﾂ', 'テ': 'ﾃ', 'ト': 'ﾄ',
    'ナ': 'ﾅ', 'ニ': 'ﾆ', 'ヌ': 'ﾇ', 'ネ': 'ﾈ', 'ノ': 'ﾉ',
    'ハ': 'ﾊ', 'ヒ': 'ﾋ', 'フ': 'ﾌ', 'ヘ': 'ﾍ', 'ホ': 'ﾎ',
    'マ': 'ﾏ', 'ミ': 'ﾐ', 'ム': 'ﾑ', 'メ': 'ﾒ', 'モ': 'ﾓ',
    'ヤ': 'ﾔ', 'ユ': 'ﾕ', 'ヨ': 'ﾖ',
    'ラ': 'ﾗ', 'リ': 'ﾘ', 'ル': 'ﾙ', 'レ': 'ﾚ', 'ロ': 'ﾛ',
    'ワ': 'ﾜ', 'ン': 'ﾝ',
    '゛': 'ﾞ', '゜': 'ﾟ',
})

// Reverse of the above — derived via Object.fromEntries so the two never
// drift. Frozen so downstream mutation is rejected.
export const HALFWIDTH_TO_FULLWIDTH_KATAKANA = Object.freeze(
    Object.fromEntries(
        Object.entries(FULLWIDTH_TO_HALFWIDTH_KATAKANA).map(([fw, hw]) => [hw, fw])
    )
)

// ─── Dakuten / handakuten composition tables ───────────────────────────
// Full-width voiced/semi-voiced character → half-width 2-char sequence
// (base + dakuten or + handakuten). Used for FW→HW decomposition.
export const FULLWIDTH_VOICED_TO_HALFWIDTH = Object.freeze({
    'ガ': 'ｶﾞ', 'ギ': 'ｷﾞ', 'グ': 'ｸﾞ', 'ゲ': 'ｹﾞ', 'ゴ': 'ｺﾞ',
    'ザ': 'ｻﾞ', 'ジ': 'ｼﾞ', 'ズ': 'ｽﾞ', 'ゼ': 'ｾﾞ', 'ゾ': 'ｿﾞ',
    'ダ': 'ﾀﾞ', 'ヂ': 'ﾁﾞ', 'ヅ': 'ﾂﾞ', 'デ': 'ﾃﾞ', 'ド': 'ﾄﾞ',
    'バ': 'ﾊﾞ', 'ビ': 'ﾋﾞ', 'ブ': 'ﾌﾞ', 'ベ': 'ﾍﾞ', 'ボ': 'ﾎﾞ',
    'パ': 'ﾊﾟ', 'ピ': 'ﾋﾟ', 'プ': 'ﾌﾟ', 'ペ': 'ﾍﾟ', 'ポ': 'ﾎﾟ',
    'ヴ': 'ｳﾞ',
})

// Reverse of the above — HW 2-char sequence → FW voiced/semi-voiced char.
// Used for HW→FW composition.
export const HALFWIDTH_TO_FULLWIDTH_VOICED = Object.freeze(
    Object.fromEntries(
        Object.entries(FULLWIDTH_VOICED_TO_HALFWIDTH).map(([fw, hw]) => [hw, fw])
    )
)

// Pre-split: base-char → FW voiced char (when next HW char is ﾞ dakuten).
// Avoids a string-concat in the inner conversion loop.
export const HW_BASE_DAKUTEN_TO_FW = Object.freeze({
    'ｶ': 'ガ', 'ｷ': 'ギ', 'ｸ': 'グ', 'ｹ': 'ゲ', 'ｺ': 'ゴ',
    'ｻ': 'ザ', 'ｼ': 'ジ', 'ｽ': 'ズ', 'ｾ': 'ゼ', 'ｿ': 'ゾ',
    'ﾀ': 'ダ', 'ﾁ': 'ヂ', 'ﾂ': 'ヅ', 'ﾃ': 'デ', 'ﾄ': 'ド',
    'ﾊ': 'バ', 'ﾋ': 'ビ', 'ﾌ': 'ブ', 'ﾍ': 'ベ', 'ﾎ': 'ボ',
    'ｳ': 'ヴ',
})

// Pre-split: base-char → FW semi-voiced char (when next HW char is ﾟ handakuten).
export const HW_BASE_HANDAKUTEN_TO_FW = Object.freeze({
    'ﾊ': 'パ', 'ﾋ': 'ピ', 'ﾌ': 'プ', 'ﾍ': 'ペ', 'ﾎ': 'ポ',
})

// ─── Extra FW↔HW pairs outside the ASCII offset + katakana ranges ──────
// These are the characters that UnicodeData.txt flags with <wide> or
// <narrow> compatibility decompositions but whose counterparts live
// OUTSIDE U+0021–007E / U+FF61–FF9F — i.e. they can't be handled by the
// ASCII offset math or the katakana table. Three groups:
//
//   1. Fullwidth Signs block (U+FFE0–FFE6): currency / math / typographic
//      marks whose HW forms live in Latin-1 Supplement (U+00A0–00FF) and
//      Currency Symbols (U+20A9). ￥↔¥ is by far the most common — every
//      Japanese e-commerce price tag is one of these two forms.
//   2. FW white parens U+FF5F/U+FF60: their HW counterparts are in the
//      Math Brackets-B block (U+2985/U+2986), NOT in Latin-1, so the
//      0xFEE0 offset that handles normal FW ASCII misses them.
//   3. Halfwidth Forms block (U+FFE8–FFEE): HW box-drawing, arrows, and
//      geometric shapes whose FW forms are in the Box Drawing (U+2500),
//      Arrows (U+2190) and Geometric Shapes (U+25A0) blocks.
//
// Authority: unicode.org UnicodeData.txt, column-5 decomposition tag.
// Table keyed FW→HW; the reverse is derived below.
export const FULLWIDTH_TO_HALFWIDTH_EXTRA = Object.freeze({
    // Fullwidth Signs block (U+FFE0–FFE6)
    '￠': '¢',  // U+FFE0 → U+00A2
    '￡': '£',  // U+FFE1 → U+00A3
    '￢': '¬',  // U+FFE2 → U+00AC
    '￣': '¯',  // U+FFE3 → U+00AF
    '￤': '¦',  // U+FFE4 → U+00A6
    '￥': '¥',  // U+FFE5 → U+00A5   (yen — highest-frequency)
    '￦': '₩',  // U+FFE6 → U+20A9
    // FW white parens (U+FF5F/FF60) — outside ASCII offset target range
    '｟': '⦅',  // U+FF5F → U+2985
    '｠': '⦆',  // U+FF60 → U+2986
    // FW side of the Halfwidth Forms block pairs
    '│': '￨',  // U+2502 → U+FFE8   LIGHT VERTICAL
    '←': '￩',  // U+2190 → U+FFE9   LEFTWARDS ARROW
    '↑': '￪',  // U+2191 → U+FFEA   UPWARDS ARROW
    '→': '￫',  // U+2192 → U+FFEB   RIGHTWARDS ARROW
    '↓': '￬',  // U+2193 → U+FFEC   DOWNWARDS ARROW
    '■': '￭',  // U+25A0 → U+FFED   BLACK SQUARE
    '○': '￮',  // U+25CB → U+FFEE   WHITE CIRCLE
})

export const HALFWIDTH_TO_FULLWIDTH_EXTRA = Object.freeze(
    Object.fromEntries(
        Object.entries(FULLWIDTH_TO_HALFWIDTH_EXTRA).map(([fw, hw]) => [hw, fw])
    )
)

// NFD-normalized combining dakuten/handakuten marks.
// The existing HW_KANA_TO_FW maps the SPACING forms ゛ (U+309B) and
// ゜ (U+309C) which is what real Japanese text uses. But Unicode NFD
// decomposes HW ﾞ/ﾟ to the COMBINING forms U+3099 / U+309A, so NFD-
// normalized input would otherwise produce stranded combining marks.
// This table is additive — it does NOT replace the spacing-form entries.
export const FULLWIDTH_COMBINING_MARKS_TO_HALFWIDTH = Object.freeze({
    '゙': 'ﾞ',  // COMBINING VOICED SOUND MARK → U+FF9E
    '゚': 'ﾟ',  // COMBINING SEMI-VOICED SOUND MARK → U+FF9F
})

// ─── Classification helpers ────────────────────────────────────────────
/**
 * @param {number} code char code point (0xFFFF-safe, BMP only)
 */
export function isHalfWidthAscii(code) {
    return code >= HALFWIDTH_ASCII_START && code <= HALFWIDTH_ASCII_END
}
export function isFullWidthAscii(code) {
    return code >= FULLWIDTH_ASCII_START && code <= FULLWIDTH_ASCII_END
}
export function isHalfWidthKatakana(code) {
    return code >= HALFWIDTH_KATAKANA_START && code <= HALFWIDTH_KATAKANA_END
}
export function isFullWidthKatakana(code) {
    return code >= FULLWIDTH_KATAKANA_START && code <= FULLWIDTH_KATAKANA_END
}
