/**
 * Counter rewriting.
 *
 * Counter kanji that follow a digit run get their kana reading substituted
 * in directly — otherwise kusamoji reads the standalone kanji with its
 * default noun reading (月 → tsuki "moon", 時 → toki "time"). Rewriting
 * "3月" → "3ガツ" (or "3がつ") BEFORE tokenization preserves the literal
 * ASCII digit AND fixes the counter pronunciation.
 *
 * We expose two parallel tables:
 *   - COUNTER_KATAKANA — used by the romaji pipeline. Katakana groups as a
 *     single kusamoji unknown-word token, so kusanaji's spaced mode keeps
 *     it whole instead of mora-splitting "がつ" → ["が","つ"] → "ga tsu".
 *   - COUNTER_HIRAGANA — used by the kana pipeline. Kusanaji's normal mode
 *     (no spaces) joins everything cleanly even with hiragana, and the
 *     output stays in the requested script. Using katakana here would
 *     leak "3ガツ" into the hiragana output unchanged.
 *
 * We only include counters whose reading is stable across all numbers —
 * 本/分/杯 vary (3本=sanbon, 1本=ippon) and are left to the analyzer.
 *
 * Used by both /v1/romaji and /v1/kana so the two converters stay in sync.
 */

import { katakanaToHiragana } from '../text/kana-script.js'

// IMPORTANT: these are the FALLBACK (regular) readings used by the
// rewriteCounters pass when no irregular per-number reading exists for the
// (digit, counter) pair. The irregular cases are handled BEFORE this pass
// by applyIrregularCounterReadings (see counter-readings.js).
//
// Several of these counters have a default kusamoji standalone reading
// that is wrong for the counter use (e.g. 軒 → "noki" / eaves, 頭 →
// "atama" / head, 足 → "ashi" / leg, 通 → "dōri" / way, 着 → "gi" /
// wear-stem, 分 → "bun" / part). The entries below force the correct
// counter reading.
const COUNTER_KATAKANA = {
    週間: 'シュウカン',
    時間: 'ジカン',
    ヶ月: 'カゲツ',
    か月: 'カゲツ',
    月: 'ガツ',
    時: 'ジ',
    分: 'フン',  // override default "bun"
    年: 'ネン',
    歳: 'サイ',
    才: 'サイ',
    円: 'エン',
    枚: 'マイ',
    回: 'カイ',
    秒: 'ビョウ',
    度: 'ド',
    日: 'ニチ',
    // 人: idiomatic 1人=ひとり, 2人=ふたり, 3+=にん. The irregulars (1, 2)
    // are now handled by applyIrregularCounterReadings; this is the
    // fallback for 3+.
    人: 'ニン',
    件: 'ケン',
    軒: 'ケン',  // override default "noki"
    冊: 'サツ',
    本: 'ホン',
    個: 'コ',
    匹: 'ヒキ',
    杯: 'ハイ',
    階: 'カイ',
    頭: 'トウ',  // override default "atama"
    羽: 'ワ',
    足: 'ソク',  // override default "ashi"
    通: 'ツウ',  // override default "dōri"
    着: 'チャク', // override default "gi"
    週: 'シュウ',
}

// Mirror table in hiragana, built mechanically from the katakana table by
// Unicode-shifting each char, so the two CANNOT drift — adding to one
// automatically updates the other.
const COUNTER_HIRAGANA = Object.fromEntries(
    Object.entries(COUNTER_KATAKANA).map(([kanji, kata]) => [
        kanji,
        katakanaToHiragana(kata),
    ])
)

// We refuse to rewrite a counter when doing so would orphan the next kanji
// of a known compound. The list is manual but small — only the high-
// frequency compounds where the second kanji's standalone reading would
// otherwise be wrong, and only those that actually appeared in the NHK
// 50-snippet benchmark. A more aggressive negative-lookahead like
// (?![\u4E00-\u9FFF]) would catch more cases but also produce false
// positives on innocent compounds (180人以上 → "180 jin ijou",
// 20日分 → "20 bi bun"), so we stay conservative and only block specific
// known compounds. Each entry is exactly 2 chars: <counter><next-kanji>.
const COMPOUND_BLOCKLIST = new Set([
    '年生', // 6年生 → 6 nen-sei (nth-grade student)
    '年間', // 5年間 → 5 nen-kan (period of n years)
    '月末', // 3月末 → 3 gatsu-matsu (end of month n) — actually getsumatsu
    '月間', // 3月間 → 3 gakkan
    '日夜', // 7日夜 → 7 nichi-ya (night of day n)
])

const COUNTER_RE = new RegExp(
    `(\\d+)(${Object.keys(COUNTER_KATAKANA)
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})`,
    'g'
)

/**
 * @param {string} text
 * @param {{ targetScript?: 'katakana' | 'hiragana' }} [opts]
 *   Defaults to 'katakana' (romaji pipeline). Pass 'hiragana' for the
 *   kana pipeline so the substituted readings stay in the requested script.
 */
export function rewriteCounters(text, opts = {}) {
    const table = opts.targetScript === 'hiragana' ? COUNTER_HIRAGANA : COUNTER_KATAKANA
    return text.replace(COUNTER_RE, (match, digits, counter, offset) => {
        // Check if (counter + next char) is a known blocklist compound. If
        // so, leave the original text untouched so the dictionary can match
        // the compound as a whole word.
        const nextChar = text[offset + match.length] || ''
        if (COMPOUND_BLOCKLIST.has(counter + nextChar)) return match
        return `${digits}${table[counter]}`
    })
}
