import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveUnknownTokens } from "../src/text/unknown-fallback.js";

describe("resolveUnknownTokens", () => {
    // Mock tokenizer that splits by character
    const mockTokenizer = {
        tokenize(text) {
            if (!text) return [];
            return [...text].map((ch, i) => ({
                surface_form: ch,
                word_type: "KNOWN",
                reading: ch,
                pos: "名詞",
            }));
        },
    };

    it("passes through KNOWN tokens unchanged", () => {
        const tokens = [
            { surface_form: "東京", word_type: "KNOWN", reading: "トウキョウ" },
            { surface_form: "の", word_type: "KNOWN", reading: "ノ" },
        ];
        const result = resolveUnknownTokens(tokens, mockTokenizer);
        assert.equal(result.length, 2);
        assert.equal(result[0].surface_form, "東京");
    });

    it("re-tokenizes UNKNOWN tokens", () => {
        const tokens = [
            { surface_form: "テスト", word_type: "UNKNOWN" },
        ];
        const result = resolveUnknownTokens(tokens, mockTokenizer);
        // Mock tokenizer splits each char, so we should get 3 tokens
        assert.ok(result.length >= 3, `Expected >=3 tokens, got ${result.length}`);
    });

    it("handles empty token array", () => {
        const result = resolveUnknownTokens([], mockTokenizer);
        assert.deepEqual(result, []);
    });

    it("handles single-char UNKNOWN", () => {
        const tokens = [{ surface_form: "X", word_type: "UNKNOWN" }];
        const result = resolveUnknownTokens(tokens, mockTokenizer);
        assert.ok(result.length >= 1);
    });

    it("does not infinite-loop on stubborn UNKNOWN", () => {
        // Tokenizer that always returns UNKNOWN
        const stubbornTokenizer = {
            tokenize(text) {
                return [{ surface_form: text, word_type: "UNKNOWN" }];
            },
        };
        const tokens = [{ surface_form: "テスト", word_type: "UNKNOWN" }];
        // Should terminate (bounded by string length halving)
        const result = resolveUnknownTokens(tokens, stubbornTokenizer);
        assert.ok(result.length > 0);
    });
});
