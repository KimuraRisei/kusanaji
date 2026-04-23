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
 * Symbols without an obvious ASCII analogue (ー macron-role is handled in
 * the romaji long-vowel pass; 々 iteration mark preserved as-is; 〒 postal,
 * ◯, ☆, →/←/↑/↓ arrows, ♪ have no clean ASCII equivalent) stay as-is.
 *
 * History: ChatGPT caught a leak of 5,504 CJK punctuation chars per
 * snippet in the non-Hepburn romaji systems before this normalizer was
 * added — see CLAUDE.md "Output invariant for /v1/romaji".
 *
 * NOTE on redundancy: Fullwidth ASCII (U+FF01–FF5E) is also handled by
 * `normalize-input.js` at segmentation time, so entries like '－' / '／' /
 * '～' won't typically reach this post-pass. They remain here as a
 * defensive safety net for any call path that skips segmentMixed.
 */

export const JP_PUNCT_TO_ASCII = {
    // ── CJK punctuation (U+3000 block) ──
    '、': ',', // U+3001 ideographic comma
    '。': '.', // U+3002 ideographic full stop
    '〃': '"', // U+3003 ditto mark
    '〆': ',', // U+3006 ideographic closing mark — rare but attested
    '「': '"', // U+300C left corner bracket
    '」': '"', // U+300D right corner bracket
    '『': '"', // U+300E left white corner bracket
    '』': '"', // U+300F right white corner bracket
    '【': '[', // U+3010 left black lenticular bracket
    '】': ']', // U+3011 right black lenticular bracket
    '〔': '[', // U+3014 left tortoise shell bracket
    '〕': ']', // U+3015 right tortoise shell bracket
    '〖': '[', // U+3016 left white lenticular bracket
    '〗': ']', // U+3017 right white lenticular bracket
    '〘': '[', // U+3018 left white tortoise shell bracket
    '〙': ']', // U+3019 right white tortoise shell bracket
    '〚': '[', // U+301A left white square bracket
    '〛': ']', // U+301B right white square bracket
    '〈': '<', // U+3008
    '〉': '>', // U+3009
    '《': '<', // U+300A
    '》': '>', // U+300B
    '〜': '~', // U+301C wave dash
    '〝': '"', // U+301D reversed double prime quotation mark
    '〞': '"', // U+301E double prime quotation mark
    '〟': '"', // U+301F low double prime quotation mark
    '　': ' ', // U+3000 ideographic space
    // U+3007 ideographic number zero. Used as a DIGIT in Japanese dates
    // and numerals (e.g. 令和〇年 = "Reiwa year 0"), NOT as the letter 'o'.
    // Previously mapped to 'o' which was semantically wrong — a romaji
    // reader would mis-parse "Reiwa year o" as text, not "year 0".
    '〇': '0',

    // ── Fullwidth ASCII (U+FF00 block) — defensive; normalize-input.js also handles ──
    '！': '!', // U+FF01
    '＂': '"', // U+FF02 fullwidth quotation mark
    '＃': '#', // U+FF03 fullwidth number sign
    '＄': '$', // U+FF04 fullwidth dollar sign
    '％': '%', // U+FF05 fullwidth percent sign
    '＆': '&', // U+FF06 fullwidth ampersand
    '＇': "'", // U+FF07 fullwidth apostrophe
    '（': '(', // U+FF08 fullwidth left paren
    '）': ')', // U+FF09 fullwidth right paren
    '＊': '*', // U+FF0A fullwidth asterisk
    '＋': '+', // U+FF0B fullwidth plus
    '，': ',', // U+FF0C fullwidth comma
    '－': '-', // U+FF0D fullwidth hyphen-minus
    '．': '.', // U+FF0E fullwidth full stop
    '／': '/', // U+FF0F fullwidth solidus
    '：': ':', // U+FF1A fullwidth colon
    '；': ';', // U+FF1B fullwidth semicolon
    '＜': '<', // U+FF1C fullwidth less-than
    '＝': '=', // U+FF1D fullwidth equals
    '＞': '>', // U+FF1E fullwidth greater-than
    '？': '?', // U+FF1F fullwidth question mark
    '＠': '@', // U+FF20 fullwidth at sign
    '［': '[', // U+FF3B fullwidth left bracket
    '＼': '\\', // U+FF3C fullwidth backslash
    '］': ']', // U+FF3D fullwidth right bracket
    '＾': '^', // U+FF3E fullwidth caret
    '＿': '_', // U+FF3F fullwidth underscore
    '｀': '`', // U+FF40 fullwidth grave accent
    '｛': '{', // U+FF5B fullwidth left brace
    '｜': '|', // U+FF5C fullwidth vertical bar
    '｝': '}', // U+FF5D fullwidth right brace
    '～': '~', // U+FF5E fullwidth tilde

    // ── Halfwidth Japanese punctuation (U+FF60 block) ──
    '｡': '.', // U+FF61 halfwidth ideographic full stop
    '｢': '"', // U+FF62 halfwidth left corner bracket
    '｣': '"', // U+FF63 halfwidth right corner bracket
    '､': ',', // U+FF64 halfwidth ideographic comma
    '･': '/', // U+FF65 halfwidth katakana middle dot — kusanaji emits
    //         this for full-width ・ (U+30FB). It's a separator in
    //         compound names; collapse to "/" which is the closest
    //         ASCII semantic.
    '・': '/', // U+30FB katakana middle dot (raw form before kusanaji)

    // ── General Punctuation (U+2000 block) — common in editorial text ──
    '‐': '-', // U+2010 hyphen
    '‑': '-', // U+2011 non-breaking hyphen
    '‒': '-', // U+2012 figure dash
    '–': '-', // U+2013 en-dash
    '—': '-', // U+2014 em-dash
    '―': '-', // U+2015 horizontal bar
    '‖': '|', // U+2016 double vertical line
    '‘': "'", // U+2018 left single quotation mark
    '’': "'", // U+2019 right single quotation mark (also apostrophe)
    '‚': ',', // U+201A single low-9 quotation mark
    '“': '"', // U+201C left double quotation mark
    '”': '"', // U+201D right double quotation mark
    '„': '"', // U+201E double low-9 quotation mark
    '†': '*', // U+2020 dagger — footnote marker
    '‡': '*', // U+2021 double dagger
    '•': '*', // U+2022 bullet
    '‥': '..', // U+2025 two-dot leader
    '…': '...', // U+2026 horizontal ellipsis → three ASCII dots
    '‰': '%', // U+2030 per mille sign (closest ASCII is percent)
    '′': "'", // U+2032 prime
    '″': '"', // U+2033 double prime
    '※': '*', // U+203B reference mark — common in Japanese footnotes (※注意)

    // ── Katakana prolonged sound fallback ──
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
