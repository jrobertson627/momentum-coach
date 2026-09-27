import { useState, type FormEvent } from 'react'
import { Button } from './components/ui/Button'
import { Card } from './components/ui/Card'
import { supabase } from './lib/supabase'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }

function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState({ kind: 'sending' })
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setState(
      error
        ? { kind: 'error', message: error.message }
        : { kind: 'sent', email },
    )
  }

  if (state.kind === 'sent') {
    return (
      <Card className="grid gap-3 text-left">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to{' '}
          <strong className="text-foreground">{state.email}</strong>. Open it on
          this device to continue.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setState({ kind: 'idle' })}
        >
          Use a different email
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <form className="grid gap-3 text-left" onSubmit={submit}>
        <h2 className="text-xl font-semibold">Sign in</h2>
        <p className="text-sm text-muted-foreground">
          No password needed. We’ll email you a link.
        </p>
        <label htmlFor="email" className="mt-1 text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? 'Sending…' : 'Email me a link'}
        </Button>
        {state.kind === 'error' && (
          <p className="text-sm text-danger" role="alert">
            {state.message}
          </p>
        )}
      </form>
    </Card>
  )
}

export default SignIn
