/**
 * Custom romaji emitter for the 4 non-Modified-Hepburn systems
 * (traditional-hepburn, nihon-shiki, kunrei-shiki, wapuro).
 *
 * Walks the kusamoji token stream directly:
 *   1. Skip non-word tokens (punctuation/symbols), emit normalized ASCII
 *      punctuation directly (kaomoji-leak defense).
 *   2. For word tokens, take the kusamoji `reading` field (katakana),
 *      shift to hiragana, and run it through japanese.romanize() with
 *      the system's preset (or the WAPURO_CONFIG for wapuro).
 *   3. Override は/へ/を particles to wa/e/o.
 *   4. For traditional-hepburn on pure-kanji tokens, apply Hepburn macron
 *      collapse.
 *   5. Insert separators between word tokens.
 *
 * Kusanaji only ships Modified Hepburn — that's why this exists.
 *
 * The kusamoji tokenizer instance and the `romanize` function are both
 * injected by the consumer. This module does NOT import them.
 */

import { isWordToken } from './token-helpers.js'
import { particleOverride } from './particle-override.js'
import { applyMacrons } from './long-vowels.js'
import { joinVerbForms } from './join-verb-forms.js'
import { JAPANESE_PRESET_BY_SYSTEM, WAPURO_CONFIG } from './systems.js'
import { katakanaToHiragana, hasKana, normalizeReading } from '../text/kana-script.js'
import { isPureKanjiSurface, removeKanji } from '../text/kanji-script.js'
import { normalizeJpPunctuation } from '../text/jp-punctuation.js'
import { resolveUnknownTokens } from '../text/unknown-fallback.js'

/**
 * @param {string} preprocessed - text post-runPrePasses
 * @param {string[]} digitRuns - from runPrePasses
 * @param {{ tokenizer: { tokenize: Function }, romanize: Function }} deps
 * @param {{ system: string, separator: 'none'|'space'|'custom', customSeparator: string, useMacrons: boolean, keepUnconvertedKanji: boolean }} opts
 * @returns {string}
 */
export function emitTableLoop(preprocessed, digitRuns, deps, opts) {
    const { tokenizer, romanize } = deps
    const { system, separator, customSeparator, useMacrons, keepUnconvertedKanji } = opts
    const sepChar = separator === 'space' ? ' ' : separator === 'custom' ? customSeparator : ''

    const rawTokens = tokenizer.tokenize(preprocessed) || []
    // Resolve UNKNOWN tokens by re-tokenizing in smaller windows
    const tokens = resolveUnknownTokens(rawTokens, tokenizer) || []

    let out = ''
    let prevWasWord = false

    for (const token of tokens) {
        const surface = token.surface_form
        const currIsWord = isWordToken(token)

        // CRITICAL: punctuation and symbol tokens MUST emit their surface
        // form directly. NEologd assigns nonsense readings to punctuation
        // (the literal space character ` ` reads as `カオモジ` / kaomoji
        // / 顔文字, the colon `:` reads as `タイプヌル`, etc.) and the
        // custom pipeline used to romanize those readings, producing
        // gibberish like "kaomoji" sprinkled throughout the output. The
        // kusanaji path doesn't have this problem because kusanaji
        // filters punctuation tokens internally.
        //
        // ALSO: normalize Japanese-script punctuation (、 。 「 」 etc.) to
        // its ASCII equivalent. Without this, romaji output for the non-
        // kusanaji systems contains thousands of CJK punctuation chars
        // per snippet on long-form input.
        if (!currIsWord) {
            out += normalizeJpPunctuation(surface)
            prevWasWord = false
            continue
        }

        const reading = normalizeReading(token.reading ?? token.pronunciation)

        let chunk = reading ? katakanaToHiragana(reading) : surface
        if (!reading && !keepUnconvertedKanji) chunk = removeKanji(chunk)

        if (hasKana(chunk)) {
            if (system === 'wapuro') {
                chunk = romanize(chunk, WAPURO_CONFIG)
            } else {
                const preset = JAPANESE_PRESET_BY_SYSTEM[system]
                chunk = romanize(chunk, preset)
            }
        }

        const overridden = particleOverride(token)
        if (overridden !== null) chunk = overridden

        if (useMacrons && system === 'traditional-hepburn' && isPureKanjiSurface(surface)) {
            chunk = applyMacrons(chunk)
        }

        if (sepChar && out.length > 0 && prevWasWord) out += sepChar

        out += chunk
        prevWasWord = true
    }

    // Join detached verb auxiliaries (shi te → shite, mashi ta → mashita).
    // The token loop inserts spaces between morphemes, which splits inflected
    // verb forms. joinVerbForms glues them back — same pass the MH path uses.
    if (sepChar === ' ') out = joinVerbForms(out)


    return out
}
