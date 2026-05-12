import { useState } from 'react'
import Dashboard from './components/Dashboard'

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
          <h1 className="text-xl font-semibold text-center text-gray-800 mb-6">CRM Ageing Dashboard</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false) }}
              placeholder="Enter password"
              className={`border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs -mt-2">Incorrect password. Try again.</p>}
            <button type="submit" disabled={loading} className="bg-green-700 hover:bg-green-800 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50">
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
