import assert from 'node:assert/strict'
import { ALL_ACCENTS } from './accents.js'
import { accentTokens, contrast, GROUNDS, hex } from './color.js'

// Every preset, plus extremes, must pass every job in both modes:
// button label 4.5, hover label 4.5, marks 3 on every ground, text 4.5 on every ground and on the soft tint
const extremes = [['white', '#ffffff'], ['black', '#000000'], ['yellow', '#ffff00'], ['lime', '#00ff00'], ['short', '#0af'], ['garbage', 'nope']]
for (const [name, c] of [...ALL_ACCENTS, ...extremes]) {
  for (const dark of [false, true]) {
    const t = accentTokens(c, dark)
    const at = `${name} ${dark ? 'dark' : 'light'}`
    const grounds = GROUNDS[dark ? 'dark' : 'light'].map(hex)
    assert.ok(contrast(hex(t.accent), hex(t.on)) >= 4.5, `${at}: button label ${t.on} on ${t.accent}`)
    assert.ok(contrast(hex(t.hover), hex(t.on)) >= 4.5, `${at}: hover label ${t.on} on ${t.hover}`)
    assert.notEqual(t.hover, t.accent, `${at}: hover must look different`)
    for (const g of grounds) {
      assert.ok(contrast(hex(t.mark), g) >= 3, `${at}: mark ${t.mark} on ground`)
      assert.ok(contrast(hex(t.ink), g) >= 4.5, `${at}: text ${t.ink} on ground`)
    }
    assert.ok(contrast(hex(t.ink), hex(t.soft)) >= 4.5, `${at}: text ${t.ink} on soft ${t.soft}`)
  }
}
// every preset has its own name and its own colour
assert.equal(new Set(ALL_ACCENTS.map(([n]) => n)).size, ALL_ACCENTS.length, 'duplicate colour name')
assert.equal(new Set(ALL_ACCENTS.map(([, c]) => c.toLowerCase())).size, ALL_ACCENTS.length, 'duplicate colour code')
assert.equal(accentTokens('#0f766e', false).accent, '#0f766e') // already readable: unchanged
console.log('color tests passed')
