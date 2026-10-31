import { FormEvent, useState } from 'react'
import { ArrowRight, Bot } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function AuthPage() {
  const {user, signIn} = useAuth()
  const navigate = useNavigate()
  const [createAccount, setCreateAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await signIn(email, password, createAccount)
      navigate('/app', {replace: true})
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to authenticate')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-5 py-12">
      <section className="glass w-full max-w-md rounded-xl p-7 sm:p-9">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold">
          <Bot className="text-emerald-300" size={22} /> Makky
        </Link>
        <h1 className="mt-8 text-2xl font-semibold">{createAccount ? 'Create your workspace' : 'Welcome back'}</h1>
        <p className="mt-2 text-sm text-gray-400">Sign in to manage your tasks and background runs.</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm text-gray-300">
            Email
            <input autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/50 px-3 py-2.5 text-white outline-none focus:border-emerald-300" />
          </label>
          <label className="block text-sm text-gray-300">
            Password
            <input autoComplete={createAccount ? 'new-password' : 'current-password'} type="password" required minLength={12} maxLength={128}
              value={password} onChange={event => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950/50 px-3 py-2.5 text-white outline-none focus:border-emerald-300" />
            <span className="mt-1 block text-xs text-gray-500">Use at least 12 characters.</span>
          </label>
          {error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50">
            {pending ? 'Working…' : createAccount ? 'Create account' : 'Sign in'} <ArrowRight size={17} />
          </button>
        </form>
        <button type="button" onClick={() => {setCreateAccount(value => !value); setError('')}} className="mt-5 text-sm text-gray-300 hover:text-white">
          {createAccount ? 'Already have an account? Sign in' : 'New to Makky? Create an account'}
        </button>
      </section>
    </main>
  )
}