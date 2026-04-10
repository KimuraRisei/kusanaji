# Kusanaji 草薙

Japanese text converter — transforms mixed Japanese text (kanji, hiragana, katakana) into romaji, hiragana, katakana, or furigana (HTML ruby).

## Install

```
npm install kusanaji
```

## Usage

```js
import Kusanaji from 'kusanaji';
import KusanajiAnalyzer from 'kusanaji-analyzer';

const kusanaji = new Kusanaji();
await kusanaji.init(new KusanajiAnalyzer());

const result = await kusanaji.convert('東京タワー', { to: 'romaji', mode: 'spaced' });
// → tōkyō tawā
```

### Output modes

| Mode | Example |
|---|---|
| `normal` | `とうきょうたわー` |
| `spaced` | `とうきょう たわー` |
| `okurigana` | `東京(とうきょう)タワー` |
| `furigana` | `<ruby>東京<rt>とうきょう</rt></ruby>タワー` |

## License

BSL 1.1