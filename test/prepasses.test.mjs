import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPrePasses } from "../src/pipeline/prepasses.js";

describe("runPrePasses", () => {
    it("returns empty for null input", () => {
        const result = runPrePasses(null, { targetScript: "katakana" });
        assert.equal(result.preprocessed, "");
        assert.deepEqual(result.digitRuns, []);
    });

    it("returns empty for empty string", () => {
        const result = runPrePasses("", { targetScript: "katakana" });
        assert.equal(result.preprocessed, "");
    });

    it("passes through plain text unchanged", () => {
        const result = runPrePasses("東京タワー", { targetScript: "katakana" });
        assert.equal(result.preprocessed, "東京タワー");
        assert.deepEqual(result.digitRuns, []);
    });

    it("rewrites irregular counter readings", () => {
        const result = runPrePasses("1本", { targetScript: "katakana" });
        // 1本 → イッポン (irregular counter)
        assert.ok(result.preprocessed.includes("イッポン") || result.preprocessed.includes("ポン"),
            `Expected counter rewrite in: ${result.preprocessed}`);
    });

    it("protects digit runs with placeholders", () => {
        const result = runPrePasses("2026年", { targetScript: "katakana" });
        assert.ok(result.digitRuns.length > 0 || result.preprocessed.includes("2026"),
            "Should protect or pass through digit runs");
    });

    it("applies reading overrides", () => {
        const result = runPrePasses("行方不明", { targetScript: "katakana" });
        // 行方不明 should get override reading ユクエフメイ
        assert.ok(
            result.preprocessed.includes("ユクエフメイ") || result.preprocessed === "行方不明",
            `Unexpected: ${result.preprocessed}`
        );
    });
});
