/**
 * Romaji emitter dispatcher.
 *
 * Two-arm switch: Modified Hepburn → kusanaji path, everything else →
 * the custom kusamoji table-loop path. Both arms own their own
 * post-processing (digit restoration, punctuation normalization, custom
 * separators) so this dispatcher does NOT have a cross-system tail.
 *
 * Why no shared tail: the original `romaji.js` had subtly different
 * post-processing in each branch (the MH branch called joinDigitRuns and
 * the decimal-point fix; the table-loop branch did not). Pulling them
 * into a shared tail would change the table-loop output and break the
 * bit-identical baseline. Each branch stays self-contained.
 */

import { emitMhKusanaji } from './mh-kusanaji.js'
import { emitTableLoop } from './table-loop.js'

/**
 * @param {string} preprocessed - text post-runPrePasses
 * @param {string[]} digitRuns - from runPrePasses
 * @param {object} deps - { kusanaji, tokenizer, romanize } — all required
 *   for the table-loop path; only `kusanaji` for the MH path. Both
 *   paths see the same `deps` object for consistency.
 * @param {object} opts - { system, separator, customSeparator, useMacrons, keepUnconvertedKanji }
 * @returns {Promise<string>}
 */
export async function emitRomaji(preprocessed, digitRuns, deps, opts) {
    if (opts.system === 'modified-hepburn') {
        return emitMhKusanaji(preprocessed, digitRuns, deps, opts)
    }
    return emitTableLoop(preprocessed, digitRuns, deps, opts)
}
