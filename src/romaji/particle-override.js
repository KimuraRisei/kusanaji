/**
 * Particle reading override.
 *
 * In Japanese, the particles は/へ/を are written with kanji that have
 * different default readings (ha/he/wo) but are pronounced wa/e/o when
 * used as particles. The kusamoji POS tag '助詞' (joshi) lets us detect
 * the particle use unambiguously, so we override here only for actual
 * particles, leaving the homograph nouns alone.
 *
 * Used by both the table-loop emitter (the 4 non-MH romaji systems) and
 * the Modified Hepburn emitter via per-token inspection.
 */

/**
 * @param {object} token kusamoji token object with surface_form and pos
 * @returns {'wa'|'e'|'o'|null} the override romanization, or null if not a particle
 */
export function particleOverride(token) {
    if (token.pos !== '助詞') return null
    switch (token.surface_form) {
        case 'は':
            return 'wa'
        case 'へ':
            return 'e'
        case 'を':
            return 'o'
        default:
            return null
    }
}
