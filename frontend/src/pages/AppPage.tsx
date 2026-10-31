import { FormEvent, useEffect, useState } from 'react'
import { Activity, Bot, Gauge, LogOut, Plus, Send, Settings, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

type TaskEvent = {id: number; agent_id: string; kind: string; message: string; progress: number}
type Task = {
  id: string
  title: string
  prompt: string
  status: string
  result: string | null
  error: string | null
  model: string | null
  events?: TaskEvent[]
}

async function loadTask(taskId: string): Promise<Task> {
  const response = await fetch(`/tasks/${taskId}`, {credentials: 'include'})
  if (!response.ok) throw new Error(`Unable to load task (${response.status})`)
  return response.json()
}

export default function AppPage() {
  const {user, signOut} = useAuth()
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [liveDraft, setLiveDraft] = useState('')
  const [error, setError] = useState('')
  const selectedTask = tasks.find(task => task.id === selectedTaskId) ?? null

  useEffect(() => {
    let active = true
    fetch('/tasks', {credentials: 'include'})
      .then(async response => {
        if (!response.ok) throw new Error(`Unable to load task history (${response.status})`)
        return response.json() as Promise<Task[]>
      })
      .then(items => {
        if (!active) return
        setTasks(items)
        if (items[0]) setSelectedTaskId(items[0].id)
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load task history')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selectedTaskId) {
      setEvents([])
      setLiveDraft('')
      return
    }
    let active = true
    let source: EventSource | null = null
    const connect = async () => {
      try {
        const detail = await loadTask(selectedTaskId)
        if (!active) return
        setTasks(current => current.map(task => task.id === detail.id ? detail : task))
        const detailEvents = detail.events ?? []
        setEvents(detailEvents)
        setLiveDraft(detailEvents
          .filter(item => item.agent_id === 'mimi' && item.kind === 'delta')
          .map(item => item.message)
          .join(''))
        if (detail.status !== 'queued' && detail.status !== 'running') return

        const lastId = detailEvents[detailEvents.length - 1]?.id ?? 0
        source = new EventSource(`/tasks/${detail.id}/events?after_id=${lastId}`)
        source.onmessage = event => {
          const item = JSON.parse(event.data) as Omit<TaskEvent, 'id'>
          const nextEvent = {...item, id: Number(event.lastEventId)}
          setEvents(current => [...current, nextEvent])
          if (item.agent_id === 'mimi' && item.kind === 'delta') {
            setLiveDraft(current => current + item.message)
          }
          if (item.kind === 'completed' || item.kind === 'failed') {
            source?.close()
            void loadTask(detail.id).then(updated => {
              setTasks(current => current.map(task => task.id === updated.id ? updated : task))
              setEvents(updated.events ?? [])
            }).catch(() => undefined)
          }
        }
        source.addEventListener('end', () => {
          source?.close()
          void loadTask(detail.id).then(updated => {
            setTasks(current => current.map(task => task.id === updated.id ? updated : task))
            setEvents(updated.events ?? [])
          }).catch(() => undefined)
        })
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to connect to task')
      }
    }
    void connect()
    return () => {
      active = false
      source?.close()
    }
  }, [selectedTaskId])

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt || pending) return
    setInput('')
    setPending(true)
    setError('')

    try {
      const response = await fetch('/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt}),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail ?? `Request failed (${response.status})`)
      }
      const task = await response.json() as Task
      setTasks(current => [task, ...current])
      setSelectedTaskId(task.id)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to start task')
      setInput(prompt)
    } finally {
      setPending(false)
    }
  }

  const startNewTask = () => {
    setSelectedTaskId(null)
    setEvents([])
    setInput('')
    setError('')
  }

  return (
    <div className="flex h-screen min-h-[560px] gap-3 p-3 md:p-4">
      <aside className="glass hidden w-72 shrink-0 flex-col rounded-xl p-4 md:flex">
        <Link to="/" className="mb-5 flex items-center gap-2 text-lg font-semibold"><Bot className="text-emerald-300" /> Makky</Link>
        <button onClick={startNewTask} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 py-2.5 font-medium text-slate-950 hover:bg-emerald-300">
          <Plus size={17} /> New task
        </button>
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Background worker queue
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500"><Activity size={14} /> Task history</div>
        <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
          {tasks.map(task => (
            <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${task.id === selectedTaskId ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
              <span className="block truncate">{task.title}</span>
              <span className="mt-1 flex items-center gap-1.5 text-xs capitalize text-gray-500">
                <span className={`h-1.5 w-1.5 rounded-full ${task.status === 'completed' ? 'bg-emerald-400' : task.status === 'failed' ? 'bg-rose-400' : 'bg-sky-400'}`} /> {task.status}
              </span>
            </button>
          ))}
          {!tasks.length && <p className="px-3 py-3 text-xs text-gray-500">No tasks yet</p>}
        </div>
        <nav className="space-y-1 border-t border-white/10 pt-3 text-sm">
          <Link to="/metrics" className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white"><Gauge size={16} /> Metrics</Link>
          <Link to="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-400 hover:bg-white/5 hover:text-white"><Settings size={16} /> Settings</Link>
        </nav>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="min-w-0 truncate text-xs text-gray-400">{user?.email}</span>
          <button onClick={() => void signOut()} title="Sign out" aria-label="Sign out" className="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white"><LogOut size={16} /></button>
        </div>
      </aside>
      <main className="glass flex min-w-0 flex-1 flex-col rounded-xl">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Bot className="shrink-0 text-amber-300" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{selectedTask?.title ?? 'Kiki · Chief of Staff'}</h1>
              <p className="mt-0.5 truncate text-xs text-gray-500">Kiki · Mimi · Zazu · OpenRouter free-model routing</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-300 sm:flex"><ShieldCheck size={14} className="text-emerald-300" /> Private workspace</div>
            <div className="flex items-center gap-1 md:hidden">
              <button onClick={startNewTask} title="New task" aria-label="New task" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300"><Plus size={17} /></button>
              <Link to="/metrics" title="Metrics" aria-label="Metrics" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300"><Gauge size={16} /></Link>
              <Link to="/settings" title="Settings" aria-label="Settings" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-gray-300"><Settings size={16} /></Link>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {error && <p role="alert" className="mx-auto mb-4 max-w-3xl rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          {selectedTask ? (
            <div className="mx-auto max-w-3xl space-y-6">
              <div className="ml-auto max-w-2xl rounded-xl border border-white/10 bg-white/[0.07] p-4 text-sm leading-6 text-gray-100 whitespace-pre-wrap">{selectedTask.prompt}</div>
              {(selectedTask.status === 'queued' || selectedTask.status === 'running') && (
                <section className="max-w-2xl rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-4">
                  <div className="flex items-center justify-between text-sm"><span className="font-medium text-emerald-100">{selectedTask.status === 'queued' ? 'Waiting for a worker' : 'Working on your task'}</span><span className="text-xs capitalize text-gray-400">{selectedTask.status}</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full animate-pulse rounded-full bg-emerald-300" style={{width: `${Math.max(events[events.length - 1]?.progress ?? 8, 8)}%`}} /></div>
                  <div className="mt-4 space-y-2">
                    {events.filter(item => item.kind !== 'delta').map(item => <p key={item.id} className="flex items-center gap-2 text-xs text-gray-400"><span className="w-12 shrink-0 font-medium text-gray-300">{item.agent_id}</span>{item.message}</p>)}
                  </div>
                </section>
              )}
              {liveDraft && (selectedTask.status === 'queued' || selectedTask.status === 'running') && (
                <section className="max-w-2xl rounded-xl border border-white/10 bg-slate-950/25 p-4">
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-pink-200">Mimi · live draft</h2>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-gray-200">{liveDraft}</p>
                </section>
              )}
              {selectedTask.status === 'completed' && selectedTask.result && (
                <div className="max-w-2xl rounded-xl border border-white/10 bg-slate-950/25 p-4 text-sm leading-7 text-gray-100 whitespace-pre-wrap">{selectedTask.result}</div>
              )}
              {selectedTask.status === 'failed' && <p className="max-w-2xl rounded-lg border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{selectedTask.error ?? 'This task failed.'}</p>}
              {selectedTask.status === 'completed' && events.length > 0 && (
                <div className="max-w-2xl border-t border-white/10 pt-4">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Execution activity</h2>
                  <div className="space-y-2">{events.map(item => <p key={item.id} className="flex gap-3 text-xs text-gray-400"><span className="w-12 shrink-0 text-gray-300">{item.agent_id}</span>{item.message}</p>)}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10"><Bot className="text-amber-300" /></div>
              <h2 className="mt-5 text-xl font-semibold">What should Makky work on?</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-gray-400">Tasks run in the background and stay in your history. This workspace can reason and synthesize; external browsing tools are not connected.</p>
            </div>
          )}
        </div>
        <form onSubmit={send} className="border-t border-white/10 p-3 sm:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-2 focus-within:border-emerald-300/40">
            <textarea value={input} onChange={event => setInput(event.target.value)} rows={2} maxLength={10000} placeholder="Describe a task for Kiki…" aria-label="Task prompt"
              className="max-h-40 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-gray-500" />
            <button type="submit" disabled={pending || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-40" aria-label="Start task">
              <Send size={17}/>
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] text-gray-500">Tasks are persisted and continue while you are away. Avoid entering passwords or sensitive credentials.</p>
        </form>
      </main>
    </div>
  )
}
