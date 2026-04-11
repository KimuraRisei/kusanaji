/**
 * Per-number counter readings for irregular forms.
 *
 * Japanese counters have systematic but irregular pronunciation changes
 * before specific numbers. The biggest categories are:
 *
 *   - Sokuon (small つ) before k/s/t/p: 1+counter, 6+counter, 8+counter,
 *     10+counter, 100+counter. Examples:
 *       1本 → ippon  (not "ichi-hon")
 *       8個 → hakko  (not "hachi-ko")
 *       10回 → jukkai (not "juu-kai")
 *
 *   - Rendaku (h→b/p) on certain counters after 3 (and sometimes others):
 *       3本 → sanbon
 *       3匹 → sanbiki
 *       3階 → sangai
 *
 *   - Truly idiomatic forms unique to one number:
 *       1人 → hitori (not "ichi-nin")
 *       2人 → futari (not "ni-nin")
 *       4月 → shigatsu (not "yon-gatsu")
 *       9時 → kuji (not "kyuu-ji")
 *       1日 → tsuitachi (not "ichi-nichi")
 *       20歳 → hatachi (not "ni-juu-sai")
 *
 * The table below stores, for each counter, the full canonical reading of
 * (digit + counter) for every number where the result is NOT just
 * `<base-digit-reading> + <base-counter-reading>`. Regular numbers are
 * omitted — the existing counter-rewrite path handles them with `digit +
 * base counter reading`.
 *
 * Used by both /v1/romaji and /v1/kana.
 *
 * The values are stored as katakana (for the romaji pipeline). A parallel
 * hiragana table is generated mechanically via `katakanaToHiragana()` so
 * the two tables can never drift.
 *
 * Order of operations in the conversion pipeline:
 *
 *   1. applyIrregularCounterReadings(text)   ← THIS module
 *      Replaces `<digit><counter>` with the full canonical reading for
 *      irregular cases. The digit is consumed entirely and the output
 *      contains no number — only the spelled-out reading.
 *
 *   2. rewriteCounters(text)
 *      Handles regular cases. Replaces `<digit><counter>` with `<digit>
 *      <base-reading-of-counter>`, preserving the visual digit.
 *
 *   3. preprocessDigits(text)
 *      Protects any remaining digits from NEologd's compound entries.
 *
 *   4. tokenize → kusanaji / custom pipeline → restoreDigits.
 *
 * Steps 1 and 2 are mutually exclusive per match — once step 1 fires on
 * a `(digit, counter)` pair, that pair is gone from the text and step 2
 * sees nothing to do for it.
 */

import { katakanaToHiragana } from '../text/kana-script.js'

// ── The irregular reading table (katakana) ──────────────────────────────

const IRREGULAR_KATAKANA = {
    本: {
        1: 'イッポン', 3: 'サンボン', 6: 'ロッポン', 8: 'ハッポン', 10: 'ジュッポン',
        20: 'ニジュッポン', 100: 'ヒャッポン', 1000: 'センボン',
    },
    個: {
        1: 'イッコ', 6: 'ロッコ', 8: 'ハッコ', 10: 'ジュッコ',
        20: 'ニジュッコ', 100: 'ヒャッコ',
    },
    人: {
        1: 'ヒトリ', 2: 'フタリ', 4: 'ヨニン',
    },
    匹: {
        1: 'イッピキ', 3: 'サンビキ', 6: 'ロッピキ', 8: 'ハッピキ', 10: 'ジュッピキ',
        20: 'ニジュッピキ', 100: 'ヒャッピキ',
    },
    杯: {
        1: 'イッパイ', 3: 'サンバイ', 6: 'ロッパイ', 8: 'ハッパイ', 10: 'ジュッパイ',
        20: 'ニジュッパイ', 100: 'ヒャッパイ',
    },
    分: {
        1: 'イップン', 3: 'サンプン', 4: 'ヨンプン', 6: 'ロップン', 8: 'ハップン', 10: 'ジュップン',
        14: 'ジュウヨンプン', 20: 'ニジュップン', 100: 'ヒャップン',
    },
    階: {
        1: 'イッカイ', 3: 'サンガイ', 6: 'ロッカイ', 8: 'ハッカイ', 10: 'ジュッカイ',
        20: 'ニジュッカイ', 100: 'ヒャッカイ',
    },
    軒: {
        1: 'イッケン', 3: 'サンゲン', 6: 'ロッケン', 8: 'ハッケン', 10: 'ジュッケン',
        20: 'ニジュッケン', 100: 'ヒャッケン',
    },
    歳: {
        1: 'イッサイ', 8: 'ハッサイ', 10: 'ジュッサイ', 20: 'ハタチ', 100: 'ヒャクサイ',
    },
    才: {
        // 才 is a common-use replacement for 歳, same readings.
        1: 'イッサイ', 8: 'ハッサイ', 10: 'ジュッサイ', 20: 'ハタチ', 100: 'ヒャクサイ',
    },
    冊: {
        1: 'イッサツ', 8: 'ハッサツ', 10: 'ジュッサツ', 20: 'ニジュッサツ', 100: 'ヒャクサツ',
    },
    件: {
        1: 'イッケン', 6: 'ロッケン', 8: 'ハッケン', 10: 'ジュッケン',
        20: 'ニジュッケン', 100: 'ヒャッケン',
    },
    回: {
        1: 'イッカイ', 6: 'ロッカイ', 8: 'ハッカイ', 10: 'ジュッカイ',
        20: 'ニジュッカイ', 100: 'ヒャッカイ',
    },
    月: {
        // Calendar months (4月 = April). Idiomatic: 4=shi, 7=shichi, 9=ku.
        // Above 12 makes no sense for calendar months but we still need
        // entries to suppress the "20gatsu" form when someone types it.
        1: 'イチガツ', 2: 'ニガツ', 3: 'サンガツ', 4: 'シガツ', 5: 'ゴガツ',
        6: 'ロクガツ', 7: 'シチガツ', 8: 'ハチガツ', 9: 'クガツ', 10: 'ジュウガツ',
        11: 'ジュウイチガツ', 12: 'ジュウニガツ',
    },
    'ヶ月': {
        1: 'イッカゲツ', 6: 'ロッカゲツ', 8: 'ハッカゲツ', 10: 'ジュッカゲツ',
        20: 'ニジュッカゲツ', 100: 'ヒャッカゲツ',
    },
    か月: {
        1: 'イッカゲツ', 6: 'ロッカゲツ', 8: 'ハッカゲツ', 10: 'ジュッカゲツ',
        20: 'ニジュッカゲツ', 100: 'ヒャッカゲツ',
    },
    時: {
        // Hour of day. Idiomatic: 4=yo, 7=shichi, 9=ku, 14=jūyo (24h clock).
        4: 'ヨジ', 7: 'シチジ', 9: 'クジ', 14: 'ジュウヨジ',
    },
    時間: {
        // Duration in hours. Same idiomatics as 時.
        4: 'ヨジカン', 7: 'シチジカン', 9: 'クジカン', 14: 'ジュウヨジカン',
    },
    日: {
        // Day of month. Almost entirely idiomatic 1-10 + 14, 20, 24.
        1: 'ツイタチ', 2: 'フツカ', 3: 'ミッカ', 4: 'ヨッカ', 5: 'イツカ',
        6: 'ムイカ', 7: 'ナノカ', 8: 'ヨウカ', 9: 'ココノカ', 10: 'トオカ',
        14: 'ジュウヨッカ', 20: 'ハツカ', 24: 'ニジュウヨッカ',
        // 100日 is regular hyakunichi but we leave it to fall through.
    },
    年: {
        // 4年 and 9年 take the idiomatic short forms in modern usage.
        4: 'ヨネン', 9: 'クネン',
    },
    週間: {
        1: 'イッシュウカン', 8: 'ハッシュウカン', 10: 'ジュッシュウカン',
        20: 'ニジュッシュウカン', 100: 'ヒャクシュウカン',
    },
    週: {
        1: 'イッシュウ', 8: 'ハッシュウ', 10: 'ジュッシュウ', 100: 'ヒャクシュウ',
    },
    頭: {
        1: 'イットウ', 8: 'ハットウ', 10: 'ジュットウ', 20: 'ニジュットウ', 100: 'ヒャクトウ',
    },
    羽: {
        // 羽 is unusual: 1 is regular ichiwa but 3 takes rendaku, and
        // 6/8/10/100 take both sokuon AND rendaku.
        3: 'サンバ', 6: 'ロッパ', 8: 'ハッパ', 10: 'ジュッパ',
        20: 'ニジュッパ', 100: 'ヒャッパ',
    },
    足: {
        1: 'イッソク', 3: 'サンゾク', 8: 'ハッソク', 10: 'ジュッソク',
        20: 'ニジュッソク', 100: 'ヒャクソク',
    },
    通: {
        1: 'イッツウ', 8: 'ハッツウ', 10: 'ジュッツウ', 100: 'ヒャクツウ',
    },
    着: {
        1: 'イッチャク', 8: 'ハッチャク', 10: 'ジュッチャク', 100: 'ヒャクチャク',
    },
}

// ── Hiragana mirror ─────────────────────────────────────────────────────

const IRREGULAR_HIRAGANA = Object.fromEntries(
    Object.entries(IRREGULAR_KATAKANA).map(([counter, byNum]) => [
        counter,
        Object.fromEntries(Object.entries(byNum).map(([n, kata]) => [n, katakanaToHiragana(kata)])),
    ])
)

// ── Regex ───────────────────────────────────────────────────────────────

const COUNTER_KEYS = Object.keys(IRREGULAR_KATAKANA)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
const IRREGULAR_RE = new RegExp(`(\\d+)(${COUNTER_KEYS})`, 'g')

/**
 * Replace `<digit><counter>` with its full canonical reading when an
 * irregular form exists. Returns the original substring untouched if no
 * irregular form is registered for that (digit, counter) pair.
 *
 * @param {string} text
 * @param {{ targetScript?: 'katakana' | 'hiragana' }} [opts]
 *   Defaults to 'katakana' (romaji pipeline).
 */
export function applyIrregularCounterReadings(text, opts = {}) {
    const table = opts.targetScript === 'hiragana' ? IRREGULAR_HIRAGANA : IRREGULAR_KATAKANA
    return text.replace(IRREGULAR_RE, (match, digits, counter) => {
        const num = parseInt(digits, 10)
        const reading = table[counter]?.[num]
        return reading || match
    })
}
