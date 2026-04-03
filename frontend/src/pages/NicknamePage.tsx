import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import './NicknamePage.css'

export function NicknamePage({ onContinue }: { onContinue: () => void }) {
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) return

    setLoading(true)
    setError('')
    try {
      await useAuthStore.getState().login(nickname.trim())
      onContinue()
    } catch (err: any) {
      setError(err.message || 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page nickname-page">
      <div className="card">
        <h1>Tic-Tac-Toe</h1>
        <p className="subtitle">Multiplayer with Nakama</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="nickname">Enter your nickname</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={!nickname.trim() || loading}>
            {loading ? 'Connecting...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
