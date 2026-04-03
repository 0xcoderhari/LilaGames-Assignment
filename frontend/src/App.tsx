import { useState } from 'react'
import { useAuthStore } from './store/authStore'
import { useGameStore } from './store/gameStore'
import { NicknamePage } from './pages/NicknamePage'
import { MatchmakingPage } from './pages/MatchmakingPage'
import { GamePage } from './pages/GamePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import './App.css'

type Screen = 'nickname' | 'matchmaking' | 'game' | 'leaderboard'

function App() {
  const [screen, setScreen] = useState<Screen>('nickname')
  const { username, isConnected } = useAuthStore()

  const handleLogout = () => {
    useAuthStore.getState().logout()
    useGameStore.getState().resetGameState()
    setScreen('nickname')
  }

  return (
    <div className="app">
      {screen !== 'nickname' && (
        <nav className="top-nav">
          <span className="nav-user">{username}</span>
          <span className={`nav-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '●' : '○'}
          </span>
          <button className="nav-btn" onClick={() => setScreen('leaderboard')}>
            Leaderboard
          </button>
          <button className="nav-btn logout" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      )}

      {screen === 'nickname' && (
        <NicknamePage onContinue={() => setScreen('matchmaking')} />
      )}

      {screen === 'matchmaking' && (
        <MatchmakingPage onGameStart={() => setScreen('game')} />
      )}

      {screen === 'game' && (
        <GamePage onGameEnd={() => setScreen('matchmaking')} />
      )}

      {screen === 'leaderboard' && (
        <LeaderboardPage onBack={() => setScreen('matchmaking')} />
      )}
    </div>
  )
}

export default App
