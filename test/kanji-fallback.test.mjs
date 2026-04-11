import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    initKanjiFallback,
    applyKanjiFallback,
    isFallbackReady,
    loadFallbackFromBinary,
    loadFallbackFromCsv,
} from "../src/text/kanji-fallback.js";

describe("kanji-fallback", () => {
    describe("loadFallbackFromCsv", () => {
        it("parses IPADIC-format CSV", () => {
            const csv = "東京,1285,1285,5000,名詞,一般,*,*,*,*,東京,トウキョウ,トーキョー\n" +
                        "大阪,1285,1285,5000,名詞,一般,*,*,*,*,大阪,オオサカ,オーサカ\n";
            const map = loadFallbackFromCsv(csv);
            assert.equal(map.size, 2);
            assert.equal(map.get("東京"), "トウキョウ");
            assert.equal(map.get("大阪"), "オオサカ");
        });

        it("skips non-kanji entries", () => {
            const csv = "hello,1285,1285,5000,名詞,一般,*,*,*,*,hello,ヘロー,ヘロー\n";
            const map = loadFallbackFromCsv(csv);
            assert.equal(map.size, 0);
        });

        it("skips comments and blank lines", () => {
            const csv = "# comment\n\n東京,1285,1285,5000,名詞,一般,*,*,*,*,東京,トウキョウ,トーキョー\n";
            const map = loadFallbackFromCsv(csv);
            assert.equal(map.size, 1);
        });
    });

    describe("loadFallbackFromBinary", () => {
        it("throws on too-small buffer", () => {
            assert.throws(() => loadFallbackFromBinary(Buffer.alloc(2)));
        });

        it("handles truncated buffer gracefully", () => {
            // header says 1000 entries but buffer is only 10 bytes
            const buf = Buffer.alloc(10);
            buf.writeUInt32LE(1000, 0);
            const map = loadFallbackFromBinary(buf);
            // Should not crash — just stop early
            assert.ok(map.size < 1000);
        });
    });

    describe("applyKanjiFallback", () => {
        it("replaces kanji using lookup map", () => {
            const map = new Map([["東京", "トウキョウ"], ["大阪", "オオサカ"]]);
            initKanjiFallback(map);
            assert.ok(isFallbackReady());

            const result = applyKanjiFallback("東京 to 大阪", "katakana");
            assert.equal(result, "トウキョウ to オオサカ");
        });

        it("passes through text without kanji", () => {
            const map = new Map([["東京", "トウキョウ"]]);
            initKanjiFallback(map);
            assert.equal(applyKanjiFallback("hello world", "katakana"), "hello world");
        });

        it("passes through kanji not in map", () => {
            const map = new Map([["東京", "トウキョウ"]]);
            initKanjiFallback(map);
            const result = applyKanjiFallback("未知の漢字", "katakana");
            assert.ok(result.includes("未") || result.includes("知"));
        });

        it("greedy longest match", () => {
            const map = new Map([["東", "ヒガシ"], ["東京", "トウキョウ"]]);
            initKanjiFallback(map);
            const result = applyKanjiFallback("東京駅", "katakana");
            assert.ok(result.startsWith("トウキョウ"), `Expected greedy match: ${result}`);
        });
    });
});
