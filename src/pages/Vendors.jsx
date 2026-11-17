import { useState } from 'react'
import CrudPage from '../components/CrudPage'
import Segmented from '../components/Segmented'

export default function Vendors() {
  const [tab, setTab] = useState('companies')
  const tabs = <Segmented label="Vendor view" items={[['companies', 'Companies'], ['contacts', 'Recruiter contacts']]} value={tab} onChange={setTab} />

  return tab === 'companies' ? (
    <CrudPage
      key="companies"
      title="Vendors"
      subtitle="One record per company, with its recruiter contacts"
      toolbar={tabs}
      table="bt_companies"
      select="*, vendor_contacts:bt_vendor_contacts(name, email), submissions:bt_submissions(count)"
      order="name"
      ascending
      noun="company"
      addLabel="Add company"
      columns={[
        { label: 'Company', render: (c) => <strong>{c.name}</strong> },
        { label: 'Recruiter contacts', render: (c) => c.vendor_contacts.length ? <div className="chips">{c.vendor_contacts.map((v) => <span key={v.email} className="chip" title={v.email}>{v.name}</span>)}</div> : <span className="muted">None yet</span> },
        { label: 'Submissions', num: true, render: (c) => c.submissions?.[0]?.count ?? 0 },
      ]}
      fields={[
        { name: 'name', label: 'Company name', required: true, placeholder: 'e.g. Cognizant' },
        { name: 'website', label: 'Website' },
      ]}
    />
  ) : (
    <CrudPage
      key="contacts"
      title="Vendors"
      subtitle="The vendor recruiters who receive your submissions"
      toolbar={tabs}
      table="bt_vendor_contacts"
      select="*, companies:bt_companies(name)"
      order="name"
      ascending
      noun="contact"
      addLabel="Add contact"
      columns={[
        { label: 'Name', render: (v) => <strong>{v.name}</strong> },
        { label: 'Company', render: (v) => v.companies?.name },
        { label: 'Email', render: (v) => <a href={`mailto:${v.email}`}>{v.email}</a> },
        { label: 'Phone', key: 'phone' },
      ]}
      fields={[
        { name: 'company_id', label: 'Company', type: 'select', required: true, ref: { table: 'bt_companies' } },
        { name: 'name', label: 'Recruiter name', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: 'Phone' },
      ]}
    />
  )
}
