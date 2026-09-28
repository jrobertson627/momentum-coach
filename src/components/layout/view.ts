import { useEffect, useState } from 'react'

export const VIEWS = ['now', 'projects', 'tasks', 'ideas'] as const
export type View = (typeof VIEWS)[number]

function viewFromHash(): View {
  const hash = window.location.hash.slice(1)
  return VIEWS.find((view) => view === hash) ?? 'now'
}

/** The current screen, kept in the URL hash so reloads and Back work. */
export function useView(): View {
  const [view, setView] = useState(viewFromHash)
  useEffect(() => {
    const onChange = () => {
      setView(viewFromHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return view
}
