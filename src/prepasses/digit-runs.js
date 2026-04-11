/**
 * Digit-run protection.
 *
 * NEologd contains compound entries like "42件" → ヨンジュウニケン and
 * "86万人" → ハチジュウロクマンニン. When the tokenizer sees "442件" it
 * matches "42件" as a longer compound and leaves "4" as an orphan token,
 * which then gets the standalone numeral reading. Romanization emits the
 * result as `4 yonjuuniken` and kana as `4よんじゅうにけん` — the leading
 * digit is preserved but the trailing 42 has been "spelled out" in
 * Japanese.
 *
 * The fix: before tokenization, replace every contiguous digit run with a
 * short alphabetical placeholder ("Xa", "Xb", ...). Kusamoji treats these
 * as opaque unknown nouns and leaves them alone. Both kusanaji's romaji
 * and kana converters pass them through verbatim. After conversion we
 * substitute the original digits back. The end result is that ASCII digit
 * runs survive the round-trip exactly as the user typed them, regardless
 * of how NEologd's compound entries would have munged them.
 *
 * IMPORTANT: this MUST run AFTER any digit-aware preprocessing (e.g. the
 * counter rewriter that turns 3月 → 3ガツ) so the original digits can still
 * be matched against literal regexes before being protected.
 */

/**
 * Replace every contiguous run of ASCII digits in `text` with a unique
 * alphabetical placeholder. Returns the placeholder text and an ordered
 * array of the original digit runs.
 *
 * Placeholder shape: `XX<letter>XX` (two leading X, one or two index
 * letters, two trailing X). The double-X delimiters serve two purposes:
 *
 *   1. They make the placeholder unambiguous against any following text.
 *      A previous version used bare `X<letter>` and the regex matched
 *      `Xdt` (where `t` was the start of the next romanized word) as a
 *      two-letter placeholder, breaking restoration. The double-X form
 *      can only ever match an actual placeholder.
 *
 *   2. Kusamoji + NEologd treats the whole `XX*XX` blob as a single
 *      unknown-word token (verified empirically — see commit history),
 *      so the placeholder doesn't get sub-tokenized into letters.
 *
 * The single-letter index range supports 26 digit runs per request, which
 * is far above anything realistic in news text. Two-letter indices extend
 * to 26 + 26*26 = 702. The hard cap is 702.
 *
 * @param {string} text
 * @returns {{ placeholderized: string, runs: string[] }}
 */
export function preprocessDigits(text) {
    const runs = []
    const placeholderized = text.replace(/\d+/g, (match) => {
        const idx = runs.length
        runs.push(match)
        const lo = String.fromCharCode(0x61 + (idx % 26))
        const hi = idx >= 26 ? String.fromCharCode(0x61 + Math.floor(idx / 26) - 1) : ''
        return `XX${hi}${lo}XX`
    })
    return { placeholderized, runs }
}

/**
 * Inverse of preprocessDigits. Walks the converted text looking for the
 * placeholders and substitutes back the original digit strings.
 *
 * Tolerates whitespace inserted between any pair of placeholder characters
 * by kusanaji's spaced mode (e.g. "X X a X X" → "XXaXX"). Unrecognized
 * placeholders are left alone.
 *
 * @param {string} text
 * @param {string[]} runs
 */
export function restoreDigits(text, runs) {
    if (!runs || runs.length === 0) return text
    return text.replace(/X\s?X\s?([a-z])\s?([a-z])?\s?X\s?X/g, (match, c1, c2) => {
        // Heuristic: if c2 exists, it must form a valid 2-letter index
        // (idx >= 26). If the resulting idx is out of range, treat the
        // match as a 1-letter placeholder followed by a stray letter that
        // happens to look like part of the placeholder. With the double-X
        // delimiters this should not happen in practice, but the guard is
        // defensive.
        if (c2) {
            const idx2 = (c1.charCodeAt(0) - 0x61 + 1) * 26 + (c2.charCodeAt(0) - 0x61)
            if (runs[idx2] !== undefined) return runs[idx2]
        }
        const idx1 = c1.charCodeAt(0) - 0x61
        return runs[idx1] !== undefined ? runs[idx1] : match
    })
}
