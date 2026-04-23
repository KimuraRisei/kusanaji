/**
 * Kana emitter — Kanji → Hiragana/Katakana via kusanaji.
 *
 * Thin wrapper around the injected kusanaji instance. The 4 modes
 * (normal, spaced, okurigana, furigana) are all handled by kusanaji
 * itself.
 *
 * The kusanaji instance is injected by the consumer.
 */

/**
 * @param {string} preprocessed - text post-runPrePasses
 * @param {string[]} digitRuns - from runPrePasses (unused, kept for interface compatibility)
 * @param {{ kusanaji: { convert: Function } }} deps
 * @param {{ to: 'hiragana' | 'katakana', mode: 'normal' | 'spaced' | 'okurigana' | 'furigana', preserveDigitsInCounters?: boolean }} opts
 * @returns {Promise<string>}
 */
export async function emitKana(preprocessed, digitRuns, deps, opts) {
    const { kusanaji } = deps
    const { to, mode, preserveDigitsInCounters } = opts
    return await kusanaji.convert(preprocessed, { to, mode, preserveDigitsInCounters })
}
