import { create } from 'zustand'
import { useAuthStore } from './authStore'

export interface GameState {
  board: string[]
  currentTurn: string
  phase: string
  mode: string
  winner: string
  winnerName: string
  turnStarted: number
  playerX: string
  playerO: string
  playerXName: string
  playerOName: string
  disconnectReason?: string
}

export interface MatchInfo {
  matchId: string
  label: string
  size: number
  presences: number
}

interface GameStore {
  matchId: string
  gameState: GameState | null
  availableMatches: MatchInfo[]
  timerRemaining: number | null
  isMyTurn: boolean
  error: string | null
  setMatchId: (id: string) => void
  setGameState: (state: Partial<GameState>) => void
  resetGameState: () => void
  listMatches: (mode?: string) => Promise<void>
  sendMove: (index: number) => void
  setTimer: (remaining: number | null) => void
  setError: (error: string | null) => void
}

const initialGameState: GameState = {
  board: ['', '', '', '', '', '', '', '', ''],
  currentTurn: '',
  phase: 'waiting',
  mode: 'classic',
  winner: '',
  winnerName: '',
  turnStarted: 0,
  playerX: '',
  playerO: '',
  playerXName: '',
  playerOName: '',
}

export const useGameStore = create<GameStore>((set, get) => ({
  matchId: '',
  gameState: null,
  availableMatches: [],
  timerRemaining: null,
  isMyTurn: false,
  error: null,

  setMatchId: (id: string) => set({ matchId: id }),

  setGameState: (partial: Partial<GameState>) =>
    set((state) => {
      const current = state.gameState || { ...initialGameState }
      const updated = { ...current, ...partial }
      const userId = useAuthStore.getState().userId
      return {
        gameState: updated,
        isMyTurn: updated.currentTurn === userId && updated.phase === 'playing',
      }
    }),

  resetGameState: () =>
    set({
      matchId: '',
      gameState: null,
      timerRemaining: null,
      isMyTurn: false,
      error: null,
    }),

  listMatches: async (mode?: string) => {
    const { socket } = useAuthStore.getState()
    if (!socket) return

    const result = await socket.rpc('list_matches', JSON.stringify({
      minSize: 0,
      maxSize: 1,
      mode: mode || '',
    }))

    const data = JSON.parse(result.payload!)
    set({ availableMatches: data.matches || [] })
  },

  sendMove: (index: number) => {
    const { socket } = useAuthStore.getState()
    const { matchId, gameState } = get()
    if (!socket || !matchId) return
    if (!gameState || gameState.phase !== 'playing') return
    if (gameState.currentTurn !== useAuthStore.getState().userId) return
    if (gameState.board[index] !== '') return

    socket.sendMatchState(matchId, 2, JSON.stringify({ index }))
  },

  setTimer: (remaining: number | null) => set({ timerRemaining: remaining }),

  setError: (error: string | null) => set({ error }),
}))
