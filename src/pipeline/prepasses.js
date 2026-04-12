/**
 * Pre-pass sequence — intentionally minimal.
 *
 * The NEologd dictionary handles all counter readings natively:
 *   4月→シガツ, 1本→イッポン, 100人→ヒャクニン, 24時間→ニジュウヨジカン,
 *   100均→ヒャッキン, 365日→サンビャクロクジュウゴニチ, etc.
 *
 * Counter prepasses and digit placeholders were REMOVED because they
 * degrade tokenization — injecting katakana that the Viterbi re-segments
 * incorrectly, and digit placeholders (XXaXX) that destroy compound
 * lookups like 100均 and 24時間.
 *
 * Only applyReadingOverrides remains for the rare case where the
 * dictionary picks an archaic reading (currently: 行方不明→ユクエフメイ).
 */

import { applyReadingOverrides } from '../prepasses/reading-overrides.js'

/**
 * @param {string} text
 * @param {{ targetScript: 'katakana' | 'hiragana' }} opts
 * @returns {{ preprocessed: string, digitRuns: string[] }}
 */
export function runPrePasses(text, { targetScript }) {
    if (!text || typeof text !== 'string') return { preprocessed: '', digitRuns: [] }
    const a = applyReadingOverrides(text, { targetScript })
    return { preprocessed: a, digitRuns: [] }
}
