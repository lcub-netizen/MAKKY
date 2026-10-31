import { useEffect, useState } from 'react'
import { Activity, ArrowLeft, CheckCircle2, Clock3, ListTodo } from 'lucide-react'
import { Link } from 'react-router-dom'

type MetricsData = {
  total_tasks: number
  active_tasks: number
  completed_tasks: number
  success_rate: number
  active_loops: number
  agent_utilization: {agent_id: string; events: number}[]
  recent_tasks: {id: string; title: string; status: string; task_type: string; model: string | null; created_at: string}[]
  task_profile: {
    recommended_dashboard: string
    by_type: Record<string, number>
    outcomes_by_type: Record<string, {total: number; completed: number; active: number; failed: number}>
    dashboard_cards?: Array<{label: string; value: number; tone?: string}>
    report?: {
      task_type?: string
      summary?: string
      profit_report?: Record<string, number | string>
      risk_controls?: string[]
      techniques_used?: string[]
      dashboard_cards?: Array<{label: string; value: number; tone?: string}>
    }
    financial_reporting: {available: boolean; reason: string}
  }
}
type SystemMetrics = {
  process_cpu_percent: number
  process_memory_bytes: number
  process_memory_percent: number
  process_threads: number
  sampled_at: string
}

const emptyMetrics: MetricsData = {
  total_tasks: 0,
  active_tasks: 0,
  completed_tasks: 0,
  success_rate: 0,
  active_loops: 0,
  agent_utilization: [],
  recent_tasks: [],
  task_profile: {
    recommended_dashboard: 'operations',
    by_type: {trading: 0, sales: 0, operations: 0},
    outcomes_by_type: {
      trading: {total: 0, completed: 0, active: 0, failed: 0},
      sales: {total: 0, completed: 0, active: 0, failed: 0},
      operations: {total: 0, completed: 0, active: 0, failed: 0},
    },
    financial_reporting: {available: false, reason: 'Financial execution data is not connected.'},
  },
}

export default function Metrics() {
  const [data, setData] = useState(emptyMetrics)
  const [system, setSystem] = useState<SystemMetrics | null>(null)
  const [dashboardType, setDashboardType] = useState('operations')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/tasks/metrics/summary', {credentials: 'include'})
      .then(async response => {
        if (!response.ok) throw new Error(`Unable to load metrics (${response.status})`)
        return response.json()
      })
      .then((value: MetricsData) => {
        setData(value)
        setDashboardType(value.task_profile.recommended_dashboard)
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load metrics'))
  }, [])

  useEffect(() => {
    let active = true
    const refresh = () => {
      fetch('/system/metrics', {credentials: 'include'})
        .then(async response => {
          if (!response.ok) throw new Error(`Unable to load system metrics (${response.status})`)
          return response.json() as Promise<SystemMetrics>
        })
        .then(value => { if (active) setSystem(value) })
        .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load system metrics') })
    }
    refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const cards = [
    {label: 'Tasks processed', value: data.total_tasks, icon: ListTodo},
    {label: 'Active tasks', value: data.active_tasks, icon: Activity},
    {label: 'Success rate', value: `${data.success_rate}%`, icon: CheckCircle2},
    {label: 'Background loops', value: data.active_loops, icon: Clock3},
  ]
  const maxEvents = Math.max(...data.agent_utilization.map(agent => agent.events), 1)
  const taskOutcomes = data.task_profile.outcomes_by_type[dashboardType] ?? data.task_profile.outcomes_by_type.operations
  const taskSuccessRate = taskOutcomes.total ? Math.round(taskOutcomes.completed / taskOutcomes.total * 100) : 0
  const selectedReport = data.task_profile.report ?? {
    summary: 'No task-specific execution report is available yet.',
    risk_controls: [],
    techniques_used: [],
    profit_report: {},
    dashboard_cards: [{label: 'Tasks', value: taskOutcomes.total}, {label: 'Completed', value: taskOutcomes.completed}, {label: 'Active', value: taskOutcomes.active}, {label: 'Failed', value: taskOutcomes.failed}, {label: 'Completion rate', value: `${taskSuccessRate}%`}],
  }
  const taskCards = selectedReport.dashboard_cards?.length ? selectedReport.dashboard_cards : [
    {label: 'Tasks', value: taskOutcomes.total},
    {label: 'Completed', value: taskOutcomes.completed},
    {label: 'Active', value: taskOutcomes.active},
    {label: 'Failed', value: taskOutcomes.failed},
    {label: 'Completion rate', value: `${taskSuccessRate}%`},
  ]

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-5">
        <div>
          <Link to="/app" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Workspace</Link>
          <h1 className="text-2xl font-semibold">Metrics</h1>
        </div>
        <span className="text-xs text-gray-500">Your account</span>
      </header>
      {error && <p role="alert" className="mb-5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({label, value, icon: Icon}) => (
          <div key={label} className="glass rounded-lg p-4 sm:p-5">
            <div className="flex items-center justify-between text-sm text-gray-400"><span>{label}</span><Icon size={16} className="text-emerald-300" /></div>
            <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </section>
      <section className="mt-8 border-y border-white/10 py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Task performance</h2>
            <p className="mt-1 text-xs text-gray-500">Outcome metrics for your selected workflow</p>
          </div>
          <div className="flex rounded-md border border-white/10 p-1" role="group" aria-label="Select task dashboard">
            {['trading', 'sales', 'operations'].map(type => (
              <button key={type} onClick={() => setDashboardType(type)} aria-pressed={dashboardType === type} className={`rounded px-3 py-1.5 text-xs capitalize ${dashboardType === type ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'}`}>
                {type} <span className="ml-1 text-gray-500">{data.task_profile.by_type[type] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {taskCards.map(card => (
            <div key={card.label} className="rounded-md border border-white/10 px-4 py-3">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Task summary</p>
            <p className="mt-3 text-sm leading-6 text-gray-200">{selectedReport.summary}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Profit view</p>
            <div className="mt-3 space-y-2 text-xs text-gray-300">
              {Object.entries(selectedReport.profit_report ?? {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 border-b border-white/5 pb-1">
                  <span className="capitalize text-gray-400">{key.replace(/_/g, ' ')}</span>
                  <span className="font-medium text-white">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {(selectedReport.risk_controls?.length || selectedReport.techniques_used?.length) && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {selectedReport.risk_controls?.length ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Risk controls</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-200">
                  {selectedReport.risk_controls.map(item => <li key={item} className="list-disc pl-4">{item}</li>)}
                </ul>
              </div>
            ) : null}
            {selectedReport.techniques_used?.length ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Techniques used</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-200">
                  {selectedReport.techniques_used.map(item => <li key={item} className="list-disc pl-4">{item}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        )}
        {(dashboardType === 'trading' || dashboardType === 'sales') && (
          <div className="mt-5 border-l-2 border-amber-300/60 pl-3">
            <p className="text-sm font-medium text-amber-100">Verified profit reporting unavailable</p>
            <p className="mt-1 text-xs leading-5 text-gray-400">{data.task_profile.financial_reporting.reason}</p>
          </div>
        )}
      </section>
      <section className="mt-8 border-y border-white/10 py-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-200">API process monitor</h2>
          <span className="text-[11px] text-gray-500">Refreshes every 15 seconds · {system ? new Date(system.sampled_at).toLocaleTimeString() : 'waiting for sample'}</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {label: 'CPU', value: system ? `${system.process_cpu_percent.toFixed(1)}%` : '—', percent: Math.min(system?.process_cpu_percent ?? 0, 100)},
            {label: 'Memory', value: system ? `${(system.process_memory_bytes / 1024 / 1024).toFixed(1)} MB` : '—', percent: Math.min(system?.process_memory_percent ?? 0, 100)},
            {label: 'Threads', value: system ? String(system.process_threads) : '—', percent: Math.min((system?.process_threads ?? 0) * 5, 100)},
          ].map(metric => <div key={metric.label}>
            <div className="mb-2 flex justify-between text-xs"><span className="text-gray-400">{metric.label}</span><span className="text-gray-200">{metric.value}</span></div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-sky-300" style={{width: `${metric.percent}%`}} /></div>
          </div>)}
        </div>
      </section>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section>
          <h2 className="mb-4 text-sm font-semibold text-gray-200">Agent activity</h2>
          <div className="space-y-4">
            {data.agent_utilization.length ? data.agent_utilization.map(agent => (
              <div key={agent.agent_id}>
                <div className="mb-1.5 flex justify-between text-xs"><span className="capitalize text-gray-300">{agent.agent_id}</span><span className="text-gray-500">{agent.events} events</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-300" style={{width: `${agent.events / maxEvents * 100}%`}} /></div>
              </div>
            )) : <p className="text-sm text-gray-500">Agent activity will appear after your first run.</p>}
          </div>
        </section>
        <section className="min-w-0">
          <h2 className="mb-4 text-sm font-semibold text-gray-200">Recent executions</h2>
          <div className="overflow-x-auto border-y border-white/10">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-gray-500"><tr><th className="py-3 pr-4 font-medium">Task</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Model</th><th className="py-3 font-medium">Created</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {data.recent_tasks.filter(task => task.task_type === dashboardType).map(task => <tr key={task.id}>
                  <td className="max-w-[200px] truncate py-3 pr-4 text-gray-200">{task.title}</td>
                  <td className="py-3 pr-4 capitalize text-gray-400">{task.status}</td>
                  <td className="py-3 pr-4 text-gray-500">{task.model ?? 'Auto'}</td>
                  <td className="py-3 text-gray-500">{new Date(task.created_at).toLocaleString()}</td>
                </tr>)}
                {!data.recent_tasks.some(task => task.task_type === dashboardType) && <tr><td colSpan={4} className="py-6 text-center text-gray-500">No {dashboardType} tasks yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
