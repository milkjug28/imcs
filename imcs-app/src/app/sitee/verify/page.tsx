'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAccount } from 'wagmi'
import { useSearchParams } from 'next/navigation'
import ConnectWallet from '@/components/ConnectWallet'

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || ''
const SITE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

type WalletInfo = { address: string; count: number }

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

  const linked = searchParams.get('linked') === 'true'
  const discordUser = searchParams.get('discord_user')
  const error = searchParams.get('error')

  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [autoVerifyAttempted, setAutoVerifyAttempted] = useState(false)

  const step = !isConnected ? 1 : !linked ? 2 : 3

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
      const res = await fetch('/api/discord/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResult(data)
      } else {
        setVerifyError(data.message || data.error || 'verification failed')
      }
    } catch {
      setVerifyError('something broke. try agen')
    } finally {
      setVerifying(false)
    }
  }, [address])

  useEffect(() => {
    if (linked && isConnected && address && !result && !verifying && !verifyError && !autoVerifyAttempted) {
      setAutoVerifyAttempted(true)
      handleVerify()
    }
  }, [linked, isConnected, address, result, verifying, verifyError, autoVerifyAttempted, handleVerify])

  const handleAddWallet = () => {
    setResult(null)
    setVerifyError(null)
    setAutoVerifyAttempted(false)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{
        fontFamily: "'Comic Neue', cursive",
        fontSize: '2rem',
        textAlign: 'center',
        marginBottom: '30px',
        color: '#000',
      }}>
        discrod verificashun
      </h2>

      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: '4px solid #000',
        borderRadius: '15px',
        padding: '30px',
        boxShadow: '6px 6px 0 #000',
        transform: 'rotate(-0.5deg)',
      }}>
        <StepBox
          number={1}
          title="connekt ur wallet"
          active={step === 1}
          done={step > 1}
        >
          {!isConnected ? (
            <ConnectWallet compact={false} />
          ) : (
            <p style={doneStyle}>
              {address?.slice(0, 6)}...{address?.slice(-4)} connekted
            </p>
          )}
        </StepBox>

        <StepBox
          number={2}
          title="link ur discrod"
          active={step === 2}
          done={step > 2}
        >
          {step < 2 ? (
            <p style={waitStyle}>do step 1 first, nerd</p>
          ) : linked && discordUser ? (
            <p style={doneStyle}>linked as {discordUser}</p>
          ) : (
            <button onClick={handleDiscordLink} style={btnStyle}>
              link discrod
            </button>
          )}
        </StepBox>

        <StepBox
          number={3}
          title="verify holdins"
          active={step === 3}
          done={!!result}
        >
          {step < 3 ? (
            <p style={waitStyle}>finish other steps first</p>
          ) : verifying ? (
            <p style={{ color: '#fff', textAlign: 'center' }}>checkin ur bags...</p>
          ) : result ? (
            <ResultDisplay result={result} onAddWallet={handleAddWallet} />
          ) : verifyError ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#ff6b6b', marginBottom: '10px' }}>{verifyError}</p>
              <button onClick={handleVerify} style={btnStyle}>try agen</button>
            </div>
          ) : (
            <button onClick={handleVerify} style={btnStyle}>verify now</button>
          )}
        </StepBox>

        {error && (
          <p style={{ color: '#ff6b6b', textAlign: 'center', marginTop: '15px' }}>
            {error === 'no_code' ? 'discord didnt give us a code' :
             error === 'invalid_state' ? 'somethin fishy happened. try agen' :
             error === 'oauth_failed' ? 'discord oauth broke' : error}
          </p>
        )}
      </div>

      <div style={{
        marginTop: '30px',
        background: '#fff',
        border: '3px solid #000',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '4px 4px 0 #000',
        transform: 'rotate(0.3deg)',
      }}>
        <h3 style={{ fontFamily: "'Comic Neue', cursive", marginBottom: '15px' }}>
          tier systum
        </h3>
        <TierRow emoji="✅" name="verified" range="1+ savants" />
        <TierRow emoji="🧠" name="reel sabant" range="2-5 savants" />
        <TierRow emoji="🔮" name="supa savants" range="6-24 savants" />
        <TierRow emoji="👑" name="ched savant" range="25-50 savants" />
        <TierRow emoji="🐐" name="absulut ched savanat" range="51+ savants" />
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          roles r cumulative. more savants = more roles. link multiple wallets 2 combine holdins
        </p>
      </div>
    </div>
  )
}

function StepBox({ number, title, active, done, children }: {
  number: number; title: string; active: boolean; done: boolean; children: React.ReactNode
}) {
  return (
    <div style={{
      background: done ? 'rgba(0,255,0,0.15)' : active ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
      borderRadius: '10px',
      padding: '15px',
      marginBottom: '15px',
      border: active ? '2px solid #fff' : '2px solid transparent',
      transition: 'all 0.3s',
    }}>
      <p style={{
        fontFamily: "'Comic Neue', cursive",
        fontWeight: 'bold',
        color: '#fff',
        fontSize: '1.1rem',
        marginBottom: '10px',
      }}>
        {done ? '✅' : `${number}.`} {title}
      </p>
      {children}
    </div>
  )
}

function ResultDisplay({ result, onAddWallet }: { result: VerifyResult; onAddWallet: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        color: '#fff',
        fontSize: '1.3rem',
        fontWeight: 'bold',
        marginBottom: '10px',
      }}>
        {result.message}
      </p>
      <p style={{ color: '#ddd' }}>
        {result.tokenCount} savant{result.tokenCount !== 1 ? 's' : ''} total across {result.wallets?.length || 1} wallet{(result.wallets?.length || 1) !== 1 ? 's' : ''}
      </p>

      {result.wallets && result.wallets.length > 0 && (
        <div style={{ marginTop: '10px', textAlign: 'left' }}>
          {result.wallets.map(w => (
            <div key={w.address} style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '6px',
              marginBottom: '4px',
              fontSize: '13px',
              color: '#ddd',
            }}>
              <span>{w.address.slice(0, 6)}...{w.address.slice(-4)}</span>
              <span>{w.count} savant{w.count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {result.tiers.map(tier => (
          <span key={tier} style={{
            background: '#fff',
            color: '#764ba2',
            padding: '4px 12px',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '14px',
          }}>
            {tier}
          </span>
        ))}
      </div>

      <p style={{ color: '#aaffaa', marginTop: '15px', fontSize: '14px' }}>
        roles assigned in discord
      </p>

      <button onClick={onAddWallet} style={{
        ...btnStyle,
        marginTop: '12px',
        background: '#444',
        fontSize: '0.9rem',
      }}>
        + add another wallet
      </button>
    </div>
  )
}

function TierRow({ emoji, name, range }: { emoji: string; name: string; range: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 0',
      borderBottom: '1px solid #eee',
    }}>
      <span style={{ fontSize: '20px' }}>{emoji}</span>
      <span style={{ fontWeight: 'bold', flex: 1 }}>{name}</span>
      <span style={{ color: '#666', fontSize: '14px' }}>{range}</span>
    </div>
  )
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
