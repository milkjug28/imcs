'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useReadContract } from 'wagmi'
import { SAVANT_TOKEN_ADDRESS, SAVANT_TOKEN_ABI, MINT_CHAIN } from '@/config/contracts'
import ConnectWallet from '@/components/ConnectWallet'
import { motion, AnimatePresence } from 'framer-motion'

type Token = {
  tokenId: string
  name: string
  image: string
  iq: number
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

export default function ProfilePage() {
  const { address, isConnected, truncatedAddress } = useWallet()
  const [holderData, setHolderData] = useState<HolderData | null>(null)
  const [legacyProfile, setLegacyProfile] = useState<ProfileData | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)

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

    const [holderRes, profileRes, usernameRes] = await Promise.all([
      fetch(`/api/holder?wallet=${address}`).catch(() => null),
      fetch(`/api/profile/${address}`).catch(() => null),
      fetch(`/api/chat/username?wallet=${address}`).catch(() => null),
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
            <div style={{
              background: 'rgba(255,255,255,0.4)',
              border: '2px solid #000',
              padding: '10px 16px',
              textAlign: 'center',
              flex: '1 1 80px',
            }}>
              <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '24px', fontWeight: 'bold' }}>
                {balance ?? 0}
              </div>
              <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '12px' }}>savants held</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.4)',
              border: '2px solid #000',
              padding: '10px 16px',
              textAlign: 'center',
              flex: '1 1 80px',
            }}>
              <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '24px', fontWeight: 'bold' }}>
                {totalIQ}
              </div>
              <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '12px' }}>total iq</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.4)',
              border: '2px solid #000',
              padding: '10px 16px',
              textAlign: 'center',
              flex: '1 1 80px',
            }}>
              <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '24px', fontWeight: 'bold' }}>
                {legacyProfile?.total_points || 0}
              </div>
              <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '12px' }}>legacy pts</div>
            </div>
            {legacyProfile?.rank && (
              <div style={{
                background: 'rgba(255,255,255,0.4)',
                border: '2px solid #000',
                padding: '10px 16px',
                textAlign: 'center',
                flex: '1 1 80px',
              }}>
                <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '24px', fontWeight: 'bold' }}>
                  #{legacyProfile.rank}
                </div>
                <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '12px' }}>legacy rank</div>
              </div>
            )}
          </div>
        </div>

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
              u dont hold any savants 💀
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
                  }}>
                    <span>{token.name}</span>
                    <span>IQ:{token.iq}</span>
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
                maxWidth: '420px',
                width: '100%',
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedToken.image}
                alt={selectedToken.name}
                style={{ width: '100%', display: 'block' }}
              />
              <div style={{ padding: '16px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}>
                  <h3 style={{ fontFamily: "'Comic Neue', cursive", fontSize: '22px', margin: 0 }}>
                    {selectedToken.name}
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

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}>
                  {selectedToken.traits.map((trait, i) => (
                    <span key={i} style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '11px',
                      padding: '3px 8px',
                      background: `hsl(${(i * 47) % 360}, 70%, 85%)`,
                      border: '1px solid #000',
                      borderRadius: '4px',
                    }}>
                      <strong>{trait.type}:</strong> {trait.value}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedToken(null)}
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
