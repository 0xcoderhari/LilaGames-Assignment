import { Client } from '@heroiclabs/nakama-js'

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || '127.0.0.1'
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || '7350'
const NAKAMA_SSL = import.meta.env.VITE_NAKAMA_SSL === 'true'
const NAKAMA_SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey'

export const client = new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_SSL)
