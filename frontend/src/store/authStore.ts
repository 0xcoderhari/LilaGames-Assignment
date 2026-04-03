import { create } from 'zustand'
import { client } from '../nakama/client'
import type { Session, Socket } from '@heroiclabs/nakama-js'

interface AuthState {
  session: Session | null
  socket: Socket | null
  username: string
  userId: string
  isConnected: boolean
  login: (username: string) => Promise<void>
  logout: () => void
  setConnected: (connected: boolean) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  socket: null,
  username: '',
  userId: '',
  isConnected: false,

  login: async (username: string) => {
    // Nakama requires custom IDs to be at least 6 characters long
    const customId = username.length < 6 ? `${username}_padid` : username;
    const session = await client.authenticateCustom(customId, true, username)
    const socket = client.createSocket()

    socket.ondisconnect = () => {
      set({ isConnected: false })
    }

    await socket.connect(session, true)
    set({
      session,
      socket,
      username,
      userId: session.user_id || '',
      isConnected: true,
    })
  },

  logout: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect(true)
    }
    set({
      session: null,
      socket: null,
      username: '',
      userId: '',
      isConnected: false,
    })
  },

  setConnected: (connected: boolean) => set({ isConnected: connected }),
}))
