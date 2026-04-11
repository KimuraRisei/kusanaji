/**
 * Kana emitter — Kanji → Hiragana/Katakana via kusanaji.
 *
 * Thin wrapper around the injected kusanaji instance. The 4 modes
 * (normal, spaced, okurigana, furigana) are all handled by kusanaji
 * itself; this module's job is just to apply digit-run restoration after
 * the conversion.
 *
 * The kusanaji instance is injected by the consumer.
 */

import { restoreDigits } from '../prepasses/digit-runs.js'

/**
 * @param {string} preprocessed - text post-runPrePasses
 * @param {string[]} digitRuns - from runPrePasses
 * @param {{ kusanaji: { convert: Function } }} deps
 * @param {{ to: 'hiragana' | 'katakana', mode: 'normal' | 'spaced' | 'okurigana' | 'furigana' }} opts
 * @returns {Promise<string>}
 */
export async function emitKana(preprocessed, digitRuns, deps, opts) {
    const { kusanaji } = deps
    const { to, mode } = opts
    let converted = await kusanaji.convert(preprocessed, { to, mode })
    converted = restoreDigits(converted, digitRuns)
    return converted
}
