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
const kusamoji = require('kusamoji')

// 1. Build a kusamoji tokenizer (loads the dictionary from .dat files)
const tokenizer = await kusamoji.builder({ dicPath: '/path/to/dict' }).buildAsync()
console.log('Tokenizer ready —', tokenizer.tokenize('テスト').length, 'tokens')

// 2. Create an analyzer adapter and initialize kusanaji
//    (KusanajiAnalyzer wraps kusamoji internally — you can also
//    pass dictPath directly and skip the manual tokenizer build)
const kusanaji = new Kusanaji()
const analyzer = new KusanajiAnalyzer({ dictPath: '/path/to/dict' })
await kusanaji.init(analyzer)

// 3. Convert Japanese text
const romaji = await kusanaji.convert('東京タワーに行きました', {
    to: 'romaji',
    mode: 'spaced',
})
console.log(romaji)
// → tōkyō tawā ni ikimashita

const hiragana = await kusanaji.convert('東京タワーに行きました', {
    to: 'hiragana',
    mode: 'normal',
})
console.log(hiragana)
// → とうきょうたわーにいきました

const furigana = await kusanaji.convert('漢字を勉強する', {
    to: 'hiragana',
    mode: 'furigana',
})
console.log(furigana)
// → <ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>を<ruby>勉強<rp>(</rp><rt>べんきょう</rt><rp>)</rp></ruby>する
```

### How the three packages connect

```
npm install kusamoji kusanaji kusanaji-analyzer
```

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

## What kusanaji handles

Real-world Japanese text is messy — mixed scripts, fullwidth characters, traditional kanji, counters with irregular readings, URLs, brand names, and date formats all in one paragraph. Kusanaji normalizes and converts all of it.

### Mixed-language text

ASCII, URLs, numbers, and Japanese in the same input. Each script type is segmented and handled correctly:

```js
await kusanaji.convert('Google Chromeの最新版v136.0がリリースされた', {
    to: 'romaji',
    mode: 'spaced',
})
// → Google Chrome no saishinban v136.0 ga riīsu sareta
```

### Fullwidth ASCII normalization

Fullwidth Latin characters (Ｅ, ＹＯＳＨＩＫＩ, ＪＲ) are normalized to halfwidth before segmentation:

```js
await kusanaji.convert('ＪＲ東日本とＹＯＳＨＩＫＩが共演', {
    to: 'romaji',
    mode: 'spaced',
})
// → JR higashinihon to YOSHIKI ga kyōen
```

### Kyūjitai (旧字体) → shinjitai (新字体)

Traditional kanji forms from Macau, Taiwan, or historical text are normalized to post-1946 simplified forms (~284 mappings) so the tokenizer can look them up:

```js
await kusanaji.convert('綜合醫院で發表された聲明', {
    to: 'romaji',
    mode: 'spaced',
})
// → sōgō iin de happyō sareta seimei

// Without normalization, 醫/聲/發 would leak as raw kanji
```

### Counter readings

Japanese counters have irregular readings with sokuon (促音) and rendaku (連濁). The tokenizer resolves all counter readings natively from the dictionary:

```js
// Irregular counters — sokuon, rendaku, idiomatic readings
await kusanaji.convert('1本のペンと3月9日', { to: 'romaji', mode: 'spaced' })
// → ippon no pen to sangatsu kokonoka

// Large numbers and compound counters
await kusanaji.convert('100人の学生が参加', { to: 'romaji', mode: 'spaced' })
// → hyakunin no gakusei ga sanka
```

### Particle override

は, へ, を are romanized by their spoken pronunciation (wa, e, o) when used as particles:

```js
await kusanaji.convert('東京へ行きました', { to: 'romaji', mode: 'spaced' })
// → tōkyō e ikimashita

await kusanaji.convert('私は本を読む', { to: 'romaji', mode: 'spaced' })
// → watashi wa hon o yomu
```

### Verb form joining

Inflected verb forms are glued back together across all 5 romanization systems, including nihon-shiki/kunrei-shiki `si`/`ti` variants:

```js
await kusanaji.convert('有効にしてください', { to: 'romaji', mode: 'spaced' })
// → yūkō ni shite kudasai    (not "shi te kudasai")
```

### Furigana (HTML ruby)

Kanji get `<ruby>` annotations while kana and non-Japanese text pass through:

```js
await kusanaji.convert('藤井聡太が王将戦に挑戦する', {
    to: 'hiragana',
    mode: 'furigana',
})
// → <ruby>藤井<rp>(</rp><rt>ふじい</rt><rp>)</rp></ruby>
//   <ruby>聡太<rp>(</rp><rt>そうた</rt><rp>)</rp></ruby>が
//   <ruby>王将<rp>(</rp><rt>おうしょう</rt><rp>)</rp></ruby>
//   <ruby>戦<rp>(</rp><rt>せん</rt><rp>)</rp></ruby>に
//   <ruby>挑戦<rp>(</rp><rt>ちょうせん</rt><rp>)</rp></ruby>する
```

### Okurigana

Parenthesized readings alongside the original kanji:

```js
await kusanaji.convert('環境問題を考える', {
    to: 'hiragana',
    mode: 'okurigana',
})
// → 環境(かんきょう)問題(もんだい)を考(かんが)える
```

### Kanji fallback (JMdict/JMnedict)

Rare kanji that the primary tokenizer can't read get looked up in a 680K-entry JMdict/JMnedict fallback dictionary:

```js
await kusanaji.convert('彙報を纏める', { to: 'romaji', mode: 'spaced' })
// → ihō o matomeru
// 彙 is rare but covered by JMdict fallback
```

### Japanese punctuation normalization

In romaji output, Japanese punctuation (、。「」【】etc.) is normalized to ASCII equivalents:

```js
await kusanaji.convert('東京、大阪、名古屋。', { to: 'romaji', mode: 'normal' })
// → tōkyō, ōsaka, nagoya.
// 、→ ,   。→ .
```

### Five romanization systems

The same input produces different output depending on the system:

```js
const text = '東京都庁舎'

// Modified Hepburn (built-in via kusanaji.convert)
;('tōkyō tochōsha')

// Traditional Hepburn
;('tōkyō tochōsha')

// Nihon-shiki (日本式)
;('tōkyō totyōsya')

// Kunrei-shiki (訓令式)
;('tôkyô totyôsya')

// Wapuro (ワープロ式)
;('toukyou tochousha')
```

### All-at-once: real-world news text

A single input exercising mixed language, counters, fullwidth, particles, and punctuation:

```js
await kusanaji.convert('セブン＆アイHDは2026年4月9日、綜合醫院で記者会見を開き「売上は前期比4.7%増」と發表した。', { to: 'romaji', mode: 'spaced' })
// → sebun & aiHD wa 2026 nen shigatsu kokonoka,
//   sōgō iin de kishakiken o hiraki
//   "uriage wa zenki hi 4.7% zō" to happyō shita.
```

## API

### `kusanaji.init(analyzer)`

Initialize with a morphological analyzer. Must be called before `convert()`.

```js
const analyzer = new KusanajiAnalyzer({ dictPath: '/path/to/dict' })
await kusanaji.init(analyzer)
```

### `kusanaji.convert(text, options)` → `Promise<string>`

Convert Japanese text.

| Option         | Type     | Values                                              | Default     |
| -------------- | -------- | --------------------------------------------------- | ----------- |
| `to`           | `string` | `"hiragana"`, `"katakana"`, `"romaji"`              | required    |
| `mode`         | `string` | `"normal"`, `"spaced"`, `"okurigana"`, `"furigana"` | `"normal"`  |
| `romajiSystem` | `string` | `"hepburn"`, `"nippon"`, `"passport"`               | `"hepburn"` |

### Output modes

| Mode        | Input      | Output (hiragana)                                      |
| ----------- | ---------- | ------------------------------------------------------ |
| `normal`    | 東京タワー | とうきょうたわー                                       |
| `spaced`    | 東京タワー | とうきょう たわー                                      |
| `okurigana` | 東京タワー | 東京(とうきょう)タワー                                 |
| `furigana`  | 漢字       | `<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>` |

### `Kusanaji.Util`

Static utility functions:

```js
Kusanaji.Util.hasKanji('漢字') // true
Kusanaji.Util.hasHiragana('ひらがな') // true
Kusanaji.Util.hasKatakana('カタカナ') // true
Kusanaji.Util.hasJapanese('hello') // false
Kusanaji.Util.isKanji('漢') // true
Kusanaji.Util.isKana('あ') // true
```

## Conversion Pipeline

Kusanaji includes a full conversion pipeline with subpath exports for advanced use:

```js
// Pre-processing passes (reading overrides)
import { runPrePasses } from 'kusanaji/pipeline'

// Romaji emitters (5 romanization systems)
import { emitRomaji } from 'kusanaji/romaji'

// Kana emitter
import { emitKana } from 'kusanaji/kana'

// Mixed-language text segmentation (splits ASCII vs Japanese)
import { segmentMixed } from 'kusanaji/text'

// JMdict/JMnedict kanji fallback lookup
import { initKanjiFallback, applyKanjiFallback } from 'kusanaji/text/kanji-fallback'

// Post-tokenization UNKNOWN token recovery
import { resolveUnknownTokens } from 'kusanaji/text/unknown-fallback'

// Japanese punctuation → ASCII normalization
import { normalizeJpPunctuation } from 'kusanaji/text/jp-punctuation'
```

All pipeline functions use **dependency injection** — pass your own kusanaji/tokenizer/romanize instances via a `deps` object. Zero runtime dependencies.

### Pipeline order

```
Input text
  → normalizeInput()           fullwidth→halfwidth letters, kyūjitai→shinjitai
  → segmentMixed()             split ASCII vs Japanese segments
  → runPrePasses()             reading overrides (minimal — tokenizer handles counters/digits)
  → tokenizer                  NEologd dictionary resolves all readings
  → emitRomaji() / emitKana()  convert tokens to romaji or kana
  → applyKanjiFallback()       best-effort JMdict lookup for remaining kanji
  → normalizeJpPunctuation()   、→, 。→. 〜→~ (romaji only)
  → output
```

### Romanization systems

| System                | Example (東京) | Via                                                 |
| --------------------- | -------------- | --------------------------------------------------- |
| Modified Hepburn      | tōkyō          | `kusanaji.convert()` (built-in)                     |
| Traditional Hepburn   | tōkyō          | `emitRomaji()` with `system: "traditional-hepburn"` |
| Nihon-shiki (日本式)  | toukyou        | `emitRomaji()` with `system: "nihon-shiki"`         |
| Kunrei-shiki (訓令式) | tôkyô          | `emitRomaji()` with `system: "kunrei-shiki"`        |
| Wapuro (ワープロ式)   | toukyou        | `emitRomaji()` with `system: "wapuro"`              |

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
