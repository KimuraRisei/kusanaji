/**
 * Token-level predicates used by the table-loop emitter.
 */

/**
 * True iff this kusamoji token represents a "real word" (not punctuation
 * or symbol). The custom romaji loop must skip non-word tokens entirely
 * and emit their surface form directly via the punctuation normalizer —
 * see CLAUDE.md "Output invariant for /v1/romaji" for the kaomoji-leak
 * backstory.
 *
 * @param {object} token kusamoji token with surface_form and pos
 * @returns {boolean}
 */
export function isWordToken(token) {
    const s = token.surface_form
    if (s.trim().length === 0) return false
    if (token.pos === '記号') return false
    if (/^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~。、・「」『』（）【】〈〉《》〔〕｛｝［］〜ー―…‥！？　]+$/.test(s)) return false
    return true
}
