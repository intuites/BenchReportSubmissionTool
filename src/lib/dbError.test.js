import assert from 'node:assert/strict'
import { saveErrorMessage } from './dbError.js'

const fields = [{ name: 'company_id', label: 'Company' }, { name: 'name', label: 'Recruiter name' }, { name: 'email', label: 'Email' }]
const form = { company_id: '1', name: 'John Cena', email: 'arahman@intuites.com' }

assert.equal(
  saveErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "bt_vendor_contacts_email_uq"', details: 'Key (lower(email::text))=(arahman@intuites.com) already exists.' }, fields, form),
  '"arahman@intuites.com" already exists. Use a different email.',
)
// no details: falls back to the constraint name in the message
assert.equal(
  saveErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "bt_companies_name_uq"' }, [{ name: 'name', label: 'Company' }], { name: 'Apple LLC' }),
  '"Apple LLC" already exists. Use a different company.',
)
assert.equal(saveErrorMessage({ code: '23505', message: 'x' }, fields, form), 'This record already exists.')
assert.equal(saveErrorMessage({ code: '42501', message: 'new row violates row-level security policy' }, fields, form), 'You can only save records assigned to you.')
assert.equal(saveErrorMessage({ code: '22001', message: 'value too long' }, fields, form), 'value too long')
console.log('dbError ok')
