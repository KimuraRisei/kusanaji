import { describe, it } from "node:test";
import assert from "node:assert/strict";
// Public symbols — imported via the `kusanaji/text` barrel so this test
// also verifies the barrel surface.
import {
    katakanaToHiragana, hasKana, normalizeReading,
    normalizeJpPunctuation,
} from "../src/text/index.js";
// Internal-only helpers (not exposed via the public barrel) — imported
// directly from their source files.
import { isPureKanjiSurface, removeKanji } from "../src/text/kanji-script.js";

describe("kana-script", () => {
    it("converts katakana to hiragana", () => {
        assert.equal(katakanaToHiragana("トウキョウ"), "とうきょう");
    });

    it("leaves hiragana unchanged", () => {
        assert.equal(katakanaToHiragana("ひらがな"), "ひらがな");
    });

    it("leaves ASCII unchanged", () => {
        assert.equal(katakanaToHiragana("hello"), "hello");
    });

    it("detects kana presence", () => {
        assert.equal(hasKana("テスト"), true);
        assert.equal(hasKana("hello"), false);
        assert.equal(hasKana("漢字"), false);
        assert.equal(hasKana("あ"), true);
    });

    it("normalizes empty/wildcard readings to null", () => {
        assert.equal(normalizeReading(""), null);
        assert.equal(normalizeReading("*"), null);
        assert.equal(normalizeReading(null), null);
        assert.equal(normalizeReading(undefined), null);
        assert.equal(normalizeReading("トウキョウ"), "トウキョウ");
    });
});

describe("kanji-script", () => {
    it("detects pure kanji surface", () => {
        assert.equal(isPureKanjiSurface("東京"), true);
        assert.equal(isPureKanjiSurface("東京タワー"), false);
        assert.equal(isPureKanjiSurface("hello"), false);
    });

    it("removes kanji from string", () => {
        assert.equal(removeKanji("東京タワー"), "タワー");
        assert.equal(removeKanji("hello"), "hello");
    });
});

describe("jp-punctuation", () => {
    it("normalizes JP punctuation to ASCII", () => {
        assert.equal(normalizeJpPunctuation("、"), ",");
        assert.equal(normalizeJpPunctuation("。"), ".");
        assert.equal(normalizeJpPunctuation("「テスト」"), '"テスト"');
    });

    it("passes ASCII through", () => {
        assert.equal(normalizeJpPunctuation("hello, world."), "hello, world.");
    });
});
