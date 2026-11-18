// Turns a database error from saving a form into a sentence people can act on.
// Postgres says a duplicate as code 23505 with details like
// 'Key (lower(email::text))=(a@b.com) already exists.'; find the form field it is about.
export function saveErrorMessage(err, fields = [], form = {}) {
  // row security refused it: a recruiter saving a record for someone else
  if (err?.code === '42501') return 'You can only save records assigned to you.'
  if (err?.code !== '23505') return err?.message || 'Could not save.'
  const key = /Key \((.+?)\)=/.exec(err.details || '')?.[1] || err.message || ''
  const field = fields.find((f) => new RegExp(`(?<![a-z])${f.name}(?![a-z])`).test(key))
  if (!field) return 'This record already exists.'
  const value = form[field.name]
  const label = field.label.toLowerCase()
  return value ? `"${value}" already exists. Use a different ${label}.` : `This ${label} already exists.`
}
