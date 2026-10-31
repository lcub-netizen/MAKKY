export default function Metrics() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">Metrics & Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Total Tasks','Active Loops','Success Rate','Time Saved'].map(k => (
          <div key={k} className="glass rounded-2xl p-6">
            <div className="text-sm text-gray-400">{k}</div>
            <div className="text-2xl font-bold mt-2">—</div>
          </div>
        ))}
      </div>
    </div>
  )
}
