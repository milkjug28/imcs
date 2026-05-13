'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useSearchParams } from 'next/navigation'
import ConnectWallet from '@/components/ConnectWallet'

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ''
const SITE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

type WalletInfo = { address: string; count: number }

type ProfileData = {
  found: boolean
  discord?: { id: string; username: string }
  tokenCount: number
  tiers: string[]
  wallets: WalletInfo[]
}

type VerifyResult = {
  success: boolean
  message: string
  tokenCount: number
  tiers: string[]
  wallets?: WalletInfo[]
  discord?: { id: string; username: string }
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', color: '#666' }}>loadin...</p>}>
      <VerifyContent />
    </Suspense>
  )
}

function VerifyContent() {
  const { address, isConnected } = useAccount()
  const searchParams = useSearchParams()
  const { signMessageAsync } = useSignMessage()

  const linked = searchParams.get('linked') === 'true'
  const discordUser = searchParams.get('discord_user')
  const error = searchParams.get('error')

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [discordSession, setDiscordSession] = useState<{ username: string } | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [autoVerifyAttempted, setAutoVerifyAttempted] = useState(false)
  const [unlinking, setUnlinking] = useState<string | null>(null)

  const walletReady = isConnected && !!address
  const discordReady = linked || !!discordSession
  const canVerify = walletReady && discordReady

  useEffect(() => {
    if (!isConnected || !address) {
      setProfile(null)
      setDiscordSession(null)
      return
    }
    if (linked) return

    setLoadingProfile(true)
    fetch(`/api/discord/wallets?wallet=${address}`)
      .then(r => r.json())
      .then(data => {
        if (data.found) {
          setProfile(data)
        } else {
          setProfile(null)
          setDiscordSession(data.discordSession || null)
        }
      })
      .catch(() => { setProfile(null); setDiscordSession(null) })
      .finally(() => setLoadingProfile(false))
  }, [address, isConnected, linked])

  const handleDiscordLink = useCallback(() => {
    const state = crypto.randomUUID()
    document.cookie = `discord_oauth_state=${state}; path=/; max-age=600; samesite=lax`
    const redirectUri = encodeURIComponent(`${SITE_URL}/api/discord/callback`)
    const url = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`
    window.location.href = url
  }, [])

  const handleVerify = useCallback(async () => {
    if (!address) return
    setVerifying(true)
    setVerifyError(null)
    try {
      const timestamp = Date.now()
      const message = `Verify wallet ownership for IMCS Discord\nWallet: ${address}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/discord/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, signature, message }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResult(data)
        setProfile({
          found: true,
          discord: data.discord,
          tokenCount: data.tokenCount,
          tiers: data.tiers,
          wallets: data.wallets || [],
        })
      } else {
        setVerifyError(data.message || data.error || 'verification failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setVerifyError('u rejected da signature. need it 2 prove u own dis wallet')
      } else {
        setVerifyError('something broke. try agen')
      }
    } finally {
      setVerifying(false)
    }
  }, [address, signMessageAsync])

  useEffect(() => {
    if (linked && isConnected && address && !result && !verifying && !verifyError && !autoVerifyAttempted) {
      setAutoVerifyAttempted(true)
      handleVerify()
    }
  }, [linked, isConnected, address, result, verifying, verifyError, autoVerifyAttempted, handleVerify])

  const handleUnlink = useCallback(async (walletAddress: string) => {
    if (!address) return
    setUnlinking(walletAddress)
    setVerifyError(null)
    try {
      if (address.toLowerCase() !== walletAddress.toLowerCase()) {
        setVerifyError('connect dat wallet first 2 unlink it')
        setUnlinking(null)
        return
      }

      const timestamp = Date.now()
      const message = `Unlink wallet from IMCS Discord\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/discord/wallets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, signature, message }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        if (data.wallets.length === 0) {
          setProfile(null)
        } else {
          setProfile(prev => prev ? {
            ...prev,
            tokenCount: data.tokenCount,
            tiers: data.tiers,
            wallets: data.wallets,
          } : null)
        }
      } else {
        setVerifyError(data.error || 'unlink failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('User rejected') && !msg.includes('user rejected')) {
        setVerifyError('something broke. try agen')
      }
    } finally {
      setUnlinking(null)
    }
  }, [address, signMessageAsync])

  if (isConnected && loadingProfile) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>checkin ur wallet...</p>
      </div>
    )
  }

  if (isConnected && profile && !linked) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={titleStyle}>ur savant profil</h2>

        <div style={cardStyle}>
          <div style={sectionStyle}>
            <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold' }}>
              {profile.discord?.username || 'unknown'}
            </p>
            <p style={{ color: '#ddd', fontSize: '0.9rem' }}>discord linked</p>
          </div>

          <div style={sectionStyle}>
            <p style={{
              color: '#fff',
              fontSize: '2rem',
              fontWeight: 'bold',
              fontFamily: "'Comic Neue', cursive",
            }}>
              {profile.tokenCount}
            </p>
            <p style={{ color: '#ddd' }}>
              savant{profile.tokenCount !== 1 ? 's' : ''} total
            </p>
            {profile.tiers.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {profile.tiers.map(tier => (
                  <span key={tier} style={tierBadge}>{tier}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...sectionStyle, textAlign: 'left' }}>
            <p style={{
              color: '#fff',
              fontWeight: 'bold',
              marginBottom: '10px',
              fontFamily: "'Comic Neue', cursive",
            }}>
              linked wallets ({profile.wallets.length})
            </p>
            {profile.wallets.map(w => (
              <div key={w.address} style={walletRow}>
                <span>{w.address.slice(0, 6)}...{w.address.slice(-4)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{w.count} savant{w.count !== 1 ? 's' : ''}</span>
                  {address?.toLowerCase() === w.address.toLowerCase() && (
                    <button
                      onClick={() => handleUnlink(w.address)}
                      disabled={unlinking === w.address}
                      style={unlinkBtn}
                    >
                      {unlinking === w.address ? '...' : 'unlink'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
              switch wallet 2 link or unlink others
            </p>
          </div>

          <button onClick={handleDiscordLink} style={btnStyle}>
            + link another wallet
          </button>

          {verifyError && (
            <p style={{ color: '#ff6b6b', textAlign: 'center', marginTop: '10px' }}>
              {verifyError}
            </p>
          )}
        </div>

        <TierSection />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={titleStyle}>discrod verificashun</h2>

      <div style={cardStyle}>
        <SectionBox title="connekt wallet" done={walletReady}>
          {!isConnected ? (
            <ConnectWallet compact={false} />
          ) : (
            <p style={doneStyle}>
              {address?.slice(0, 6)}...{address?.slice(-4)} connekted
            </p>
          )}
        </SectionBox>

        <SectionBox title="link discrod" done={discordReady}>
          {discordReady ? (
            <p style={doneStyle}>linked as {discordUser || discordSession?.username}</p>
          ) : (
            <button onClick={handleDiscordLink} style={btnStyle}>link discrod</button>
          )}
        </SectionBox>

        <SectionBox title="sign + verify" done={!!result}>
          {!canVerify ? (
            <p style={waitStyle}>
              {!walletReady && !discordReady ? 'connect wallet n discord first' :
               !walletReady ? 'connect wallet first' :
               'link discord first'}
            </p>
          ) : verifying ? (
            <p style={{ color: '#fff', textAlign: 'center' }}>sign in ur wallet then checkin bags...</p>
          ) : result ? (
            <ResultDisplay result={result} onAddWallet={handleDiscordLink} />
          ) : verifyError ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#ff6b6b', marginBottom: '10px' }}>{verifyError}</p>
              <button onClick={handleVerify} style={btnStyle}>try agen</button>
            </div>
          ) : (
            <button onClick={handleVerify} style={btnStyle}>sign + verify</button>
          )}
        </SectionBox>

        {error && (
          <p style={{ color: '#ff6b6b', textAlign: 'center', marginTop: '15px' }}>
            {error === 'no_code' ? 'discord didnt give us a code' :
             error === 'invalid_state' ? 'somethin fishy happened. try agen' :
             error === 'oauth_failed' ? 'discord oauth broke' : error}
          </p>
        )}
      </div>

      <TierSection />
    </div>
  )
}

function SectionBox({ title, done, children }: {
  title: string; done: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      background: done ? 'rgba(0,255,0,0.15)' : 'rgba(255,255,255,0.2)',
      borderRadius: '10px',
      padding: '15px',
      marginBottom: '15px',
      border: done ? '2px solid rgba(0,255,0,0.3)' : '2px solid transparent',
      transition: 'all 0.3s',
    }}>
      <p style={{
        fontFamily: "'Comic Neue', cursive",
        fontWeight: 'bold',
        color: '#fff',
        fontSize: '1.1rem',
        marginBottom: '10px',
      }}>
        {done ? '✅' : '○'} {title}
      </p>
      {children}
    </div>
  )
}

function ResultDisplay({ result, onAddWallet }: { result: VerifyResult; onAddWallet: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '10px' }}>
        {result.message}
      </p>
      <p style={{ color: '#ddd' }}>
        {result.tokenCount} savant{result.tokenCount !== 1 ? 's' : ''} total across {result.wallets?.length || 1} wallet{(result.wallets?.length || 1) !== 1 ? 's' : ''}
      </p>

      {result.wallets && result.wallets.length > 0 && (
        <div style={{ marginTop: '10px', textAlign: 'left' }}>
          {result.wallets.map(w => (
            <div key={w.address} style={walletRow}>
              <span>{w.address.slice(0, 6)}...{w.address.slice(-4)}</span>
              <span>{w.count} savant{w.count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {result.tiers.map(tier => (
          <span key={tier} style={tierBadge}>{tier}</span>
        ))}
      </div>

      <p style={{ color: '#aaffaa', marginTop: '15px', fontSize: '14px' }}>
        roles assigned in discord
      </p>

      <button onClick={onAddWallet} style={{ ...btnStyle, marginTop: '12px', background: '#444', fontSize: '0.9rem' }}>
        + add another wallet
      </button>
    </div>
  )
}

function TierSection() {
  return (
    <div style={{
      marginTop: '30px',
      background: '#fff',
      border: '3px solid #000',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '4px 4px 0 #000',
      transform: 'rotate(0.3deg)',
    }}>
      <h3 style={{ fontFamily: "'Comic Neue', cursive", marginBottom: '15px' }}>tier systum</h3>
      <TierRow emoji="✅" name="verified" range="1+ savants" />
      <TierRow emoji="🧠" name="reel sabant" range="2-5 savants" />
      <TierRow emoji="🔮" name="supa savants" range="6-24 savants" />
      <TierRow emoji="👑" name="ched savant" range="25-50 savants" />
      <TierRow emoji="🐐" name="absulut ched savanat" range="51+ savants" />
      <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        roles r cumulative. more savants = more roles. link multiple wallets 2 combine holdins
      </p>
    </div>
  )
}

function TierRow({ emoji, name, range }: { emoji: string; name: string; range: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #eee' }}>
      <span style={{ fontSize: '20px' }}>{emoji}</span>
      <span style={{ fontWeight: 'bold', flex: 1 }}>{name}</span>
      <span style={{ color: '#666', fontSize: '14px' }}>{range}</span>
    </div>
  )
}

const titleStyle: React.CSSProperties = {
  fontFamily: "'Comic Neue', cursive",
  fontSize: '2rem',
  textAlign: 'center',
  marginBottom: '30px',
  color: '#000',
}

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  border: '4px solid #000',
  borderRadius: '15px',
  padding: '30px',
  boxShadow: '6px 6px 0 #000',
  transform: 'rotate(-0.5deg)',
}

const sectionStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  borderRadius: '10px',
  padding: '15px',
  marginBottom: '15px',
  textAlign: 'center',
}

const walletRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.1)',
  borderRadius: '6px',
  marginBottom: '6px',
  fontSize: '13px',
  color: '#ddd',
}

const tierBadge: React.CSSProperties = {
  background: '#fff',
  color: '#764ba2',
  padding: '4px 12px',
  borderRadius: '20px',
  fontWeight: 'bold',
  fontSize: '14px',
}

const unlinkBtn: React.CSSProperties = {
  background: 'rgba(255,100,100,0.3)',
  border: '1px solid rgba(255,100,100,0.5)',
  color: '#ffaaaa',
  borderRadius: '4px',
  padding: '2px 8px',
  fontSize: '11px',
  cursor: 'pointer',
}

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px',
  background: '#5865F2',
  color: '#fff',
  border: '3px solid #000',
  borderRadius: '8px',
  fontFamily: "'Comic Neue', cursive",
  fontSize: '1.1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  boxShadow: '3px 3px 0 #000',
}

const doneStyle: React.CSSProperties = {
  color: '#aaffaa',
  textAlign: 'center',
  fontWeight: 'bold',
}

const waitStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.4)',
  textAlign: 'center',
  fontStyle: 'italic',
}
