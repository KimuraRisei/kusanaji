/**
 * Romaji system configuration tables.
 *
 * The 4 non-Modified-Hepburn systems (traditional-hepburn, nihon-shiki,
 * kunrei-shiki, wapuro) are emitted by the table-loop emitter via the
 * `japanese` package's `romanize` function. Each system maps to a preset
 * name (or in wapuro's case, a custom config object).
 *
 * Modified Hepburn is delegated to kusanaji and does NOT use this file.
 */

export const JAPANESE_PRESET_BY_SYSTEM = {
    'modified-hepburn': 'modified hepburn',
    'traditional-hepburn': 'traditional hepburn',
    'kunrei-shiki': 'kunrei',
    'nihon-shiki': 'nihon',
}

// Wāpuro: IME-style romanization. Long vowels stay as written (ou/oo/aa),
// を stays "wo", ぢ/づ stay distinct as di/du.
export const WAPURO_CONFIG = {
    し: 'shi',
    ち: 'chi',
    つ: 'tsu',
    ふ: 'fu',
    じ: 'ji',
    ぢ: 'di',
    づ: 'du',
    ああ: 'aa',
    いい: 'ii',
    うう: 'uu',
    ええ: 'ee',
    おお: 'oo',
    'あー': 'aa',
    えい: 'ei',
    おう: 'ou',
    んあ: "n'a",
    んい: "n'i",
    んう: "n'u",
    んえ: "n'e",
    んお: "n'o",
    っち: 'cchi',
    っつ: 'ttsu',
    ゐ: 'wi',
    ゑ: 'we',
    を: 'wo',
}

/**
 * Reverse the macron pass — used when the caller passes useMacrons=false
 * but kusanaji produced macrons anyway. Expands ā/ī/ū/ē/ō back to vowel
 * pairs.
 */
export function stripMacrons(text) {
    return text
        .replace(/ā/g, 'aa')
        .replace(/ī/g, 'ii')
        .replace(/ū/g, 'uu')
        .replace(/ē/g, 'ee')
        .replace(/ō/g, 'ou')
}
