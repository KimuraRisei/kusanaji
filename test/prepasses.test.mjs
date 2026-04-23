import { describe, it } from "node:test";
import assert from "node:assert/strict";
// Import via the barrel so this test also covers the fact that
// `runPrePasses` is properly re-exported from `kusanaji/pipeline`.
import { runPrePasses } from "../src/pipeline/index.js";

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

    it("passes through counters unchanged (tokenizer handles natively)", () => {
        const result = runPrePasses("1本", { targetScript: "katakana" });
        assert.equal(result.preprocessed, "1本");
    });

    it("passes through digits unchanged (tokenizer handles natively)", () => {
        const result = runPrePasses("2026年", { targetScript: "katakana" });
        assert.equal(result.preprocessed, "2026年");
        assert.deepEqual(result.digitRuns, []);
    });

    it("passes through compounds unchanged (readings in dict)", () => {
        const result = runPrePasses("行方不明", { targetScript: "katakana" });
        // Reading override map is empty — all readings migrated to dict patches
        assert.equal(result.preprocessed, "行方不明");
    });
});
