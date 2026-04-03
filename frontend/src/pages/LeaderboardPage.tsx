import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import './LeaderboardPage.css'

interface LeaderboardRecord {
  owner: string
  username: string
  score: number
  rank: number
}

export function LeaderboardPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'wins' | 'win_streaks'>('wins')
  const [records, setRecords] = useState<LeaderboardRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const socket = useAuthStore.getState().socket

  useEffect(() => {
    fetchLeaderboard()
  }, [tab])

  const fetchLeaderboard = async () => {
    if (!socket) return
    setLoading(true)
    setError('')
    try {
      const result = await socket.rpc('get_leaderboard', JSON.stringify({
        name: tab,
        limit: 20,
      }))
      const data = JSON.parse(result.payload!)
      setRecords(data.records || [])
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leaderboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page leaderboard-page">
      <div className="card">
        <div className="leaderboard-header">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
          <h2>Leaderboard</h2>
        </div>

        <div className="tabs">
          <button className={tab === 'wins' ? 'active' : ''} onClick={() => setTab('wins')}>
            Most Wins
          </button>
          <button className={tab === 'win_streaks' ? 'active' : ''} onClick={() => setTab('win_streaks')}>
            Win Streaks
          </button>
        </div>

        {loading ? (
          <p className="loading">Loading...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : records.length === 0 ? (
          <p className="empty">No records yet. Play some games!</p>
        ) : (
          <div className="leaderboard-list">
            {records.map((record, i) => (
              <div key={record.owner} className={`leaderboard-item ${i < 3 ? `rank-${i + 1}` : ''}`}>
                <span className="rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="username">{record.username}</span>
                <span className="score">{record.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
