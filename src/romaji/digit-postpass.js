/**
 * Post-pass digit handling for romaji output.
 *
 * After kusanaji / the custom loop has produced romaji, two cleanup
 * tasks remain:
 *
 *   1. NEologd's tokenizer splits multi-digit numbers into individual
 *      digit tokens (vanilla IPADIC kept them grouped). After kusanaji
 *      returns, rejoin any adjacent single-digit ASCII numerals so
 *      "1 5 nichi" → "15 nichi". Loops because each pass only removes
 *      one space.
 *
 *   2. A literal "." between two digit runs is a decimal point, not a
 *      sentence boundary. Kusanaji treats every "." as its own token in
 *      spaced mode and inserts surrounding spaces. Restore "1325.46"
 *      from "1325 . 46".
 */

export function joinDigitRuns(text) {
    let prev = ''
    let cur = text
    while (cur !== prev) {
        prev = cur
        cur = cur.replace(/(\d) (\d)/g, '$1$2')
    }
    return cur
}

export function fixDecimalPointSpacing(text) {
    return text.replace(/(\d) \. (\d)/g, '$1.$2')
}
