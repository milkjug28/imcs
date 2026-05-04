'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import ConnectWallet from '@/components/ConnectWallet'

type CollectionStatus = {
  slug: string
  name: string
  displayName: string
  chainId: number
  cap: number
  claimed: number
  spotsRemaining: number
  logo: string | null
}

type ExistingClaim = {
  collection_slug: string
  mint_wallet: string
  claimed_at: string
} | null

type OwnershipResult = {
  owns: boolean
  balance: number
  collection: string
} | null

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
  border: '5px solid #000',
  boxShadow: '8px 8px 0 #000',
  maxWidth: '520px',
  width: '100%',
  transform: 'rotate(-1deg)',
  padding: '30px 20px',
}

const btnStyle: React.CSSProperties = {
  fontFamily: 'Comic Neue, cursive',
  fontSize: '18px',
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #00ff00, #00bfff)',
  color: '#000',
  border: '4px solid #000',
  boxShadow: '5px 5px 0 #000',
  cursor: 'pointer',
  fontWeight: 'bold',
  width: '100%',
  transition: 'all 0.15s',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'Comic Neue, cursive',
  fontSize: '15px',
  padding: '12px 14px',
  border: '4px solid #000',
  boxShadow: '4px 4px 0 #000',
  boxSizing: 'border-box' as const,
  background: '#ffffcc',
}

function buildSignMessage(collection: string, mintWallet: string, timestamp: number): string {
  return [
    'IMCS Community Whitelist Claim',
    '',
    `Collection: ${collection}`,
    `Mint wallet: ${mintWallet}`,
    `Timestamp: ${timestamp}`,
    '',
    'This signature only proves wallet ownership.',
    'No transaction will be executed.',
  ].join('\n')
}

export default function CommunityPage() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [collections, setCollections] = useState<CollectionStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [existingClaim, setExistingClaim] = useState<ExistingClaim>(null)
  const [checkingClaim, setCheckingClaim] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [ownership, setOwnership] = useState<OwnershipResult>(null)
  const [checkingOwnership, setCheckingOwnership] = useState(false)
  const [mintWallet, setMintWallet] = useState('')
  const [useSameWallet, setUseSameWallet] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/community/status')
      .then(r => r.json())
      .then(data => {
        setCollections(data.collections || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const checkExistingClaim = useCallback(async (wallet: string) => {
    setCheckingClaim(true)
    try {
      const res = await fetch(`/api/community/check?wallet=${encodeURIComponent(wallet)}`)
      const data = await res.json()
      setExistingClaim(data.claim || null)
    } catch {
      setExistingClaim(null)
    }
    setCheckingClaim(false)
  }, [])

  useEffect(() => {
    if (isConnected && address) {
      checkExistingClaim(address)
    } else {
      setExistingClaim(null)
    }
  }, [isConnected, address, checkExistingClaim])

  // Check NFT ownership when collection is selected
  useEffect(() => {
    if (!selectedSlug || !address) {
      setOwnership(null)
      return
    }

    setCheckingOwnership(true)
    setOwnership(null)
    setError('')

    fetch(`/api/community/check-ownership?wallet=${encodeURIComponent(address)}&collection=${encodeURIComponent(selectedSlug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setOwnership(data)
          if (!data.owns) {
            setError(`u dont own any ${data.collection} nftss. nice try`)
          }
        }
        setCheckingOwnership(false)
      })
      .catch(() => {
        setError('couldnt check ownership, try agen')
        setCheckingOwnership(false)
      })
  }, [selectedSlug, address])

  useEffect(() => {
    if (useSameWallet && address) {
      setMintWallet(address)
    } else if (useSameWallet) {
      setMintWallet('')
    }
  }, [useSameWallet, address])

  const selectedCollection = collections.find(c => c.slug === selectedSlug)
  const canClaim = ownership?.owns && !claiming && mintWallet

  const handleClaim = async () => {
    if (!address || !selectedCollection || !mintWallet || !ownership?.owns) return

    const trimmedMint = mintWallet.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedMint)) {
      setError('dats not a valid wallut address dummy')
      return
    }

    setError('')
    setResult(null)
    setClaiming(true)

    try {
      const timestamp = Date.now()
      const message = buildSignMessage(
        selectedCollection.name,
        trimmedMint.toLowerCase(),
        timestamp
      )

      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/community/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holderWallet: address,
          mintWallet: trimmedMint,
          collectionSlug: selectedCollection.slug,
          signature,
          timestamp,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'sumthin went wrong')
      } else {
        setResult({ success: true, message: data.message })
        const statusRes = await fetch('/api/community/status')
        const statusData = await statusRes.json()
        setCollections(statusData.collections || [])
        if (address) checkExistingClaim(address)
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'UserRejectedRequestError') {
        setError('u rejected da signature, try agen wen redy')
      } else {
        setError('sumthin went wrong, try agen')
      }
    }

    setClaiming(false)
  }

  const totalSpots = collections.reduce((sum, c) => sum + c.cap, 0)
  const totalClaimed = collections.reduce((sum, c) => sum + c.claimed, 0)

  return (
    <div className="page active" style={{ position: 'relative', minHeight: '70vh' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '20px',
      }}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontSize: 'clamp(22px, 6vw, 32px)',
              color: '#000',
              textShadow: '2px 2px 0 #ff00ff',
              marginBottom: '8px',
            }}>
              kommuntitty witelisst 🤝
            </h2>
            <p style={{
              fontSize: '15px',
              marginBottom: '6px',
              color: '#000',
              fontWeight: 700,
            }}>
              own an nft frum a partnur kollekshun?<br />
              pruv it n get 1 free mint spot 🤝
            </p>
            <p style={{
              fontSize: '13px',
              marginBottom: '20px',
              color: '#333',
              fontWeight: 700,
            }}>
              {totalClaimed} / {totalSpots} total spotss claimed
            </p>

            {/* Connect wallet */}
            {!isConnected && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{
                  fontSize: '14px',
                  marginBottom: '12px',
                  color: '#333',
                  fontWeight: 700,
                }}>
                  connect da wallut dat holdss ur nft
                </p>
                <ConnectWallet label="connect wallut 🔌" ignoreChain />
              </div>
            )}

            {/* Already claimed state */}
            {isConnected && !checkingClaim && existingClaim && (
              <div style={{
                marginTop: '16px',
                background: 'linear-gradient(135deg, #00ff88, #00ccff)',
                border: '4px solid #000',
                boxShadow: '5px 5px 0 #000',
                padding: '20px',
                transform: 'rotate(0.5deg)',
              }}>
                <h3 style={{
                  fontSize: '22px',
                  color: '#000',
                  textShadow: '2px 2px 0 #fff',
                  marginBottom: '8px',
                }}>
                  u alredy claimed! ✅
                </h3>
                <p style={{
                  fontSize: '15px',
                  color: '#000',
                  fontWeight: 700,
                  marginBottom: '6px',
                }}>
                  kollekshun: {existingClaim.collection_slug}
                </p>
                <p style={{
                  fontSize: '13px',
                  color: '#333',
                  fontWeight: 700,
                  wordBreak: 'break-all',
                }}>
                  mint wallut: {existingClaim.mint_wallet}
                </p>
                <p style={{
                  fontSize: '12px',
                  color: '#666',
                  fontWeight: 700,
                  marginTop: '8px',
                }}>
                  1 claim per wallut. no takebackss.
                </p>
              </div>
            )}

            {isConnected && checkingClaim && (
              <p style={{ color: '#000', fontWeight: 700 }}>checkin if u alredy claimed...</p>
            )}

            {/* Claim flow - only if no existing claim */}
            {isConnected && !checkingClaim && !existingClaim && !result && (
              <>
                <div style={{
                  textAlign: 'left',
                  marginBottom: '16px',
                }}>
                  <p style={{
                    fontSize: '14px',
                    marginBottom: '10px',
                    color: '#333',
                    fontWeight: 700,
                  }}>
                    pik ur kollekshun (u get 1 choice)
                  </p>

                  {loading && (
                    <p style={{ color: '#000', fontWeight: 700 }}>loadin kollekshunss...</p>
                  )}

                  {!loading && collections.length === 0 && (
                    <div style={{
                      background: '#fff3cd',
                      border: '3px solid #000',
                      padding: '12px',
                      fontWeight: 700,
                      fontSize: '14px',
                    }}>
                      no kollekshunss available yet. chek bak soon!
                    </div>
                  )}

                  {!loading && collections.length > 0 && (
                    <select
                      value={selectedSlug || ''}
                      onChange={(e) => {
                        setSelectedSlug(e.target.value || null)
                        setError('')
                        setOwnership(null)
                      }}
                      style={{
                        width: '100%',
                        fontFamily: 'Comic Neue, cursive',
                        fontSize: '15px',
                        padding: '12px 14px',
                        border: '4px solid #000',
                        boxShadow: '4px 4px 0 #000',
                        background: selectedSlug ? 'linear-gradient(135deg, #00ff88, #00ccff)' : '#ffffcc',
                        fontWeight: 700,
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'><path d=\'M0 0l6 8 6-8z\' fill=\'%23000\'/></svg>")',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 14px center',
                        paddingRight: '40px',
                      }}
                    >
                      <option value="">-- pik a kollekshun --</option>
                      {collections.map(c => {
                        const isFull = c.spotsRemaining <= 0
                        return (
                          <option
                            key={c.slug}
                            value={c.slug}
                            disabled={isFull}
                          >
                            {c.displayName} — {isFull ? 'FULL' : `${c.claimed}/${c.cap}`}
                          </option>
                        )
                      })}
                    </select>
                  )}

                  {/* Ownership check status */}
                  {checkingOwnership && (
                    <div style={{
                      marginTop: '12px',
                      background: '#fff3cd',
                      border: '3px solid #000',
                      padding: '10px 14px',
                      fontWeight: 700,
                      fontSize: '14px',
                      textAlign: 'center',
                    }}>
                      checkin if u own any... 🔍
                    </div>
                  )}

                  {ownership?.owns && !checkingOwnership && (
                    <div style={{
                      marginTop: '12px',
                      background: '#00ff88',
                      border: '3px solid #000',
                      padding: '10px 14px',
                      fontWeight: 700,
                      fontSize: '14px',
                      color: '#000',
                      textAlign: 'center',
                    }}>
                      u own {ownership.balance} {ownership.collection} nft{ownership.balance > 1 ? 'ss' : ''} ✅
                    </div>
                  )}
                </div>

                {/* Mint wallet + sign - only show if ownership confirmed */}
                {ownership?.owns && !checkingOwnership && selectedCollection && (
                  <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                    <p style={{
                      fontSize: '14px',
                      marginBottom: '8px',
                      color: '#333',
                      fontWeight: 700,
                    }}>
                      wut wallut u wanna mint wif?
                    </p>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: 700,
                      marginBottom: '10px',
                      cursor: 'pointer',
                      fontFamily: 'Comic Neue, cursive',
                    }}>
                      <input
                        type="checkbox"
                        checked={useSameWallet}
                        onChange={(e) => {
                          setUseSameWallet(e.target.checked)
                          if (!e.target.checked) setMintWallet('')
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      use dis wallut (same as connected)
                    </label>

                    {!useSameWallet && (
                      <input
                        type="text"
                        value={mintWallet}
                        onChange={(e) => setMintWallet(e.target.value)}
                        placeholder="0x... (ur burner wallut)"
                        style={{ ...inputStyle, marginBottom: '12px' }}
                      />
                    )}

                    <p style={{
                      fontSize: '13px',
                      marginBottom: '8px',
                      color: '#666',
                      fontWeight: 700,
                    }}>
                      sign 2 pruv u own dis wallut (no gas, no tx)
                    </p>

                    <button
                      onClick={handleClaim}
                      disabled={!canClaim}
                      style={{
                        ...btnStyle,
                        background: !canClaim ? '#999' : btnStyle.background,
                        cursor: !canClaim ? 'not-allowed' : 'pointer',
                        boxShadow: !canClaim ? '2px 2px 0 #000' : '5px 5px 0 #000',
                      }}
                    >
                      {claiming ? 'claimin ur spot...' : 'sign & claim spot ✍️'}
                    </button>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    marginTop: '12px',
                    background: '#ff4444',
                    border: '3px solid #000',
                    padding: '10px 14px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '15px',
                    textShadow: '1px 1px 0 #000',
                  }}>
                    {error}
                  </div>
                )}
              </>
            )}

            {/* Success */}
            {result?.success && (
              <div style={{
                marginTop: '16px',
                background: 'linear-gradient(135deg, #00ff88, #00ccff)',
                border: '4px solid #000',
                boxShadow: '5px 5px 0 #000',
                padding: '20px',
                transform: 'rotate(1deg)',
              }}>
                <h3 style={{
                  fontSize: '24px',
                  color: '#000',
                  textShadow: '2px 2px 0 #fff',
                  marginBottom: '8px',
                }}>
                  ur in!! 🎉🔥
                </h3>
                <p style={{
                  fontSize: '16px',
                  color: '#000',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}>
                  {result.message}
                </p>
                <p style={{
                  fontSize: '14px',
                  color: '#333',
                  fontWeight: 700,
                }}>
                  ur mint wallut is on da kommuntitty list.<br />
                  ull be able 2 mint in phase 2.
                </p>
              </div>
            )}

            {/* Info box */}
            <div style={{
              marginTop: '20px',
              background: 'rgba(0,0,0,0.1)',
              border: '2px solid #000',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#333',
              textAlign: 'left',
            }}>
              <p style={{ marginBottom: '6px' }}>how dis workss:</p>
              <p style={{ marginBottom: '4px' }}>1. connect wallut dat holdss nft</p>
              <p style={{ marginBottom: '4px' }}>2. pik 1 kollekshun (u only get 1 choice!)</p>
              <p style={{ marginBottom: '4px' }}>3. we check if u own an nft from dat kollekshun</p>
              <p style={{ marginBottom: '4px' }}>4. sign a message (NO gas, NO transaction)</p>
              <p style={{ marginBottom: '4px' }}>5. u can designate a burner 2 mint wif</p>
              <p>6. ur mint wallut goess on phase 2 witelisst</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
