import { Link } from 'react-router-dom'
import { Activity, ArrowDown, ArrowRight, Bot, Check, Clock3, LockKeyhole, Radio, Rocket, Workflow } from 'lucide-react'
import { useAuth } from '../auth'

const features = [
  {icon: Clock3, title: 'Runs beyond the tab', text: 'Every task is queued, traced, and resumed later so your team can keep moving while the workspace works in the background.'},
  {icon: Workflow, title: 'Roles follow the task', text: 'Workflows can prepare lead qualification, sales plans, and portfolio risk reviews. External actions require a connected integration and your approval.'},
  {icon: Radio, title: 'Live task monitoring', text: 'Follow each worker and response as it runs, with persisted progress and a clear final handoff.'},
  {icon: LockKeyhole, title: 'Server-side provider key', text: 'OpenRouter credentials stay on the backend, never in browser code, so live business automation stays secure.'},
]

const agents = [
  {name: 'Kiki', role: 'Scaling lead', color: '#FACC15', status: 'Active'},
  {name: 'Pip', role: 'Research', color: '#22D3EE', status: 'Integration pending'},
  {name: 'Noko', role: 'Browser operator', color: '#34D399', status: 'Approval flow pending'},
  {name: 'Mimi', role: 'Strategy + synthesis', color: '#F472B6', status: 'Active'},
  {name: 'Zazu', role: 'Risk & QA', color: '#FB923C', status: 'Active'},
  {name: 'Tiko', role: 'Scheduler', color: '#60A5FA', status: 'Scheduled runs'},
  {name: 'Lulu', role: 'Delivery', color: '#A78BFA', status: 'Completion events'},
]

export default function Landing() {
  const {user} = useAuth()
  return (
    <main>
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-semibold text-white"><Bot className="text-cyan-300" /> Makky</Link>
        <nav className="flex items-center gap-5 text-sm text-gray-300">
          <a href="#workflow" className="hidden hover:text-white sm:block">Workflow</a>
          <a href="#agents" className="hidden hover:text-white sm:block">Agents</a>
          <Link to={user ? '/app' : '/login'} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white hover:bg-white/10">{user ? 'Open workspace' : 'Sign in'}</Link>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100svh-72px)] max-w-7xl items-center gap-12 px-5 pb-16 pt-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-cyan-200"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Multi-user AI operations workspace</div>
          <h1 className="text-6xl font-semibold leading-none text-white sm:text-7xl">Makky</h1>
          <h2 className="mt-5 max-w-lg text-2xl font-medium leading-tight text-white sm:text-3xl">An AI operator that plans, prepares, and reviews. You approve the move.</h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-gray-300">Delegate productivity and business tasks, qualify leads for human follow-up, and prepare research or portfolio risk briefs. Makky does not promise profits or place trades, publish listings, or contact customers without an approved integration and explicit confirmation.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={user ? '/app' : '/login'} className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"><Rocket size={17} /> Launch workspace <ArrowRight size={16} /></Link>
            <a href="#workflow" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm text-gray-200 hover:bg-white/5">See the workflow <ArrowDown size={15} /></a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-cyan-300" /> User-scoped task history</span>
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-cyan-300" /> Redis background queue</span>
            <span className="inline-flex items-center gap-1.5"><Check size={13} className="text-cyan-300" /> Server-side OpenRouter access</span>
          </div>
        </div>

        <div className="relative min-w-0 lg:pl-4">
          <div className="absolute -inset-8 -z-10 bg-[radial-gradient(ellipse_at_55%_45%,rgba(34,211,238,0.12),transparent_60%),radial-gradient(ellipse_at_80%_85%,rgba(168,85,247,0.12),transparent_55%)]" />
          <div className="overflow-hidden rounded-xl border border-white/15 bg-black/80 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white"><Bot size={16} className="text-amber-300" /> Workspace preview</div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Example run</span>
            </div>
            <div className="grid min-h-[310px] sm:grid-cols-[150px_1fr]">
              <div className="hidden border-r border-white/10 bg-white/[0.02] p-3 sm:block">
                <div className="mb-4 flex items-center gap-2 text-xs text-gray-300"><Activity size={13} className="text-cyan-300" /> Recent tasks</div>
                <div className="rounded-md bg-white/[0.04] p-2 text-[11px] leading-4 text-white">Lead qualification</div>
                <div className="mt-2 p-2 text-[11px] text-gray-500">Portfolio risk brief</div>
              </div>
              <div className="flex flex-col p-4 sm:p-5">
                <div className="max-w-[85%] self-end rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-gray-100">Qualify inbound leads and prepare a shortlist for my review.</div>
                <div className="mt-4 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3 sm:p-4">
                  <div className="flex items-center justify-between text-xs"><span className="text-cyan-100">Task activity</span><span className="text-gray-400">Reviewing</span></div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-4/5 rounded-full bg-cyan-300" /></div>
                  <div className="mt-4 space-y-3 text-[11px]">
                    <div className="flex items-center gap-2 text-gray-300"><span className="w-10 text-amber-300">Kiki</span>Research brief saved <Check size={12} className="ml-auto text-cyan-300" /></div>
                    <div className="flex items-center gap-2 text-gray-300"><span className="w-10 text-pink-300">Mimi</span>Lead score draft <Check size={12} className="ml-auto text-cyan-300" /></div>
                    <div className="flex items-center gap-2 text-white"><span className="w-10 text-orange-300">Zazu</span>Risk review in progress<span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /></div>
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-5"><div className="h-9 flex-1 rounded-md border border-white/10 bg-white/[0.02]" /><div className="grid h-9 w-9 place-items-center rounded-md bg-cyan-300 text-black"><ArrowRight size={15} /></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-black px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-200">Built for long-running work</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold text-white">A useful run is more than a chat reply.</h2>
          <div className="mt-8 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({icon: Icon, title, text}) => <article key={title} className="border-t border-white/10 pt-4">
              <Icon size={18} className="text-cyan-300" />
              <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-300">{text}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-200">Execution path</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">One task, a visible chain of responsibility.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">Runs are queued independently of the browser session. Each stage adds a traceable event so a sales brief, lead qualification, or portfolio risk review remains auditable.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['01', 'Kiki', 'Maps the job and priorities', '#FACC15'],
              ['02', 'Mimi', 'Builds the business brief', '#F472B6'],
              ['03', 'Zazu', 'Reviews risk and quality', '#FB923C'],
            ].map(([step, name, role, color], index) => <div key={name} className="relative border-t border-white/15 pt-4">
              <span className="text-[10px] text-gray-500">{step}</span>
              <h3 className="mt-4 text-lg font-semibold" style={{color}}>{name}</h3>
              <p className="mt-1 text-xs text-gray-300">{role}</p>
              {index < 2 && <ArrowRight size={15} className="absolute right-0 top-5 hidden text-gray-500 sm:block" />}
            </div>)}
          </div>
        </div>
      </section>

      <section id="agents" className="border-y border-white/10 bg-black px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-medium uppercase tracking-wide text-cyan-200">Agent roster</p><h2 className="mt-3 text-2xl font-semibold text-white">Clear roles, honest status.</h2></div>
            <p className="max-w-sm text-xs leading-5 text-gray-400">The board is dynamic: sales, marketplace, and trading requests trigger different operating roles without hard-coding a fixed single persona.</p>
          </div>
          <div className="mt-7 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map(agent => <article key={agent.name} className="flex items-center gap-3 border-t border-white/10 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-lg" style={{color: agent.color}}>{agent.name === 'Kiki' ? '✦' : agent.name === 'Pip' ? '⌕' : agent.name === 'Noko' ? '⌘' : agent.name === 'Mimi' ? '✳' : agent.name === 'Zazu' ? '⬡' : agent.name === 'Tiko' ? '◷' : '↗'}</span>
              <div className="min-w-0"><h3 className="text-sm font-medium text-white">{agent.name} <span className="font-normal text-gray-400">· {agent.role}</span></h3><p className={`mt-1 text-[11px] ${agent.status === 'Active' ? 'text-cyan-300' : 'text-gray-400'}`}>{agent.status}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-xs text-gray-400 sm:px-8">
        <span>Makky · AI task workspace</span>
        <div className="flex items-center gap-5"><Link to="/login" className="hover:text-white">Account</Link><Link to="/app" className="hover:text-white">Workspace</Link></div>
      </footer>
    </main>
  )
}
