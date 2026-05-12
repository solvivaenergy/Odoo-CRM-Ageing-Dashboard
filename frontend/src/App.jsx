import { useState } from 'react'
import Dashboard from './components/Dashboard'

const CORRECT_PASSWORD = 'Solviva$upremacy2026'

function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('sv_auth') === '1')
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input === CORRECT_PASSWORD) {
      sessionStorage.setItem('sv_auth', '1')
      setAuthed(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
          <img src="https://solvivaenergy.github.io/Odoo-CRM-Ageing-Dashboard/solviva-logo.png" alt="Solviva" className="h-10 mx-auto mb-6" onError={(e) => e.target.style.display='none'} />
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
            <button type="submit" className="bg-green-700 hover:bg-green-800 text-white rounded-lg py-2 text-sm font-medium transition-colors">
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard />
    </div>
  )
}

export default App
