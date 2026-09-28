import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { useCreateIdea } from './useIdeas'

/**
 * One-field idea capture, available on every screen. Parking an idea should
 * take seconds so it doesn't become a reason to start something new.
 */
export function QuickCapture() {
  const id = useId()
  const create = useCreateIdea()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [justParked, setJustParked] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!justParked) return
    const timer = setTimeout(() => setJustParked(false), 3000)
    return () => clearTimeout(timer)
  }, [justParked])

  function close() {
    setOpen(false)
    setText('')
    create.reset()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const idea = text.trim()
    if (!idea) return
    create.mutate(
      { text: idea },
      {
        onSuccess: () => {
          close()
          setJustParked(true)
        },
      },
    )
  }

  return (
    <div className="grid gap-2">
      {!open && (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Park an idea
          </Button>
          {justParked && (
            <span role="status" className="text-sm text-muted-foreground">
              Parked. Back to what you were doing.
            </span>
          )}
        </div>
      )}

      {open && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={submit}
          onKeyDown={(e) => e.key === 'Escape' && close()}
        >
          <label htmlFor={id} className="sr-only">
            New idea
          </label>
          <input
            id={id}
            ref={inputRef}
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder="What’s the idea?"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="sm"
            disabled={create.isPending || !text.trim()}
          >
            Park it
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={close}>
            Cancel
          </Button>
          {create.error && (
            <p className="w-full text-sm text-danger" role="alert">
              {create.error.message}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
