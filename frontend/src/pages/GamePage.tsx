import { useEffect, useCallback } from 'react'
import type { MatchData, MatchPresenceEvent } from '@heroiclabs/nakama-js'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import './GamePage.css'

export function GamePage({ onGameEnd }: { onGameEnd: () => void }) {
  const { userId } = useAuthStore()
  const { gameState, matchId, isMyTurn, timerRemaining, error, sendMove, setGameState, setTimer } = useGameStore()
  const socket = useAuthStore.getState().socket

  useEffect(() => {
    if (!socket || !matchId) return

    const handleMatchData = (data: MatchData) => {
      const { op_code, data: payload } = data
      if (!payload) return

      try {
        const decoded = new TextDecoder().decode(payload)
        const parsed = JSON.parse(decoded)

        if (op_code === 3 && parsed.type === 'state' && parsed.state) {
          setGameState(parsed.state)
        } else if (op_code === 3 && parsed.type === 'timer') {
          setTimer(parsed.remaining)
        } else if (op_code === 4) {
          setGameState({
            phase: 'finished',
            winner: parsed.winner,
            winnerName: parsed.winnerName,
            disconnectReason: parsed.reason,
          })
        }
      } catch {
        // ignore parse errors
      }
    }

    const handleMatchPresence = (_presence: MatchPresenceEvent) => {
      // Could handle reconnects here
    }

    socket.onmatchdata = handleMatchData
    socket.onmatchpresence = handleMatchPresence

    return () => {
      socket.onmatchdata = null as unknown as (matchData: MatchData) => void
      socket.onmatchpresence = null as unknown as (matchPresence: MatchPresenceEvent) => void
    }
  }, [socket, matchId])

  const handleCellClick = useCallback((index: number) => {
    if (!isMyTurn) return
    if (!gameState || gameState.board[index] !== '') return
    sendMove(index)
  }, [isMyTurn, gameState, sendMove])

  const handlePlayAgain = () => {
    useGameStore.getState().resetGameState()
    onGameEnd()
  }

  if (!gameState) {
    return (
      <div className="page game-page">
        <div className="card">
          <p>Waiting for game to start...</p>
          {matchId && (
            <p style={{ marginTop: '15px', fontSize: '0.9em', color: '#888' }}>
              Match Code: <strong>{matchId}</strong>
            </p>
          )}
        </div>
      </div>
    )
  }

  const { board, phase, mode, winner, winnerName, playerXName, playerOName } = gameState

  const isPlayerX = userId === gameState.playerX
  const myMark = isPlayerX ? 'X' : 'O'
  const opponentName = isPlayerX ? playerOName : playerXName

  if (phase === 'finished') {
    const resultText = winner === 'draw'
      ? "It's a Draw!"
      : winner === userId
        ? 'You Win!'
        : `${winnerName} Wins!`

    const subText = gameState.disconnectReason === 'disconnect' ? "Opponent abandoned the match." :
                    gameState.disconnectReason === 'timeout' ? "Opponent ran out of time." : ""

    return (
      <div className="page game-page">
        <div className="card game-over-card">
          <h2 className="result-title">{resultText}</h2>
          {subText && <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>{subText}</p>}
          <div className="final-board">
            {board.map((cell, i) => (
              <div key={i} className={`cell ${cell === 'X' ? 'x-mark' : cell === 'O' ? 'o-mark' : ''}`}>
                {cell}
              </div>
            ))}
          </div>
          <button className="primary-btn" onClick={handlePlayAgain}>
            Play Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page game-page">
      <div className="card">
        <div className="game-header">
          <div className={`player ${isMyTurn && isPlayerX ? 'active' : ''}`}>
            <span className="mark x">X</span>
            <span className="name">{playerXName}</span>
            {isMyTurn && isPlayerX && <span className="turn-indicator">Your turn</span>}
          </div>
          <div className="vs">vs</div>
          <div className={`player ${isMyTurn && !isPlayerX ? 'active' : ''}`}>
            <span className="mark o">O</span>
            <span className="name">{playerOName}</span>
            {isMyTurn && !isPlayerX && <span className="turn-indicator">Your turn</span>}
          </div>
        </div>

        {mode === 'timed' && (
          <div className={`timer ${timerRemaining !== null && timerRemaining <= 10 ? 'warning' : ''}`}>
            {timerRemaining !== null ? `${timerRemaining}s` : '30s'}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="board">
          {board.map((cell, i) => (
            <button
              key={i}
              className={`cell ${cell === 'X' ? 'x-mark' : cell === 'O' ? 'o-mark' : ''} ${cell === '' && isMyTurn ? 'clickable' : ''}`}
              onClick={() => handleCellClick(i)}
              disabled={cell !== '' || !isMyTurn}
            >
              {cell}
            </button>
          ))}
        </div>

        {!isMyTurn && phase === 'playing' && (
          <p className="waiting-text">Waiting for {opponentName}...</p>
        )}

        <div className="game-info">
          <span className="mode-badge">{mode === 'timed' ? 'Timed' : 'Classic'}</span>
          <span className="my-mark">You are: {myMark}</span>
        </div>
      </div>
    </div>
  )
}
