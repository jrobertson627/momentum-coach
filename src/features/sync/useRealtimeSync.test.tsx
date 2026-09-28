// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest'
import { TABLE_QUERY_KEYS, useRealtimeSync } from './useRealtimeSync'

type Handler = () => void
type Filter = { event: string; schema: string; table: string }

// A stand-in for a Supabase Realtime channel that lets tests fire changes.
const fake = vi.hoisted(() => {
  const state = {
    name: '',
    handlers: new Map<string, () => void>(),
    filters: [] as { event: string; schema: string; table: string }[],
    onStatus: (_status: string) => {},
    removed: false,
  }
  const channel = {
    on: (_type: string, filter: Filter, handler: Handler) => {
      state.filters.push(filter)
      state.handlers.set(filter.table, handler)
      return channel
    },
    subscribe: (callback: (status: string) => void) => {
      state.onStatus = callback
      return channel
    },
  }
  return { state, channel }
})

vi.mock('../../lib/supabase', () => ({
  supabase: {
    channel: (name: string) => {
      fake.state.name = name
      return fake.channel
    },
    removeChannel: () => {
      fake.state.removed = true
      return Promise.resolve('ok')
    },
  },
}))

let client: QueryClient
let invalidate: MockInstance<QueryClient['invalidateQueries']>

function renderSync() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useRealtimeSync('user-1'), { wrapper })
}

function invalidatedKeys() {
  return invalidate.mock.calls.map(([filters]) => filters?.queryKey)
}

beforeEach(() => {
  vi.useFakeTimers()
  fake.state.handlers.clear()
  fake.state.filters = []
  fake.state.removed = false
  client = new QueryClient()
  invalidate = vi.spyOn(client, 'invalidateQueries')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRealtimeSync', () => {
  it('listens to every app table on a per-user channel', () => {
    renderSync()
    expect(fake.state.name).toBe('sync:user-1')
    expect(fake.state.filters).toEqual(
      Object.keys(TABLE_QUERY_KEYS).map((table) => ({
        event: '*',
        schema: 'public',
        table,
      })),
    )
  })

  it('refetches what changed', () => {
    renderSync()
    fake.state.handlers.get('tasks')!()
    vi.advanceTimersByTime(250)
    expect(invalidatedKeys()).toEqual([['tasks']])
  })

  it('batches a burst of changes into one refetch per table', () => {
    renderSync()
    // Completing a task touches three tables at once.
    fake.state.handlers.get('tasks')!()
    fake.state.handlers.get('task_events')!()
    fake.state.handlers.get('reward_ledger')!()
    fake.state.handlers.get('tasks')!()
    expect(invalidate).not.toHaveBeenCalled()

    vi.advanceTimersByTime(250)
    expect(invalidatedKeys()).toEqual([
      ['tasks'],
      ['task_events'],
      ['reward_balance'],
    ])
  })

  it('refetches everything after reconnecting, not on first connect', () => {
    renderSync()
    fake.state.onStatus('SUBSCRIBED')
    expect(invalidate).not.toHaveBeenCalled()

    fake.state.onStatus('CHANNEL_ERROR')
    fake.state.onStatus('SUBSCRIBED')
    expect(invalidate).toHaveBeenCalledWith()
  })

  it('unsubscribes when signed out', () => {
    const { unmount } = renderSync()
    unmount()
    expect(fake.state.removed).toBe(true)
  })
})
