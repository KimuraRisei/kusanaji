/**
 * Barrel surface test.
 *
 * kusanaji exposes five subpaths in package.json — `.`, `./pipeline`,
 * `./romaji`, `./kana`, `./text`. Each is backed by an `index.js` barrel
 * that re-exports a specific set of symbols. Downstream consumers
 * (jala-dict-api, benchmarks, etc.) import from these barrels rather
 * than reaching into individual source files.
 *
 * If a symbol is accidentally dropped from a barrel during a refactor,
 * consumers break but the per-module tests pass (they import the
 * source file directly). This test closes that gap by asserting the
 * full public API surface of each barrel.
 *
 * When adding / removing a public symbol, update BOTH the barrel file
 * and the expected set below.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import * as pipeline from '../src/pipeline/index.js'
import * as romaji   from '../src/romaji/index.js'
import * as kana     from '../src/kana/index.js'
import * as text     from '../src/text/index.js'
import Kusanaji     from '../src/index.js'

/** Assert every name in `expected` is defined on the barrel's exports. */
function assertExports(mod, expected, barrelName) {
    const missing = expected.filter(n => mod[n] === undefined)
    assert.deepEqual(
        missing, [],
        `kusanaji/${barrelName} is missing: ${missing.join(', ')}`,
    )
}

describe('barrel surface', () => {
    it('kusanaji/pipeline exports runPrePasses', () => {
        assertExports(pipeline, ['runPrePasses'], 'pipeline')
        assert.equal(typeof pipeline.runPrePasses, 'function')
    })

    it('kusanaji/romaji exports emitter + system presets', () => {
        assertExports(romaji, [
            'emitRomaji',
            'JAPANESE_PRESET_BY_SYSTEM',
            'WAPURO_CONFIG',
            'stripMacrons',
            'macronToCircumflex',
        ], 'romaji')
        assert.equal(typeof romaji.emitRomaji, 'function')
        assert.equal(typeof romaji.stripMacrons, 'function')
        assert.equal(typeof romaji.macronToCircumflex, 'function')
        assert.equal(typeof romaji.JAPANESE_PRESET_BY_SYSTEM, 'object')
    })

    it('kusanaji/kana exports emitKana', () => {
        assertExports(kana, ['emitKana'], 'kana')
        assert.equal(typeof kana.emitKana, 'function')
    })

    it('kusanaji/text exports segmentation + fallback + punctuation + width + kyūjitai map', () => {
        assertExports(text, [
            // segmentation
            'segmentMixed', 'hasJapanese',
            // JMdict/JMnedict fallback
            'applyKanjiFallback', 'initKanjiFallback', 'isFallbackReady',
            'loadFallbackFromBinary', 'loadFallbackFromCsv',
            // unknown-token re-tokenization
            'resolveUnknownTokens',
            // punctuation
            'JP_PUNCT_TO_ASCII', 'normalizeJpPunctuation',
            // kana-script helpers
            'hasKana', 'katakanaToHiragana', 'normalizeReading',
            // width module (functions)
            'toFullWidthOutput',
            'detectWidth', 'fullToHalfWidth', 'halfToFullWidth', 'getWidthStats',
            // width module (tables / predicates)
            'ASCII_OFFSET',
            'FULLWIDTH_ASCII_START', 'FULLWIDTH_ASCII_END',
            'FULLWIDTH_SPACE', 'HALFWIDTH_SPACE',
            'FULLWIDTH_TO_HALFWIDTH_KATAKANA', 'HALFWIDTH_TO_FULLWIDTH_KATAKANA',
            'FULLWIDTH_VOICED_TO_HALFWIDTH',
            'HW_BASE_DAKUTEN_TO_FW', 'HW_BASE_HANDAKUTEN_TO_FW',
            'FULLWIDTH_TO_HALFWIDTH_EXTRA', 'HALFWIDTH_TO_FULLWIDTH_EXTRA',
            'FULLWIDTH_COMBINING_MARKS_TO_HALFWIDTH',
            'isFullWidthAscii', 'isFullWidthKatakana',
            'isHalfWidthAscii', 'isHalfWidthKatakana',
            // input normalization — lives in prepasses/ but re-exported here
            // so consumers don't reach into that path
            'KYUJITAI_TO_SHINJITAI', 'normalizeInput',
        ], 'text')
        assert.equal(typeof text.segmentMixed, 'function')
        assert.equal(typeof text.halfToFullWidth, 'function')
        assert.equal(typeof text.fullToHalfWidth, 'function')
        // spot-check table shapes
        assert.ok(Object.keys(text.KYUJITAI_TO_SHINJITAI).length > 200,
            'KYUJITAI_TO_SHINJITAI should have 200+ entries')
        assert.equal(text.KYUJITAI_TO_SHINJITAI['濱'], '浜',
            '濱→浜 should be in KYUJITAI_TO_SHINJITAI')
        assert.equal(text.HALFWIDTH_TO_FULLWIDTH_EXTRA['¥'], '￥',
            '¥→￥ should be in HALFWIDTH_TO_FULLWIDTH_EXTRA')
    })

    it('root `.` exports the Kusanaji class as default', () => {
        assert.equal(typeof Kusanaji, 'function',
            'default export of kusanaji should be the Kusanaji class')
        assert.equal(Kusanaji.name, 'Kusanaji')
        assert.ok(Kusanaji.Util, 'Kusanaji.Util should be attached')
    })

    it('round-trip spot-check via the barrels — pipeline + text + round-trip ¥', () => {
        // Use only symbols imported through the barrels to prove the
        // public surface is self-consistent.
        const pre = pipeline.runPrePasses('東京＠日本', { targetScript: 'katakana' })
        assert.equal(typeof pre.preprocessed, 'string')
        // FW @ gets normalized to ASCII via the width module during segmentMixed
        const normalized = text.normalizeInput('ＡＢＣ　１２３')
        assert.equal(normalized, 'ABC 123')
        // Width round-trip (¥ / ￥) via the extra table
        const fw = text.halfToFullWidth('¥100').text
        assert.equal(fw, '￥１００')
        const hw = text.fullToHalfWidth(fw).text
        assert.equal(hw, '¥100')
    })
})
