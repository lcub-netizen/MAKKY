import { FormEvent, useEffect, useState } from 'react'
import { ArrowLeft, Check, Download, LockKeyhole, Save, Server, ShieldCheck, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

type SettingsData = {
  preferred_model: string | null
  fallback_enabled: boolean
  available_models: string[]
  provider_configured: boolean
  secure_cookies: boolean
  capabilities: {background_tasks: boolean; persistent_history: boolean; scheduled_runs: boolean; live_browser: boolean; continuous_scouting: boolean}
}
type SessionData = {id: string; created_at: string; expires_at: string; current: boolean; revoked: boolean}
type ScheduledLoop = {id: string; title: string; prompt: string; interval_minutes: number; enabled: boolean; next_run_at: string; last_run_at: string | null}

export default function Settings() {
  const {signOut} = useAuth()
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loops, setLoops] = useState<ScheduledLoop[]>([])
  const [loopPrompt, setLoopPrompt] = useState('')
  const [loopInterval, setLoopInterval] = useState(60)
  const [creatingLoop, setCreatingLoop] = useState(false)
  const [model, setModel] = useState('')
  const [fallback, setFallback] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/settings', {credentials: 'include'}),
      fetch('/auth/sessions', {credentials: 'include'}),
      fetch('/loops', {credentials: 'include'}),
    ])
      .then(async ([settingsResponse, sessionsResponse, loopsResponse]) => {
        if (!settingsResponse.ok) throw new Error(`Unable to load settings (${settingsResponse.status})`)
        if (!sessionsResponse.ok) throw new Error(`Unable to load sessions (${sessionsResponse.status})`)
        if (!loopsResponse.ok) throw new Error(`Unable to load scheduled runs (${loopsResponse.status})`)
        return [await settingsResponse.json(), await sessionsResponse.json(), await loopsResponse.json()] as [SettingsData, SessionData[], ScheduledLoop[]]
      })
      .then(([value, sessionItems, loopItems]) => {
        setSettings(value)
        setModel(value.preferred_model ?? '')
        setFallback(value.fallback_enabled)
        setSessions(sessionItems)
        setLoops(loopItems)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load settings'))
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const response = await fetch('/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({preferred_model: model || null, fallback_enabled: fallback}),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail ?? `Unable to save settings (${response.status})`)
      }
      setSettings(await response.json())
      setSaved(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save settings')
    } finally {
      setSaving(false)
    }
  }

  const createLoop = async (event: FormEvent) => {
    event.preventDefault()
    setCreatingLoop(true)
    setError('')
    try {
      const response = await fetch('/loops', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt: loopPrompt, interval_minutes: loopInterval}),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail ?? `Unable to create scheduled run (${response.status})`)
      }
      const created = await response.json() as ScheduledLoop
      setLoops(current => [created, ...current])
      setLoopPrompt('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create scheduled run')
    } finally {
      setCreatingLoop(false)
    }
  }

  const updateLoop = async (loop: ScheduledLoop, enabled: boolean) => {
    const response = await fetch(`/loops/${loop.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({enabled}),
    })
    if (!response.ok) {
      setError(`Unable to update scheduled run (${response.status})`)
      return
    }
    const updated = await response.json() as ScheduledLoop
    setLoops(current => current.map(item => item.id === loop.id ? updated : item))
  }

  const deleteLoop = async (loop: ScheduledLoop) => {
    const response = await fetch(`/loops/${loop.id}`, {method: 'DELETE', credentials: 'include'})
    if (!response.ok) {
      setError(`Unable to delete scheduled run (${response.status})`)
      return
    }
    setLoops(current => current.filter(item => item.id !== loop.id))
  }

  const revokeSession = async (session: SessionData) => {
    setError('')
    const response = await fetch(`/auth/sessions/${session.id}`, {method: 'DELETE', credentials: 'include'})
    if (!response.ok) {
      setError(`Unable to revoke session (${response.status})`)
      return
    }
    setSessions(current => current.map(item => item.id === session.id ? {...item, revoked: true} : item))
    if (session.current) await signOut()
  }

  const resetHistory = async () => {
    if (!window.confirm('Delete all completed and failed task history? This cannot be undone.')) return
    setResetting(true)
    setError('')
    try {
      const response = await fetch('/tasks', {method: 'DELETE', credentials: 'include'})
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail ?? `Unable to reset history (${response.status})`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reset history')
    } finally {
      setResetting(false)
    }
  }

  const capabilityRows = [
    ['Persistent task history', settings?.capabilities.persistent_history],
    ['Background task runner', settings?.capabilities.background_tasks],
    ['Scheduled recurring runs', settings?.capabilities.scheduled_runs],
    ['Live browser control', settings?.capabilities.live_browser],
    ['Continuous trend scouting', settings?.capabilities.continuous_scouting],
  ] as const

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 sm:px-8">
      <header className="mb-8 border-b border-white/10 pb-5">
        <Link to="/app" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Workspace</Link>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>
      {error && <p role="alert" className="mb-5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      <form onSubmit={save} className="space-y-8">
        <section className="border-b border-white/10 pb-8">
          <div className="flex items-center gap-2"><Server size={17} className="text-emerald-300" /><h2 className="font-medium">AI routing</h2></div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">The OpenRouter key is configured on the server and is never returned to the browser.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm text-gray-300">Preferred free model
              <select value={model} onChange={event => setModel(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-emerald-300">
                <option value="">Automatic selection</option>
                {settings?.available_models.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-gray-300">
              <input type="checkbox" checked={fallback} onChange={event => setFallback(event.target.checked)} className="h-4 w-4 accent-emerald-400" />
              Fall back on rate limits
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
            <span className={`h-2 w-2 rounded-full ${settings?.provider_configured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {settings?.provider_configured ? 'Provider key detected on server' : 'Provider key not configured'}
          </div>
        </section>
        <section className="border-b border-white/10 pb-8">
          <div className="flex items-center gap-2"><Server size={17} className="text-sky-300" /><h2 className="font-medium">Scheduled runs</h2></div>
          <p className="mt-2 text-sm leading-6 text-gray-400">Recurring prompts run independently of your browser tab. They use model knowledge only; live web research is not connected.</p>
          <form onSubmit={createLoop} className="mt-4 space-y-3">
            <label className="block text-sm text-gray-300">Prompt
              <textarea required minLength={1} maxLength={10000} value={loopPrompt} onChange={event => setLoopPrompt(event.target.value)} rows={3} placeholder="What should Makky revisit on a schedule?"
                className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-300" />
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm text-gray-300">Frequency
                <select value={loopInterval} onChange={event => setLoopInterval(Number(event.target.value))} className="mt-2 block rounded-lg border border-white/15 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-sky-300">
                  <option value={15}>Every 15 minutes</option><option value={30}>Every 30 minutes</option><option value={60}>Every hour</option><option value={360}>Every 6 hours</option>
                </select>
              </label>
              <button type="submit" disabled={creatingLoop || !loopPrompt.trim() || loops.some(loop => loop.enabled)} className="rounded-lg border border-sky-300/30 px-4 py-2.5 text-sm text-sky-100 hover:bg-sky-300/10 disabled:opacity-40">{creatingLoop ? 'Creating…' : 'Create scheduled run'}</button>
              {loops.some(loop => loop.enabled) && <span className="text-xs text-gray-500">Pause the active schedule before adding another.</span>}
            </div>
          </form>
          <div className="mt-5 divide-y divide-white/5 border-y border-white/10">
            {loops.map(loop => <article key={loop.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><h3 className="truncate text-sm text-gray-200">{loop.title}</h3><p className="mt-1 text-xs text-gray-500">Every {loop.interval_minutes >= 60 ? `${loop.interval_minutes / 60}h` : `${loop.interval_minutes}m`} · Next {new Date(loop.next_run_at).toLocaleString()}</p></div>
              <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs text-gray-400"><input type="checkbox" checked={loop.enabled} onChange={event => void updateLoop(loop, event.target.checked)} className="h-4 w-4 accent-emerald-400" /> Active</label><button type="button" onClick={() => void deleteLoop(loop)} aria-label={`Delete ${loop.title}`} className="rounded p-2 text-gray-500 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 size={15} /></button></div>
            </article>)}
            {!loops.length && <p className="py-4 text-xs text-gray-500">No scheduled runs configured.</p>}
          </div>
        </section>
        <section className="border-b border-white/10 pb-8">
          <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-300" /><h2 className="font-medium">System capabilities</h2></div>
          <div className="mt-4 divide-y divide-white/5">
            {capabilityRows.map(([label, enabled]) => <div key={label} className="flex items-center justify-between py-3 text-sm">
              <span className="text-gray-300">{label}</span>
              <span className={`text-xs ${enabled ? 'text-emerald-300' : 'text-gray-500'}`}>{enabled ? 'Available' : 'Not configured'}</span>
            </div>)}
          </div>
        </section>
        <section className="pb-2">
          <div className="flex items-center gap-2"><LockKeyhole size={17} className="text-emerald-300" /><h2 className="font-medium">Session security</h2></div>
          <p className="mt-2 text-sm text-gray-400">Authentication cookies are HttpOnly and SameSite strict. Secure-only cookies are {settings?.secure_cookies ? 'enabled' : 'disabled for local development'}.</p>
          <div className="mt-4 divide-y divide-white/5 border-y border-white/10">
            {sessions.map(session => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="text-xs text-gray-400"><span className="text-gray-200">{session.current ? 'This session' : 'Signed-in session'}</span><span className="mx-2 text-gray-600">·</span>{new Date(session.created_at).toLocaleString()}</div>
              {session.revoked ? <span className="text-xs text-gray-500">Revoked</span> : <button type="button" onClick={() => void revokeSession(session)} className="text-xs text-rose-300 hover:text-rose-200">Revoke</button>}
            </div>)}
            {!sessions.length && <p className="py-3 text-xs text-gray-500">No active sessions.</p>}
          </div>
        </section>
        <section className="border-t border-white/10 pt-6">
          <h2 className="font-medium">Your data</h2>
          <p className="mt-2 text-sm text-gray-400">Export an archive or clear completed task history. Active tasks must finish before reset.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/tasks/export" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-200 hover:bg-white/5"><Download size={15} /> Export task archive</a>
            <button type="button" onClick={() => void resetHistory()} disabled={resetting} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"><Trash2 size={15} /> {resetting ? 'Resetting…' : 'Clear task history'}</button>
          </div>
        </section>
        <div className="flex items-center gap-3 border-t border-white/10 pt-5">
          <button type="submit" disabled={saving || !settings} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"><Save size={16} /> {saving ? 'Saving…' : 'Save settings'}</button>
          {saved && <span role="status" className="inline-flex items-center gap-1 text-sm text-emerald-300"><Check size={15} /> Saved</span>}
        </div>
      </form>
    </main>
  )
}
