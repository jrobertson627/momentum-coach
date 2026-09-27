import clsx from 'clsx'
import { useEffect, useState } from 'react'
import SignIn from './SignIn'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { checkSupabase, supabase } from './lib/supabase'
import { useSession } from './lib/useSession'

type Status = 'checking' | 'connected' | 'offline'

const statusText: Record<Status, string> = {
  checking: 'Checking connection…',
  connected: 'Connected',
  offline: 'Can’t reach the server',
}

function App() {
  const session = useSession()
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    checkSupabase().then((ok) => setStatus(ok ? 'connected' : 'offline'))
  }, [])

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-sm content-center justify-items-center gap-2 px-4 py-10 text-center">
      <img src="/logo.svg" alt="" width={64} height={64} />
      <h1 className="mt-2 text-3xl font-semibold">Momentum Coach</h1>
      <p className="text-muted-foreground">
        A calm coach that helps you finish what you start.
      </p>

      <div className="mt-6 w-full">
        {session === null && <SignIn />}
        {session && (
          <Card className="grid gap-3 text-left">
            <p className="text-sm text-muted-foreground">
              Signed in as{' '}
              <strong className="text-foreground">{session.user.email}</strong>
            </p>
            <Button
              variant="secondary"
              className="justify-self-start"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </Button>
          </Card>
        )}
      </div>

      <p
        role="status"
        className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"
      >
        <span
          className={clsx(
            'size-2 rounded-full',
            status === 'connected' ? 'bg-accent' : 'bg-neutral-400',
          )}
        />
        {statusText[status]}
      </p>
    </main>
  )
}

export default App
