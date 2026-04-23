/**
 * Public entry for the text-layer utilities — segmentation, fallback lookups,
 * punctuation normalization, kana helpers, bidirectional width conversion, and
 * the kyūjitai→shinjitai mapping table.
 *
 * Consumers:
 *   import {
 *       segmentMixed,
 *       applyKanjiFallback, initKanjiFallback,
 *       normalizeJpPunctuation,
 *       katakanaToHiragana, hasKana,
 *       halfToFullWidth, fullToHalfWidth, toFullWidthOutput,
 *       KYUJITAI_TO_SHINJITAI,
 *   } from 'kusanaji/text'
 */

// Segmentation (JP vs foreign)
export { hasJapanese, segmentMixed } from './segment-mixed.js'

// Fallback lookups over JMdict/JMnedict
export {
    applyKanjiFallback,
    initKanjiFallback,
    isFallbackReady,
    loadFallbackFromBinary,
    loadFallbackFromCsv,
} from './kanji-fallback.js'

// Unknown-token re-tokenization
export { resolveUnknownTokens } from './unknown-fallback.js'

// JP punctuation → ASCII (romaji post-pass)
export { JP_PUNCT_TO_ASCII, normalizeJpPunctuation } from './jp-punctuation.js'

// Kana-script helpers (hiragana↔katakana shift, classification)
export { hasKana, katakanaToHiragana, normalizeReading } from './kana-script.js'

// Width conversion — the full bidirectional module + its data tables
export { toFullWidthOutput } from './full-width-output.js'
export {
    detectWidth,
    fullToHalfWidth,
    getWidthStats,
    halfToFullWidth,
} from './width-convert.js'
export {
    ASCII_OFFSET,
    FULLWIDTH_ASCII_END, FULLWIDTH_ASCII_START,
    FULLWIDTH_COMBINING_MARKS_TO_HALFWIDTH,
    FULLWIDTH_KATAKANA_END, FULLWIDTH_KATAKANA_START,
    FULLWIDTH_SPACE,
    FULLWIDTH_TO_HALFWIDTH_EXTRA,
    FULLWIDTH_TO_HALFWIDTH_KATAKANA,
    FULLWIDTH_VOICED_TO_HALFWIDTH,
    HALFWIDTH_ASCII_END, HALFWIDTH_ASCII_START,
    HALFWIDTH_KATAKANA_END, HALFWIDTH_KATAKANA_START,
    HALFWIDTH_SPACE,
    HALFWIDTH_TO_FULLWIDTH_EXTRA,
    HALFWIDTH_TO_FULLWIDTH_KATAKANA,
    HALFWIDTH_TO_FULLWIDTH_VOICED,
    HW_BASE_DAKUTEN_TO_FW,
    HW_BASE_HANDAKUTEN_TO_FW,
    isFullWidthAscii, isFullWidthKatakana,
    isHalfWidthAscii, isHalfWidthKatakana,
} from './width-tables.js'

// Kyūjitai→shinjitai mapping + the input normalizer. Lives in prepasses/
// internally but is semantically a text-layer transform — re-exported here
// so downstream validators don't reach into prepasses/ paths.
export { KYUJITAI_TO_SHINJITAI, normalizeInput } from '../prepasses/normalize-input.js'

// Digit-run → kana text transform. Companion to the token-level
// `readDigitTokenAsKana` (used inside the emit chain); this one is for
// ASCII-only "foreign" segments that `segmentMixed` passes through
// without tokenization — e.g. product codes like `530-6k`.
export { digitsToKanaInText } from '../counter-table.js'
