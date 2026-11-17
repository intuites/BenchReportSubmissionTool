import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'
import Segmented from '../components/Segmented'
import '../styles/landing.css'

// Set VITE_ALLOW_SIGNUP=false in .env (and Vercel) to hide the Create account tab
const ALLOW_SIGNUP = import.meta.env.VITE_ALLOW_SIGNUP !== 'false'

const COPY = {
  signin: { title: 'Sign in to Bench Tracker', text: 'Submissions, the interviews they earned, and the candidates still waiting', button: 'Sign in', busy: 'Signing in…' },
  signup: { title: 'Create your account', text: 'Use your work email. Once you confirm it, an admin gives you access', button: 'Create account', busy: 'Creating account…' },
}

// A row that grows open or folds shut in place, so sign-in and sign-up read as one form changing.
// Closed, its fields leave the tab order and stop being required.
function Fold({ open, children }) {
  return (
    <div className={`fold ${open ? 'open' : ''}`} inert={open ? undefined : ''} aria-hidden={!open}>
      <div className="fold-inner">{children}</div>
    </div>
  )
}

export default function Login({ initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const signup = mode === 'signup'

  function switchMode(m) { setMode(m); setError(''); setSentTo(''); history.replaceState(null, '', `#${m}`) }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const email = form.email.trim().toLowerCase()
    if (signup) {
      if (form.password.length < 8) return setError('Use at least 8 characters for your password.')
      if (form.password !== form.confirm) return setError('The two passwords don’t match.')
    }
    setBusy(true)
    const { data, error } = signup
      ? await supabase.auth.signUp({ email, password: form.password, options: { data: { full_name: form.name.trim() }, emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password: form.password })
    setBusy(false)
    if (error) return setError(error.message)
    // With email confirmation on (Supabase's default) sign-up returns no session: ask them to check their inbox
    if (signup && !data.session) setSentTo(email)
  }

  const c = COPY[mode]
  const title = sentTo ? 'Check your inbox' : c.title
  return (
    <main className="auth auth-site">
      <header className="auth-bar">
        <div className="auth-bar-in">
          <a href="#" className="auth-home" aria-label="Bench Tracker home"><Logo /></a>
        </div>
      </header>
      <div className="auth-col" data-enter>

        <header className="auth-head">
          <h1 key={title} className="swap">{title}</h1>
          <p key={sentTo || c.text} className="muted swap">
            {sentTo ? <>We sent a confirmation link to <strong>{sentTo}</strong>. Open it, then sign in here.</> : c.text}
          </p>
        </header>

        {!supabase ? (
          <section className="auth-card setup">
            <h2>Connect your database</h2>
            <ol>
              <li>Create a Supabase project and run <code>supabase/schema.sql</code> in its SQL Editor.</li>
              <li>Copy <code>.env.example</code> to <code>.env</code> and fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</li>
              <li>Restart <code>npm run dev</code>.</li>
            </ol>
          </section>
        ) : sentTo ? (
          <section className="auth-card sent swap">
            <MailCheck size={28} strokeWidth={1.5} className="sent-icon" />
            <button className="btn block" onClick={() => switchMode('signin')}>Back to sign in</button>
          </section>
        ) : (
          <form className="auth-card form" onSubmit={submit}>
            {ALLOW_SIGNUP && <Segmented label="Sign in or create account" items={[['signin', 'Sign in'], ['signup', 'Create account']]} value={mode} onChange={switchMode} />}
            <Fold open={signup}>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input id="name" autoComplete="name" required={signup} value={form.name} onChange={set('name')} />
              </div>
            </Fold>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required value={form.password} onChange={set('password')} />
            </div>
            <Fold open={signup}>
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input id="confirm" type="password" autoComplete="new-password" required={signup} value={form.confirm} onChange={set('confirm')} />
              </div>
            </Fold>
            {error && <p className="alert" role="alert">{error}</p>}
            <button className="btn primary block" disabled={busy} aria-busy={busy}>
              <span key={mode} className="swap">{busy ? c.busy : c.button}</span>
            </button>
          </form>
        )}

        {ALLOW_SIGNUP && supabase && !sentTo && (
          <p className="auth-switch muted">
            {signup
              ? <>Already have an account? <button type="button" className="link" onClick={() => switchMode('signin')}>Sign in</button></>
              : <>New to the team? <button type="button" className="link" onClick={() => switchMode('signup')}>Create an account</button></>}
          </p>
        )}
      </div>
    </main>
  )
}
