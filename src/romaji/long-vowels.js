/**
 * Long-vowel macron handling for romaji.
 */

/**
 * Modified Hepburn macron collapse for `oo` → `ō`. Kusanaji applies this
 * inconsistently — it works for some compounds (ōya from 大谷) but misses
 * others (ootani from 大谷翔平 in NEologd). Since kusanaji's `spaced` mode
 * inserts word boundaries between morphemes, any `oo` substring left in
 * the output is necessarily intra-morpheme and safe to collapse to ō.
 *
 * We do NOT collapse `ou` here — kusanaji already handles ou→ō reliably,
 * and adding a second pass risks turning legitimate "ou" sequences (e.g.
 * the verb 思う = omou) into "omō". Only `oo` is added defensively.
 */
export function collapseLongVowels(text) {
    return text.replace(/oo/g, 'ō')
}

/**
 * Apply Hepburn-style macron collapse to a single chunk. Used by the
 * traditional-hepburn branch of the table-loop emitter, but ONLY on
 * tokens whose surface is pure kanji — verb stems with hiragana okurigana
 * (思う/食う/言う) must NOT have their `ou`/`uu` collapsed.
 *
 * @param {string} chunk
 * @returns {string}
 */
export function applyMacrons(chunk) {
    return chunk
        .replace(/aa/g, 'ā')
        .replace(/ii/g, 'ī')
        .replace(/uu/g, 'ū')
        .replace(/ee/g, 'ē')
        .replace(/oo/g, 'ō')
        .replace(/ou/g, 'ō')
}
