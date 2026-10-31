import { Link } from 'react-router-dom'
import { Rocket } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-green-300 to-blue-400 bg-clip-text text-transparent mb-4">
        Autonomous Swarm Intelligence for Seamless Execution
      </h1>
      <p className="text-lg text-gray-300 max-w-2xl mb-8">
        Makky orchestrates 7 specialized AI agents to automate research, browsing, synthesis, and delivery — even while you sleep.
      </p>
      <Link to="/app" className="glass px-8 py-4 rounded-2xl flex items-center gap-2 hover:bg-white/10 transition">
        <Rocket size={20} /> Launch Workspace
      </Link>
    </div>
  )
}
