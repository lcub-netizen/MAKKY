import { useState } from 'react'
import { Send, Bot } from 'lucide-react'

export default function AppPage() {
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<{role:string;text:string}[]>([
    {role:'assistant', text:'Hi! I am Kiki, your Chief of Staff. How can I help?'}
  ])

  const send = () => {
    if (!input.trim()) return
    setMsgs(m => [...m, {role:'user', text: input}, {role:'assistant', text:'(streaming...)' }])
    setInput('')
  }

  return (
    <div className="flex h-screen">
      <aside className="w-80 glass m-4 rounded-2xl p-4 flex flex-col gap-3">
        <h2 className="font-bold text-lg">Makky</h2>
        <div className="text-sm text-gray-400">7 Agents Active</div>
        <nav className="flex flex-col gap-2 mt-4">
          <a href="/metrics" className="hover:text-green-300">Metrics</a>
          <a href="/settings" className="hover:text-green-300">Settings</a>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col m-4 glass rounded-2xl">
        <header className="p-4 border-b border-white/10 flex items-center gap-2">
          <Bot className="text-yellow-300" /> Kiki — Chief of Staff
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.map((m,i) => (
            <div key={i} className={`p-3 rounded-xl max-w-xl ${m.role==='user'?'glass ml-auto bg-white/10':'glass'}`}>
              {m.text}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/10 flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
            className="flex-1 glass rounded-xl px-4 py-2 bg-transparent outline-none" placeholder="Ask Kiki..." />
          <button onClick={send} className="glass px-4 py-2 rounded-xl hover:bg-white/10"><Send size={18}/></button>
        </div>
      </main>
    </div>
  )
}
