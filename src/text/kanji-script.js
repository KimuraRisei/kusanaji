/**
 * Pure-string helpers for kanji (CJK unified ideographs).
 *
 * No tokenizer, no romanizer — just Unicode-range tests over U+4E00–9FFF.
 */

/**
 * @param {string} ch single character
 * @returns {boolean}
 */
export function isKanjiChar(ch) {
    const code = ch.charCodeAt(0)
    return code >= 0x4e00 && code <= 0x9fff
}

/**
 * True iff every character in `surface` is a kanji. Empty string returns
 * false. Used by the romaji emitter to decide whether the macron pass for
 * traditional-hepburn applies (only Sino-Japanese morphemes get macrons —
 * verb stems with hiragana okurigana like 思う/食う are excluded).
 *
 * @param {string} surface
 * @returns {boolean}
 */
export function isPureKanjiSurface(surface) {
    if (!surface) return false
    for (const ch of surface) {
        if (!isKanjiChar(ch)) return false
    }
    return true
}

/**
 * Strip every kanji character from `text`. Used by the romaji "do not keep
 * unconverted kanji" branch when a token has no reading available.
 *
 * @param {string} text
 * @returns {string}
 */
export function removeKanji(text) {
    let out = ''
    for (const ch of text) {
        if (!isKanjiChar(ch)) out += ch
    }
    return out
}
