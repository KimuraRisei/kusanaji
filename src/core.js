import {
    ROMANIZATION_SYSTEM,
    getStrType,
    patchTokens,
    isHiragana,
    isKatakana,
    isKana,
    isKanji,
    isJapanese,
    hasHiragana,
    hasKatakana,
    hasKana,
    hasKanji,
    hasJapanese,
    toRawHiragana,
    toRawKatakana,
    toRawRomaji,
} from "./util.js";

/**
 * Kusanaji Class
 */
class Kusanaji {
    /**
     * Constructor
     * @constructs Kusanaji
     */
    constructor() {
        this._analyzer = null;
    }

    /**
     * Initialize Kusanaji
     * @memberOf Kusanaji
     * @instance
     * @returns {Promise} Promise object represents the result of initialization
     */
    async init(analyzer) {
        if (!analyzer || typeof analyzer !== "object" || typeof analyzer.init !== "function" || typeof analyzer.parse !== "function") {
            throw new Error("Invalid initialization parameter.");
        }
        else if (this._analyzer == null) {
            await analyzer.init();
            this._analyzer = analyzer;
        }
        else {
            throw new Error("Kusanaji has already been initialized.");
        }
    }

    /**
     * Convert given string to target syllabary with options available
     * @memberOf Kusanaji
     * @instance
     * @param {string} str Given String
     * @param {Object} [options] Settings Object
     * @param {string} [options.to="hiragana"] Target syllabary ["hiragana"|"katakana"|"romaji"]
     * @param {string} [options.mode="normal"] Convert mode ["normal"|"spaced"|"okurigana"|"furigana"]
     * @param {string} [options.romajiSystem="hepburn"] Romanization System ["nippon"|"passport"|"hepburn"]
     * @param {string} [options.delimiter_start="("] Delimiter(Start)
     * @param {string} [options.delimiter_end=")"] Delimiter(End)
     * @returns {Promise} Promise object represents the result of conversion
     */
    // Escape regex special characters in a string so it can be used as a
    // literal match inside a RegExp. Without this, surface forms containing
    // ?, +, *, (, ), [, ], etc. crash the regex builder or cause catastrophic
    // backtracking.
    static _escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    async convert(str, options) {
        if (!this._analyzer) {
            throw new Error("Kusanaji not initialized — call init() first");
        }
        options = options || {};
        options.to = options.to || "hiragana";
        options.mode = options.mode || "normal";
        options.romajiSystem = options.romajiSystem || ROMANIZATION_SYSTEM.HEPBURN;
        options.delimiter_start = options.delimiter_start || "(";
        options.delimiter_end = options.delimiter_end || ")";
        str = str || "";

        if (["hiragana", "katakana", "romaji"].indexOf(options.to) === -1) {
            throw new Error("Invalid Target Syllabary.");
        }

        if (["normal", "spaced", "okurigana", "furigana"].indexOf(options.mode) === -1) {
            throw new Error("Invalid Conversion Mode.");
        }

        const ROMAJI_SYSTEMS = Object.keys(ROMANIZATION_SYSTEM).map(e => ROMANIZATION_SYSTEM[e]);
        if (ROMAJI_SYSTEMS.indexOf(options.romajiSystem) === -1) {
            throw new Error("Invalid Romanization System.");
        }

        const rawTokens = await this._analyzer.parse(str);
        const tokens = patchTokens(rawTokens);

        if (options.mode === "normal" || options.mode === "spaced") {
            switch (options.to) {
                case "katakana":
                    if (options.mode === "normal") {
                        return tokens.map(token => token.reading).join("");
                    }
                    return tokens.map(token => token.reading).join(" ");
                case "romaji":
                    const romajiConv = (token) => {
                        let preToken;
                        if (hasJapanese(token.surface_form)) {
                            preToken = token.pronunciation || token.reading;
                        }
                        else {
                            preToken = token.surface_form;
                        }
                        return toRawRomaji(preToken, options.romajiSystem);
                    };
                    if (options.mode === "normal") {
                        return tokens.map(romajiConv).join("");
                    }
                    return tokens.map(romajiConv).join(" ");
                case "hiragana":
                    for (let hi = 0; hi < tokens.length; hi++) {
                        if (hasKanji(tokens[hi].surface_form)) {
                            if (!hasKatakana(tokens[hi].surface_form)) {
                                tokens[hi].reading = toRawHiragana(tokens[hi].reading);
                            }
                            else {
                                // handle katakana-kanji-mixed tokens
                                tokens[hi].reading = toRawHiragana(tokens[hi].reading);
                                let tmp = "";
                                let hpattern = "";
                                for (let hc = 0; hc < tokens[hi].surface_form.length; hc++) {
                                    if (isKanji(tokens[hi].surface_form[hc])) {
                                        hpattern += "(.*?)";
                                    }
                                    else {
                                        const hch = tokens[hi].surface_form[hc];
                                        hpattern += isKatakana(hch) ? toRawHiragana(hch) : Kusanaji._escapeRegex(hch);
                                    }
                                }
                                const hreg = new RegExp(hpattern);
                                const hmatches = hreg.exec(tokens[hi].reading);
                                if (hmatches) {
                                    let pickKJ = 0;
                                    for (let hc1 = 0; hc1 < tokens[hi].surface_form.length; hc1++) {
                                        if (isKanji(tokens[hi].surface_form[hc1])) {
                                            tmp += hmatches[pickKJ + 1];
                                            pickKJ++;
                                        }
                                        else {
                                            tmp += tokens[hi].surface_form[hc1];
                                        }
                                    }
                                    tokens[hi].reading = tmp;
                                }
                            }
                        }
                        else {
                            tokens[hi].reading = tokens[hi].surface_form;
                        }
                    }
                    if (options.mode === "normal") {
                        return tokens.map(token => token.reading).join("");
                    }
                    return tokens.map(token => token.reading).join(" ");
                default:
                    throw new Error("Unknown option.to param");
            }
        }
        else if (options.mode === "okurigana" || options.mode === "furigana") {
            const notations = []; // [basic, basic_type[1=kanji,2=kana,3=others], notation, pronunciation]
            for (let i = 0; i < tokens.length; i++) {
                const strType = getStrType(tokens[i].surface_form);
                switch (strType) {
                    case 0:
                        notations.push([tokens[i].surface_form, 1, toRawHiragana(tokens[i].reading), tokens[i].pronunciation || tokens[i].reading]);
                        break;
                    case 1:
                        let pattern = "";
                        let isLastTokenKanji = false;
                        const subs = []; // recognize kanjis and group them
                        for (let c = 0; c < tokens[i].surface_form.length; c++) {
                            if (isKanji(tokens[i].surface_form[c])) {
                                if (!isLastTokenKanji) { // ignore successive kanji tokens (#10)
                                    isLastTokenKanji = true;
                                    pattern += "(.+?)";
                                    subs.push(tokens[i].surface_form[c]);
                                }
                                else {
                                    subs[subs.length - 1] += tokens[i].surface_form[c];
                                }
                            }
                            else {
                                isLastTokenKanji = false;
                                const ch = tokens[i].surface_form[c];
                                subs.push(ch);
                                pattern += isKatakana(ch) ? toRawHiragana(ch) : Kusanaji._escapeRegex(ch);
                            }
                        }
                        const reg = new RegExp(`^${pattern}$`);
                        const matches = reg.exec(toRawHiragana(tokens[i].reading));
                        if (matches) {
                            let pickKanji = 1;
                            for (let c1 = 0; c1 < subs.length; c1++) {
                                if (isKanji(subs[c1][0])) {
                                    notations.push([subs[c1], 1, matches[pickKanji], toRawKatakana(matches[pickKanji])]);
                                    pickKanji += 1;
                                }
                                else {
                                    notations.push([subs[c1], 2, toRawHiragana(subs[c1]), toRawKatakana(subs[c1])]);
                                }
                            }
                        }
                        else {
                            notations.push([tokens[i].surface_form, 1, toRawHiragana(tokens[i].reading), tokens[i].pronunciation || tokens[i].reading]);
                        }
                        break;
                    case 2:
                        for (let c2 = 0; c2 < tokens[i].surface_form.length; c2++) {
                            // PATCH: NEologd named-entity tokens (e.g.
                            // 「ニューヨーク・タイムズ」) can have surface_form longer
                            // than reading because the dictionary reading omits the
                            // ・ interpunct. Without bound checking, reading[c2] is
                            // undefined and toRawHiragana([...undefined]) throws
                            // "TypeError: str is not iterable". For pure-kana case 2
                            // tokens the surface IS already kana, so falling back to
                            // surface_form[c2] is the correct value.
                            const _r2 = (tokens[i].reading != null && tokens[i].reading[c2] != null)
                                ? tokens[i].reading[c2]
                                : tokens[i].surface_form[c2];
                            const _p2 = (tokens[i].pronunciation != null && tokens[i].pronunciation[c2] != null)
                                ? tokens[i].pronunciation[c2]
                                : _r2;
                            notations.push([tokens[i].surface_form[c2], 2, toRawHiragana(_r2), _p2]);
                        }
                        break;
                    case 3:
                        for (let c3 = 0; c3 < tokens[i].surface_form.length; c3++) {
                            notations.push([tokens[i].surface_form[c3], 3, tokens[i].surface_form[c3], tokens[i].surface_form[c3]]);
                        }
                        break;
                    default:
                        throw new Error("Unknown strType");
                }
            }
            let result = "";
            switch (options.to) {
                case "katakana":
                    if (options.mode === "okurigana") {
                        for (let n0 = 0; n0 < notations.length; n0++) {
                            if (notations[n0][1] !== 1) {
                                result += notations[n0][0];
                            }
                            else {
                                result += notations[n0][0] + options.delimiter_start + toRawKatakana(notations[n0][2]) + options.delimiter_end;
                            }
                        }
                    }
                    else { // furigana
                        for (let n1 = 0; n1 < notations.length; n1++) {
                            if (notations[n1][1] !== 1) {
                                result += notations[n1][0];
                            }
                            else {
                                result += `<ruby>${notations[n1][0]}<rp>${options.delimiter_start}</rp><rt>${toRawKatakana(notations[n1][2])}</rt><rp>${options.delimiter_end}</rp></ruby>`;
                            }
                        }
                    }
                    return result;
                case "romaji":
                    if (options.mode === "okurigana") {
                        for (let n2 = 0; n2 < notations.length; n2++) {
                            if (notations[n2][1] !== 1) {
                                result += notations[n2][0];
                            }
                            else {
                                result += notations[n2][0] + options.delimiter_start + toRawRomaji(notations[n2][3], options.romajiSystem) + options.delimiter_end;
                            }
                        }
                    }
                    else { // furigana
                        result += "<ruby>";
                        for (let n3 = 0; n3 < notations.length; n3++) {
                            result += `${notations[n3][0]}<rp>${options.delimiter_start}</rp><rt>${toRawRomaji(notations[n3][3], options.romajiSystem)}</rt><rp>${options.delimiter_end}</rp>`;
                        }
                        result += "</ruby>";
                    }
                    return result;
                case "hiragana":
                    if (options.mode === "okurigana") {
                        for (let n4 = 0; n4 < notations.length; n4++) {
                            if (notations[n4][1] !== 1) {
                                result += notations[n4][0];
                            }
                            else {
                                result += notations[n4][0] + options.delimiter_start + notations[n4][2] + options.delimiter_end;
                            }
                        }
                    }
                    else { // furigana
                        for (let n5 = 0; n5 < notations.length; n5++) {
                            if (notations[n5][1] !== 1) {
                                result += notations[n5][0];
                            }
                            else {
                                result += `<ruby>${notations[n5][0]}<rp>${options.delimiter_start}</rp><rt>${notations[n5][2]}</rt><rp>${options.delimiter_end}</rp></ruby>`;
                            }
                        }
                    }
                    return result;
                default:
                    throw new Error("Invalid Target Syllabary.");
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // High-level API — complete pipeline for real-world text
    // ══════════════════════════════════════════════════════════════════

    /**
     * Initialize with a tokenizer and optional dependencies.
     * Replaces the separate init(analyzer) + manual shim + fallback setup.
     *
     * @param {Object} config
     * @param {Object} config.tokenizer  kusamoji tokenizer instance (required)
     * @param {Function} [config.romanize]  japanese.romanize function (optional — enables non-MH systems)
     * @param {string} [config.fallbackDictPath]  path to fallback.dat (optional — enables kanji fallback)
     */
    async initFull(config) {
        if (!config || !config.tokenizer) {
            throw new Error("initFull requires { tokenizer } at minimum")
        }
        this._tokenizer = config.tokenizer
        this._romanize = config.romanize || null

        // Build analyzer shim from the tokenizer (same contract as kusanaji-analyzer)
        const tokenizer = config.tokenizer
        const analyzerShim = {
            init() { return Promise.resolve() },
            parse(str = '') {
                return new Promise((resolve) => {
                    if (str.trim() === '') return resolve([])
                    const tokens = tokenizer.tokenize(str)
                    for (let i = 0; i < tokens.length; i++) {
                        tokens[i].verbose = {
                            word_id: tokens[i].word_id,
                            word_type: tokens[i].word_type,
                            word_position: tokens[i].word_position,
                        }
                        delete tokens[i].word_id
                        delete tokens[i].word_type
                        delete tokens[i].word_position
                    }
                    resolve(tokens)
                })
            },
        }

        // Initialize the core convert() engine
        await this.init(analyzerShim)

        // Load kanji fallback dictionary if path provided
        if (config.fallbackDictPath) {
            const fs = await import('node:fs')
            const { initKanjiFallback, loadFallbackFromBinary } = await import('./text/kanji-fallback.js')
            try {
                const buf = fs.readFileSync(config.fallbackDictPath)
                const fallbackMap = loadFallbackFromBinary(buf)
                initKanjiFallback(fallbackMap)
            } catch (e) {
                // fallback.dat not found — kanji fallback disabled (non-fatal)
            }
        }
    }

    /**
     * Convert text to romaji. Complete pipeline: segmentation → prepasses →
     * emission → fallback → punctuation normalization.
     *
     * @param {string} text  Input text (may contain mixed JP/ASCII)
     * @param {Object} [opts]
     * @param {string} [opts.system='modified-hepburn']  Romanization system
     * @param {string} [opts.separator='space']  Token separator: 'none'|'space'|'custom'
     * @param {string} [opts.customSeparator=' ']
     * @param {boolean} [opts.useMacrons=true]
     * @param {boolean} [opts.keepUnconvertedKanji=true]
     * @returns {Promise<string>}
     */
    async toRomaji(text, opts = {}) {
        if (!this._analyzer) throw new Error("Kusanaji not initialized — call initFull() first")

        const { segmentMixed } = await import('./text/segment-mixed.js')
        const { runPrePasses } = await import('./pipeline/prepasses.js')
        const { emitRomaji } = await import('./romaji/emit.js')
        const { applyKanjiFallback } = await import('./text/kanji-fallback.js')
        const { normalizeJpPunctuation } = await import('./text/jp-punctuation.js')

        const system = opts.system || 'modified-hepburn'
        const separator = opts.separator || 'space'
        const customSeparator = opts.customSeparator || ' '
        const useMacrons = opts.useMacrons !== false
        const keepUnconvertedKanji = opts.keepUnconvertedKanji !== false

        const segments = segmentMixed(text)
        const parts = []

        for (const seg of segments) {
            if (seg.type === 'foreign') {
                parts.push(seg.text)
            } else {
                const { preprocessed, digitRuns } = runPrePasses(seg.text, { targetScript: 'katakana' })
                const converted = await emitRomaji(
                    preprocessed, digitRuns,
                    { kusanaji: this, tokenizer: this._tokenizer, romanize: this._romanize },
                    { system, separator, customSeparator, useMacrons, keepUnconvertedKanji }
                )
                parts.push(converted)
            }
        }

        // Join parts — insert space between consecutive JP segments
        let result = ''
        for (let i = 0; i < parts.length; i++) {
            if (i > 0
                && segments[i].type === 'japanese'
                && segments[i - 1].type === 'japanese'
                && result.length > 0
                && !result.endsWith(' ')) {
                result += ' '
            }
            result += parts[i]
        }

        // Katakana → Hiragana helper for fallback pass
        const toHiragana = (s) => s.replace(/[\u30A1-\u30F6]/g, ch =>
            String.fromCharCode(ch.charCodeAt(0) - 0x60))

        // Fallback romanize using injected romanize function
        const fallbackRomanize = this._romanize
            ? (h) => { try { return this._romanize(h) } catch { return h } }
            : (h) => h

        result = applyKanjiFallback(result, 'romaji', toHiragana, fallbackRomanize)
        result = normalizeJpPunctuation(result)

        return result
    }

    /**
     * Convert text to kana. Complete pipeline: segmentation → prepasses →
     * emission → fallback.
     *
     * @param {string} text  Input text (may contain mixed JP/ASCII)
     * @param {Object} opts
     * @param {string} opts.to  Target: 'hiragana' | 'katakana'
     * @param {string} [opts.mode='normal']  Mode: 'normal'|'spaced'|'okurigana'|'furigana'
     * @returns {Promise<string>}
     */
    async toKana(text, opts = {}) {
        if (!this._analyzer) throw new Error("Kusanaji not initialized — call initFull() first")
        if (!opts.to || (opts.to !== 'hiragana' && opts.to !== 'katakana')) {
            throw new Error('opts.to must be "hiragana" or "katakana"')
        }

        const { segmentMixed } = await import('./text/segment-mixed.js')
        const { runPrePasses } = await import('./pipeline/prepasses.js')
        const { emitKana } = await import('./kana/emit.js')
        const { applyKanjiFallback } = await import('./text/kanji-fallback.js')

        const to = opts.to
        const mode = opts.mode || 'normal'

        const segments = segmentMixed(text)
        const parts = []

        for (const seg of segments) {
            if (seg.type === 'foreign') {
                parts.push(seg.text)
            } else {
                const { preprocessed, digitRuns } = runPrePasses(seg.text, { targetScript: to })
                const converted = await emitKana(
                    preprocessed, digitRuns,
                    { kusanaji: this },
                    { to, mode }
                )
                parts.push(converted)
            }
        }

        let result = parts.join('')

        const toHiragana = (s) => s.replace(/[\u30A1-\u30F6]/g, ch =>
            String.fromCharCode(ch.charCodeAt(0) - 0x60))

        if (to === 'hiragana') {
            result = applyKanjiFallback(result, 'hiragana', toHiragana)
        } else {
            result = applyKanjiFallback(result, 'katakana')
        }

        return result
    }
}

const Util = {
    isHiragana,
    isKatakana,
    isKana,
    isKanji,
    isJapanese,
    hasHiragana,
    hasKatakana,
    hasKana,
    hasKanji,
    hasJapanese,
};

Kusanaji.Util = Util;

export default Kusanaji;
