import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import AppPage from './pages/AppPage'
import Metrics from './pages/Metrics'
import Settings from './pages/Settings'
import AuthPage from './pages/AuthPage'
import { AuthProvider, ProtectedRoute } from './auth'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="relative min-h-screen overflow-hidden bg-black text-white">
          <div className="relative z-10">
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/app" element={<ProtectedRoute><AppPage /></ProtectedRoute>} />
              <Route path="/metrics" element={<ProtectedRoute><Metrics /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
