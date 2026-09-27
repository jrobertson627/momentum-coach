import { useEffect, useState } from 'react'
import { checkSupabase } from './lib/supabase'

type Status = 'checking' | 'connected' | 'offline'

const statusText: Record<Status, string> = {
  checking: 'Checking connection…',
  connected: 'Connected',
  offline: 'Can’t reach the server',
}

function App() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    checkSupabase().then((ok) => setStatus(ok ? 'connected' : 'offline'))
  }, [])

  return (
    <main className="placeholder">
      <img src="/logo.svg" alt="" width={72} height={72} />
      <h1>Momentum Coach</h1>
      <p>A calm coach that helps you finish what you start.</p>
      <p className={`status status-${status}`} role="status">
        {statusText[status]}
      </p>
    </main>
  )
}

export default App
