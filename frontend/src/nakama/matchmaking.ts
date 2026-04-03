import { useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import type { MatchData, MatchPresenceEvent } from '@heroiclabs/nakama-js'

export function useMatchListener() {
  const { socket } = useAuthStore.getState()
  const { setGameState, setTimer } = useGameStore.getState()

  const setup = useCallback(() => {
    if (!socket) return

    socket.onmatchdata = (data: MatchData) => {
      const { op_code, data: payload } = data
      if (!payload) return

      try {
        const decoded = new TextDecoder().decode(payload)
        const parsed = JSON.parse(decoded)

        if (op_code === 3) {
          if (parsed.type === 'state' && parsed.state) {
            setGameState(parsed.state)
          } else if (parsed.type === 'timer') {
            setTimer(parsed.remaining)
          }
        } else if (op_code === 4) {
          setGameState({ phase: 'finished', winner: parsed.winner, winnerName: parsed.winnerName })
        }
      } catch {
        // ignore parse errors
      }
    }

    socket.onmatchpresence = (_presence: MatchPresenceEvent) => {
      // Handle join/leave events if needed
    }

    return () => {
      socket.onmatchdata = null as unknown as (matchData: MatchData) => void
      socket.onmatchpresence = null as unknown as (matchPresence: MatchPresenceEvent) => void
    }
  }, [socket])

  return { setup }
}

export function useMatchActions() {
  const { socket } = useAuthStore()

  const joinMatch = useCallback(async (id: string) => {
    if (!socket) return null

    try {
      const match = await socket.joinMatch(id)
      useGameStore.getState().setMatchId(id)
      return match
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join match'
      useGameStore.getState().setError(message)
      return null
    }
  }, [socket])

  const createAndJoin = useCallback(async (mode: string) => {
    if (!socket) return null

    try {
      const result = await socket.rpc('create_match', JSON.stringify({
        username: useAuthStore.getState().username,
        mode,
      }))

      const data = JSON.parse(result.payload!)
      const matchId = data.matchId

      const match = await socket.joinMatch(matchId)
      useGameStore.getState().setMatchId(matchId)
      return match
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create match'
      useGameStore.getState().setError(message)
      return null
    }
  }, [socket])

  return { joinMatch, createAndJoin }
}
