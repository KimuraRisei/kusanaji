import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collapseLongVowels } from "../src/romaji/long-vowels.js";
import { joinVerbForms } from "../src/romaji/join-verb-forms.js";
import { joinDigitRuns, fixDecimalPointSpacing } from "../src/romaji/digit-postpass.js";
import { isWordToken } from "../src/romaji/token-helpers.js";
import { JAPANESE_PRESET_BY_SYSTEM } from "../src/romaji/systems.js";

describe("long-vowels", () => {
    it("collapses oo → ō", () => {
        assert.equal(collapseLongVowels("ootani"), "ōtani");
    });

    it("does NOT collapse ou (by design)", () => {
        assert.equal(collapseLongVowels("toukyou"), "toukyou");
    });

    it("leaves non-long vowels alone", () => {
        assert.equal(collapseLongVowels("sushi"), "sushi");
    });
});

describe("join-verb-forms", () => {
    it("joins mashita", () => {
        const result = joinVerbForms("iki mashita");
        assert.equal(result, "ikimashita");
    });

    it("leaves non-verb text alone", () => {
        assert.equal(joinVerbForms("tōkyō tawā"), "tōkyō tawā");
    });
});

describe("digit-postpass", () => {
    it("joins split digit runs", () => {
        assert.equal(joinDigitRuns("1 5 nichi"), "15 nichi");
    });

    it("fixes decimal point spacing", () => {
        assert.equal(fixDecimalPointSpacing("3 . 14"), "3.14");
    });
});

describe("token-helpers", () => {
    it("identifies word tokens", () => {
        assert.equal(isWordToken({ surface_form: "東京", pos: "名詞" }), true);
        assert.equal(isWordToken({ surface_form: "。", pos: "記号" }), false);
        assert.equal(isWordToken({ surface_form: " ", pos: "名詞" }), false);
        assert.equal(isWordToken({ surface_form: "、", pos: "記号" }), false);
    });
});

describe("romaji systems", () => {
    it("has all 4 non-MH presets", () => {
        assert.ok(JAPANESE_PRESET_BY_SYSTEM["traditional-hepburn"]);
        assert.ok(JAPANESE_PRESET_BY_SYSTEM["nihon-shiki"]);
        assert.ok(JAPANESE_PRESET_BY_SYSTEM["kunrei-shiki"]);
    });
});
