import { useState, useEffect } from 'react'
import { useGameStore, type MatchInfo } from '../store/gameStore'
import { useMatchActions } from '../nakama/matchmaking'
import './MatchmakingPage.css'

export function MatchmakingPage({ onGameStart }: { onGameStart: () => void }) {
  const [mode, setMode] = useState<'classic' | 'timed'>('classic')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'create' | 'join' | 'browse'>('create')
  const { createAndJoin, joinMatch } = useMatchActions()
  const { availableMatches, listMatches, error, setError } = useGameStore()

  useEffect(() => {
    if (tab === 'browse') {
      listMatches(mode)
    }
  }, [tab, mode])

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    const result = await createAndJoin(mode)
    setLoading(false)
    if (result) onGameStart()
  }

  const handleJoin = async () => {
    if (!joinCode.trim()) return
    setLoading(true)
    setError(null)
    const result = await joinMatch(joinCode.trim())
    setLoading(false)
    if (result) onGameStart()
  }

  const handleBrowseJoin = async (match: MatchInfo) => {
    setLoading(true)
    setError(null)
    const result = await joinMatch(match.matchId)
    setLoading(false)
    if (result) onGameStart()
  }

  return (
    <div className="page matchmaking-page">
      <div className="card">
        <h2>Find a Game</h2>

        <div className="mode-selector">
          <button
            className={mode === 'classic' ? 'active' : ''}
            onClick={() => setMode('classic')}
          >
            Classic
          </button>
          <button
            className={mode === 'timed' ? 'active' : ''}
            onClick={() => setMode('timed')}
          >
            Timed (30s)
          </button>
        </div>

        <div className="tabs">
          <button className={tab === 'create' ? 'active' : ''} onClick={() => setTab('create')}>
            Create
          </button>
          <button className={tab === 'join' ? 'active' : ''} onClick={() => setTab('join')}>
            Join by Code
          </button>
          <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>
            Browse
          </button>
        </div>

        {tab === 'create' && (
          <div className="tab-content">
            <p>Mode: <strong>{mode}</strong></p>
            <button className="primary-btn" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating...' : 'Create New Game'}
            </button>
          </div>
        )}

        {tab === 'join' && (
          <div className="tab-content">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter match code"
            />
            <button className="primary-btn" onClick={handleJoin} disabled={!joinCode.trim() || loading}>
              {loading ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        )}

        {tab === 'browse' && (
          <div className="tab-content">
            {availableMatches.length === 0 ? (
              <p className="empty">No available matches. Create one!</p>
            ) : (
              <div className="match-list">
                {availableMatches.map((match) => (
                  <div key={match.matchId} className="match-item">
                    <div>
                      <span className="match-mode">
                        {match.label.includes('timed') ? 'Timed' : 'Classic'}
                      </span>
                      <span className="match-id">{match.matchId.slice(0, 8)}...</span>
                    </div>
                    <button onClick={() => handleBrowseJoin(match)} disabled={loading}>
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="refresh-btn" onClick={() => listMatches(mode)}>
              Refresh
            </button>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
