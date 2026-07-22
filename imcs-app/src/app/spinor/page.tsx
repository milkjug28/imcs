'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useHolderData } from '@/hooks/useHolderData'
import { useReadContract } from 'wagmi'
import { SAVANT_TOKEN_ADDRESS, SAVANT_TOKEN_ABI, MINT_CHAIN } from '@/config/contracts'
import ConnectWallet from '@/components/ConnectWallet'
import SpinnerWheel from '@/components/SpinnerWheel'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

function parseNames(input: string): string[] {
  return input
    .split(/[\s,\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function playTick() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800 + Math.random() * 400
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.05)
    setTimeout(() => ctx.close(), 100)
  } catch {}
}

function playWinnerSound() {
  try {
    const ctx = new AudioContext()
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t)
      osc.stop(t + 0.3)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch {}
}

export default function SpinorPage() {
  const { address, isConnected } = useWallet()
  const { holderData } = useHolderData()

  const { data: balanceRaw, isLoading: balanceLoading } = useReadContract({
    address: SAVANT_TOKEN_ADDRESS,
    abi: SAVANT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: MINT_CHAIN.id,
    query: { enabled: !!address },
  })

  // On-chain read first; holder context (already fetched app-wide) as fallback
  // so a public-RPC hiccup doesn't show a real holder the not-holder state.
  const bal = balanceRaw !== undefined ? Number(balanceRaw) : (holderData?.balance ?? null)
  const loading = !!address && balanceLoading && bal === null
  const isHolder = bal !== null && bal > 0

  const [names, setNames] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [winner, setWinner] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const lastRotation = useRef(0)
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleSpin = () => {
    if (spinning || names.length === 0) return
    setSpinning(true)
    setWinner(null)
    const extraRotations = 5 + Math.floor(Math.random() * 5)
    const randomOffset = Math.floor(Math.random() * 360)
    const newRotation = lastRotation.current + extraRotations * 360 + randomOffset
    setRotation(newRotation)
    lastRotation.current = newRotation

    // Tick sounds that slow down
    let tickDelay = 60
    const startTicking = () => {
      playTick()
      tickDelay = Math.min(tickDelay * 1.08, 500)
      if (tickDelay < 480) {
        tickInterval.current = setTimeout(startTicking, tickDelay)
      }
    }
    startTicking()

    setTimeout(() => calculateWinner(newRotation), 4100)
  }

  const calculateWinner = (finalRotation: number) => {
    setSpinning(false)
    if (tickInterval.current) clearTimeout(tickInterval.current)
    const normalizedRotation = finalRotation % 360
    const topAngle = (270 - normalizedRotation + 360) % 360
    const segmentAngle = 360 / names.length
    const winnerIndex = Math.floor(topAngle / segmentAngle) % names.length
    const finalWinner = names[winnerIndex]
    setWinner(finalWinner)
    setHistory(prev => [finalWinner, ...prev])
    playWinnerSound()
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF6B6B', '#FF9E64', '#FFD93D', '#6BCB77', '#4D96FF', '#9B72FF', '#FF78C4'],
    })
  }

  const addName = (e?: FormEvent) => {
    e?.preventDefault()
    if (!newName.trim()) return
    const parsed = parseNames(newName)
    const unique = parsed.filter(n => !names.includes(n))
    if (unique.length > 0) setNames([...names, ...unique])
    setNewName('')
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.includes('\n') || pasted.includes(',') || pasted.includes(' ')) {
      e.preventDefault()
      const parsed = parseNames(pasted)
      const unique = parsed.filter(n => !names.includes(n))
      if (unique.length > 0) setNames([...names, ...unique])
      setNewName('')
    }
  }

  const removeName = (nameToRemove: string) => setNames(names.filter(n => n !== nameToRemove))

  const removeWinner = () => {
    if (winner) {
      setNames(names.filter(n => n !== winner))
      setWinner(null)
    }
  }

  const isGated = !isConnected || (loading && bal === null) || !isHolder

  const spinorHeader = (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px', marginLeft: '2px' }}>
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#FF595E' }} />
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#FFCA3A' }} />
          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#1982C4' }} />
        </div>
        <h1 className="spinor-title">
          SABANT<br />
          <span className="spinor-title-outline">SPINOR</span>
        </h1>
        {isGated && <p className="spinor-subtitle">spin da wheel 4 raffles n giveaways. add naymes n walluts, den spin 2 get weeners.</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ position: 'relative', zIndex: 100 }}>
          <ConnectWallet compact={true} />
        </div>
        {!isGated && (
          <>
            <div className="spinor-badge" style={{ background: '#FFD700', transform: 'rotate(2deg)' }}>
              git rdy
            </div>
            <div className="spinor-badge" style={{ background: '#fff', transform: 'rotate(-1deg)' }}>
              {names.length} participants left
            </div>
          </>
        )}
      </div>
    </header>
  )

  if (isGated) {
    let gateContent
    if (!isConnected) {
      gateContent = (
        <>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h2>connekt wallut 2 spin</h2>
          <p style={{ marginBottom: '24px', opacity: 0.5 }}>u need a wallut n at leest 1 savant</p>
          <ConnectWallet label="connekt wallut" />
        </>
      )
    } else if (loading && bal === null) {
      gateContent = (
        <>
          <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'spinor-pulse 1.5s infinite' }}>🎉</div>
          <h2>checkin ur savants...</h2>
        </>
      )
    } else {
      gateContent = (
        <>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>😤</div>
          <h2>u dont hav a savant</h2>
          <p style={{ marginBottom: '24px', opacity: 0.5 }}>go buy 1 on opensee then cum bak, dork</p>
          <a
            href="https://opensea.io/collection/imaginary-magic-crypto-savants"
            target="_blank"
            rel="noopener noreferrer"
            className="spinor-bold-button"
            style={{ background: '#2081e2', color: '#fff', textDecoration: 'none', display: 'inline-flex', height: 'auto', padding: '12px 24px', fontSize: '20px' }}
          >
            go 2 opensee
          </a>
        </>
      )
    }

    return (
      <div className="spinor-page">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {spinorHeader}
          <div className="spinor-gate">
            {gateContent}
          </div>
        </div>
      </div>
    )
  }

  const disabled = spinning || names.length === 0

  return (
    <div className="spinor-page">
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {spinorHeader}

        {/* Main grid */}
        <div className="spinor-grid">
          {/* Left: Controls */}
          <div className="spinor-left">
            {/* Da Puul */}
            <div className="spinor-bold-box" style={{ padding: '28px' }}>
              <h2 className="spinor-section-title" style={{ textDecorationColor: '#FFCA3A' }}>
                da puul
              </h2>

              <form onSubmit={addName} style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Enter a name..."
                  className="spinor-input"
                />
                <button type="submit" className="spinor-add-btn">
                  +
                </button>
              </form>

              <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }} className="spinor-scrollbar">
                <AnimatePresence mode="popLayout">
                  {names.map((name) => (
                    <motion.div
                      key={name}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="spinor-name-item"
                    >
                      <span>{name}</span>
                      <button onClick={() => removeName(name)} className="spinor-name-remove">
                        ×
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {names.length > 0 && (
                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                  <button onClick={() => setNames([])} className="spinor-clear-btn">
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Weeners Lug */}
            <div className="spinor-bold-box" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 className="spinor-section-title" style={{ textDecorationColor: '#1982C4', marginBottom: 0 }}>
                  weeeners lug
                </h2>
                {history.length > 0 && (
                  <button onClick={() => setHistory([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '18px' }}>
                    ×
                  </button>
                )}
              </div>
              <div style={{ height: '150px', overflowY: 'auto' }} className="spinor-scrollbar">
                {history.length === 0 ? (
                  <p style={{ opacity: 0.3, fontStyle: 'italic', fontSize: '16px', fontWeight: 700, textTransform: 'uppercase' }}>
                    Empty log...
                  </p>
                ) : (
                  history.map((h, i) => (
                    <div key={i} className="spinor-history-item">
                      <span className="spinor-history-num">{history.length - i}</span>
                      <span>{h}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Wheel + Result + Spin - aligned to top */}
          <div className="spinor-right">
            <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto', padding: '0 16px' }}>
              <SpinnerWheel items={names} spinning={spinning} rotation={rotation} />
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              <AnimatePresence>
                {winner && (
                  <motion.div
                    initial={{ scale: 0, rotate: 10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="spinor-bold-box spinor-winner-card"
                  >
                    <div className="spinor-winner-badge">!</div>
                    <h3 className="spinor-winner-label">VICTORIOUS!</h3>
                    <div className="spinor-winner-name">{winner}</div>
                    <button onClick={removeWinner} className="spinor-expel-btn">
                      🗑 Expel Winner
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                disabled={disabled}
                onClick={handleSpin}
                className={`spinor-bold-button spinor-spin-btn ${disabled ? 'spinor-spin-disabled' : ''}`}
              >
                {spinning ? (
                  <>
                    <span className="spinor-spinning-icon">↻</span>
                    <span>SPINNING...</span>
                  </>
                ) : (
                  <>
                    <span>spiiiiinnnn</span>
                    <div className="spinor-spin-circle" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom decorations */}
      <div className="spinor-deco-left">
        <div style={{ width: '48px', height: '48px', background: '#000', borderRadius: '50%' }} />
        <div style={{ width: '48px', height: '48px', background: '#000', transform: 'rotate(45deg)' }} />
        <div style={{ width: '48px', height: '48px', background: '#000', borderRadius: '8px' }} />
      </div>
      <div className="spinor-deco-right">Good Luck!</div>
    </div>
  )
}
