/**
 * Post-tokenization fallback for UNKNOWN tokens.
 *
 * After the Viterbi tokenizer runs, any UNKNOWN tokens represent spans
 * the tokenizer couldn't segment. This module provides a fallback that:
 *
 *   1. Re-tokenizes the UNKNOWN span in smaller windows (halving each time)
 *   2. If that still produces UNKNOWN, falls back to character-by-character
 *      dictionary lookup via getFeatures()
 *   3. As a last resort, passes the surface through unchanged (the romaji
 *      pipeline will emit it as-is)
 *
 * This dramatically reduces kanji leakage in romaji/kana output because
 * most UNKNOWN spans contain known words that just failed in the larger
 * Viterbi context.
 */

/**
 * Re-tokenize UNKNOWN tokens by splitting them into smaller chunks.
 *
 * @param {Array} tokens - kusamoji token array from tokenizer.tokenize()
 * @param {{ tokenize: Function }} tokenizer - the kusamoji tokenizer instance
 * @returns {Array} - new token array with UNKNOWN tokens replaced by re-tokenized results
 */
export function resolveUnknownTokens(tokens, tokenizer) {
    const result = []

    for (const token of tokens) {
        if (token.word_type !== 'UNKNOWN') {
            result.push(token)
            continue
        }

        const surface = token.surface_form
        if (!surface || surface.length <= 1) {
            result.push(token)
            continue
        }

        // Strategy 1: split UNKNOWN surface in half and re-tokenize each half
        const resolved = retokenizeSpan(surface, tokenizer)
        if (resolved.length > 0) {
            result.push(...resolved)
        } else {
            // Strategy 2: character-by-character — each char as its own token
            for (const ch of surface) {
                const charTokens = tokenizer.tokenize(ch)
                if (charTokens.length > 0) {
                    result.push(...charTokens)
                } else {
                    // Last resort: emit as-is
                    result.push({
                        surface_form: ch,
                        pos: '名詞',
                        pos_detail_1: '一般',
                        reading: undefined,
                        pronunciation: undefined,
                        word_type: 'FALLBACK',
                    })
                }
            }
        }
    }

    return result
}

/**
 * Try to re-tokenize a span by splitting it into progressively smaller pieces.
 * Returns an array of tokens (may still contain some UNKNOWN, but fewer).
 */
function retokenizeSpan(surface, tokenizer) {
    // Try the full span first with the tokenizer
    const tokens = tokenizer.tokenize(surface)
    const hasUnk = tokens.some(t => t.word_type === 'UNKNOWN')

    if (!hasUnk) return tokens

    // Split in half and try each half
    const chars = [...surface]
    if (chars.length <= 2) return [] // too short to split further

    const mid = Math.ceil(chars.length / 2)
    const left = chars.slice(0, mid).join('')
    const right = chars.slice(mid).join('')

    const leftTokens = tokenizer.tokenize(left)
    const rightTokens = tokenizer.tokenize(right)

    const leftHasUnk = leftTokens.some(t => t.word_type === 'UNKNOWN')
    const rightHasUnk = rightTokens.some(t => t.word_type === 'UNKNOWN')

    // If both halves resolved, great
    if (!leftHasUnk && !rightHasUnk) {
        return [...leftTokens, ...rightTokens]
    }

    // If one half resolved, recurse on the other
    const result = []

    if (!leftHasUnk) {
        result.push(...leftTokens)
    } else {
        // Recurse with smaller window
        for (const t of leftTokens) {
            if (t.word_type === 'UNKNOWN' && t.surface_form.length > 1) {
                const sub = retokenizeSpan(t.surface_form, tokenizer)
                if (sub.length > 0) result.push(...sub)
                else result.push(t)
            } else {
                result.push(t)
            }
        }
    }

    if (!rightHasUnk) {
        result.push(...rightTokens)
    } else {
        for (const t of rightTokens) {
            if (t.word_type === 'UNKNOWN' && t.surface_form.length > 1) {
                const sub = retokenizeSpan(t.surface_form, tokenizer)
                if (sub.length > 0) result.push(...sub)
                else result.push(t)
            } else {
                result.push(t)
            }
        }
    }

    return result
}
