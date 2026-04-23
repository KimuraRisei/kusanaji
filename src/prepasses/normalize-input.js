/**
 * Input normalization — runs BEFORE segmentation.
 *
 * 1. Fullwidth ASCII (U+FF01–FF5E) → halfwidth (U+0021–007E)
 *    so the segmenter classifies them as foreign, not Japanese.
 *    Delegated to `fullToHalfWidth()` in `width-convert.js` — single
 *    source of truth for HW↔FW tables.
 *
 * 2. Ideographic space (U+3000) → regular space. Also handled by
 *    `fullToHalfWidth()` via its `convertSpaces` option.
 *
 * 3. Kyūjitai (旧字体) → shinjitai (新字体).
 *    NEologd only has post-1946 simplified kanji. Traditional forms
 *    from Macau, Taiwan, historical, or formal text go through the
 *    tokenizer as UNKNOWN and leak into output. Normalizing them
 *    pre-tokenization lets the dictionary match correctly.
 *
 *    The table below covers the ~364 kanji simplified in the 1946
 *    Tōyō Kanji reform and subsequent Jōyō Kanji revisions. This is
 *    kusanaji-specific and NOT part of the generic width module.
 */

import { fullToHalfWidth } from '../text/width-convert.js'

// Daiji (大字) — legal/formal numerals. Only normalize daiji that have
// NO modern non-daiji usage, otherwise we regress common words.
//
// Safe:
//   壱 / 壹  →  一   (modern usage is strictly daiji; rare exception
//                     is the place name 壱岐 which is accepted collateral)
//   弐 / 貳  →  二   (no modern non-daiji usage)
//
// UNSAFE — DO NOT add back without a better strategy:
//   参 → 三   breaks 参加 (sanka), 参考 (sankō), 参議院 (sangiin),
//             参拝 (sanpai), 参照 (sanshō), 参上 (sanjō), etc. The test
//             harness caught `参加 → サンガ` post-normalization; this is
//             the furigana view revealing `三加` at tokenization time.
//   拾 → 十   breaks 拾う (hirou, to pick up), 拾得物 (shūtokubutsu),
//             and any verb use of 拾.
//
// 參 is the kyūjitai form of 参; we normalize 參→参 (not →三) so the
// tokenizer sees the modern shinjitai, preserving correct reading.
const DAIJI_TO_STANDARD = {
    '壱': '一', '壹': '一',
    '弐': '二', '貳': '二',
    '參': '参',
}

// Complete kyūjitai (旧字体) → shinjitai (新字体) mapping.
// Source: Jōyō Kanji reform (1946 Tōyō Kanji + 1981/2010 revisions).
// Organized by Japanese radical order for maintainability.
//
// Exported so downstream consumers (benchmarks, validation harnesses) can
// account for this unconditional normalization when comparing input
// kanji against output kanji. Do NOT mutate — use as read-only reference.
export const KYUJITAI_TO_SHINJITAI = {
    ...DAIJI_TO_STANDARD,
    // 一・丨・丶・丿
    '亞': '亜', '惡': '悪', '壓': '圧', '圍': '囲', '醫': '医',
    '壹': '壱', '稻': '稲', '飮': '飲', '隱': '隠',
    // 宀・尸・广
    '營': '営', '榮': '栄', '衞': '衛', '驛': '駅',
    '圓': '円', '鹽': '塩', '緣': '縁', '艷': '艶',
    // 口・囗
    '應': '応', '歐': '欧', '毆': '殴', '櫻': '桜', '奧': '奥',
    // 人・亻
    '假': '仮', '價': '価', '畫': '画', '會': '会', '囘': '回',
    '壞': '壊', '懷': '懐', '繪': '絵',
    '擴': '拡', '殼': '殻', '覺': '覚', '學': '学', '嶽': '岳',
    '樂': '楽', '渴': '渇', '鐮': '鎌', '卷': '巻',
    '罐': '缶', '歡': '歓', '觀': '観', '關': '関',
    '陷': '陥', '顏': '顔', '氣': '気',
    '歸': '帰', '龜': '亀', '舊': '旧', '據': '拠',
    '擧': '挙', '虛': '虚', '峽': '峡', '挾': '挟', '狹': '狭',
    '鄕': '郷', '曉': '暁',
    '區': '区', '驅': '駆', '勳': '勲', '薰': '薫', '徑': '径',
    '惠': '恵', '揭': '掲', '溪': '渓', '經': '経', '螢': '蛍',
    '輕': '軽', '繼': '継', '鷄': '鶏', '藝': '芸', '擊': '撃',
    '缺': '欠', '儉': '倹', '劍': '剣', '圈': '圏', '檢': '検',
    '權': '権', '獻': '献', '硏': '研', '險': '険', '顯': '顕',
    '驗': '験', '嚴': '厳', '廣': '広', '效': '効', '恆': '恒',
    '鑛': '鉱', '號': '号', '國': '国', '黑': '黒',
    '濟': '済', '碎': '砕', '齋': '斎', '劑': '剤', '雜': '雑',
    '參': '参', '慘': '惨', '棧': '桟', '蠶': '蚕', '贊': '賛',
    '殘': '残', '絲': '糸', '齒': '歯', '兒': '児',
    '辭': '辞', '濕': '湿', '實': '実', '寫': '写',
    '釋': '釈', '壽': '寿', '收': '収',
    '從': '従', '澁': '渋', '獸': '獣', '縱': '縦',
    '肅': '粛', '處': '処', '緖': '緒',
    '敍': '叙', '將': '将', '稱': '称',
    '涉': '渉', '燒': '焼', '證': '証', '奬': '奨', '條': '条',
    '狀': '状', '乘': '乗', '淨': '浄', '剩': '剰', '疊': '畳',
    '繩': '縄', '壤': '壌', '讓': '譲', '釀': '醸', '觸': '触',
    '囑': '嘱', '愼': '慎', '眞': '真', '寢': '寝', '盡': '尽',
    '圖': '図', '粹': '粋', '醉': '酔', '穗': '穂', '隨': '随',
    '髓': '髄', '樞': '枢', '數': '数', '瀨': '瀬', '聲': '声',
    '齊': '斉', '靜': '静', '竊': '窃', '攝': '摂',
    '專': '専', '淺': '浅', '戰': '戦', '踐': '践', '錢': '銭',
    '潛': '潜', '纖': '繊', '禪': '禅', '曾': '曽',
    '雙': '双', '壯': '壮', '搜': '捜',
    '騷': '騒', '增': '増', '藏': '蔵',
    '臟': '臓', '卽': '即', '帶': '帯', '滯': '滞', '對': '対',
    '擇': '択', '單': '単', '團': '団', '彈': '弾',
    '斷': '断', '癡': '痴', '遲': '遅', '晝': '昼', '蟲': '虫',
    '鑄': '鋳', '廳': '庁', '徵': '徴', '聽': '聴',
    '敕': '勅', '鎭': '鎮', '遞': '逓',
    '鐵': '鉄', '轉': '転', '點': '点', '傳': '伝',
    '黨': '党', '盜': '盗', '燈': '灯', '當': '当', '鬪': '闘',
    '德': '徳', '獨': '独', '讀': '読', '屆': '届', '貳': '弐', '腦': '脳', '霸': '覇', '廢': '廃', '拜': '拝',
    '賣': '売', '麥': '麦', '發': '発', '髮': '髪', '拔': '抜',
    '晚': '晩', '蠻': '蛮',
    '祕': '秘', '濱': '浜', '甁': '瓶',
    '拂': '払', '佛': '仏', '倂': '併', '竝': '並', '辯': '弁',
    '瓣': '弁', '辨': '弁', '舖': '舗', '步': '歩', '寶': '宝', '豐': '豊', '沒': '没', '飜': '翻',
    '每': '毎', '萬': '万', '滿': '満', '默': '黙', '餠': '餅',
    '麵': '麺', '彌': '弥', '譯': '訳', '藥': '薬', '與': '与',
    '搖': '揺', '樣': '様', '謠': '謡', '來': '来', '賴': '頼',
    '亂': '乱', '覽': '覧', '龍': '竜', '兩': '両', '獵': '猟',
    '綠': '緑', '壘': '塁', '淚': '涙', '勵': '励',
    '禮': '礼', '隸': '隷', '靈': '霊', '齡': '齢', '歷': '歴',
    '戀': '恋', '鍊': '錬', '爐': '炉', '勞': '労',
    '樓': '楼', '郞': '郎', '錄': '録', '灣': '湾', '綜': '総', '閱': '閲', '歲': '歳', '剝': '剥', '姬': '姫',
    '吞': '呑', '嶋': '島', '邊': '辺', '澤': '沢', '總': '総', '閒': '間', '髙': '高'
}

/**
 * Normalize input text before tokenization.
 *
 * Two passes applied in order:
 *   1. Width normalization (FW ASCII → HW ASCII + ideographic space → ASCII space)
 *      via `fullToHalfWidth`. Katakana is NOT converted here — FW katakana must
 *      stay FW for the tokenizer to recognise it as Japanese.
 *   2. Kyūjitai → shinjitai kanji substitution (kusanaji-specific).
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeInput (text) {
    if (!text) return text
    // Step 1: FW ASCII + FW space → HW. Explicitly disable katakana
    // conversion so that `カタカナ` stays `カタカナ` (required by the tokenizer's
    // character classification).
    const widthNormalized = fullToHalfWidth(text, {
        convertAscii: true,
        convertSpaces: true,
        convertKatakana: false,
        handleDakuten: false,
    }).text
    // Step 2: kyūjitai → shinjitai (char-by-char lookup).
    let out = ''
    for (let i = 0; i < widthNormalized.length; i++) {
        const ch = widthNormalized[i]
        out += KYUJITAI_TO_SHINJITAI[ch] ?? ch
    }
    return out
}
