// node src/lib/live.test.js: the live channel with a fake Supabase client
import assert from 'node:assert/strict'

import { createLive, TABLES } from './liveCore.js'

const handlers = []
let subscribed = 0
// a fake client: its channel records what it is asked to hear; .on() chains, as Supabase's does
const ch = { on(_k, f, cb) { handlers.push({ table: f.table, cb }); return ch }, subscribe() { subscribed++ } }
const fake = { channel: () => ch }

const live = createLive(fake)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fire = (table) => handlers.filter((h) => h.table === table).forEach((h) => h.cb({}))

let a = 0, b = 0
const offA = live.onLive(['bt_submissions'], () => a++, { wait: 20 })
live.onLive(['bt_settings'], () => b++, { wait: 20 })
assert.equal(subscribed, 1, 'one channel for the whole app')
assert.equal(handlers.length, TABLES.length, 'every working table is heard')

// a burst of changes reloads once, after it settles
fire('bt_submissions'); fire('bt_submissions'); fire('bt_submissions')
await wait(50)
assert.equal(a, 1, 'a burst reloads once')
// a change to another table does not wake a page that does not care
assert.equal(b, 0, 'unrelated page stays quiet')
fire('bt_settings')
await wait(50)
assert.equal(b, 1, 'the page that cares reloads')
// unsubscribed: no more reloads
offA()
fire('bt_submissions')
await wait(50)
assert.equal(a, 1, 'a closed page is not called')
assert.equal(live.size(), 1)
console.log('live tests passed')
