/**
 * The 4-pre-pass sequence shared by both `toRomaji` and `toKana`.
 *
 * Order matters and is enforced here as the single source of truth:
 *
 *   1. applyReadingOverrides — manual overrides for compounds where NEologd
 *      picks a wrong reading (currently 行方不明).
 *   2. applyIrregularCounterReadings — substitute the FULL canonical reading
 *      for irregular (digit, counter) pairs (1本 → イッポン, 4月 → シガツ,
 *      1日 → ツイタチ, ...). The digit is consumed.
 *   3. rewriteCounters — handle the regular counter cases (3月 → 3ガツ,
 *      preserving the digit). Blocks on COMPOUND_BLOCKLIST so 6年生
 *      doesn't become 6ネン生.
 *   4. preprocessDigits — protect any remaining ASCII digit runs from
 *      NEologd's compound number entries by replacing them with XX<l>XX
 *      placeholders. Returns both the placeholderized text and the run
 *      list, which the caller passes to restoreDigits after conversion.
 *
 * Steps 2 and 3 are mutually exclusive per match — once step 2 fires on a
 * (digit, counter) pair, the pair is gone from the text and step 3 sees
 * nothing to do for it.
 */

import { applyReadingOverrides } from '../prepasses/reading-overrides.js'
import { applyIrregularCounterReadings } from '../prepasses/counter-readings.js'
import { rewriteCounters } from '../prepasses/counter-rewrite.js'
import { preprocessDigits } from '../prepasses/digit-runs.js'

/**
 * @param {string} text
 * @param {{ targetScript: 'katakana' | 'hiragana' }} opts
 * @returns {{ preprocessed: string, digitRuns: string[] }}
 */
export function runPrePasses(text, { targetScript }) {
    const a = applyReadingOverrides(text, { targetScript })
    const b = applyIrregularCounterReadings(a, { targetScript })
    const c = rewriteCounters(b, { targetScript })
    const { placeholderized, runs } = preprocessDigits(c)
    return { preprocessed: placeholderized, digitRuns: runs }
}
