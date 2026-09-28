import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Button } from '../ui/Button'
import type { View } from './view'

const TABS: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'now', label: 'Now', icon: <SunIcon /> },
  { view: 'projects', label: 'Projects', icon: <FlagIcon /> },
  { view: 'tasks', label: 'Tasks', icon: <ListIcon /> },
  { view: 'ideas', label: 'Parking lot', icon: <BulbIcon /> },
]

type Props = {
  view: View
  email?: string
  ideaCount: number
  onSignOut: () => void
  /** Shown under the header on every screen (quick idea capture). */
  headerExtra?: ReactNode
  children: ReactNode
}

/**
 * The signed-in layout. On phones the tabs are a bottom bar within thumb
 * reach; from the `sm` breakpoint up they sit in the header.
 */
export function AppShell({
  view,
  email,
  ideaCount,
  onSignOut,
  headerExtra,
  children,
}: Props) {
  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-muted">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/logo.svg" alt="" width={28} height={28} />
            <span className="truncate font-serif text-lg font-semibold">
              Momentum Coach
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:inline">
              {email}
            </span>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
        <div className="mx-auto grid w-full max-w-2xl gap-3 px-4 pb-3">
          <nav
            aria-label="Main"
            className={clsx(
              // Phone: a bottom tab bar, clear of the home indicator.
              'fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-muted/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
              // Wider screens: inline tabs in the header.
              'sm:static sm:z-auto sm:flex sm:gap-1 sm:border-0 sm:bg-transparent sm:pb-0 sm:backdrop-blur-none',
            )}
          >
            {TABS.map((tab) => (
              <TabLink
                key={tab.view}
                tab={tab}
                current={view === tab.view}
                badge={tab.view === 'ideas' ? ideaCount : 0}
              />
            ))}
          </nav>
          {headerExtra}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-28 sm:pb-12">
        {children}
      </main>
    </div>
  )
}

function TabLink({
  tab,
  current,
  badge,
}: {
  tab: (typeof TABS)[number]
  current: boolean
  badge: number
}) {
  return (
    <a
      href={`#${tab.view}`}
      aria-current={current ? 'page' : undefined}
      aria-label={badge > 0 ? `${tab.label}, ${badge} parked` : undefined}
      className={clsx(
        'relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
        'sm:min-h-0 sm:flex-row sm:gap-1.5 sm:rounded-md sm:px-3 sm:py-1.5 sm:text-sm',
        current
          ? 'text-accent sm:bg-accent sm:text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground sm:hover:bg-background',
      )}
    >
      <span aria-hidden="true" className="size-6 sm:hidden">
        {tab.icon}
      </span>
      <span>
        {tab.label}
        {badge > 0 && (
          <span className="ml-1 rounded-full bg-accent/15 px-1.5 py-px text-[10px] text-accent sm:bg-background/20 sm:text-current">
            {badge}
          </span>
        )}
      </span>
      {current && (
        <span
          aria-hidden="true"
          className="absolute top-0 h-0.5 w-8 rounded-full bg-accent sm:hidden"
        />
      )}
    </a>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
    >
      {children}
    </svg>
  )
}

function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </Icon>
  )
}

function FlagIcon() {
  return (
    <Icon>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Icon>
  )
}

function ListIcon() {
  return (
    <Icon>
      <path d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9" />
    </Icon>
  )
}

function BulbIcon() {
  return (
    <Icon>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </Icon>
  )
}
