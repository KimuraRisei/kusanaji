/**
 * Segment mixed-language text into Japanese vs non-Japanese runs,
 * then micro-split Japanese runs so the Viterbi tokenizer never sees
 * chunks longer than ~15 characters.
 *
 * The kusamoji Viterbi makes wrong segmentation choices on long inputs
 * due to short-fragment entries (テス, アメ, イン) in NEologd competing
 * with longer correct matches. The fix: split aggressively before
 * tokenization so each chunk is short enough for the Viterbi to handle.
 */

// Japanese character ranges
const JP_CHAR = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF65-\uFF9F]/

function isJpChar(ch) {
    const code = ch.codePointAt(0)
    return (
        (code >= 0x3000 && code <= 0x303F) || // CJK symbols & punctuation
        (code >= 0x3040 && code <= 0x309F) || // Hiragana
        (code >= 0x30A0 && code <= 0x30FF) || // Katakana
        (code >= 0x3400 && code <= 0x4DBF) || // CJK ext A
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK unified
        (code >= 0xF900 && code <= 0xFAFF) || // CJK compat
        (code >= 0xFF01 && code <= 0xFF60) || // Fullwidth ASCII
        (code >= 0xFF65 && code <= 0xFF9F) || // Halfwidth katakana
        (code >= 0x1B000 && code <= 0x1B16F)  // Kana supplement / extended
    )
}

/**
 * Split text into alternating Japanese / non-Japanese segments,
 * then micro-split Japanese segments on every natural boundary.
 *
 * @param {string} text
 * @returns {Array<{type: 'japanese' | 'foreign', text: string}>}
 */
export function segmentMixed(text) {
    if (!text) return []

    // ── Pass 1: split on language boundaries ────────────────────────
    const raw = []
    let currentType = null
    let currentText = ''

    for (const ch of text) {
        // Whitespace and ASCII punctuation: attach to current segment
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' ||
            ch === '.' || ch === ',' || ch === '!' || ch === '?' ||
            ch === ';' || ch === ':' || ch === '-' || ch === '—' ||
            ch === '(' || ch === ')' || ch === '[' || ch === ']' ||
            ch === '"' || ch === "'" || ch === '…' || ch === '　' ||
            ch === '/' || ch === '\\' || ch === '#' || ch === '@' ||
            ch === '&' || ch === '+' || ch === '=' || ch === '*') {
            currentText += ch
            continue
        }

        const jp = isJpChar(ch)
        const type = jp ? 'japanese' : 'foreign'

        if (currentType === null) {
            currentType = type
            currentText = ch
        } else if (type === currentType) {
            currentText += ch
        } else {
            if (currentText) raw.push({ type: currentType, text: currentText })
            currentType = type
            currentText = ch
        }
    }
    if (currentText) raw.push({ type: currentType || 'foreign', text: currentText })

    // ── Pass 2: move leading particles from JP segments to preceding foreign ─
    const LEADING_PARTICLES = /^([のはをがでともにへやか、。]+)/
    for (let i = 1; i < raw.length; i++) {
        if (raw[i].type !== 'japanese' || raw[i - 1].type !== 'foreign') continue
        const m = raw[i].text.match(LEADING_PARTICLES)
        if (m) {
            raw[i - 1].text += m[1]
            raw[i].text = raw[i].text.slice(m[1].length)
            if (!raw[i].text) { raw.splice(i, 1); i-- }
        }
    }

    // ── Pass 3: micro-split Japanese segments ───────────────────────
    // Split on EVERY natural boundary so the Viterbi never sees >15 chars:
    //   - Sentence punctuation: 。！？
    //   - Clause punctuation: 、
    //   - Brackets: 「」『』【】（）〈〉《》〔〕
    //   - Quotation marks in the text
    //   - After common particles when the segment is still long
    const JP_PUNCT_SPLIT = /(?<=[。、！？\n「」『』【】（）〈〉《》〔〕｛｝])/g

    const result = []
    for (const seg of raw) {
        if (seg.type !== 'japanese') {
            result.push(seg)
            continue
        }

        // First split on JP punctuation/brackets
        const parts = seg.text.split(JP_PUNCT_SPLIT).filter(Boolean)

        for (const part of parts) {
            // If still >15 chars, further split on common particles
            if ([...part].length > 15) {
                const subParts = part.split(/(?<=[をのがはでにともへや])/g).filter(Boolean)
                for (const sp of subParts) {
                    result.push({ type: 'japanese', text: sp })
                }
            } else {
                result.push({ type: 'japanese', text: part })
            }
        }
    }

    return result
}

/**
 * Check if text contains any Japanese characters.
 * @param {string} text
 * @returns {boolean}
 */
export function hasJapanese(text) {
    return JP_CHAR.test(text)
}
