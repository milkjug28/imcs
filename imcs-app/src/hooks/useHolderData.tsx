'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useWallet } from './useWallet'

type Token = {
  tokenId: string
  name: string
  image: string
  iq: number
  savantName?: string | null
  traits: { type: string; value: string }[]
}

export type HolderData = {
  wallet: string
  balance: number
  tokens: Token[]
}

type HolderState = {
  holderData: HolderData | null
  loading: boolean
  error: boolean
  refetch: (force?: boolean) => Promise<HolderData | null>
}

const HolderContext = createContext<HolderState>({
  holderData: null,
  loading: false,
  error: false,
  refetch: async () => null,
})

const CACHE_KEY_PREFIX = 'holder_ctx_'
const CACHE_TTL = 120_000

function readCache(address: string): HolderData | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${address}`)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts < CACHE_TTL) return data
  } catch {}
  return null
}

function writeCache(address: string, data: HolderData) {
  try {
    sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${address}`,
      JSON.stringify({ data, ts: Date.now() }),
    )
  } catch {}
}

export function HolderProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useWallet()
  const [holderData, setHolderData] = useState<HolderData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const fetchHolder = useCallback(async (force = false): Promise<HolderData | null> => {
    if (!address) return null

    if (!force) {
      const cached = readCache(address)
      if (cached) {
        setHolderData(cached)
        setError(false)
        return cached
      }
    }

    setLoading(true)
    setError(false)

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/holder?wallet=${address}`, { cache: 'no-store' })
        if (res.ok) {
          const data: HolderData = await res.json()
          setHolderData(data)
          writeCache(address, data)
          setLoading(false)
          return data
        }
      } catch {}
      if (attempt === 0) await new Promise(r => setTimeout(r, 1200))
    }

    setError(true)
    setLoading(false)
    return null
  }, [address])

  useEffect(() => {
    if (isConnected && address) {
      fetchHolder()
    } else {
      setHolderData(null)
      setError(false)
    }
  }, [isConnected, address, fetchHolder])

  return (
    <HolderContext.Provider value={{ holderData, loading, error, refetch: fetchHolder }}>
      {children}
    </HolderContext.Provider>
  )
}

export function useHolderData() {
  return useContext(HolderContext)
}
