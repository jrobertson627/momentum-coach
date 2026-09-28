import clsx from 'clsx'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { formatCredits } from '../../lib/rewards'
import { useGameTimeBalance, useSpendGameTime } from './useGameTime'

const PRESETS = [15, 30, 60]

/** Game-time balance, and a way to spend it guilt-free. */
export function GameTime() {
  const id = useId()
  const balance = useGameTimeBalance()
  const spend = useSpendGameTime()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [enjoy, setEnjoy] = useState<string | null>(null)

  const available = balance.data ?? 0
  const amount = Number(minutes)
  const valid = Number.isInteger(amount) && amount > 0 && amount <= available

  function close() {
    setOpen(false)
    setMinutes('')
    setNote('')
    spend.reset()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const playing = note.trim()
    spend.mutate(
      { minutes: amount, note: playing },
      {
        onSuccess: () => {
          setEnjoy(
            `Enjoy ${formatCredits(amount)}${playing ? ` of ${playing}` : ''}. You earned it.`,
          )
          close()
        },
      },
    )
  }

  if (balance.isPending) return null

  return (
    <section
      aria-label="Game time"
      className="grid gap-3 rounded-lg border border-border bg-muted px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Game time:{' '}
          <strong className="text-accent">{formatCredits(available)}</strong>
        </p>
        {!open &&
          (available > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEnjoy(null)
                setOpen(true)
              }}
            >
              Play
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Finish a task to earn some.
            </span>
          ))}
      </div>

      {enjoy && !open && (
        <p role="status" className="text-sm text-muted-foreground">
          {enjoy}
        </p>
      )}

      {open && (
        <form className="grid gap-3" onSubmit={submit}>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">How long?</legend>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={preset > available}
                  aria-pressed={amount === preset}
                  onClick={() => setMinutes(String(preset))}
                  className={clsx(
                    'rounded-full px-3 py-1 text-sm disabled:opacity-40',
                    amount === preset
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'border border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {preset} min
                </button>
              ))}
              <label htmlFor={`${id}-minutes`} className="sr-only">
                Minutes
              </label>
              <input
                id={`${id}-minutes`}
                type="number"
                inputMode="numeric"
                min={1}
                max={available}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="min"
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </div>
          </fieldset>
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-note`} className="text-sm font-medium">
              What are you playing?{' '}
              <span className="font-normal">(optional)</span>
            </label>
            <input
              id={`${id}-note`}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Stardew Valley"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {spend.error && (
            <p className="text-sm text-danger" role="alert">
              {spend.error.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!valid || spend.isPending}
            >
              Start playing
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
