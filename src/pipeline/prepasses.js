/**
 * Pre-pass sequence — intentionally minimal.
 *
 * The NEologd dictionary handles most counter readings natively:
 *   4月→シガツ, 1本→イッポン, 100人→ヒャクニン, 24時間→ニジュウヨジカン,
 *   100均→ヒャッキン, 365日→サンビャクロクジュウゴニチ, etc.
 *
 * Counter-handling lives AT THE TOKEN LEVEL in `counter-table.js` plus the
 * per-token override in `core.js`, NOT as a text-level prepass.
 *
 * Only `applyReadingOverrides` remains here for the rare case where the
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
