import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import AppPage from './pages/AppPage'
import Metrics from './pages/Metrics'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen overflow-hidden">
        <div className="orb orb-white w-96 h-96 top-0 left-0" />
        <div className="orb orb-green w-96 h-96 top-1/3 right-0" />
        <div className="orb orb-blue w-96 h-96 bottom-0 left-1/3" />
        <div className="relative z-10">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
