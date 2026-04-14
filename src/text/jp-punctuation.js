/**
 * Japanese punctuation → ASCII normalization.
 *
 * Used by the romaji pipeline (NOT the kana pipeline — kana output keeps
 * Japanese punctuation as the user typed it). Without this, romaji output
 * for the non-Modified-Hepburn systems contains thousands of CJK
 * punctuation chars per snippet on long-form input, because the custom
 * pipeline emits punctuation tokens' surface forms unchanged.
 *
 * Conservative — only the punctuation that has a clear ASCII equivalent.
 * Symbols without an obvious ASCII analogue (ー, 〜, …, etc.) stay as-is.
 *
 * History: ChatGPT caught a leak of 5,504 CJK punctuation chars per
 * snippet in the non-Hepburn romaji systems before this normalizer was
 * added — see CLAUDE.md "Output invariant for /v1/romaji".
 */

export const JP_PUNCT_TO_ASCII = {
    '、': ',', // U+3001 ideographic comma
    '。': '.', // U+3002 ideographic full stop
    '「': '"', // U+300C left corner bracket
    '」': '"', // U+300D right corner bracket
    '｢': '"', // U+FF62 halfwidth left corner bracket
    '｣': '"', // U+FF63 halfwidth right corner bracket
    '『': '"', // U+300E left white corner bracket
    '』': '"', // U+300F right white corner bracket
    '【': '[', // U+3010 left black lenticular bracket
    '】': ']', // U+3011 right black lenticular bracket
    '〔': '[', // U+3014 left tortoise shell bracket
    '〕': ']', // U+3015 right tortoise shell bracket
    '〈': '<', // U+3008
    '〉': '>', // U+3009
    '《': '<', // U+300A
    '》': '>', // U+300B
    '（': '(', // U+FF08 fullwidth left paren
    '）': ')', // U+FF09 fullwidth right paren
    '［': '[', // U+FF3B fullwidth left bracket
    '］': ']', // U+FF3D fullwidth right bracket
    '｛': '{', // U+FF5B fullwidth left brace
    '｝': '}', // U+FF5D fullwidth right brace
    '！': '!', // U+FF01
    '？': '?', // U+FF1F
    '：': ':', // U+FF1A
    '；': ';', // U+FF1B
    '＝': '=', // U+FF1D fullwidth equals
    '，': ',', // U+FF0C fullwidth comma
    '．': '.', // U+FF0E fullwidth full stop
    '　': ' ', // U+3000 ideographic space
    '･': '/', // U+FF65 halfwidth katakana middle dot — kusanaji emits
    //         this for full-width ・ (U+30FB). It's a separator in
    //         compound names; collapse to "/" which is the closest
    //         ASCII semantic.
    '・': '/', // U+30FB katakana middle dot (raw form before kusanaji)
    '〜': '~', // U+301C wave dash
    '〝': '"', // U+301D reversed double prime quotation mark
    '〟': '"',
    '〇': 'o', // U+3007 ideographic number zero // U+301F low double prime quotation mark
    'ー': '-', // U+30FC katakana prolonged sound mark — fallback for edge
    //         cases where the romaji converter didn't handle it (e.g.
    //         standalone ー after a non-kana token). In proper romaji this
    //         is a macron on the preceding vowel, but when it leaks as-is
    //         the hyphen is the least-bad ASCII approximation.
}

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeJpPunctuation(s) {
    let out = ''
    for (const ch of s) {
        out += JP_PUNCT_TO_ASCII[ch] ?? ch
    }
    return out
}
