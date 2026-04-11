/**
 * Verb-form rejoiner.
 *
 * Kusanaji's `spaced` mode separates *every* morpheme. Conventionally
 * romaji writes inflected verbs as one word (shimasu, kakimashita, mite
 * imasu), so we run a multi-pass post-pass to glue them back together.
 * Each pass is targeted rather than blanket — order matters, longer forms
 * first. Loops to fixed-point because some inputs need 2-3 passes.
 *
 * Used by the Modified Hepburn emitter only — the table-loop emitter for
 * the 4 non-MH systems doesn't need this because its custom kusamoji
 * loop walks tokens directly without the kusanaji spacing artefact.
 */

const AUX_PIECE_REWRITES = [
    [/\bmashi ta\b/g, 'mashita'],
    [/\bmashi te\b/g, 'mashite'],
    [/\bdeshi ta\b/g, 'deshita'],
    [/\bmasho u\b/g, 'mashō'],
    [/\bdesho u\b/g, 'deshō'],
    [/\bmase n\b/g, 'masen'],
    [/\btari ta\b/g, 'tarita'],
    [/\bnakat ta\b/g, 'nakatta'],
    [/\bnakere ba\b/g, 'nakereba'],
]

const AUX_SUFFIX_RE = /\b([a-zāīūēō]+) (masu|mashita|mashite|masen|mashō|deshita|deshō|tara|tari)\b/g

// "de" deliberately excluded from the verb-tail glue — it's a particle
// homograph and merging "shinkansen de" → "shinkansende" would be wrong.
// Left side must end in i/e (ren'yōkei stems) and be at least 2 chars to
// skip 1-mora ambiguity (i ta → ita, where "i" might be a content word).
const VERB_TAIL_RE = /\b([a-zāīūēō]{2,}[ie]) (ta|te|da)\b/g

const PASSIVE_RE = /\bsa re (ta|te|nai|nakatta|masu|mashita|mashite)\b/g

const PROGRESSIVE_RE = /\b([a-zāīūēō]+(?:te|de)) i (masu|mashita|masen|mashō|ta|nai|nakatta)\b/g

const VOLITIONAL_MACRON_RE = /\bmasho u\b/g

// Targeted copula-past fix.
//
// History: a previous version had a generic SOKUON_RE pass intended to glue
// cross-token small-tsu gemination ("kat ta" → "katta"). It was removed
// because (a) kusanaji almost never splits sokuon across token boundaries
// — `katta` always comes back as a single token — and (b) the regex was
// matching real `tsu` syllables in Sino-Japanese words, producing nonsense
// like "keisatsu de" → "keisadde". Removing it fixed 17 of 19 romaji-only
// errors on the 50-snippet NHK benchmark.
//
// HOWEVER, the empirical replacement pass below shows kusanaji DOES emit
// the copula past form `だった` as the literal token sequence "datsu ta"
// (and the te-form `だって` as "datsu te"). Same for the colloquial
// `じゃった/じゃって`. These are the only forms that need the manual glue
// — every other geminate form (`勝った→katta`, `あった→atta`, `やっと→yatto`)
// is already correct from kusanaji.
const COPULA_PAST_REWRITES = [
    [/\bdatsu ta\b/g, 'datta'],
    [/\bdatsu te\b/g, 'datte'],
    [/\bjatsu ta\b/g, 'jatta'],
    [/\bjatsu te\b/g, 'jatte'],
]

/**
 * Loop the rewrites to fixed-point. Capped at 5 iterations as a safety
 * guard — should typically converge in 2.
 *
 * @param {string} text
 * @returns {string}
 */
export function joinVerbForms(text) {
    let prev = ''
    let cur = text
    for (let i = 0; i < 5 && cur !== prev; i++) {
        prev = cur
        for (const [re, replacement] of AUX_PIECE_REWRITES) cur = cur.replace(re, replacement)
        cur = cur.replace(AUX_SUFFIX_RE, '$1$2')
        cur = cur.replace(PASSIVE_RE, 'sare$1')
        cur = cur.replace(VERB_TAIL_RE, '$1$2')
        cur = cur.replace(PROGRESSIVE_RE, '$1 i$2')
        cur = cur.replace(VOLITIONAL_MACRON_RE, 'mashō')
        for (const [re, replacement] of COPULA_PAST_REWRITES) cur = cur.replace(re, replacement)
    }
    return cur
}
