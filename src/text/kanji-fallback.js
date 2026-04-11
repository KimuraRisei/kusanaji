/**
 * Kanji fallback — JMdict/JMnedict reading lookup for leftover kanji.
 *
 * After the primary conversion (kusamoji Viterbi + kusanaji), scan the
 * output for remaining kanji characters. For each kanji run, look up
 * the reading in a JMdict/JMnedict lookup table and substitute it.
 *
 * This is a best-effort pass — the lookup may return wrong readings for
 * ambiguous kanji (e.g., 生 → セイ vs ショウ vs いきる vs なま). But since
 * the primary dict handles 98% correctly, this only fires on the 2% of
 * rare/archaic kanji that the Viterbi couldn't segment.
 *
 * The lookup table is loaded once and cached. It maps surface → reading
 * with longest-match-first priority (longer surfaces checked before
 * shorter ones).
 */

const KANJI_RE = /[\u4E00-\u9FFF\u3400-\u4DBF]+/g

let _lookupMap = null
let _maxKeyLen = 0

/**
 * Initialize the fallback lookup from a pre-built Map.
 * Called once at boot by the consumer (dict-api).
 *
 * @param {Map<string, string>} map - surface → katakana reading
 */
export function initKanjiFallback(map) {
    _lookupMap = map
    _maxKeyLen = 0
    for (const key of map.keys()) {
        if (key.length > _maxKeyLen) _maxKeyLen = key.length
    }
}

/**
 * Load the fallback map from a CSV file (IPADIC format).
 * Picks the first reading encountered for each surface (dedup).
 *
 * @param {string} csvContent - contents of jmdict.csv or jmnedict.csv
 * @returns {Map<string, string>}
 */
export function loadFallbackFromCsv(csvContent) {
    const map = new Map()
    for (const line of csvContent.split('\n')) {
        if (!line || line.startsWith('#')) continue
        const parts = line.split(',')
        if (parts.length < 12) continue
        const surface = parts[0]
        const reading = parts[11]
        if (!surface || !reading) continue
        // Only store if surface contains kanji
        if (!/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(surface)) continue
        // First reading wins (don't overwrite)
        if (!map.has(surface)) {
            map.set(surface, reading)
        }
    }
    return map
}

/**
 * Scan text for remaining kanji runs and replace them with readings
 * from the JMdict/JMnedict lookup. Greedy longest-match.
 *
 * @param {string} text - partially converted text (may contain stray kanji)
 * @param {'katakana' | 'hiragana' | 'romaji'} target - what to convert to
 * @param {Function} [toHiragana] - katakana→hiragana converter (for hiragana target)
 * @param {Function} [romanize] - hiragana→romaji converter (for romaji target)
 * @returns {string}
 */
export function applyKanjiFallback(text, target, toHiragana, romanize) {
    if (!_lookupMap || _lookupMap.size === 0) return text
    if (!KANJI_RE.test(text)) return text

    // Reset regex state
    KANJI_RE.lastIndex = 0

    return text.replace(KANJI_RE, (kanjiRun) => {
        let result = ''
        let pos = 0

        while (pos < kanjiRun.length) {
            let matched = false

            // Greedy longest-match: try from maxKeyLen down to 1
            const maxTry = Math.min(_maxKeyLen, kanjiRun.length - pos)
            for (let len = maxTry; len >= 1; len--) {
                const candidate = kanjiRun.slice(pos, pos + len)
                const reading = _lookupMap.get(candidate)
                if (reading) {
                    let out = reading
                    if (target === 'hiragana' && toHiragana) {
                        out = toHiragana(reading)
                    } else if (target === 'romaji' && toHiragana && romanize) {
                        out = romanize(toHiragana(reading))
                    }
                    result += out
                    pos += len
                    matched = true
                    break
                }
            }

            if (!matched) {
                result += kanjiRun[pos]
                pos++
            }
        }

        return result
    })
}

/**
 * Check if the fallback is initialized.
 * @returns {boolean}
 */
export function isFallbackReady() {
    return _lookupMap !== null && _lookupMap.size > 0
}
