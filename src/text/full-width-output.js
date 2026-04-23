/**
 * Full-width output post-pass — thin wrapper around `halfToFullWidth`.
 *
 * Kept as a stable re-export name because downstream (jala-dict-api/src/converters/kana.js)
 * imports `toFullWidthOutput` by name. The actual transform lives in
 * `width-convert.js` so there is a single implementation shared by the
 * yomi pipeline and the dedicated `/v2/width` endpoint.
 *
 * Intentionally narrow — this is a cosmetic output transform; do NOT
 * use it on input text (which should be half-width-normalized first by
 * normalize-input.js so the tokenizer classifies ASCII as foreign).
 */

import { halfToFullWidth } from './width-convert.js'

/**
 * Convert all half-width ASCII printable + space + half-width katakana to
 * full-width. Composes dakuten / handakuten sequences (e.g. ｶﾞ → ガ).
 *
 * @param {string} text
 * @returns {string}
 */
export function toFullWidthOutput(text) {
    if (!text) return text
    return halfToFullWidth(text).text
}
