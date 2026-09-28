import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import SignIn from './SignIn'
import { Button } from './components/ui/Button'
import { ProjectsPage } from './features/projects/ProjectsPage'
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

  if (session === undefined) return null
  if (session === null) return <SignedOut />

  return (
    <div className="min-h-svh">
      <AppHeader email={session.user.email} />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <ProjectsPage />
      </main>
    </div>
  )
}

function AppHeader({ email }: { email?: string }) {
  const queryClient = useQueryClient()

  return (
    <header className="border-b border-border bg-muted">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" width={28} height={28} />
          <span className="font-serif text-lg font-semibold">
            Momentum Coach
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut()
              queryClient.clear()
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}

function SignedOut() {
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
        <SignIn />
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
