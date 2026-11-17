import assert from 'node:assert/strict'
import { periodRange, shift } from './period.js'

// 2026-11-14 is a Saturday
assert.deepEqual(periodRange('day', '2026-11-14'), { from: '2026-11-14', to: '2026-11-14' })
assert.deepEqual(periodRange('week', '2026-11-14'), { from: '2026-11-09', to: '2026-11-15' })
assert.deepEqual(periodRange('week', '2026-11-16'), { from: '2026-11-16', to: '2026-11-22' }) // Monday
assert.deepEqual(periodRange('week', '2026-11-15'), { from: '2026-11-09', to: '2026-11-15' }) // Sunday
assert.deepEqual(periodRange('month', '2028-02-10'), { from: '2028-02-01', to: '2028-02-29' }) // leap year
assert.deepEqual(periodRange('week', '2026-12-31'), { from: '2026-12-28', to: '2027-01-03' }) // crosses year
assert.equal(shift('month', '2026-01-31', 1), '2026-02-01')
assert.equal(shift('week', '2026-11-14', -1), '2026-11-07')
console.log('period tests passed')
