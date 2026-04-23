# Kusanaji 草薙

Powerful Japanese text processor for Node.js — romaji conversion, hiragana, katakana, furigana with prepasses, mixed-language segmentation, traditional to modern kanji conversion, unicode normalization and kanji fallback.

Built to work with [Kusamoji](https://github.com/KimuraRisei/kusamoji) as the morphological analyzer backend.

## Install

```bash
pnpm install kusanaji kusamoji kusanaji-analyzer
```

or

```bash
npm install kusanaji kusamoji kusanaji-analyzer
```

Three packages work together:

| Package                                                              | Role                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| [kusamoji](https://www.npmjs.com/package/kusamoji)                   | Tokenizer — splits Japanese text into morphemes with readings |
| **kusanaji** (this package)                                          | Converter — transforms tokens into romaji/kana/furigana       |
| [kusanaji-analyzer](https://www.npmjs.com/package/kusanaji-analyzer) | Adapter — bridges kusamoji into kusanaji's analyzer interface |

## Quick Start

```js
const Kusanaji = require('kusanaji')
const KusanajiAnalyzer = require('kusanaji-analyzer')

const kusanaji = new Kusanaji()
const analyzer = new KusanajiAnalyzer({ dictPath: '/path/to/dict' })
await kusanaji.init(analyzer)

await kusanaji.convert('東京タワーに行きました', { to: 'romaji',   mode: 'spaced' })
// → tōkyō tawā ni ikimashita

await kusanaji.convert('東京タワーに行きました', { to: 'hiragana', mode: 'normal' })
// → とうきょうたわーにいきました

await kusanaji.convert('漢字を勉強する',         { to: 'hiragana', mode: 'furigana' })
// → <ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>を
//   <ruby>勉強<rp>(</rp><rt>べんきょう</rt><rp>)</rp></ruby>する
```

### How the three packages connect

```
kusamoji               loads dictionary, tokenizes text (Viterbi algorithm)
    ↓
kusanaji-analyzer      adapter — wraps kusamoji.tokenize() into init() + parse()
    ↓
kusanaji               converter — takes tokens, outputs romaji/kana/furigana
```

- **kusamoji** does the heavy lifting: loads 12 `.dat` dictionary files via mmap, runs Viterbi segmentation, returns tokens with POS tags and readings.
- **kusanaji-analyzer** is a thin adapter (~70 lines) that calls `kusamoji.builder({ dicPath }).buildAsync()` internally and reshapes the token output to match kusanaji's expected format.
- **kusanaji** receives the parsed tokens and converts them to the target script (romaji, hiragana, katakana, or furigana).

You can also use **kusamoji directly** without kusanaji if you only need tokenization:

```js
const kusamoji = require('kusamoji')
const tokenizer = await kusamoji.builder({ dicPath: '/path/to/dict' }).buildAsync()
const tokens = tokenizer.tokenize('東京タワーに行きました')
tokens.forEach((t) => console.log(t.surface_form, t.reading, t.pos))
```

### Dictionary files

kusamoji requires a pre-compiled IPADIC dictionary (12 `.dat` files). See [kusamoji's README](https://github.com/KimuraRisei/kusamoji#dictionary-files) for how to obtain or build one.

For maximum accuracy with proper nouns and modern vocabulary, use an IPADIC + NEologd dictionary.

## Gallery — complex real-world text

The following single-sentence inputs exercise many features simultaneously — mixed scripts, counters, dates, fullwidth chars, kyūjitai, ASCII numerics, and punctuation. The output column shows `to: 'romaji', mode: 'spaced'` with Modified Hepburn unless noted.

| Scenario | Input → Output |
|---|---|
| **Date + counter + particle** | `2026年4月1日は年度始めです。`<br>→ `nisennijūrokunen shigatsu tsuitachi wa nendohajime desu.` |
| **Idiomatic 月 + 日** | `1日から10日までは繁忙期です。`<br>→ `tsuitachi kara tōka made wa hanbōki desu.` |
| **Rendaku counter (本)** | `ビールを1本、ワインを3本、水を10本買った。`<br>→ `bīru o ippon , wain o sambon , mizu o juppon katta.` |
| **Mixed EN/JP product text** | `Google Chrome の最新版v136.0がリリースされた。`<br>→ `Google Chrome no saishinban v136.0 ga riīsu sareta.` |
| **Japanese address (HW digits + compound counters)** | `東京都千代田区丸の内1-1-1 新丸ビル3階`<br>→ `tōkyōtochiyodakumarunōchi 1-1-1 shimmarubirusankai` |
| **Fullwidth address normalization** | `横浜市西区みなとみらい２－３－５クイーンズタワー`<br>→ `yokohamashinishikuminatomirai 2-3-5 kuīnzu tawā` |
| **Kyūjitai in news headline** | `綜合醫院で發表された聲明が話題になった。`<br>→ `sōgō iin de happyō sareta seimei ga wadai ni natta.` |
| **Daiji in formal text** | `弐万五千円を壱号館で受け取る。`<br>→ `nimangosen'en o ichi gōkan de uketoru.` (弐→二, 壱→一 normalized) |
| **Proper nouns + particles** | `藤井聡太が王将戦に挑戦する。`<br>→ `fujii souta ga ōshōsen ni chōsen suru.` |
| **Percent + digits in news** | `100人の学生のうち、87パーセントが合格した。`<br>→ `hyakunin no gakusei no uchi , hachijuunanapāsento ga gōkaku shita.` |
| **Punctuation normalization** | `東京、大阪、名古屋——三大都市。`<br>→ `tōkyō, ōsaka, nagoya - - sandaitoshi.` |
| **Nihon-shiki vs Hepburn** | `日本語の勉強を始めました` (Nihon-shiki)<br>→ `nihongo no benkyô o hazimemasita` |
| **Wapuro (macron-free)** | `この映画は本当に面白かった` (Wapuro)<br>→ `kono eiga wa hontouni omoshiroka' ta` |

Every example in this gallery is regression-tested against the running pipeline.

## Feature details

### Five romanization systems

Same input, five outputs — pick whichever best fits your pipeline. **Modified Hepburn** (default) is the everyday output; **Traditional Hepburn** differs only in `m` vs `n` before labials; **Nihon-shiki** and **Kunrei-shiki** use `si/ti/tu` with a circumflex on long vowels; **Wapuro** is the plain ASCII input-method style.

```js
const input = '東京都庁舎は新宿にあります'

await kusanaji.convert(input, { to: 'romaji', romajiSystem: 'hepburn' })
// Modified Hepburn      → tōkyōtochōsha wa shinjuku ni arimasu

// via emitRomaji() with explicit systems:
emitRomaji(..., { system: 'traditional-hepburn' })
// Traditional Hepburn   → tōkyōtochōsha wa shinjuku ni arimasu

emitRomaji(..., { system: 'nihon-shiki' })
// Nihon-shiki (日本式)   → tôkyôtotyôsya wa sinzyuku ni arimasu

emitRomaji(..., { system: 'kunrei-shiki' })
// Kunrei-shiki (訓令式)  → tôkyôtotyôsya wa sinzyuku ni arimasu

emitRomaji(..., { system: 'wapuro' })
// Wapuro (ワープロ式)    → toukyoutochousha wa shinjuku ni arimasu
```

### Four output modes

```js
const input = '環境問題を考える'

await kusanaji.convert(input, { to: 'hiragana', mode: 'normal' })
// → かんきょうもんだいをかんがえる

await kusanaji.convert(input, { to: 'hiragana', mode: 'spaced' })
// → かんきょう もんだい を かんが える

await kusanaji.convert(input, { to: 'hiragana', mode: 'okurigana' })
// → 環境(かんきょう)問題(もんだい)を考(かんが)える

await kusanaji.convert(input, { to: 'hiragana', mode: 'furigana' })
// → <ruby>環境<rt>かんきょう</rt></ruby><ruby>問題<rt>もんだい</rt></ruby>を
//   <ruby>考<rt>かんが</rt></ruby>える
```

All four modes work with `to: 'hiragana'`, `to: 'katakana'`, and `to: 'romaji'`.

### Counter readings — rendaku, sokuonbika, idiomatic forms

Japanese counters have a menagerie of irregular readings. The tokenizer resolves them from the dictionary; kusanaji's `counter-table.js` adds the long tail of ~330 rendaku/sokuonbika overrides and a `preserveDigitToken` fallback for digit-counter pairs the tokenizer splits.

```js
// 本 — sokuonbika at 1/6/8/10, rendaku at 3
'1本のビール'   → 'イッポン ノ ビール'     // ippon
'3本の鉛筆'     → 'サンボン ノ エンピツ'   // sanbon (rendaku)
'6本のバラ'     → 'ロッポン ノ バラ'       // roppon
'10本の線'      → 'ジッポン ノ セン'       // jippon

// 月 + 日 — calendar-idiomatic
'1月'  → 'イチガツ'     '4月'  → 'シガツ'     '9月'  → 'クガツ'
'1日'  → 'ツイタチ'     '4日'  → 'ヨッカ'     '20日' → 'ハツカ'

// 時 / 時間 — irregular at 4/7/9
'4時30分'    → 'ヨジサンジップン'
'7時間'      → 'シチジカン'

// Loanword counters (no rendaku, base = surface)
'87パーセント'  → 'ハチジュウナナパーセント'
'360キロ'      → 'サンビャクロクジュウキロ'
'500ミリリットル' → 'ゴヒャクミリリットル'
'¥1,500'       → (kept as-is; use `outputFullWidth` to render ￥１，５００)

// Building/disaster counters
'マンション5棟が倒壊' → 'マンション　ゴトウ　ガトウカイ'   // 5棟 = gotō
'被災で100棟焼失'    → 'ヒサイ　デ　ヒャットウ　ショウシツ' // 100棟 = hyattō
```

All counter examples above use `to: 'katakana', mode: 'normal'`.

### Keep digits as-is + output in full-width (address/invoice rendering)

Two flags control numeric preservation and full-width rendering — commonly used together to render Japanese addresses or invoices where ASCII digits should stay visually grouped but in full-width form:

```js
// Default: digits expanded to kanji-numeral kana readings
await kusanaji.convert('1-408号室', { to: 'katakana' })
// → イチハチヨンマルハチゴウシツ    (unusable as an address label)

// keepOriginalNumbers: digits stay as ASCII glyphs
await kusanaji.convert('1-408号室', {
    to: 'katakana',
    keepOriginalNumbers: true,
})
// → 1-408ゴウシツ                  (legible)

// keepOriginalNumbers + outputFullWidth: full Japanese-style glyphs
await kusanaji.convert('東京都千代田区丸の内1-1-1 新丸ビル3階', {
    to: 'katakana',
    keepOriginalNumbers: true,
    outputFullWidth: true,
})
// → トウキョウトチヨダクマルノウチ１－１－１　シンマルビル３カイ
```

### Fullwidth ASCII normalization (input side)

Fullwidth Latin, fullwidth digits, and the ideographic space are normalized to halfwidth before segmentation, so the tokenizer classifies them as foreign instead of folding them into Japanese-script runs:

```js
'ＪＲ東日本とＹＯＳＨＩＫＩが共演'     → 'JR higashinihon to YOSHIKI ga kyōen'
'４月１日は年度始めです'              → 'shigatsu tsuitachi wa nendohajime desu'
'価格：￥１，５００（税込）'           → 'kakaku : ¥ 1,500 ( zeikomi )'
```

### Kyūjitai (旧字体) → shinjitai (新字体)

Traditional kanji forms from Macau, Taiwan, or historical/formal text are normalized to post-1946 simplified forms (~284 mappings exposed via `KYUJITAI_TO_SHINJITAI`) so the tokenizer can look them up.

```js
'綜合醫院で發表された聲明'  → 'sōgō iin de happyō sareta seimei'   // 醫→医 發→発 聲→声
'舊車を國會で議論'          → 'kyūsha o kokkai de giron'            // 舊→旧 國→国 會→会
'學校で體操を習う'          → 'gakkō de taisō o narau'              // 學→学 體→体
'亞細亞の中心に位置する'    → 'ajia no chūshin ni ichi suru'        // 亞→亜
'濱松で公演する'            → 'hamamatsu de kōen suru'              // 濱→浜
```

Note: daiji (legal/formal numerals) `壱/弐` are also normalized to `一/二` — but `参/拾` are NOT, because they have common non-daiji meanings (参加 "participate", 拾う "pick up").

### Bidirectional half-width ↔ full-width conversion

Pure Unicode transform, pipeline-independent — exposed for callers that only need width normalization without the tokenizer.

```js
import { halfToFullWidth, fullToHalfWidth } from 'kusanaji/text'

halfToFullWidth('ABC 123-456 ｶﾀｶﾅ ｶﾞｷﾞﾊﾟ').text
// → ＡＢＣ　１２３－４５６　カタカナ　ガギパ
//   (HW→FW ASCII, HW→FW katakana with dakuten/handakuten composed)

fullToHalfWidth('ＡＢＣ　１２３　カタカナ　ガギパ').text
// → ABC 123 ｶﾀｶﾅ ｶﾞｷﾞﾊﾟ
//   (reverse — voiced FW katakana decomposed into base + ﾞ/ﾟ)

halfToFullWidth('¥1,500').text                    // → ￥１，５００
halfToFullWidth('50% → 80%').text                 // → ５０％　→　８０％
fullToHalfWidth('東京都ＡＢＣ１２３カタカナ').text  // → 東京都ABC123ｶﾀｶﾅ  (kanji untouched)
```

Every FW/HW pair defined by Unicode (via `<wide>` / `<narrow>` compatibility decomposition) is covered, including the Fullwidth Signs block (U+FFE0–FFE6 — ￠ ￡ ￢ ￣ ￤ ￥ ￦) and the Halfwidth Forms block (U+FFE8–FFEE — ￨ ← ↑ → ↓ ■ ○).

### Particle override

`は`, `へ`, `を` used as particles romanize by their spoken pronunciation:

```js
'私は本を読む'              → 'watashi wa hon o yomu'
'東京へ行きました'          → 'tōkyō e ikimashita'
'これは学校へ行く道です'    → 'kore wa gakkō e iku michi desu'
```

### Verb form joining

Inflected verb forms are glued back together across all 5 systems, including nihon-shiki/kunrei-shiki `si`/`ti` variants:

```js
'有効にしてください'         → 'yūkō ni shite kudasai'        // (not "shi te kudasai")
'勉強している'               → 'benkyō shite iru'
'書いていました'             → 'kaite imashita'
'食べたくありませんでした'   → 'tabetaku arimasen deshita'
```

### Furigana (HTML ruby)

Kanji get `<ruby>` annotations while kana and non-Japanese text pass through:

```js
await kusanaji.convert('藤井聡太が王将戦に挑戦する', { to: 'hiragana', mode: 'furigana' })
// <ruby>藤井聡太<rp>(</rp><rt>ふじいそうた</rt><rp>)</rp></ruby>が
// <ruby>王将戦<rp>(</rp><rt>おうしょうせん</rt><rp>)</rp></ruby>に
// <ruby>挑戦<rp>(</rp><rt>ちょうせん</rt><rp>)</rp></ruby>する

// Dates inside furigana — readings come out idiomatic:
await kusanaji.convert('2026年4月9日に発表する', { to: 'hiragana', mode: 'furigana' })
// <ruby>2026年<rt>にせんにじゅうろくねん</rt></ruby>
// <ruby>4月<rt>しがつ</rt></ruby>
// <ruby>9日<rt>ここのか</rt></ruby>
// に<ruby>発表<rt>はっぴょう</rt></ruby>する
```

### Okurigana mode

Parenthesized readings alongside the original kanji — useful for learner-facing displays:

```js
'環境問題を考える'             → '環境(かんきょう)問題(もんだい)を考(かんが)える'
'今日は4月9日の木曜日です。'   → '今日(きょう)は4月(しがつ)9日(ここのか)の木曜日(もくようび)です。'
```

### Kanji fallback (JMdict/JMnedict)

Rare kanji that the primary tokenizer can't read are looked up in a 680K-entry JMdict/JMnedict fallback dictionary:

```js
'彙報を纏める'         → 'ihō o matomeru'       // 彙 rare, 纏 rare
'曠野に佇む'           → 'kōya ni tatazumu'
'齟齬が生じる'         → 'sogo ga shōjiru'
```

### Japanese punctuation normalization (romaji)

In romaji output, Japanese punctuation (`、 。「」【】 〜 …`) and ~80 other symbols are normalized to ASCII equivalents:

```js
'東京、大阪、名古屋。'          → 'tōkyō, ōsaka, nagoya.'
'「本当？」と聞いた'            → '"hontō?" to kiita'
'【重要】会議は午後3時～4時'    → '[jūyō] kaigi wa gogo sanji ~ yoji'
'これは…難しい問題だ'           → 'kore wa... muzukashii mondai da'
```

The CJK/editorial symbol table lives in [src/text/jp-punctuation.js](src/text/jp-punctuation.js); it also handles smart quotes (`"" ''`), em/en dashes (`— –`), hyphen variants (`‐ ‑ ‒`), reference marks (`※ † ‡ •`), per-mille (`‰`), and prime symbols (`′ ″`).

## API reference

### `kusanaji.init(analyzer)`

Initialize with a morphological analyzer. Must be called before `convert()`.

```js
const analyzer = new KusanajiAnalyzer({ dictPath: '/path/to/dict' })
await kusanaji.init(analyzer)
```

### `kusanaji.convert(text, options)` → `Promise<string>`

Convert Japanese text.

| Option                      | Type      | Values                                              | Default     |
| --------------------------- | --------- | --------------------------------------------------- | ----------- |
| `to`                        | `string`  | `"hiragana"`, `"katakana"`, `"romaji"`              | required    |
| `mode`                      | `string`  | `"normal"`, `"spaced"`, `"okurigana"`, `"furigana"` | `"normal"`  |
| `romajiSystem`              | `string`  | `"hepburn"`, `"nippon"`, `"passport"`               | `"hepburn"` |
| `preserveDigitsInCounters`  | `boolean` | keep `<digits><counter>` pairs with ASCII digits    | `false`     |

### `Kusanaji.Util`

Static utility functions:

```js
Kusanaji.Util.hasKanji('漢字')         // true
Kusanaji.Util.hasHiragana('ひらがな')  // true
Kusanaji.Util.hasKatakana('カタカナ')  // true
Kusanaji.Util.hasJapanese('hello')     // false
Kusanaji.Util.isKanji('漢')            // true
Kusanaji.Util.isKana('あ')             // true
```

## Pipeline subpath exports (advanced)

Kusanaji exposes its internal pipeline through **five subpath exports only**. Each is a barrel (`index.js`) that re-exports the relevant symbols — consumers should import from these entries rather than reaching into individual source files.

```js
// ── Root: high-level class ─────────────────────────────────────────
import Kusanaji from 'kusanaji'

// ── Pipeline orchestration ─────────────────────────────────────────
import { runPrePasses } from 'kusanaji/pipeline'

// ── Romaji layer ───────────────────────────────────────────────────
import {
    emitRomaji,
    JAPANESE_PRESET_BY_SYSTEM, WAPURO_CONFIG,
    stripMacrons, macronToCircumflex,
} from 'kusanaji/romaji'

// ── Kana layer ─────────────────────────────────────────────────────
import { emitKana } from 'kusanaji/kana'

// ── Text utilities ─────────────────────────────────────────────────
import {
    // segmentation
    segmentMixed, hasJapanese,
    // JMdict/JMnedict fallback
    initKanjiFallback, applyKanjiFallback, isFallbackReady,
    loadFallbackFromBinary, loadFallbackFromCsv,
    // unknown-token recovery
    resolveUnknownTokens,
    // punctuation
    JP_PUNCT_TO_ASCII, normalizeJpPunctuation,
    // kana-script helpers
    katakanaToHiragana, hasKana, normalizeReading,
    // width conversion — bidirectional + raw tables
    halfToFullWidth, fullToHalfWidth, detectWidth, getWidthStats,
    toFullWidthOutput,
    FULLWIDTH_TO_HALFWIDTH_KATAKANA, HALFWIDTH_TO_FULLWIDTH_KATAKANA,
    FULLWIDTH_TO_HALFWIDTH_EXTRA, HALFWIDTH_TO_FULLWIDTH_EXTRA,
    // input normalization + kyūjitai map
    KYUJITAI_TO_SHINJITAI, normalizeInput,
} from 'kusanaji/text'
```

All pipeline functions use **dependency injection** — pass your own kusanaji/tokenizer/romanize instances via a `deps` object. Zero runtime dependencies.

### Pipeline order (how the parts compose)

```
Input text
  → normalizeInput()           fullwidth→halfwidth ASCII, kyūjitai→shinjitai
  → segmentMixed()             split ASCII vs Japanese segments
  → runPrePasses()             reading overrides (minimal — tokenizer handles counters/digits)
  → tokenizer                  NEologd dictionary resolves readings
  → emitRomaji() / emitKana()  token-level romaji / kana emission
  → applyKanjiFallback()       best-effort JMdict lookup for remaining kanji
  → normalizeJpPunctuation()   、→, 。→. 〜→~ (romaji only)
  → toFullWidthOutput()        opt-in HW→FW post-pass on kana output
  → output
```

### Romanization systems

| System                | Example (東京都庁舎) | Via                                                 |
| --------------------- | -------------------- | --------------------------------------------------- |
| Modified Hepburn      | tōkyōtochōsha        | `kusanaji.convert()` (built-in)                     |
| Traditional Hepburn   | tōkyōtochōsha        | `emitRomaji()` with `system: "traditional-hepburn"` |
| Nihon-shiki (日本式)  | tôkyôtotyôsya        | `emitRomaji()` with `system: "nihon-shiki"`         |
| Kunrei-shiki (訓令式) | tôkyôtotyôsya        | `emitRomaji()` with `system: "kunrei-shiki"`        |
| Wapuro (ワープロ式)   | toukyoutochousha     | `emitRomaji()` with `system: "wapuro"`              |

Modified Hepburn goes through kusanaji's built-in converter. The other 4 use a custom token-loop with the `japanese` package's `romanize()` function (injected by the consumer).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Your application                                     │
│                                                      │
│   kusanaji.convert("漢字テスト", { to: "romaji" })   │
│       │                                              │
│       ▼                                              │
│   ┌─────────┐     ┌──────────────────┐              │
│   │ kusanaji │────▶│ kusanaji-analyzer │              │
│   │ convert()│     │ parse()          │              │
│   └────┬─────┘     └───────┬──────────┘              │
│        │                    │                         │
│        │                    ▼                         │
│        │           ┌──────────────┐                   │
│        │           │   kusamoji   │                   │
│        │           │  tokenize()  │                   │
│        │           │  (Viterbi)   │                   │
│        │           └──────┬───────┘                   │
│        │                  │                           │
│        │    tokens with readings                      │
│        │◀─────────────────┘                           │
│        │                                              │
│        ▼                                              │
│   romaji / hiragana / katakana / furigana             │
└──────────────────────────────────────────────────────┘
```

## License

[BSL 1.1](LICENSE) — free for personal and non-commercial use. Commercial use requires a license. Change date: 4 years from release.
