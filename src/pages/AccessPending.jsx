import { useState } from 'react'
import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import { confirmDialog } from '../components/Confirm'
import '../styles/landing.css'

// Signed in, but this email isn't an active recruiter or an admin yet. Same centred column as sign-in.
export default function AccessPending({ email, onRetry }) {
  const [checking, setChecking] = useState(false)
  return (
    <main className="auth auth-site">
      <header className="auth-bar">
        <div className="auth-bar-in"><Logo /></div>
      </header>
      <div className="auth-col" data-enter>
        <header className="auth-head">
          <h1>Waiting for access</h1>
          <p className="muted">You’re signed in as <strong>{email}</strong>, but this email isn’t on the team yet</p>
        </header>
        <section className="auth-card">
          <Clock size={28} strokeWidth={1.5} className="sent-icon" />
          <p className="auth-note">Ask your admin to approve you on the Team access page, or to add you as a recruiter. Then check again.</p>
          <button className="btn primary block" disabled={checking} aria-busy={checking} onClick={async () => { setChecking(true); await onRetry(); setChecking(false) }}>
            <RefreshCw size={16} /> {checking ? 'Checking…' : 'Check again'}
          </button>
          <button className="btn block" onClick={async () => { if (await confirmDialog('Sign out of Bench Tracker?', { body: 'You can sign back in any time to check whether your access is ready.', confirm: 'Sign out', cancel: 'Stay signed in' })) supabase.auth.signOut() }}><LogOut size={16} /> Sign out</button>
        </section>
      </div>
    </main>
  )
}
