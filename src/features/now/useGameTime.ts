import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGameTimeBalance, spendGameTime } from '../../lib/gameTime'

export const gameTimeKey = ['reward_balance'] as const

export function useGameTimeBalance() {
  return useQuery({ queryKey: gameTimeKey, queryFn: fetchGameTimeBalance })
}

export function useSpendGameTime() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ minutes, note }: { minutes: number; note?: string }) =>
      spendGameTime(minutes, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gameTimeKey }),
  })
}
