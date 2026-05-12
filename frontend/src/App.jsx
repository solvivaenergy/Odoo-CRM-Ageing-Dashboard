import { useState } from 'react'
import Dashboard from './components/Dashboard'
import logo from './assets/logo.png'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('sv_token') || null)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: input }),
      })
      if (!res.ok) throw new Error('Invalid password')
      const { token: t } = await res.json()
      sessionStorage.setItem('sv_token', t)
      setToken(t)
    } catch {
      setError(true)
      setInput('')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Subtle emerald glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 sm:p-10 w-full max-w-sm relative z-10 mx-4">
          <img src={logo} alt="Logo" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-center text-white mb-8">CRM Ageing Dashboard</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <input
                type="password"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(false) }}
                placeholder="Enter password"
                className={`w-full bg-slate-950/50 border rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all ${error ? 'border-red-500/50 focus:ring-red-500/50' : 'border-slate-700'}`}
                autoFocus
              />
              {error && <p className="text-red-400 text-xs mt-2">Incorrect password. Try again.</p>}
            </div>
            <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg py-3 text-sm font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              {loading ? 'Checking...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard token={token} onUnauth={() => { sessionStorage.removeItem('sv_token'); setToken(null) }} />
    </div>
  )
}

export default App
