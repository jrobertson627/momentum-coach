import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import SignIn from './SignIn'
import { AppShell } from './components/layout/AppShell'
import { useView } from './components/layout/view'
import { IdeasPage } from './features/ideas/IdeasPage'
import { QuickCapture } from './features/ideas/QuickCapture'
import { useIdeas } from './features/ideas/useIdeas'
import { NowPage } from './features/now/NowPage'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { useRealtimeSync } from './features/sync/useRealtimeSync'
import { TasksPage } from './features/tasks/TasksPage'
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

  return <SignedIn userId={session.user.id} email={session.user.email} />
}

function SignedIn({ userId, email }: { userId: string; email?: string }) {
  const view = useView()
  useRealtimeSync(userId)
  const queryClient = useQueryClient()
  const ideas = useIdeas()

  return (
    <AppShell
      view={view}
      email={email}
      ideaCount={ideas.data?.length ?? 0}
      onSignOut={async () => {
        await supabase.auth.signOut()
        queryClient.clear()
      }}
      headerExtra={<QuickCapture />}
    >
      {view === 'ideas' && <IdeasPage />}
      {view === 'tasks' && <TasksPage />}
      {view === 'projects' && <ProjectsPage />}
      {view === 'now' && <NowPage />}
    </AppShell>
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
