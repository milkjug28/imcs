'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useReadContract, useSignMessage } from 'wagmi'
import { SAVANT_TOKEN_ADDRESS, SAVANT_TOKEN_ABI, MINT_CHAIN } from '@/config/contracts'
import ConnectWallet from '@/components/ConnectWallet'
import { motion, AnimatePresence } from 'framer-motion'

type Token = {
  tokenId: string
  name: string
  image: string
  iq: number
  savantName?: string | null
  traits: { type: string; value: string }[]
}

type HolderData = {
  wallet: string
  balance: number
  tokens: Token[]
}

type ProfileData = {
  total_points: number
  rank: number | null
  name: string
}

type IQBalance = {
  total_earned: number
  total_allocated: number
  available: number
}

function buildAllocateMessage(wallet: string, allocations: { tokenId: number; points: number }[]): string {
  const lines = allocations.map(a => `  Savant #${a.tokenId}: +${a.points} IQ`)
  const total = allocations.reduce((s, a) => s + a.points, 0)
  return [
    'Allocate IQ Points to Savants',
    '',
    ...lines,
    '',
    `Total: ${total} IQ points`,
    '',
    'This action is permanent and cannot be undone.',
    '',
    `Wallet: ${wallet.toLowerCase()}`,
  ].join('\n')
}

export default function ProfilePage() {
  const { address, isConnected, truncatedAddress } = useWallet()
  const { signMessageAsync } = useSignMessage()
  const [holderData, setHolderData] = useState<HolderData | null>(null)
  const [legacyProfile, setLegacyProfile] = useState<ProfileData | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)

  const [iqBalance, setIqBalance] = useState<IQBalance | null>(null)
  const [allocations, setAllocations] = useState<Record<string, number>>({})
  const [allocating, setAllocating] = useState(false)
  const [allocateError, setAllocateError] = useState<string | null>(null)
  const [allocateSuccess, setAllocateSuccess] = useState<string | null>(null)
  const [showAllocator, setShowAllocator] = useState(false)

  const [namingToken, setNamingToken] = useState(false)
  const [savantNameInput, setSavantNameInput] = useState('')
  const [namingError, setNamingError] = useState<string | null>(null)
  const [namingSuccess, setNamingSuccess] = useState(false)

  const { data: balanceRaw } = useReadContract({
    address: SAVANT_TOKEN_ADDRESS,
    abi: SAVANT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: MINT_CHAIN.id,
    query: { enabled: !!address },
  })

  const fetchData = useCallback(async () => {
    if (!address) { setLoading(false); return }
    setLoading(true)

    const nc = { cache: 'no-store' as RequestCache }
    const [holderRes, profileRes, usernameRes, iqRes] = await Promise.all([
      fetch(`/api/holder?wallet=${address}`, nc).catch(() => null),
      fetch(`/api/profile/${address}`, nc).catch(() => null),
      fetch(`/api/chat/username?wallet=${address}`).catch(() => null),
      fetch(`/api/iq/balance?wallet=${address}`, nc).catch(() => null),
    ])

    if (holderRes?.ok) {
      const data = await holderRes.json()
      setHolderData(data)
    }

    if (profileRes?.ok) {
      const data = await profileRes.json()
      setLegacyProfile(data)
    }

    if (usernameRes?.ok) {
      const data = await usernameRes.json()
      setUsername(data.username || null)
    }

    if (iqRes?.ok) {
      const data = await iqRes.json()
      setIqBalance(data)
    }

    setLoading(false)
  }, [address])

  useEffect(() => {
    if (isConnected && address) {
      fetchData()
    } else {
      setHolderData(null)
      setLegacyProfile(null)
      setUsername(null)
      setSelectedToken(null)
      setEditingName(false)
      setIqBalance(null)
      setAllocations({})
      setShowAllocator(false)
      setLoading(false)
    }
  }, [isConnected, address, fetchData])

  const saveUsername = async () => {
    if (!usernameInput.trim() || !address) return
    setSavingName(true)
    try {
      const res = await fetch('/api/chat/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, username: usernameInput.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setUsername(data.username)
        setEditingName(false)
        setUsernameInput('')
      } else {
        alert(data.error || 'name taken or invalid')
      }
    } catch {}
    setSavingName(false)
  }

  const totalAllocating = Object.values(allocations).reduce((s, v) => s + (v || 0), 0)
  const canAllocate = totalAllocating > 0 && totalAllocating <= (iqBalance?.available || 0)

  const handleAllocate = async () => {
    if (!address || !canAllocate) return
    setAllocating(true)
    setAllocateError(null)
    setAllocateSuccess(null)

    const allocs = Object.entries(allocations)
      .filter(([, pts]) => pts > 0)
      .map(([tokenId, points]) => ({ tokenId: parseInt(tokenId), points }))

    if (!allocs.length) return

    const message = buildAllocateMessage(address, allocs)

    try {
      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/iq/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, allocations: allocs, signature, message }),
      })

      const data = await res.json()
      if (data.ok) {
        setAllocateSuccess(`allocated ${totalAllocating} IQ points!`)
        setAllocations({})
        setShowAllocator(false)
        fetchData()
      } else {
        setAllocateError(data.error || 'allocation failed')
      }
    } catch (err) {
      setAllocateError(err instanceof Error ? err.message : 'signature rejected')
    }
    setAllocating(false)
  }

  const handleNameSavant = async () => {
    if (!address || !selectedToken || !savantNameInput.trim()) return
    setNamingToken(true)
    setNamingError(null)
    setNamingSuccess(false)

    const tokenId = parseInt(selectedToken.tokenId)
    const trimmed = savantNameInput.trim()
    const message = [
      'Name Your Savant',
      '',
      `Savant #${tokenId}: "${trimmed}"`,
      '',
      `Wallet: ${address.toLowerCase()}`,
    ].join('\n')

    try {
      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/savant/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, tokenId, name: trimmed, signature, message }),
      })

      const data = await res.json()
      if (data.ok) {
        setSelectedToken({ ...selectedToken, savantName: trimmed })
        setSavantNameInput('')
        setNamingSuccess(true)
        if (holderData) {
          const updated = holderData.tokens.map(t =>
            t.tokenId === selectedToken.tokenId ? { ...t, savantName: trimmed } : t
          )
          setHolderData({ ...holderData, tokens: updated })
        }
      } else {
        setNamingError(data.error || 'failed to set name')
      }
    } catch (err) {
      setNamingError(err instanceof Error ? err.message : 'signature rejected')
    }
    setNamingToken(false)
  }

  const balance = balanceRaw !== undefined ? Number(balanceRaw) : (holderData?.balance ?? null)
  const isHolder = balance !== null && balance > 0
  const totalIQ = holderData?.tokens.reduce((sum, t) => sum + t.iq, 0) || 0

  if (!isConnected) {
    return (
      <div className="page active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
          border: '4px solid #000',
          borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
          boxShadow: '8px 8px 0 #000',
          padding: '40px 30px',
          textAlign: 'center',
          maxWidth: '400px',
          transform: 'rotate(-1deg)',
        }}>
          <h2 style={{ fontFamily: "'Comic Neue', cursive", fontSize: '28px', color: '#000', textShadow: '2px 2px 0 #fff', marginBottom: '16px' }}>
            my savant profil
          </h2>
          <p style={{ fontFamily: "'Comic Neue', cursive", fontSize: '18px', marginBottom: '24px', color: '#000' }}>
            connect ur wallut 2 c ur stats
          </p>
          <ConnectWallet label="connekt wallut" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Comic Neue', cursive" }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {['#ff69b4', '#00bfff', '#ffd700'].map((color, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, border: '2px solid #000' }}
              />
            ))}
          </div>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>loading ur profil...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="page active">
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 16px' }}>

        {/* Identity Card */}
        <div style={{
          background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
          border: '3px solid #000',
          borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
          boxShadow: '8px 8px 0 #000',
          padding: '24px',
          marginBottom: '20px',
          position: 'relative',
        }}>
          {/* Username / Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <h2 style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '28px',
              color: '#000',
              textShadow: '2px 2px 0 #fff',
              margin: 0,
            }}>
              {username || legacyProfile?.name || truncatedAddress}
            </h2>
            <button
              onClick={() => setEditingName(!editingName)}
              style={{
                fontFamily: "'Comic Neue', cursive",
                fontSize: '11px',
                padding: '2px 10px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {username ? 'change name' : 'set name'}
            </button>
          </div>

          {editingName && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <input
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                placeholder="enter username..."
                maxLength={20}
                style={{
                  flex: 1,
                  fontFamily: "'Comic Neue', cursive",
                  fontSize: '14px',
                  padding: '6px 10px',
                  border: '2px solid #000',
                  background: '#fff',
                }}
              />
              <button
                onClick={saveUsername}
                disabled={savingName}
                style={{
                  fontFamily: "'Comic Neue', cursive",
                  fontSize: '14px',
                  padding: '6px 14px',
                  background: '#00ff00',
                  border: '2px solid #000',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {savingName ? '...' : 'save'}
              </button>
            </div>
          )}

          <p style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(0,0,0,0.6)', marginBottom: '16px' }}>
            {truncatedAddress}
          </p>

          {/* Stats Row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <StatBox label="savants held" value={balance ?? 0} />
            <StatBox label="total iq" value={totalIQ} />
            {iqBalance && iqBalance.available > 0 && (
              <StatBox label="iq 2 allocate" value={iqBalance.available} highlight />
            )}
            <StatBox label="legacy pts" value={legacyProfile?.total_points || 0} />
            {legacyProfile?.rank && <StatBox label="legacy rank" value={`#${legacyProfile.rank}`} />}
          </div>
        </div>

        {/* IQ Allocation Banner */}
        {iqBalance && iqBalance.available > 0 && isHolder && !showAllocator && (
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            style={{
              background: 'linear-gradient(135deg, #00ff87, #60efff)',
              border: '3px solid #000',
              boxShadow: '6px 6px 0 #000',
              padding: '16px 20px',
              marginBottom: '20px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
            onClick={() => setShowAllocator(true)}
          >
            <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
              u have {iqBalance.available} IQ points 2 allocate!
            </div>
            <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '14px', color: '#333', marginTop: '4px' }}>
              tap here 2 make ur savants smarter (permanent, no takebacks)
            </div>
          </motion.div>
        )}

        {/* Allocation Success/Error */}
        {allocateSuccess && (
          <div style={{
            background: '#00ff87',
            border: '2px solid #000',
            padding: '12px',
            marginBottom: '16px',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
            {allocateSuccess}
          </div>
        )}
        {allocateError && (
          <div style={{
            background: '#ff4444',
            color: '#fff',
            border: '2px solid #000',
            padding: '12px',
            marginBottom: '16px',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
            {allocateError}
          </div>
        )}

        {/* IQ Allocator Panel */}
        <AnimatePresence>
          {showAllocator && iqBalance && holderData && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                background: '#111',
                border: '3px solid #0f0',
                boxShadow: '0 0 20px rgba(0,255,0,0.3)',
                marginBottom: '20px',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '20px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}>
                  <h3 style={{
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    color: '#0f0',
                    margin: 0,
                  }}>
                    IQ ALLOCATION TERMINAL
                  </h3>
                  <button
                    onClick={() => { setShowAllocator(false); setAllocations({}) }}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      background: 'transparent',
                      color: '#666',
                      border: '1px solid #333',
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    [X]
                  </button>
                </div>

                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#0f0',
                  marginBottom: '16px',
                  padding: '8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                }}>
                  Available: {iqBalance.available - totalAllocating} / {iqBalance.available} IQ pts
                  {totalAllocating > 0 && <span style={{ color: '#ff0' }}> (allocating {totalAllocating})</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {holderData.tokens.map(token => (
                    <div
                      key={token.tokenId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #333',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={token.image}
                        alt={token.name}
                        style={{ width: '48px', height: '48px', objectFit: 'cover', border: '1px solid #333' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#fff' }}>
                          {token.name}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>
                          Current IQ: {token.iq}
                          {(allocations[token.tokenId] || 0) > 0 && (
                            <span style={{ color: '#0f0' }}>
                              {' '}→ {token.iq + (allocations[token.tokenId] || 0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => {
                            const current = allocations[token.tokenId] || 0
                            if (current > 0) setAllocations(p => ({ ...p, [token.tokenId]: current - 1 }))
                          }}
                          style={{
                            fontFamily: 'monospace',
                            width: '28px',
                            height: '28px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: '1',
                          }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={iqBalance.available - totalAllocating + (allocations[token.tokenId] || 0)}
                          value={allocations[token.tokenId] || 0}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0)
                            const otherAllocations = totalAllocating - (allocations[token.tokenId] || 0)
                            const clamped = Math.min(val, iqBalance.available - otherAllocations)
                            setAllocations(p => ({ ...p, [token.tokenId]: clamped }))
                          }}
                          style={{
                            fontFamily: 'monospace',
                            width: '60px',
                            textAlign: 'center',
                            background: '#000',
                            color: '#0f0',
                            border: '1px solid #0f0',
                            padding: '4px',
                            fontSize: '14px',
                          }}
                        />
                        <button
                          onClick={() => {
                            const current = allocations[token.tokenId] || 0
                            const remaining = iqBalance.available - totalAllocating
                            if (remaining > 0) setAllocations(p => ({ ...p, [token.tokenId]: current + 1 }))
                          }}
                          style={{
                            fontFamily: 'monospace',
                            width: '28px',
                            height: '28px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: '1',
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                {holderData.tokens.length > 1 && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                  }}>
                    <button
                      onClick={() => {
                        const perToken = Math.floor(iqBalance.available / holderData.tokens.length)
                        const remainder = iqBalance.available % holderData.tokens.length
                        const newAllocs: Record<string, number> = {}
                        holderData.tokens.forEach((t, i) => {
                          newAllocs[t.tokenId] = perToken + (i < remainder ? 1 : 0)
                        })
                        setAllocations(newAllocs)
                      }}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '4px 10px',
                        background: '#1a1a1a',
                        color: '#0f0',
                        border: '1px solid #0f0',
                        cursor: 'pointer',
                      }}
                    >
                      split evenly
                    </button>
                    <button
                      onClick={() => setAllocations({})}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '4px 10px',
                        background: '#1a1a1a',
                        color: '#666',
                        border: '1px solid #333',
                        cursor: 'pointer',
                      }}
                    >
                      clear all
                    </button>
                  </div>
                )}

                <button
                  onClick={handleAllocate}
                  disabled={!canAllocate || allocating}
                  style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '12px 24px',
                    width: '100%',
                    background: canAllocate ? '#0f0' : '#333',
                    color: canAllocate ? '#000' : '#666',
                    border: `2px solid ${canAllocate ? '#0f0' : '#333'}`,
                    cursor: canAllocate ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}
                >
                  {allocating
                    ? 'sign in wallet...'
                    : canAllocate
                      ? `allocate ${totalAllocating} IQ points (permanent)`
                      : 'enter points above'
                  }
                </button>

                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#666',
                  textAlign: 'center',
                  marginTop: '8px',
                }}>
                  requires wallet signature. no gas. no takebacks.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Holdings Gallery */}
        {!isHolder ? (
          <div style={{
            border: '3px solid #000',
            borderRadius: '225px 15px 225px 15px / 15px 225px 15px 255px',
            boxShadow: '8px 8px 0 #000',
            background: '#fff',
            padding: '40px 20px',
            textAlign: 'center',
          }}>
            <h3 style={{ fontFamily: "'Comic Neue', cursive", fontSize: '22px', marginBottom: '12px' }}>
              u dont hold any savants
            </h3>
            <p style={{ fontFamily: "'Comic Neue', cursive", fontSize: '16px', color: '#666' }}>
              get 1 on{' '}
              <a href="https://opensea.io/collection/imaginary-magic-crypto-savants/overview" target="_blank" rel="noopener noreferrer" style={{ color: '#ff69b4', textDecoration: 'underline' }}>
                opensee
              </a>
              , dork
            </p>
          </div>
        ) : (
          <div>
            <h3 style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '20px',
              marginBottom: '12px',
              textShadow: '1px 1px 0 #ff69b4',
            }}>
              ur savants ({holderData?.tokens.length || 0})
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '12px',
            }}>
              {holderData?.tokens.map(token => (
                <motion.div
                  key={token.tokenId}
                  whileHover={{ scale: 1.05, rotate: 0 }}
                  onClick={() => setSelectedToken(token)}
                  style={{
                    border: '3px solid #000',
                    boxShadow: '4px 4px 0 #000',
                    background: '#fff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transform: `rotate(${(parseInt(token.tokenId) % 5 - 2) * 0.8}deg)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={token.image}
                    alt={token.name}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{
                    padding: '6px 8px',
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'space-between',
                    background: '#000',
                    color: '#0f0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{token.name}{token.savantName ? ` - ${token.savantName}` : ''}</span>
                    <span style={{ flexShrink: 0, marginLeft: '4px' }}>IQ:{token.iq}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Token Detail Modal */}
      <AnimatePresence>
        {selectedToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedToken(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -3 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                border: '4px solid #000',
                boxShadow: '10px 10px 0 #000',
                borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
                maxWidth: '340px',
                width: '100%',
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedToken.image}
                alt={selectedToken.name}
                style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '16px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}>
                  <h3 style={{ fontFamily: "'Comic Neue', cursive", fontSize: '22px', margin: 0 }}>
                    {selectedToken.savantName || selectedToken.name}
                  </h3>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    background: '#000',
                    color: '#0f0',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                  }}>
                    IQ: {selectedToken.iq}
                  </span>
                </div>

                {selectedToken.savantName && (
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#888',
                    marginBottom: '8px',
                  }}>
                    {selectedToken.name}
                  </div>
                )}

                {/* Savant Naming */}
                <div style={{
                  background: '#f5f5f5',
                  border: '2px solid #000',
                  padding: '10px',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '12px',
                    fontWeight: 'bold',
                    marginBottom: '6px',
                  }}>
                    {selectedToken.savantName ? 'rename ur savant' : 'sett naym'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={savantNameInput}
                      onChange={e => setSavantNameInput(e.target.value)}
                      placeholder={selectedToken.savantName || 'name ur savant...'}
                      maxLength={32}
                      style={{
                        flex: 1,
                        fontFamily: "'Comic Neue', cursive",
                        fontSize: '13px',
                        padding: '6px 8px',
                        border: '2px solid #000',
                        background: '#fff',
                      }}
                    />
                    <button
                      onClick={handleNameSavant}
                      disabled={namingToken || !savantNameInput.trim()}
                      style={{
                        fontFamily: "'Comic Neue', cursive",
                        fontSize: '12px',
                        padding: '6px 12px',
                        background: savantNameInput.trim() ? '#00ff00' : '#ccc',
                        border: '2px solid #000',
                        cursor: savantNameInput.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                      }}
                    >
                      {namingToken ? '...' : 'sign & save'}
                    </button>
                  </div>
                  {namingSuccess && (
                    <div style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '11px',
                      color: '#00aa00',
                      fontWeight: 'bold',
                      marginTop: '4px',
                    }}>
                      naym saved! ur savant is now known as &quot;{selectedToken.savantName}&quot;
                    </div>
                  )}
                  {namingError && (
                    <div style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '11px',
                      color: '#ff0000',
                      marginTop: '4px',
                    }}>
                      {namingError}
                    </div>
                  )}
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    color: '#999',
                    marginTop: '4px',
                  }}>
                    requires wallet signature. shows on leederbord & metadata.
                  </div>
                </div>

                <button
                  onClick={() => { setSelectedToken(null); setSavantNameInput(''); setNamingError(null); setNamingSuccess(false) }}
                  style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '14px',
                    padding: '8px 20px',
                    background: '#ff69b4',
                    color: '#fff',
                    border: '2px solid #000',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: '14px',
                    width: '100%',
                  }}
                >
                  close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,255,0.4)',
      border: `2px solid ${highlight ? '#0f0' : '#000'}`,
      padding: '10px 16px',
      textAlign: 'center',
      flex: '1 1 80px',
      ...(highlight && { animation: 'pulse 2s infinite' }),
    }}>
      <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '24px', fontWeight: 'bold' }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '12px' }}>{label}</div>
    </div>
  )
}
