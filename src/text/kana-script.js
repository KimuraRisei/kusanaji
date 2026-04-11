/**
 * Pure-string helpers for kana scripts (hiragana / katakana).
 *
 * No tokenizer, no romanizer, no kusanaji — just Unicode-range tests and
 * the well-known katakana ↔ hiragana shift. Imported from many places, so
 * this file MUST stay tiny and dependency-free.
 */

/**
 * Shift each char in U+30A1..U+30F6 (katakana) down by 0x60 to its hiragana
 * counterpart. Chars outside that range pass through unchanged.
 *
 * @param {string} text
 * @returns {string}
 */
export function katakanaToHiragana(text) {
    return text.replace(/[\u30A1-\u30F6]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60)
    )
}

/**
 * Does the string contain any hiragana or katakana chars?
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasKana(text) {
    return /[\u3040-\u309F\u30A0-\u30FF]/.test(text)
}

/**
 * Treat kusamoji's empty/wildcard reading sentinels as null. kusamoji uses
 * the literal '*' string for "no reading" on some token classes, and the
 * empty string after trim() means the same thing.
 *
 * @param {string|null|undefined} reading
 * @returns {string|null}
 */
export function normalizeReading(reading) {
    if (!reading) return null
    if (reading === '*' || reading.trim() === '') return null
    return reading
}
