import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Kusanaji from "../src/index.js";

// Regression test for the Hepburn internal-long-vowel fold in core.js
// romajiConv. The table-driven converter only folds おう/うう that lands as a
// clean token-final mora, so internal おう in a multi-mora on-yomi reading
// (最新情報 → saishinjouhō) stayed raw. romajiConv now normalizes オ段/ウ段 + ウ
// → +ー (POS-gated to skip 動詞/助動詞/形容詞) so the existing ー→macron pass
// folds it — without over-folding verb/adj う endings (思う stays omou).
//
// Uses a mock analyzer so the test is self-contained — no dict required.
function makeKusanaji(tokenMap) {
    const k = new Kusanaji();
    return k.init({
        async init() {},
        async parse(text) { return tokenMap[text] || []; },
    }).then(() => k);
}

const tk = (surface_form, reading, pos) => ({
    surface_form, pos, pos_detail_1: "*", pos_detail_2: "*", pos_detail_3: "*",
    conjugated_type: "*", conjugated_form: "*", basic_form: surface_form,
    reading, pronunciation: reading, word_type: "KNOWN",
});

const TOKENS = {
    // Multi-mora on-yomi nouns — internal おう/うう must fold.
    "情報": [tk("情報", "ジョウホウ", "名詞")],
    "最新情報": [tk("最新情報", "サイシンジョウホウ", "名詞")],
    "商業高校": [tk("商業高校", "ショウギョウコウコウ", "名詞")],
    "旧統一教会": [tk("旧統一教会", "キュウトウイツキョウカイ", "名詞")],
    // Constraints — verb/adj う endings must NOT over-fold.
    "思う": [tk("思う", "オモウ", "動詞")],
    "言う": [tk("言う", "イウ", "動詞")],
    "高い": [tk("高い", "タカイ", "形容詞")],
};

const romaji = (k, s) => k.convert(s, { to: "romaji", romajiSystem: "hepburn" });

describe("romaji Hepburn internal long-vowel fold (P1)", () => {
    it("control: 情報 → jōhō", async () => {
        const k = await makeKusanaji(TOKENS);
        assert.equal(await romaji(k, "情報"), "jōhō");
    });

    it("folds internal おう in a multi-mora on-yomi noun: 最新情報 → saishinjōhō", async () => {
        const k = await makeKusanaji(TOKENS);
        assert.equal(await romaji(k, "最新情報"), "saishinjōhō");
    });

    it("folds repeated おう/うう: 商業高校 → shōgyōkōkō", async () => {
        const k = await makeKusanaji(TOKENS);
        assert.equal(await romaji(k, "商業高校"), "shōgyōkōkō");
    });

    it("folds うう + きょう: 旧統一教会 → kyūtōitsukyōkai", async () => {
        const k = await makeKusanaji(TOKENS);
        assert.equal(await romaji(k, "旧統一教会"), "kyūtōitsukyōkai");
    });

    it("does NOT over-fold a verb う ending: 思う → omou", async () => {
        const k = await makeKusanaji(TOKENS);
        assert.equal(await romaji(k, "思う"), "omou");
    });

    it("does NOT over-fold a verb う ending: 言う → iu", async () => {
        const k = await makeKusanaji(TOKENS);
        assert.equal(await romaji(k, "言う"), "iu");
    });

    it("leaves an adjective alone: 高い → takai", async () => {
        const k = await makeKusanaji(TOKENS);
        assert.equal(await romaji(k, "高い"), "takai");
    });
});
