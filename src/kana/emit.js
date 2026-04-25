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
 * @param {{ to: 'hiragana' | 'katakana', mode: 'normal' | 'spaced' | 'okurigana' | 'furigana', preserveDigitsInCounters?: boolean, keepOriginalKatakana?: boolean }} opts
 * @returns {Promise<string>}
 */
export async function emitKana(preprocessed, digitRuns, deps, opts) {
    const { kusanaji } = deps
    const { to, mode, preserveDigitsInCounters, keepOriginalKatakana } = opts
    return await kusanaji.convert(preprocessed, {
        to,
        mode,
        preserveDigitsInCounters,
        // Forwarded to kusanaji's output post-pass. When false, the hiragana
        // target rewrites any input katakana spans to hiragana so the final
        // output is uniformly the target script. The katakana target always
        // applies its own toRawKatakana post-pass regardless of this flag.
        keepOriginalKatakana,
    })
}
