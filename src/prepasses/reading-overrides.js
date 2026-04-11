/**
 * Manual reading overrides for kanji compounds where NEologd picks a wrong
 * or rare reading.
 *
 * This is a small, hand-curated list — NOT a substitute for the dictionary.
 * Only add entries here when:
 *   1. The compound has ONE canonical reading (no context-dependent
 *      alternatives that would make a static override wrong elsewhere).
 *   2. NEologd's current pick is provably wrong (e.g. archaic, regional,
 *      or a dictionary curation accident).
 *   3. The compound is common enough that fixing it materially improves
 *      output quality on real text.
 *
 * Do NOT add proper nouns of specific living people / current events here —
 * the maintenance burden grows forever and the override quickly drifts
 * stale. NEologd is the right place for those, even when it's wrong.
 *
 * The substitution runs BEFORE tokenization, replacing each kanji match
 * with its katakana reading. Katakana (not hiragana) so kusamoji groups it
 * as a single unknown-noun token instead of mora-splitting it.
 *
 * Used by both /v1/romaji and /v1/kana so the two converters stay in sync.
 */

import { katakanaToHiragana } from '../text/kana-script.js'

const OVERRIDES_KATAKANA = {
    // 行方不明 ("yukue fumei", missing/whereabouts unknown). NEologd picks
    // the rare reading "ゆくえしれず → omokatashirezu" which only appears in
    // archaic literary contexts. The standard news/spoken reading is
    // ゆくえふめい. Triggered repeatedly in the NHK 50-snippet benchmark.
    行方不明: 'ユクエフメイ',
}

// Hiragana mirror, built mechanically from the katakana table so the two
// cannot drift — adding to one automatically updates the other.
const OVERRIDES_HIRAGANA = Object.fromEntries(
    Object.entries(OVERRIDES_KATAKANA).map(([kanji, kata]) => [
        kanji,
        katakanaToHiragana(kata),
    ])
)

const OVERRIDE_RE = new RegExp(
    Object.keys(OVERRIDES_KATAKANA)
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
    'g'
)

/**
 * @param {string} text
 * @param {{ targetScript?: 'katakana' | 'hiragana' }} [opts]
 *   Defaults to 'katakana' (romaji pipeline). Pass 'hiragana' for the
 *   kana pipeline so the override readings stay in the requested script.
 */
export function applyReadingOverrides(text, opts = {}) {
    if (Object.keys(OVERRIDES_KATAKANA).length === 0) return text
    const table = opts.targetScript === 'hiragana' ? OVERRIDES_HIRAGANA : OVERRIDES_KATAKANA
    return text.replace(OVERRIDE_RE, (match) => table[match] || match)
}
