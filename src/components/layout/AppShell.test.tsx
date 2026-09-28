// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { useView } from './view'

function Harness({ onSignOut = () => {} }: { onSignOut?: () => void }) {
  const view = useView()
  return (
    <AppShell view={view} ideaCount={3} onSignOut={onSignOut}>
      <p>Showing {view}</p>
    </AppShell>
  )
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = vi.fn()
})

describe('AppShell', () => {
  it('starts on Now and marks it as the current page', () => {
    render(<Harness />)
    expect(screen.getByText('Showing now')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Now' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('switches screens through the URL hash', async () => {
    render(<Harness />)

    await act(async () => {
      window.location.hash = '#tasks'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(screen.getByText('Showing tasks')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Now' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('falls back to Now for an unknown hash', () => {
    window.location.hash = '#nope'
    render(<Harness />)
    expect(screen.getByText('Showing now')).toBeVisible()
  })

  it('shows how many ideas are parked', () => {
    render(<Harness />)
    expect(
      screen.getByRole('link', { name: 'Parking lot, 3 parked' }),
    ).toHaveAttribute('href', '#ideas')
  })

  it('signs out', async () => {
    const onSignOut = vi.fn()
    render(<Harness onSignOut={onSignOut} />)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalled()
  })
})
