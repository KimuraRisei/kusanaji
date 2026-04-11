/**
 * Modified Hepburn romaji emitter (kusanaji path).
 *
 * Kusanaji handles MH noticeably better than the hand-rolled table-loop
 * for: rendaku-aware joining (手紙 → tegami), long-vowel detection across
 * morpheme boundaries (思う stays omou, 東京 collapses to tōkyō), and
 * proper okurigana handling. We delegate the romanization to it and only
 * apply targeted post-passes for the cases kusanaji misses.
 *
 * The kusanaji instance is injected by the consumer (dict-api or
 * jala-ui's local fallback). This module does NOT import kusanaji.
 */

import { joinVerbForms } from './join-verb-forms.js'
import { collapseLongVowels } from './long-vowels.js'
import { stripMacrons } from './systems.js'
import { normalizeJpPunctuation } from '../text/jp-punctuation.js'
import { restoreDigits } from '../prepasses/digit-runs.js'
import { joinDigitRuns, fixDecimalPointSpacing } from './digit-postpass.js'

/**
 * @param {string} preprocessed - text post-runPrePasses
 * @param {string[]} digitRuns - from runPrePasses
 * @param {{ kusanaji: { convert: Function } }} deps
 * @param {{ separator: 'none'|'space'|'custom', customSeparator: string, useMacrons: boolean }} opts
 * @returns {Promise<string>}
 */
export async function emitMhKusanaji(preprocessed, digitRuns, deps, opts) {
    const { kusanaji } = deps
    const { separator, customSeparator, useMacrons } = opts
    const sepChar = separator === 'space' ? ' ' : separator === 'custom' ? customSeparator : ''

    const mode = sepChar ? 'spaced' : 'normal'
    let raw = await kusanaji.convert(preprocessed, { to: 'romaji', mode, romajiSystem: 'hepburn' })

    // Glue spaced verb auxiliaries (mashita, shimasu, ...) and copula past
    // (datta, datte) back into single tokens. Only meaningful in spaced
    // mode where kusanaji inserted the spaces in the first place.
    if (sepChar) raw = joinVerbForms(raw)

    // Defensive macron pass — see collapseLongVowels for the rationale.
    if (useMacrons) raw = collapseLongVowels(raw)

    // Restore digit runs from placeholders. Must run before joinDigitRuns,
    // which handles the legacy "1 5" → "15" case for any single-digit
    // splits the placeholder system didn't catch.
    raw = restoreDigits(raw, digitRuns)
    raw = joinDigitRuns(raw)

    // Collapse spaces around a literal "." that sits between two digit
    // runs — that's a decimal point, not a sentence boundary.
    raw = fixDecimalPointSpacing(raw)

    if (separator === 'custom' && customSeparator !== ' ') {
        raw = raw.replace(/ +/g, customSeparator)
    }

    if (!useMacrons) raw = stripMacrons(raw)

    // Final pass: normalize any Japanese punctuation that survived
    // kusanaji (notably ･ U+FF65 which kusanaji emits for ・, plus
    // 【】 lenticular brackets that it leaves untouched).
    raw = normalizeJpPunctuation(raw)

    return raw
}
