/**
 * Counter reading data — flat-key architecture.
 *
 * Three flat maps + a blocklist, applied at the TOKEN level after kusamoji
 * has segmented the input:
 *
 *   for each token whose surface matches `<digits><counter>`:
 *     - If preserveDigits is TRUE:
 *         emit `<ASCII digits> + COUNTER_KATAKANA[counter]`
 *         (base counter reading. Digit-preservation implies the user is
 *         prioritising glyph legibility over native rendaku; 1本 → 1ホン,
 *         4月 → 4ガツ. Acceptable tradeoff.)
 *     - If preserveDigits is FALSE:
 *         emit IRREGULAR_COUNTER_KANA[surface] ?? token.reading
 *         (tokenizer usually has the correct compound reading via NEologd;
 *         the table is a safety-net override.)
 *   else: emit token.reading unchanged.
 *
 * A separate SINGLE_KANJI_READING_OVERRIDES map corrects single-kanji tokens
 * where the main dict's default is a nanori (e.g. 館 → カン, not タテ).
 *
 * See `parseDigitCounter()`, `emitCounterReading()`, and
 * `overrideSingleKanjiReading()` helpers below.
 *
 * Why flat keys: single lookup, easy to enumerate/grep/verify, adding an
 * entry doesn't require remembering which counter owns it. See workspace
 * memory `flat_lookup_tables_preferred.md`.
 */

import { toRawHiragana } from './util.js'

// ── 1. Full irregular readings (for keep=false override) ───────────────
// Keyed by the EXACT surface form. Value is the full reading in katakana.
// The tokenizer (via NEologd) already produces most of these readings
// natively, so this table serves primarily as a safety-net override for
// cases where the tokenizer's compound match differs from the canonical
// irregular form. Populated only where a compound has rendaku, gemination,
// or an idiomatic replacement.
export const IRREGULAR_COUNTER_KANA = Object.freeze({
    // 本 — rendaku/gemination at 1,3,6,8,10,100,1000
    '1本': 'イッポン', '3本': 'サンボン', '6本': 'ロッポン', '8本': 'ハッポン',
    '10本': 'ジッポン', '100本': 'ヒャッポン', '1000本': 'センボン',

    // 個
    '1個': 'イッコ', '6個': 'ロッコ', '8個': 'ハッコ', '10個': 'ジッコ',
    '100個': 'ヒャッコ',

    // 人 — idiomatic 1人/2人 plus 4人 shortens digit
    '1人': 'ヒトリ', '2人': 'フタリ', '4人': 'ヨニン',

    // 匹
    '1匹': 'イッピキ', '3匹': 'サンビキ', '6匹': 'ロッピキ', '8匹': 'ハッピキ',
    '10匹': 'ジッピキ', '100匹': 'ヒャッピキ',

    // 杯
    '1杯': 'イッパイ', '3杯': 'サンバイ', '6杯': 'ロッパイ', '8杯': 'ハッパイ',
    '10杯': 'ジッパイ', '100杯': 'ヒャッパイ',

    // 分 (minutes)
    '1分': 'イップン', '3分': 'サンプン', '4分': 'ヨンプン', '6分': 'ロップン',
    '8分': 'ハップン', '10分': 'ジップン', '14分': 'ジュウヨンプン',
    '100分': 'ヒャップン',

    // 階
    '1階': 'イッカイ', '3階': 'サンガイ', '6階': 'ロッカイ', '8階': 'ハッカイ',
    '10階': 'ジッカイ', '100階': 'ヒャッカイ',

    // 軒
    '1軒': 'イッケン', '3軒': 'サンゲン', '6軒': 'ロッケン', '8軒': 'ハッケン',
    '10軒': 'ジッケン',

    // 歳 / 才
    '1歳': 'イッサイ', '8歳': 'ハッサイ', '10歳': 'ジッサイ', '20歳': 'ハタチ',
    '1才': 'イッサイ', '8才': 'ハッサイ', '10才': 'ジッサイ', '20才': 'ハタチ',

    // 冊
    '1冊': 'イッサツ', '8冊': 'ハッサツ', '10冊': 'ジッサツ',

    // 件
    '1件': 'イッケン', '6件': 'ロッケン', '8件': 'ハッケン', '10件': 'ジッケン',

    // 回
    '1回': 'イッカイ', '6回': 'ロッカイ', '8回': 'ハッカイ', '10回': 'ジッカイ',

    // 月 (calendar month) — idiomatic digit readings at 4,7,9
    '1月': 'イチガツ', '2月': 'ニガツ', '3月': 'サンガツ', '4月': 'シガツ',
    '5月': 'ゴガツ', '6月': 'ロクガツ', '7月': 'シチガツ', '8月': 'ハチガツ',
    '9月': 'クガツ', '10月': 'ジュウガツ', '11月': 'ジュウイチガツ', '12月': 'ジュウニガツ',

    // ヶ月 / か月 / カ月 (three surface variants, same reading)
    '1ヶ月': 'イッカゲツ', '6ヶ月': 'ロッカゲツ', '8ヶ月': 'ハッカゲツ', '10ヶ月': 'ジッカゲツ',
    '1か月': 'イッカゲツ', '6か月': 'ロッカゲツ', '8か月': 'ハッカゲツ', '10か月': 'ジッカゲツ',
    '1カ月': 'イッカゲツ', '6カ月': 'ロッカゲツ', '8カ月': 'ハッカゲツ', '10カ月': 'ジッカゲツ',

    // 時 — idiomatic 4/7/9
    '4時': 'ヨジ', '7時': 'シチジ', '9時': 'クジ', '14時': 'ジュウヨジ',

    // 時間 — same idiomatic digits as 時
    '4時間': 'ヨジカン', '7時間': 'シチジカン', '9時間': 'クジカン',
    '14時間': 'ジュウヨジカン',

    // 日 (day of month) — mostly idiomatic 1–10 + 14, 20, 24
    '1日': 'ツイタチ', '2日': 'フツカ', '3日': 'ミッカ', '4日': 'ヨッカ',
    '5日': 'イツカ', '6日': 'ムイカ', '7日': 'ナノカ', '8日': 'ヨウカ',
    '9日': 'ココノカ', '10日': 'トオカ', '14日': 'ジュウヨッカ',
    '20日': 'ハツカ', '24日': 'ニジュウヨッカ',

    // 年
    '4年': 'ヨネン', '9年': 'クネン',

    // 週 / 週間
    '1週': 'イッシュウ', '8週': 'ハッシュウ', '10週': 'ジッシュウ',
    '1週間': 'イッシュウカン', '8週間': 'ハッシュウカン', '10週間': 'ジッシュウカン',

    // 頭
    '1頭': 'イットウ', '8頭': 'ハットウ', '10頭': 'ジットウ',

    // 羽
    '3羽': 'サンバ', '6羽': 'ロッパ', '8羽': 'ハッパ', '10羽': 'ジッパ',

    // 足
    '1足': 'イッソク', '3足': 'サンゾク', '8足': 'ハッソク', '10足': 'ジッソク',

    // 通
    '1通': 'イッツウ', '8通': 'ハッツウ', '10通': 'ジッツウ',

    // 着
    '1着': 'イッチャク', '8着': 'ハッチャク', '10着': 'ジッチャク',

    // 戸 — parallels 個
    '1戸': 'イッコ', '6戸': 'ロッコ', '8戸': 'ハッコ', '10戸': 'ジッコ',
    '100戸': 'ヒャッコ',

    // 箇所 / ヶ所 / カ所 / か所 — same reading カショ, sokuonbika at 1/6/8/10/100
    '1箇所': 'イッカショ', '6箇所': 'ロッカショ', '8箇所': 'ハッカショ',
    '10箇所': 'ジッカショ', '100箇所': 'ヒャッカショ',
    '1ヶ所': 'イッカショ', '6ヶ所': 'ロッカショ', '8ヶ所': 'ハッカショ',
    '10ヶ所': 'ジッカショ', '100ヶ所': 'ヒャッカショ',
    '1カ所': 'イッカショ', '6カ所': 'ロッカショ', '8カ所': 'ハッカショ',
    '10カ所': 'ジッカショ', '100カ所': 'ヒャッカショ',
    '1か所': 'イッカショ', '6か所': 'ロッカショ', '8か所': 'ハッカショ',
    '10か所': 'ジッカショ', '100か所': 'ヒャッカショ',

    // 片 — parallels 本/匹/分
    '1片': 'イッペン', '3片': 'サンペン', '6片': 'ロッペン', '8片': 'ハッペン',
    '10片': 'ジッペン', '100片': 'ヒャッペン',

    // 艘
    '1艘': 'イッソウ', '8艘': 'ハッソウ', '10艘': 'ジッソウ',

    // 隻
    '1隻': 'イッセキ', '8隻': 'ハッセキ', '10隻': 'ジッセキ', '100隻': 'ヒャッセキ',

    // 周 — parallels 週
    '1周': 'イッシュウ', '8周': 'ハッシュウ', '10周': 'ジッシュウ',

    // 点
    '1点': 'イッテン', '8点': 'ハッテン', '10点': 'ジッテン',

    // 滴
    '1滴': 'イッテキ', '8滴': 'ハッテキ', '10滴': 'ジッテキ',

    // 棟 — parallels 頭 (same base トウ, same sokuonbika pattern)
    '1棟': 'イットウ', '8棟': 'ハットウ', '10棟': 'ジットウ', '100棟': 'ヒャットウ',

    // 世紀 — centuries
    '1世紀': 'イッセイキ', '8世紀': 'ハッセイキ', '10世紀': 'ジッセイキ',

    // 期 — terms/quarters
    '1期': 'イッキ', '6期': 'ロッキ', '8期': 'ハッキ', '10期': 'ジッキ',
    '100期': 'ヒャッキ',

    // 等 — rank/class (1等賞)
    '1等': 'イットウ', '8等': 'ハットウ', '10等': 'ジットウ',

    // 級 — rank/grade
    '1級': 'イッキュウ', '6級': 'ロッキュウ', '8級': 'ハッキュウ',
    '10級': 'ジッキュウ', '100級': 'ヒャッキュウ',

    // 缶 — cans
    '1缶': 'イッカン', '6缶': 'ロッカン', '8缶': 'ハッカン',
    '10缶': 'ジッカン', '100缶': 'ヒャッカン',

    // 艇 — small boats
    '1艇': 'イッテイ', '8艇': 'ハッテイ', '10艇': 'ジッテイ',

    // 回戦 — tournament round
    '1回戦': 'イッカイセン', '6回戦': 'ロッカイセン', '8回戦': 'ハッカイセン',
    '10回戦': 'ジッカイセン',

    // 勝 — wins (100勝 = ヒャクショウ per NHK, plain; ヒャッショウ not standard)
    '1勝': 'イッショウ', '8勝': 'ハッショウ', '10勝': 'ジッショウ',
    '100勝': 'ヒャクショウ',

    // 敗 — losses (3敗 = サンパイ per NHK; distinct from 3杯 = サンバイ)
    '1敗': 'イッパイ', '3敗': 'サンパイ', '6敗': 'ロッパイ', '8敗': 'ハッパイ',
    '10敗': 'ジッパイ', '100敗': 'ヒャッパイ',

    // 首 — waka poems (百首 = ヒャクシュ idiomatic)
    '1首': 'イッシュ', '8首': 'ハッシュ', '10首': 'ジッシュ',
    '100首': 'ヒャクシュ',

    // 句 — haiku phrases
    '1句': 'イック', '6句': 'ロック', '8句': 'ハック', '10句': 'ジック',
    '100句': 'ヒャック',

    // 拍 — musical beats (3拍 = サンパク per NHK)
    '1拍': 'イッパク', '3拍': 'サンパク', '6拍': 'ロッパク', '8拍': 'ハッパク',
    '10拍': 'ジッパク', '100拍': 'ヒャッパク',

    // 小節 — musical bars
    '1小節': 'イッショウセツ', '8小節': 'ハッショウセツ', '10小節': 'ジッショウセツ',

    // 作 — works/oeuvres
    '1作': 'イッサク', '8作': 'ハッサク', '10作': 'ジッサク',

    // 発 — shots/rockets (3発 = サンパツ per NHK)
    '1発': 'イッパツ', '3発': 'サンパツ', '6発': 'ロッパツ', '8発': 'ハッパツ',
    '10発': 'ジッパツ', '100発': 'ヒャッパツ', '1000発': 'センパツ',

    // 挺 — long objects/guns (same reading as 丁 = チョウ)
    '1挺': 'イッチョウ', '8挺': 'ハッチョウ', '10挺': 'ジッチョウ',

    // 脚 — chairs/tables
    '1脚': 'イッキャク', '6脚': 'ロッキャク', '8脚': 'ハッキャク',
    '10脚': 'ジッキャク', '100脚': 'ヒャッキャク',

    // 校 — schools
    '1校': 'イッコウ', '6校': 'ロッコウ', '8校': 'ハッコウ',
    '10校': 'ジッコウ', '100校': 'ヒャッコウ',

    // 局 — bureaus/stations
    '1局': 'イッキョク', '6局': 'ロッキョク', '8局': 'ハッキョク',
    '10局': 'ジッキョク', '100局': 'ヒャッキョク',

    // 社 — companies
    '1社': 'イッシャ', '8社': 'ハッシャ', '10社': 'ジッシャ',

    // 班 — squads (3班 = サンパン per NHK)
    '1班': 'イッパン', '3班': 'サンパン', '6班': 'ロッパン', '8班': 'ハッパン',
    '10班': 'ジッパン', '100班': 'ヒャッパン',

    // 票 — votes (3票 = サンピョウ per NHK)
    '1票': 'イッピョウ', '3票': 'サンピョウ', '6票': 'ロッピョウ', '8票': 'ハッピョウ',
    '10票': 'ジッピョウ', '100票': 'ヒャッピョウ', '1000票': 'センピョウ',

    // 色 — colors/types (100色 = ヒャクショク plain, idiomatic)
    '1色': 'イッショク', '8色': 'ハッショク', '10色': 'ジッショク',
    '100色': 'ヒャクショク',

    // 席 (additional — base already present)
    '1席': 'イッセキ', '8席': 'ハッセキ', '10席': 'ジッセキ',

    // 包 — packets/doses (3包 = サンポウ per NHK)
    '1包': 'イッポウ', '3包': 'サンポウ', '6包': 'ロッポウ', '8包': 'ハッポウ',
    '10包': 'ジッポウ', '100包': 'ヒャッポウ',

    // 皿 — plates (rendaku at 3)
    '1皿': 'ヒトサラ', '2皿': 'フタサラ', '3皿': 'サンザラ',

    // 人前 — portions (1/4 idiomatic)
    '1人前': 'イチニンマエ', '4人前': 'ヨニンマエ',

    // 反 — bolts of cloth
    '1反': 'イッタン', '8反': 'ハッタン', '10反': 'ジッタン',

    // 揃い — sets of clothing (kun-yomi for small counts)
    '1揃い': 'ヒトソロイ', '2揃い': 'フタソロイ',

    // 枝 — branches (kun-yomi for 1)
    '1枝': 'ヒトエダ',

    // 重 — layers (kun-yomi for 1, 2)
    '1重': 'ヒトエ', '2重': 'フタエ',

    // 桁 — digits (kun-yomi idiomatic for 1, 2)
    '1桁': 'ヒトケタ', '2桁': 'フタケタ',

    // 銭 — yen cents
    '1銭': 'イッセン', '8銭': 'ハッセン', '10銭': 'ジッセン',

    // ── Digit-gap additions to counters already above ──
    // 4-prefix: ヨン is dominant over シ in modern spoken/broadcast.
    '4本': 'ヨンホン', '4匹': 'ヨンヒキ', '4階': 'ヨンカイ', '4杯': 'ヨンハイ',
    '4軒': 'ヨンケン', '4件': 'ヨンケン', '4回': 'ヨンカイ', '4頭': 'ヨントウ',
    '4ヶ月': 'ヨンカゲツ', '4か月': 'ヨンカゲツ', '4カ月': 'ヨンカゲツ',

    // 100-prefix sokuonbika (parallels 100本=ヒャッポン)
    '100回': 'ヒャッカイ', '100頭': 'ヒャットウ', '100羽': 'ヒャッパ',
    '100ヶ月': 'ヒャッカゲツ', '100か月': 'ヒャッカゲツ', '100カ月': 'ヒャッカゲツ',

    // 1羽 — pin to standard イチワ (イッパ is non-standard)
    '1羽': 'イチワ',
})

// ── 2. Base counter reading per counter kanji ──────────────────────────
// Used when `preserveDigits=true` — digit keeps its ASCII form and this
// base reading is appended. Rendaku'd counter pronunciations (e.g.
// "ポン" for 1本, "ガイ" for 3階) are deliberately NOT applied here:
// when the user has preserved the ASCII glyph, the kana is an aid to
// understanding rather than a phonetic transcription, and emitting the
// base reading is both simpler and unambiguous.
export const COUNTER_KATAKANA = Object.freeze({
    // Time
    '年': 'ネン', '月': 'ガツ', '日': 'ニチ',
    '週': 'シュウ', '週間': 'シュウカン',
    '時': 'ジ', '時間': 'ジカン',
    '分': 'フン', '分間': 'フンカン',
    '秒': 'ビョウ',
    'ヶ月': 'カゲツ', 'か月': 'カゲツ', 'カ月': 'カゲツ',
    '周年': 'シュウネン',
    '世紀': 'セイキ', '代': 'ダイ', '年代': 'ネンダイ',
    '期': 'キ', '世代': 'セダイ', '代目': 'ダイメ',
    // Currency / age
    '円': 'エン', '歳': 'サイ', '才': 'サイ',
    // Objects / quantity
    '本': 'ホン', '個': 'コ', '匹': 'ヒキ', '枚': 'マイ', '杯': 'ハイ',
    '冊': 'サツ', '台': 'ダイ', '着': 'チャク',
    '箱': 'ハコ', '束': 'タバ', '粒': 'ツブ', '切れ': 'キレ',
    '点': 'テン', '滴': 'テキ', '片': 'ヘン',
    '包': 'ホウ', '膳': 'ゼン', '缶': 'カン', '瓶': 'ビン',
    '袋': 'フクロ', '尾': 'ビ',
    // People
    '人': 'ニン', '名': 'メイ', '人前': 'ニンマエ',
    // Addresses / ordinals / places
    '番': 'バン', '番地': 'バンチ', '号': 'ゴウ', '号室': 'ゴウシツ',
    '丁目': 'チョウメ', '丁': 'チョウ', '階': 'カイ', '室': 'シツ',
    '件': 'ケン', '軒': 'ケン',
    '戸': 'コ', '店': 'テン',
    '箇所': 'カショ', 'ヶ所': 'カショ', 'カ所': 'カショ', 'か所': 'カショ',
    // Legal / policy / rank
    '条': 'ジョウ', '等': 'トウ', '級': 'キュウ',
    // Events / sports
    '回': 'カイ', '度': 'ド', '周': 'シュウ',
    '回戦': 'カイセン', '試合': 'シアイ', '弾': 'ダン',
    '勝': 'ショウ', '敗': 'ハイ',
    'セット': 'セット', 'ゲーム': 'ゲーム', 'ラウンド': 'ラウンド',
    'シーズン': 'シーズン', 'ホール': 'ホール',
    // Animals / transport
    '頭': 'トウ', '羽': 'ワ',
    '艘': 'ソウ', '隻': 'セキ', '艇': 'テイ',
    '機': 'キ', '両': 'リョウ', '輪': 'リン',
    // Buildings / structures / furniture
    '棟': 'トウ', '脚': 'キャク',
    // Media / performance / literature
    '曲': 'キョク', '話': 'ワ', '編': 'ヘン', '節': 'セツ',
    '巻': 'カン', '幕': 'マク', '錠': 'ジョウ',
    '場': 'バ', '首': 'シュ', '句': 'ク',
    '拍': 'ハク', '小節': 'ショウセツ', '作': 'サク',
    // Medicine / pharma
    '回分': 'カイブン',
    // Measures / ratios / math
    '割': 'ワリ', '倍': 'バイ', '段': 'ダン',
    '畳': 'ジョウ', '坪': 'ツボ', '席': 'セキ', '列': 'レツ',
    '行': 'ギョウ', '手': 'テ',
    '種': 'シュ', '類': 'ルイ', '種類': 'シュルイ',
    '乗': 'ジョウ', '桁': 'ケタ', '重': 'ジュウ',
    // Military / weapons
    '発': 'ハツ', '挺': 'チョウ',
    // Food / cuisine
    '皿': 'サラ',
    // Nature / plants / stock
    '株': 'カブ', '枝': 'エダ',
    // Textiles
    '反': 'タン', '揃い': 'ソロイ',
    // Shop / business / organisational
    '組': 'クミ', '足': 'ソク', '通': 'ツウ',
    '部': 'ブ', '課': 'カ', '章': 'ショウ', '項': 'コウ', '位': 'イ',
    '校': 'コウ', '局': 'キョク', '院': 'イン', '社': 'シャ', '班': 'ハン',
    '票': 'ヒョウ', '連': 'レン', '通り': 'トオリ',
    '色': 'ショク', '問': 'モン', '科': 'カ',

    // ── Loanword (katakana) counters ──
    // Loanword counters have NO rendaku/gemination — base reading equals
    // surface. The only reason these entries exist is so that `preserveDigits`
    // mode emits `<digits> + <counter kana>` (e.g. 87パーセント → 87パーセント)
    // instead of the full number-to-kana reading (ハチジュウナナパーセント).
    // For keepDigits=false, the tokenizer emits the native reading directly.
    // Units (length/area/volume/mass)
    'パーセント': 'パーセント',
    'キロ': 'キロ', 'キロメートル': 'キロメートル', 'メートル': 'メートル',
    'センチ': 'センチ', 'ミリ': 'ミリ', 'ミリメートル': 'ミリメートル',
    'マイクロメートル': 'マイクロメートル', 'ナノメートル': 'ナノメートル',
    'グラム': 'グラム', 'キログラム': 'キログラム', 'ミリグラム': 'ミリグラム',
    'トン': 'トン',
    'リットル': 'リットル', 'ミリリットル': 'ミリリットル',
    'ヘクタール': 'ヘクタール',
    'インチ': 'インチ', 'フィート': 'フィート',
    'ヤード': 'ヤード', 'マイル': 'マイル',
    'オンス': 'オンス', 'ガロン': 'ガロン', 'カラット': 'カラット',
    // Currency
    'ドル': 'ドル', 'ユーロ': 'ユーロ', 'ウォン': 'ウォン',
    'ポンド': 'ポンド', 'セント': 'セント',
    '元': 'ゲン', '銭': 'セン',
    'ルピー': 'ルピー', 'フラン': 'フラン', 'ルーブル': 'ルーブル',
    'レアル': 'レアル', 'ペソ': 'ペソ', 'リラ': 'リラ',
    // Tech / media / computing
    'ページ': 'ページ', 'ポイント': 'ポイント',
    'バイト': 'バイト', 'キロバイト': 'キロバイト', 'メガバイト': 'メガバイト',
    'ギガバイト': 'ギガバイト', 'テラバイト': 'テラバイト',
    'ペタバイト': 'ペタバイト', 'ビット': 'ビット',
    'ヘルツ': 'ヘルツ', 'キロヘルツ': 'キロヘルツ',
    'メガヘルツ': 'メガヘルツ', 'ギガヘルツ': 'ギガヘルツ',
    'ワット': 'ワット', 'キロワット': 'キロワット',
    'ミリワット': 'ミリワット', 'メガワット': 'メガワット',
    'ギガワット': 'ギガワット',
    'ボルト': 'ボルト', 'ミリボルト': 'ミリボルト',
    'アンペア': 'アンペア', 'ミリアンペア': 'ミリアンペア',
    'ルクス': 'ルクス', 'デシベル': 'デシベル',
    'フレーム': 'フレーム', 'ピクセル': 'ピクセル', 'セル': 'セル',
    // Containers / misc
    'パック': 'パック', 'ボトル': 'ボトル', 'アンプル': 'アンプル',
    'カロリー': 'カロリー', 'ケース': 'ケース',
})

// ── 4. Single-kanji reading overrides ──────────────────────────────────
// Standalone kanji where the kusamoji main-dict (NEologd) default reading
// is a name (nanori) or rare reading that's wrong for ordinary text. These
// overrides apply AT THE TOKEN LEVEL when the token surface is exactly the
// kanji (1 char, not part of a larger compound the tokenizer handled).
//
// Do NOT grow this list broadly — add entries only when a real-world test
// produces the wrong reading. Each entry should have a clear "prefer word-
// reading over nanori" justification. NEologd's default for these kanji is
// a person/place-name reading that's never correct in ordinary text.
export const SINGLE_KANJI_READING_OVERRIDES = Object.freeze({
    '館': 'カン',   // default (nanori): タテ/ダテ → override to word reading カン
})

// ── 5. Compound blocklist — don't rewrite when the "counter" is actually ─
// the first kanji of a longer compound (e.g., 6年生 → ロクネンセイ, NOT
// 6ネン+生). At the token level, kusamoji usually compounds these naturally
// so we rarely need this — but retained as a safety net for edge cases
// where the tokenizer segments `<digits><counter><next-kanji>` as
// `[<digits><counter>][<next-kanji>]` instead of one compound.
//
// Entries are EXACTLY 2 kanji — the counter + the kanji that must not be
// split off. `parseDigitCounter` rejects a surface whose tail exactly
// matches one of these.
export const COMPOUND_BLOCKLIST = new Set([
    '年生',   // 6年生 → rokunensei (grade)
    '年間',   // 5年間 → gonenkan (period of N years)
    '月末',   // 3月末 → sangatsu-matsu
    '月間',   // 3月間 → sangatsukan
    '日夜',   // 7日夜 → nichiya
    '日間',   // 3日間 — nichikan
    '時々',   // 1時々 — edge case
])

// Sort counter keys by length desc so longer counters (号室, 時間, 丁目,
// 週間, ヶ月, 番地) match before their shorter prefixes (号, 時, 丁, 週, 月, 番).
const COUNTER_KEYS_DESC = Object.freeze(
    Object.keys(COUNTER_KATAKANA).sort((a, b) => b.length - a.length)
)

/**
 * Parse a token surface into { digits, counterKanji } if it matches the
 * `<one or more ASCII digits><known counter kanji>` pattern. Returns null
 * otherwise. Fullwidth digits are not handled here — they're expected to
 * have been normalized to halfwidth by `normalize-input.js` upstream of
 * tokenization.
 *
 * @param {string} surface
 * @returns {{ digits: string, counterKanji: string } | null}
 */
export function parseDigitCounter(surface) {
    const m = surface.match(/^(\d+)(.+)$/)
    if (!m) return null
    const [, digits, tail] = m
    if (COMPOUND_BLOCKLIST.has(tail)) return null
    // Longest-match on counter to prefer 号室 over 号, 時間 over 時, etc.
    for (const c of COUNTER_KEYS_DESC) {
        if (tail === c) return { digits, counterKanji: c }
    }
    return null
}

/**
 * Emit the counter-aware reading for a token, or null if the token is not
 * a `<digits><counter>` compound.
 *
 * @param {{ surface_form: string, reading: string }} token
 * @param {{ preserveDigits: boolean, to: 'hiragana' | 'katakana' }} opts
 * @returns {string | null} the kana string (in requested target script), or null to fall through
 */
export function emitCounterReading(token, opts) {
    const parsed = parseDigitCounter(token.surface_form)
    if (!parsed) return null
    const { digits, counterKanji } = parsed
    const surface = token.surface_form

    let kana
    if (opts.preserveDigits) {
        // Build `<ASCII digits><base counter reading>`. Straightforward
        // concatenation — no rendaku applied. See the comment on
        // COUNTER_KATAKANA above for the rationale.
        kana = digits + COUNTER_KATAKANA[counterKanji]
    } else {
        // Use an explicit irregular override if provided; fall back to the
        // tokenizer's native reading (which NEologd already handles well).
        kana = IRREGULAR_COUNTER_KANA[surface] ?? token.reading
    }

    return opts.to === 'hiragana' ? toRawHiragana(kana) : kana
}

/**
 * Override the reading of a standalone single-kanji token when the main
 * dict's default is a nanori / rare reading that's wrong for ordinary
 * text. Returns the override kana (in requested target script) or null
 * to fall through to the token's own reading.
 *
 * @param {{ surface_form: string }} token
 * @param {{ to: 'hiragana' | 'katakana' }} opts
 * @returns {string | null}
 */
export function overrideSingleKanjiReading(token, opts) {
    if (!token?.surface_form || token.surface_form.length !== 1) return null
    const kana = SINGLE_KANJI_READING_OVERRIDES[token.surface_form]
    if (!kana) return null
    return opts.to === 'hiragana' ? toRawHiragana(kana) : kana
}

/**
 * When preserveDigits=true, emit the surface of a pure-ASCII-digit token
 * (e.g. `87`, `360`) instead of its kana reading. This preserves digit runs
 * for cases the tokenizer splits as separate tokens — notably `<digits>` +
 * `<katakana loanword counter>` (87パーセント, 360キロ, 500ミリリットル) and
 * bare digit runs (2026, 1-1-1) where no counter suffix follows.
 *
 * Combined `<digits><counter>` tokens are already handled by
 * `emitCounterReading`; this helper only triggers when that path returned
 * null (i.e. the token had no counter-kanji tail), so the two never overlap.
 *
 * Returns the surface as-is (ASCII digits are script-agnostic) or null to
 * fall through.
 *
 * @param {{ surface_form: string }} token
 * @param {{ preserveDigits: boolean }} opts
 * @returns {string | null}
 */
export function preserveDigitToken(token, opts) {
    if (!opts.preserveDigits) return null
    if (!token?.surface_form) return null
    if (!/^\d+$/.test(token.surface_form)) return null
    return token.surface_form
}

// Digit-by-digit kana reading map.
// Used when preserveDigits=false for bare-digit tokens that kusamoji left
// with `reading === surface` (it only produces compound number readings
// when a counter follows). For product/model numbers like `530-6k`, a
// digit-by-digit reading (ゴ・サン・レイ) is the natural pronunciation and
// the closest safe default when there's no counter-driven context.
//
// Choice of variant (e.g. 0 → レイ not ゼロ, 4 → ヨン not シ, 7 → ナナ not
// シチ, 9 → キュウ not ク) matches the modern spoken-Japanese convention
// for reading loose digit sequences.
const DIGIT_TO_KANA = Object.freeze({
    '0': 'レイ',
    '1': 'イチ',
    '2': 'ニ',
    '3': 'サン',
    '4': 'ヨン',
    '5': 'ゴ',
    '6': 'ロク',
    '7': 'ナナ',
    '8': 'ハチ',
    '9': 'キュウ',
})

/**
 * When preserveDigits=false, read a pure-ASCII-digit token digit-by-digit
 * as kana. This is the counterpart to `preserveDigitToken`: one fires
 * when the user wants digits preserved as glyphs; this one fires when
 * they want digits spoken.
 *
 * Triggers only on tokens whose surface is `^\d+$` — counter-compound
 * tokens (`1本`, `4月`, `530円`) are handled by `emitCounterReading`
 * before this helper runs and their compound readings are used; they
 * never reach this fallback.
 *
 * Example: `530-6k` tokenizes to [530][-][6][k]. With preserveDigits=false:
 *   530 → ゴサンレイ   (via this helper)
 *   -   → - (passthrough)
 *   6   → ロク        (via this helper)
 *   k   → k           (passthrough — non-digit)
 *
 * @param {{ surface_form: string }} token
 * @param {{ preserveDigits: boolean, to: 'hiragana' | 'katakana' }} opts
 * @returns {string | null}
 */
export function readDigitTokenAsKana(token, opts) {
    if (opts.preserveDigits) return null
    if (!token?.surface_form) return null
    if (!/^\d+$/.test(token.surface_form)) return null
    let kana = ''
    for (const d of token.surface_form) kana += DIGIT_TO_KANA[d]
    return opts.to === 'hiragana' ? toRawHiragana(kana) : kana
}

/**
 * Text-level counterpart to `readDigitTokenAsKana` — replaces every digit
 * run inside `text` with its digit-by-digit kana reading. Non-digit chars
 * (letters, hyphens, kanji, punctuation, etc.) pass through unchanged.
 *
 * Used for ASCII-dominant input runs that `segmentMixed` classifies as
 * `foreign` and passes through without tokenization. A bare product-code
 * like `530-6k` never reaches the token-level emit chain (it's not in a
 * Japanese segment), so the token helper alone isn't enough — this
 * text-level pass covers that path.
 *
 * Example:
 *   digitsToKanaInText('530-6k', { to: 'hiragana' }) → 'ごさんれい-ろくk'
 *   digitsToKanaInText('tel 03-1234-5678', { to: 'katakana' })
 *     → 'tel レイサン-イチニサンヨン-ゴロクナナハチ'
 *
 * @param {string} text
 * @param {{ to: 'hiragana' | 'katakana' }} opts
 * @returns {string}
 */
export function digitsToKanaInText(text, opts) {
    if (!text) return text
    return text.replace(/\d+/g, (run) => {
        let kana = ''
        for (const d of run) kana += DIGIT_TO_KANA[d]
        return opts.to === 'hiragana' ? toRawHiragana(kana) : kana
    })
}
