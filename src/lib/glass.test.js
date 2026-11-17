// node src/lib/glass.test.js — the refraction map points inward at the rim and is flat inside
import assert from 'node:assert/strict'
import { lensData } from './glass.js'

const w = 120, h = 80, r = 12
const d = lensData(w, h, r)
const px = (x, y) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 4)]

assert.deepEqual(px(60, 40), [128, 128, 0, 255], 'the middle does not move and is all frosted core')
assert.equal(px(0, 40)[2], 255, 'the rim is all crisp bent backdrop')
assert.ok(px(15, 40)[2] > 0 && px(15, 40)[2] < 255 && px(30, 40)[2] === 0, 'the rim fades into the core')
assert.ok(px(0, 40)[0] > 200 && Math.abs(px(0, 40)[1] - 128) <= 1, 'left edge pulls from the right (inward)')
assert.ok(px(w - 1, 40)[0] < 56, 'right edge pulls from the left')
assert.ok(px(60, 0)[1] > 200 && px(60, h - 1)[1] < 56, 'top pulls down, bottom pulls up')
const c = px(4, 4)
assert.ok(c[0] > 128 && c[1] > 128, 'a corner pulls in along its diagonal')
assert.ok(px(10, 40)[0] < px(2, 40)[0], 'the pull eases off away from the edge')
for (let i = 3; i < d.length; i += 4) assert.equal(d[i], 255, 'opaque everywhere')
console.log('glass lens map: ok')
