/**
 * Bidirectional half-width ↔ full-width conversion.
 *
 * Two pure functions — `halfToFullWidth()` and `fullToHalfWidth()` — plus a
 * small `getWidthStats()` helper. All mapping data lives in `width-tables.js`,
 * so this module is the transform engine and nothing else.
 *
 * Used in three places:
 *   1. kusanaji internal pipeline
 *      - `normalize-input.js` uses `fullToHalfWidth` (ASCII + space only) to
 *        normalize input before tokenization.
 *      - `full-width-output.js` uses `halfToFullWidth` as the opt-in
 *        `outputFullWidth` post-pass on kana/yomi output.
 *   2. jala-dict-api `POST /v2/width` — direct HTTP wrapper.
 *   3. jala-ui (optional) — re-exported via kusanaji's subpath exports if
 *      the Vercel batch route wants in-process conversion on Edge.
 *
 * Zero runtime deps. Pure ESM. Edge-runtime safe.
 */

import {
    HALFWIDTH_ASCII_START, HALFWIDTH_ASCII_END,
    FULLWIDTH_ASCII_START, FULLWIDTH_ASCII_END, ASCII_OFFSET,
    HALFWIDTH_SPACE, FULLWIDTH_SPACE,
    HALFWIDTH_KATAKANA_START, HALFWIDTH_KATAKANA_END,
    FULLWIDTH_KATAKANA_START, FULLWIDTH_KATAKANA_END,
    FULLWIDTH_TO_HALFWIDTH_KATAKANA,
    HALFWIDTH_TO_FULLWIDTH_KATAKANA,
    FULLWIDTH_VOICED_TO_HALFWIDTH,
    HW_BASE_DAKUTEN_TO_FW,
    HW_BASE_HANDAKUTEN_TO_FW,
    FULLWIDTH_TO_HALFWIDTH_EXTRA,
    HALFWIDTH_TO_FULLWIDTH_EXTRA,
    FULLWIDTH_COMBINING_MARKS_TO_HALFWIDTH,
    isHalfWidthAscii, isFullWidthAscii,
    isHalfWidthKatakana, isFullWidthKatakana,
} from './width-tables.js'

/**
 * @typedef {Object} WidthConversionOptions
 * @property {boolean} [convertAscii=true]      U+0021–007E ↔ U+FF01–FF5E
 * @property {boolean} [convertKatakana=true]   HW katakana ↔ FW katakana (incl. dakuten)
 * @property {boolean} [convertSpaces=true]     U+0020 ↔ U+3000
 * @property {boolean} [handleDakuten=true]     Compose/decompose voiced/semi-voiced marks
 */

const DEFAULT_OPTS = Object.freeze({
    convertAscii: true,
    convertKatakana: true,
    convertSpaces: true,
    handleDakuten: true,
})

/**
 * Convert half-width characters to full-width.
 *
 * When `handleDakuten` is true (default), a half-width base char followed
 * immediately by ﾞ or ﾟ is composed into a single full-width voiced or
 * semi-voiced katakana (e.g. `ｶ` + `ﾞ` → `ガ`, `ﾊ` + `ﾟ` → `パ`).
 *
 * Characters outside the HW ASCII / HW katakana / space ranges pass
 * through unchanged — so kanji, hiragana, and already-full-width chars
 * are preserved.
 *
 * @param {string} text
 * @param {WidthConversionOptions} [options]
 * @returns {{ text: string, convertedCount: number, unchangedCount: number, breakdown: { ascii: number, katakana: number, spaces: number, other: number } }}
 */
export function halfToFullWidth(text, options = {}) {
    if (!text) return _empty('half', 'full')
    // `??` so an explicitly passed `undefined` doesn't override the default
    // (plain spread would: {a:true, ...{a:undefined}} → {a:undefined}).
    const opts = {
        convertAscii:   options.convertAscii   ?? DEFAULT_OPTS.convertAscii,
        convertKatakana: options.convertKatakana ?? DEFAULT_OPTS.convertKatakana,
        convertSpaces:  options.convertSpaces  ?? DEFAULT_OPTS.convertSpaces,
        handleDakuten:  options.handleDakuten  ?? DEFAULT_OPTS.handleDakuten,
    }
    let out = ''
    let converted = 0
    let unchanged = 0
    const breakdown = { ascii: 0, katakana: 0, spaces: 0, other: 0 }

    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        const code = ch.charCodeAt(0)
        const nextCh = text[i + 1]

        // Dakuten / handakuten composition — consume two chars, emit one.
        if (opts.convertKatakana && opts.handleDakuten && nextCh) {
            if (nextCh === 'ﾞ' && HW_BASE_DAKUTEN_TO_FW[ch]) {
                out += HW_BASE_DAKUTEN_TO_FW[ch]
                converted += 2
                breakdown.katakana += 2
                i++
                continue
            }
            if (nextCh === 'ﾟ' && HW_BASE_HANDAKUTEN_TO_FW[ch]) {
                out += HW_BASE_HANDAKUTEN_TO_FW[ch]
                converted += 2
                breakdown.katakana += 2
                i++
                continue
            }
        }

        if (opts.convertSpaces && code === HALFWIDTH_SPACE) {
            out += String.fromCharCode(FULLWIDTH_SPACE)
            converted++; breakdown.spaces++
            continue
        }
        if (opts.convertAscii && isHalfWidthAscii(code)) {
            out += String.fromCharCode(code + ASCII_OFFSET)
            converted++; breakdown.ascii++
            continue
        }
        if (opts.convertKatakana && isHalfWidthKatakana(code)) {
            const mapped = HALFWIDTH_TO_FULLWIDTH_KATAKANA[ch]
            if (mapped) {
                out += mapped
                converted++; breakdown.katakana++
                continue
            }
        }
        // "Extra" HW→FW pairs: Latin-1 currency/math signs (¥, ¢, £, …),
        // halfwidth-forms block (￨, ←, ↑, →, ↓, ■, ○), Math Brackets-B
        // white parens (⦅, ⦆). Outside the ASCII offset + katakana ranges
        // but still bona fide FW/HW pairs per UnicodeData.txt.
        if (opts.convertAscii && HALFWIDTH_TO_FULLWIDTH_EXTRA[ch]) {
            out += HALFWIDTH_TO_FULLWIDTH_EXTRA[ch]
            converted++; breakdown.ascii++
            continue
        }
        out += ch
        unchanged++; breakdown.other++
    }

    return {
        text: out,
        sourceWidth: 'half',
        targetWidth: 'full',
        convertedCount: converted,
        unchangedCount: unchanged,
        breakdown,
    }
}

/**
 * Convert full-width characters to half-width.
 *
 * When `handleDakuten` is true (default), a full-width voiced / semi-voiced
 * katakana is decomposed into two half-width chars (base + ﾞ or + ﾟ).
 * Otherwise, voiced katakana are left unchanged (since no single HW char
 * represents e.g. ガ).
 *
 * Characters outside the FW ASCII / FW katakana / FW space / decomposable
 * voiced ranges pass through unchanged — so kanji, hiragana, CJK
 * punctuation, and already-half-width chars are preserved.
 *
 * @param {string} text
 * @param {WidthConversionOptions} [options]
 * @returns {{ text: string, convertedCount: number, unchangedCount: number, breakdown: { ascii: number, katakana: number, spaces: number, other: number } }}
 */
export function fullToHalfWidth(text, options = {}) {
    if (!text) return _empty('full', 'half')
    // `??` so an explicitly passed `undefined` doesn't override the default
    // (plain spread would: {a:true, ...{a:undefined}} → {a:undefined}).
    const opts = {
        convertAscii:   options.convertAscii   ?? DEFAULT_OPTS.convertAscii,
        convertKatakana: options.convertKatakana ?? DEFAULT_OPTS.convertKatakana,
        convertSpaces:  options.convertSpaces  ?? DEFAULT_OPTS.convertSpaces,
        handleDakuten:  options.handleDakuten  ?? DEFAULT_OPTS.handleDakuten,
    }
    let out = ''
    let converted = 0
    let unchanged = 0
    const breakdown = { ascii: 0, katakana: 0, spaces: 0, other: 0 }

    for (const ch of text) {
        const code = ch.charCodeAt(0)

        if (opts.convertSpaces && code === FULLWIDTH_SPACE) {
            out += String.fromCharCode(HALFWIDTH_SPACE)
            converted++; breakdown.spaces++
            continue
        }
        if (opts.convertAscii && isFullWidthAscii(code)) {
            out += String.fromCharCode(code - ASCII_OFFSET)
            converted++; breakdown.ascii++
            continue
        }
        if (opts.convertKatakana && opts.handleDakuten && FULLWIDTH_VOICED_TO_HALFWIDTH[ch]) {
            out += FULLWIDTH_VOICED_TO_HALFWIDTH[ch]
            converted++; breakdown.katakana++
            continue
        }
        if (opts.convertKatakana && FULLWIDTH_TO_HALFWIDTH_KATAKANA[ch]) {
            out += FULLWIDTH_TO_HALFWIDTH_KATAKANA[ch]
            converted++; breakdown.katakana++
            continue
        }
        // "Extra" FW→HW pairs: Fullwidth Signs block (￥, ￠, ￡, …),
        // halfwidth-forms-block FW counterparts (│, ←, ↑, →, ↓, ■, ○),
        // FW white parens (｟, ｠). Outside ASCII/katakana offset ranges.
        if (opts.convertAscii && FULLWIDTH_TO_HALFWIDTH_EXTRA[ch]) {
            out += FULLWIDTH_TO_HALFWIDTH_EXTRA[ch]
            converted++; breakdown.ascii++
            continue
        }
        // NFD combining dakuten / handakuten marks — defensive: NFD-
        // normalized input contains U+3099 / U+309A rather than the
        // spacing forms U+309B / U+309C handled via FULLWIDTH_TO_HALFWIDTH_KATAKANA.
        if (opts.convertKatakana && opts.handleDakuten && FULLWIDTH_COMBINING_MARKS_TO_HALFWIDTH[ch]) {
            out += FULLWIDTH_COMBINING_MARKS_TO_HALFWIDTH[ch]
            converted++; breakdown.katakana++
            continue
        }
        out += ch
        unchanged++; breakdown.other++
    }

    return {
        text: out,
        sourceWidth: 'full',
        targetWidth: 'half',
        convertedCount: converted,
        unchangedCount: unchanged,
        breakdown,
    }
}

/**
 * Detect the predominant character width in a text.
 *
 * @param {string} text
 * @returns {'half' | 'full' | 'mixed' | 'none'}
 */
export function detectWidth(text) {
    if (!text) return 'none'
    let half = 0
    let full = 0
    for (const ch of text) {
        const code = ch.charCodeAt(0)
        if (isHalfWidthAscii(code) || isHalfWidthKatakana(code) || code === HALFWIDTH_SPACE) half++
        else if (isFullWidthAscii(code) || isFullWidthKatakana(code) || code === FULLWIDTH_SPACE) full++
    }
    if (half === 0 && full === 0) return 'none'
    if (half > 0 && full > 0) return 'mixed'
    return half > 0 ? 'half' : 'full'
}

/**
 * Count HW and FW characters per category.
 *
 * @param {string} text
 */
export function getWidthStats(text) {
    let hwAscii = 0, fwAscii = 0, hwKana = 0, fwKana = 0, hwSpace = 0, fwSpace = 0, other = 0
    for (const ch of (text ?? '')) {
        const code = ch.charCodeAt(0)
        if (code === HALFWIDTH_SPACE) hwSpace++
        else if (code === FULLWIDTH_SPACE) fwSpace++
        else if (isHalfWidthAscii(code)) hwAscii++
        else if (isFullWidthAscii(code)) fwAscii++
        else if (isHalfWidthKatakana(code)) hwKana++
        else if (isFullWidthKatakana(code)) fwKana++
        else other++
    }
    return {
        total: (text ?? '').length,
        halfWidth: { ascii: hwAscii, katakana: hwKana, space: hwSpace, total: hwAscii + hwKana + hwSpace },
        fullWidth: { ascii: fwAscii, katakana: fwKana, space: fwSpace, total: fwAscii + fwKana + fwSpace },
        other,
        hasWidthChars: hwAscii + fwAscii + hwKana + fwKana + hwSpace + fwSpace > 0,
    }
}

function _empty(src, tgt) {
    return {
        text: '',
        sourceWidth: src,
        targetWidth: tgt,
        convertedCount: 0,
        unchangedCount: 0,
        breakdown: { ascii: 0, katakana: 0, spaces: 0, other: 0 },
    }
}
