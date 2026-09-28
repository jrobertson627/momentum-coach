import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import SignIn from './SignIn'
import { Button } from './components/ui/Button'
import { IdeasPage } from './features/ideas/IdeasPage'
import { QuickCapture } from './features/ideas/QuickCapture'
import { useIdeas } from './features/ideas/useIdeas'
import { ProjectsPage } from './features/projects/ProjectsPage'
import { TasksPage } from './features/tasks/TasksPage'
import { checkSupabase, supabase } from './lib/supabase'
import { useSession } from './lib/useSession'

type Status = 'checking' | 'connected' | 'offline'

const statusText: Record<Status, string> = {
  checking: 'Checking connection…',
  connected: 'Connected',
  offline: 'Can’t reach the server',
}

const VIEWS = ['projects', 'tasks', 'ideas'] as const
type View = (typeof VIEWS)[number]

function viewFromHash(): View {
  const hash = window.location.hash.slice(1)
  return VIEWS.find((view) => view === hash) ?? 'projects'
}

/** The current screen, kept in the URL hash so reloads and Back work. */
function useView(): View {
  const [view, setView] = useState(viewFromHash)
  useEffect(() => {
    const onChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return view
}

function App() {
  const session = useSession()

  if (session === undefined) return null
  if (session === null) return <SignedOut />

  return <SignedIn email={session.user.email} />
}

function SignedIn({ email }: { email?: string }) {
  const view = useView()

  return (
    <div className="min-h-svh">
      <AppHeader email={email} view={view} />
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        {view === 'ideas' && <IdeasPage />}
        {view === 'tasks' && <TasksPage />}
        {view === 'projects' && <ProjectsPage />}
      </main>
    </div>
  )
}

function AppHeader({ email, view }: { email?: string; view: View }) {
  const queryClient = useQueryClient()
  const ideas = useIdeas()
  const ideaCount = ideas.data?.length ?? 0

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
      <div className="mx-auto grid w-full max-w-2xl gap-3 px-4 pb-3">
        <nav aria-label="Main" className="flex gap-1">
          <NavLink href="#projects" current={view === 'projects'}>
            Projects
          </NavLink>
          <NavLink href="#tasks" current={view === 'tasks'}>
            Tasks
          </NavLink>
          <NavLink href="#ideas" current={view === 'ideas'}>
            Parking lot{ideaCount > 0 && ` (${ideaCount})`}
          </NavLink>
        </nav>
        <QuickCapture />
      </div>
    </header>
  )
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string
  current: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      className={clsx(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        current
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-background hover:text-foreground',
      )}
    >
      {children}
    </a>
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
