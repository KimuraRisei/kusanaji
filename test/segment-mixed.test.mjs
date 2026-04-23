import { describe, it } from "node:test";
import assert from "node:assert/strict";
// Via the barrel — both symbols are part of the `kusanaji/text` public API.
import { segmentMixed, hasJapanese } from "../src/text/index.js";

describe("segmentMixed", () => {
    it("returns empty for null/empty", () => {
        assert.deepEqual(segmentMixed(null), []);
        assert.deepEqual(segmentMixed(""), []);
    });

    it("pure Japanese → single segment", () => {
        const segs = segmentMixed("東京タワー");
        assert.equal(segs.length, 1);
        assert.equal(segs[0].type, "japanese");
        assert.equal(segs[0].text, "東京タワー");
    });

    it("pure ASCII → single segment", () => {
        const segs = segmentMixed("hello world");
        assert.equal(segs.length, 1);
        assert.equal(segs[0].type, "foreign");
    });

    it("splits ASCII and Japanese", () => {
        const segs = segmentMixed("Yahoo!ニュースの機能");
        assert.ok(segs.length >= 2);
        assert.equal(segs[0].type, "foreign");
        assert.ok(segs[0].text.includes("Yahoo"));
    });

    it("keeps particles in Japanese segments", () => {
        const segs = segmentMixed("JavaScriptの設定");
        // の stays in JP segment so the tokenizer can resolve it correctly
        const jpSegs = segs.filter(s => s.type === "japanese");
        const hasParticle = jpSegs.some(s => s.text.includes("の"));
        assert.ok(hasParticle, "Expected の in a JP segment");
    });

    it("splits on sentence punctuation", () => {
        const segs = segmentMixed("テスト。次の文。");
        assert.ok(segs.length >= 2, `Expected >=2 segments, got ${segs.length}`);
    });

    it("micro-splits long Japanese segments on clause boundaries", () => {
        const long = "これは非常に長い日本語の文章であり、テスト用に作成されたものです。";
        const segs = segmentMixed(long);
        // Should split on 、 and 。
        assert.ok(segs.length >= 2, `Expected >=2 segments for long text, got ${segs.length}`);
    });
});

describe("hasJapanese", () => {
    it("returns true for Japanese text", () => {
        assert.equal(hasJapanese("東京"), true);
        assert.equal(hasJapanese("ひらがな"), true);
        assert.equal(hasJapanese("カタカナ"), true);
    });

    it("returns false for ASCII", () => {
        assert.equal(hasJapanese("hello"), false);
        assert.equal(hasJapanese("123"), false);
    });
});
