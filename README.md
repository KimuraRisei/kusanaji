# Kusanaji 草薙

Japanese text converter for Node.js — transforms mixed Japanese text (kanji, hiragana, katakana) into romaji, hiragana, katakana, or furigana (HTML ruby). Supports 5 romanization systems and 4 output modes.

Built to work with [Kusamoji](https://github.com/KimuraRisei/kusamoji) as the morphological analyzer backend.

## Install

```bash
npm install kusanaji kusamoji kusanaji-analyzer
```

Three packages work together:

| Package | Role |
|---|---|
| [kusamoji](https://www.npmjs.com/package/kusamoji) | Tokenizer — splits Japanese text into morphemes with readings |
| **kusanaji** (this package) | Converter — transforms tokens into romaji/kana/furigana |
| [kusanaji-analyzer](https://www.npmjs.com/package/kusanaji-analyzer) | Adapter — bridges kusamoji into kusanaji's analyzer interface |

## Quick Start

```js
const Kusanaji = require("kusanaji");
const KusanajiAnalyzer = require("kusanaji-analyzer");
const kusamoji = require("kusamoji");

// 1. Build a kusamoji tokenizer (loads the dictionary from .dat files)
const tokenizer = await kusamoji
    .builder({ dicPath: "/path/to/dict" })
    .buildAsync();
console.log("Tokenizer ready —", tokenizer.tokenize("テスト").length, "tokens");

// 2. Create an analyzer adapter and initialize kusanaji
//    (KusanajiAnalyzer wraps kusamoji internally — you can also
//    pass dictPath directly and skip the manual tokenizer build)
const kusanaji = new Kusanaji();
const analyzer = new KusanajiAnalyzer({ dictPath: "/path/to/dict" });
await kusanaji.init(analyzer);

// 3. Convert Japanese text
const romaji = await kusanaji.convert("東京タワーに行きました", {
    to: "romaji",
    mode: "spaced",
});
console.log(romaji);
// → tōkyō tawā ni ikimashita

const hiragana = await kusanaji.convert("東京タワーに行きました", {
    to: "hiragana",
    mode: "normal",
});
console.log(hiragana);
// → とうきょうたわーにいきました

const furigana = await kusanaji.convert("漢字を勉強する", {
    to: "hiragana",
    mode: "furigana",
});
console.log(furigana);
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
const kusamoji = require("kusamoji");
const tokenizer = await kusamoji.builder({ dicPath: "/path/to/dict" }).buildAsync();
const tokens = tokenizer.tokenize("東京タワーに行きました");
tokens.forEach(t => console.log(t.surface_form, t.reading, t.pos));
```

### Dictionary files

kusamoji requires a pre-compiled IPADIC dictionary (12 `.dat` files). See [kusamoji's README](https://github.com/KimuraRisei/kusamoji#dictionary-files) for how to obtain or build one.

For maximum accuracy with proper nouns and modern vocabulary, use an IPADIC + NEologd dictionary.

## API

### `kusanaji.init(analyzer)`

Initialize with a morphological analyzer. Must be called before `convert()`.

```js
const analyzer = new KusanajiAnalyzer({ dictPath: "/path/to/dict" });
await kusanaji.init(analyzer);
```

### `kusanaji.convert(text, options)` → `Promise<string>`

Convert Japanese text.

| Option | Type | Values | Default |
|---|---|---|---|
| `to` | `string` | `"hiragana"`, `"katakana"`, `"romaji"` | required |
| `mode` | `string` | `"normal"`, `"spaced"`, `"okurigana"`, `"furigana"` | `"normal"` |
| `romajiSystem` | `string` | `"hepburn"`, `"nippon"`, `"passport"` | `"hepburn"` |

### Output modes

| Mode | Input | Output (hiragana) |
|---|---|---|
| `normal` | 東京タワー | とうきょうたわー |
| `spaced` | 東京タワー | とうきょう たわー |
| `okurigana` | 東京タワー | 東京(とうきょう)タワー |
| `furigana` | 漢字 | `<ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>` |

### `Kusanaji.Util`

Static utility functions:

```js
Kusanaji.Util.hasKanji("漢字")      // true
Kusanaji.Util.hasHiragana("ひらがな") // true
Kusanaji.Util.hasKatakana("カタカナ") // true
Kusanaji.Util.hasJapanese("hello")   // false
Kusanaji.Util.kanaToHiragana("カタカナ") // かたかな
Kusanaji.Util.kanaToKatakana("ひらがな") // ヒラガナ
```

## Conversion Pipeline

Kusanaji includes a full conversion pipeline with subpath exports for advanced use:

```js
// Pre-processing passes (counter readings, digit protection, etc.)
import { runPrePasses } from "kusanaji/pipeline";

// Romaji emitters (5 romanization systems)
import { emitRomaji } from "kusanaji/romaji";

// Kana emitter
import { emitKana } from "kusanaji/kana";

// Mixed-language text segmentation (splits ASCII vs Japanese)
import { segmentMixed } from "kusanaji/text";

// JMdict/JMnedict kanji fallback lookup
import { initKanjiFallback, applyKanjiFallback } from "kusanaji/text/kanji-fallback";

// Post-tokenization UNKNOWN token recovery
import { resolveUnknownTokens } from "kusanaji/text/unknown-fallback";

// Japanese punctuation → ASCII normalization
import { normalizeJpPunctuation } from "kusanaji/text/jp-punctuation";
```

All pipeline functions use **dependency injection** — pass your own kusanaji/tokenizer/romanize instances via a `deps` object. Zero runtime dependencies.

### Pipeline order

```
Input text
  → segmentMixed()           split ASCII vs Japanese segments
  → runPrePasses()           counter readings, reading overrides, digit protection
  → emitRomaji() / emitKana()  convert via kusanaji or custom table-loop
  → applyKanjiFallback()     best-effort lookup for any remaining kanji
  → output
```

### Romanization systems

| System | Example (東京) | Via |
|---|---|---|
| Modified Hepburn | tōkyō | `kusanaji.convert()` (built-in) |
| Traditional Hepburn | tōkyō | `emitRomaji()` with `system: "traditional-hepburn"` |
| Nihon-shiki (日本式) | toukyou | `emitRomaji()` with `system: "nihon-shiki"` |
| Kunrei-shiki (訓令式) | tôkyô | `emitRomaji()` with `system: "kunrei-shiki"` |
| Wapuro (ワープロ式) | toukyou | `emitRomaji()` with `system: "wapuro"` |

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
