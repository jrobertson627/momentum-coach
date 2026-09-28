import type { Energy } from './tasks'

/** What the user has right now: the input to every recommendation. */
export type CheckIn = {
  minutes: number
  energy: Energy
}

/** The "60+" choice: plenty of time, but still a limit worth respecting. */
export const PLENTY_OF_TIME = 120

export const TIME_OPTIONS = [
  { minutes: 10, label: '10 min' },
  { minutes: 25, label: '25 min' },
  { minutes: 45, label: '45 min' },
  { minutes: PLENTY_OF_TIME, label: '60+ min' },
] as const

export const ENERGY_OPTIONS = [
  { energy: 'low', label: 'Low' },
  { energy: 'medium', label: 'Medium' },
  { energy: 'high', label: 'High' },
] as const satisfies readonly { energy: Energy; label: string }[]

export function describeCheckIn({ minutes, energy }: CheckIn): string {
  const time =
    minutes >= PLENTY_OF_TIME ? 'an hour or more' : `${minutes} minutes`
  return `${time} and ${energy} energy`
}
