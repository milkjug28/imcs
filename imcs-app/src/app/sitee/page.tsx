'use client'

import { useState, useRef } from 'react'

const ETH_RE = /^0x[a-fA-F0-9]{40}$/

type CheckResult = {
  wallet: string
  found: boolean
  phases: { gtd: boolean; community: boolean; fcfs: boolean }
  totalMints: number
  source: string | null
  total_points: number
}

const emojis = [
  { emoji: '⭐', top: '10%', left: '15%', delay: '0s' },
  { emoji: '✨', top: '25%', right: '20%', delay: '0.5s' },
  { emoji: '💫', top: '50%', left: '8%', delay: '1s' },
  { emoji: '🌟', top: '15%', right: '10%', delay: '1.5s' },
  { emoji: '⭐', bottom: '25%', left: '25%', delay: '2s' },
  { emoji: '✨', bottom: '35%', right: '15%', delay: '2.5s' },
  { emoji: '💫', top: '40%', right: '30%', delay: '3s' },
  { emoji: '🌟', bottom: '15%', left: '10%', delay: '3.5s' },
]

function getResponseMessage(result: CheckResult): { title: string; body: string; vibe: 'hype' | 'mega' | 'sad' } {
  const { gtd, community, fcfs } = result.phases

  if (gtd && community && fcfs) {
    return {
      title: 'kungratz u iz speshul savaant 🧙‍♂️✨🎉',
      body: `gtd = 1. community = 1. fcfs = 1.\nu have all 3 savaants 2 mint.`,
      vibe: 'mega',
    }
  }

  if (gtd && fcfs) {
    return {
      title: 'kungratz u iz savaant 🧙‍♂️🔥',
      body: `gtd = 1. community = 0. fcfs = 1.\nu haz 2 savaants 2 mint.`,
      vibe: 'hype',
    }
  }

  if (community && fcfs) {
    return {
      title: 'kungratz u haz kumunity 🤝✨',
      body: `gtd = 0. community = 1. fcfs = 1.\nu haz 2 savaants 2 mint.`,
      vibe: 'hype',
    }
  }

  if (gtd && community) {
    return {
      title: 'kungratz u iz savaant 🧙‍♂️🔥',
      body: `gtd = 1. community = 1. fcfs = 0.\nu haz 2 savaants 2 mint.`,
      vibe: 'hype',
    }
  }

  if (gtd) {
    return {
      title: 'kungratz u iz savaant 🧙‍♂️',
      body: `gtd = 1. community = 0. fcfs = 0.\nu haz 1 savaant 2 mint.`,
      vibe: 'hype',
    }
  }

  if (community) {
    return {
      title: 'kungratz u haz kumunity 🤝',
      body: `gtd = 0. community = 1. fcfs = 0.\nu haz 1 savaant 2 mint.`,
      vibe: 'hype',
    }
  }

  if (fcfs) {
    return {
      title: 'kungratz u haz fcfs 🏃',
      body: `gtd = 0. community = 0. fcfs = 1.\nu haz 1 savaant 2 mint.`,
      vibe: 'hype',
    }
  }

  return {
    title: 'srry u iz not savant 💀',
    body: `gtd = 0. community = 0. fcfs = 0.\nu have no savaants 2 mint.`,
    vibe: 'sad',
  }
}

function getCardImage(result: CheckResult): string {
  const { gtd, community, fcfs } = result.phases
  if (gtd) return '/assets/for-cards/savaant.png'
  if (community) return '/assets/for-cards/community.png'
  if (fcfs) return '/assets/for-cards/fcfs.png'
  return '/assets/for-cards/no-savant.png'
}

function truncateWallet(w: string) {
  return w.slice(0, 6) + '...' + w.slice(-4)
}

async function captureCardBlob(el: HTMLElement): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default
  await document.fonts.ready

  const originalTransform = el.style.transform
  el.style.transform = 'none'

  const cardCanvas = await html2canvas(el, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
  })

  el.style.transform = originalTransform

  const pad = 32
  const angle = -0.5 * (Math.PI / 180)
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const rw = Math.ceil(cardCanvas.width * cos + cardCanvas.height * sin)
  const rh = Math.ceil(cardCanvas.height * cos + cardCanvas.width * sin)
  const w = rw + pad * 2
  const h = rh + pad * 2
  const final = document.createElement('canvas')
  final.width = w
  final.height = h
  const ctx = final.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#ff6b9d')
  grad.addColorStop(1, '#ffd700')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(angle)
  ctx.drawImage(cardCanvas, -cardCanvas.width / 2, -cardCanvas.height / 2)
  ctx.restore()

  return new Promise((resolve) => {
    final.toBlob((blob) => resolve(blob!), 'image/png')
  })
}

export default function HomePage() {
  const [wallet, setWallet] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyLabel, setCopyLabel] = useState('copy')
  const cardRef = useRef<HTMLDivElement>(null)

  const handleCheck = async () => {
    const trimmed = wallet.trim()
    if (!ETH_RE.test(trimmed)) {
      setError('dats not a wallet address u dummy')
      setResult(null)
      return
    }
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/check?wallet=${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'sumthin went wrong')
      else setResult(data)
    } catch {
      setError('cant reach da server, try agen')
    }
    setLoading(false)
  }

  const handleCopy = async () => {
    if (!cardRef.current) return
    try {
      const blob = await captureCardBlob(cardRef.current)
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopyLabel('copied!')
      } else {
        handleDownload()
        setCopyLabel('downloaded!')
      }
    } catch {
      setCopyLabel('failed')
    }
    setTimeout(() => setCopyLabel('copy'), 2000)
  }

  const handleDownload = async () => {
    if (!cardRef.current) return
    const blob = await captureCardBlob(cardRef.current)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `imcs-savant-status.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleShareX = () => {
    if (!result) return
    const msg = result.totalMints > 0
      ? `im a savaant wit ${result.totalMints} mint${result.totalMints > 1 ? 's' : ''}. r u on da list?? chek ur wallut @imcsnft`
      : `im not a savant yet... r u?? chek ur wallut @imcsnft`
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent('https://imcs.world')}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const msg = result ? getResponseMessage(result) : null

  return (
    <div className="page active" id="home" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Background "imaginate" text */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1,
        textAlign: 'center',
        padding: '0 10px',
        width: '100%',
        pointerEvents: 'none',
      }}>
        <h1 style={{
          fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
          fontSize: 'clamp(60px, 15vw, 180px)',
          color: '#ffff00',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          WebkitTextStroke: '3px #000',
          textShadow: '4px 4px 0 #000',
          margin: 0,
          lineHeight: 1,
          fontWeight: 700,
        }}>
          imaginate
        </h1>
      </div>

      {/* Floating emojis */}
      {emojis.map((item, i) => (
        <div
          key={i}
          className="floating-emoji"
          style={{
            top: item.top,
            bottom: (item as unknown as Record<string, string>).bottom,
            left: item.left,
            right: item.right,
            animationDelay: item.delay,
          }}
        >
          {item.emoji}
        </div>
      ))}

      {/* Wallet checker card */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '20px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
          border: '5px solid #000',
          boxShadow: '8px 8px 0 #000',
          maxWidth: '480px',
          width: '100%',
          transform: 'rotate(-1deg)',
        }}>
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <h2 style={{
              fontSize: 'clamp(24px, 7vw, 36px)',
              color: '#000',
              textShadow: '2px 2px 0 #ff00ff',
              marginBottom: '8px',
            }}>
              chek wallut 🧙‍♂️
            </h2>
            <p style={{ fontSize: '16px', marginBottom: '20px', color: '#000', fontWeight: 700 }}>
              paste ur wallet 2 see if ur a savaant
            </p>

            {/* Input */}
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              placeholder="0x..."
              style={{
                width: '100%',
                fontFamily: 'Comic Neue, cursive',
                fontSize: '15px',
                padding: '12px 14px',
                border: '4px solid #000',
                boxShadow: '4px 4px 0 #000',
                marginBottom: '12px',
                boxSizing: 'border-box',
                background: '#ffffcc',
              }}
            />

            <button
              onClick={handleCheck}
              disabled={loading}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: '20px',
                padding: '12px 30px',
                background: loading ? '#999' : 'linear-gradient(135deg, #00ff00, #00bfff)',
                color: '#000',
                border: '4px solid #000',
                boxShadow: loading ? '2px 2px 0 #000' : '5px 5px 0 #000',
                cursor: loading ? 'wait' : 'pointer',
                fontWeight: 'bold',
                width: '100%',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'rotate(1deg) scale(1.03)' }}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              {loading ? 'hmmmm checkin...' : 'chek it 👀'}
            </button>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: '16px',
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

            {/* Result card (capturable) */}
            {result && msg && (
              <>
                <div
                  ref={cardRef}
                  data-card
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    marginTop: '16px',
                    background: msg.vibe === 'sad'
                      ? 'linear-gradient(135deg, #ff4444, #cc0000)'
                      : msg.vibe === 'mega'
                        ? 'linear-gradient(135deg, #ffd700, #ff00ff, #00ffff)'
                        : 'linear-gradient(135deg, #00ff88, #00ccff)',
                    border: '4px solid #000',
                    boxShadow: '5px 5px 0 #000',
                    padding: '20px 16px 20px 16px',
                    transform: msg.vibe === 'mega' ? 'rotate(1deg)' : 'rotate(-0.5deg)',
                  }}
                >
                  {/* Character image - bottom left, clipped at bottom */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-10px',
                    left: '-15px',
                    width: '130px',
                    height: '130px',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getCardImage(result)}
                      alt=""
                      style={{
                        width: '130px',
                        height: '130px',
                        objectFit: 'contain',
                        objectPosition: 'center top',
                        transform: 'rotate(-5deg)',
                      }}
                    />
                  </div>

                  {/* IMCS branding for screenshot */}
                  <div style={{
                    position: 'relative',
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: msg.vibe === 'sad' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                    margin: '0px 0px 10px 0px',
                    padding: '0px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    lineHeight: '16px',
                  }}>
                    imcs.world - {truncateWallet(result.wallet)}
                  </div>

                  <h3 style={{
                    position: 'relative',
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '24px',
                    color: msg.vibe === 'sad' ? '#fff' : '#000',
                    textShadow: msg.vibe === 'sad' ? '2px 2px 0 #000' : '2px 2px 0 #fff',
                    margin: '0px 0px 12px 0px',
                    padding: '0px',
                    lineHeight: '30px',
                    fontWeight: 700,
                  }}>
                    {msg.title}
                  </h3>
                  <p style={{
                    position: 'relative',
                    fontFamily: 'Comic Neue, cursive',
                    fontSize: '16px',
                    color: msg.vibe === 'sad' ? '#ffd' : '#000',
                    fontWeight: 700,
                    lineHeight: '26px',
                    margin: '0px 0px 12px 0px',
                    padding: '0px',
                    whiteSpace: 'pre-line',
                  }}>
                    {msg.body}
                  </p>
                  {result.total_points > 0 && (
                    <p style={{
                      position: 'relative',
                      fontFamily: 'Comic Neue, cursive',
                      fontSize: '14px',
                      color: msg.vibe === 'sad' ? '#ffa' : '#333',
                      fontWeight: 700,
                      margin: '0px 0px 4px 0px',
                      padding: '0px',
                      lineHeight: '20px',
                    }}>
                      {result.total_points} savant points
                    </p>
                  )}
                  {result.source && (
                    <span style={{
                      position: 'relative',
                      display: 'inline-block',
                      marginTop: '8px',
                      background: '#000',
                      color: '#ffff00',
                      fontWeight: 700,
                      fontFamily: 'Comic Neue, cursive',
                      fontSize: '12px',
                      padding: '3px 10px',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      lineHeight: '18px',
                      borderRadius: '50px', 
                    }}>
                      {result.source === 'collab' ? 'savaantkollab fren' : result.source === 'leaderboard' ? 'imaginari magikal cripto savaant' : 'kumuntitty holdur'}
                    </span>
                  )}
                </div>

                {/* Share buttons */}
                <div style={{
                  marginTop: '12px',
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}>
                  {[
                    { label: copyLabel, icon: '📋', onClick: handleCopy },
                    { label: 'save', icon: '⬇️', onClick: handleDownload },
                    { label: 'share 2 X', icon: '𝕏', onClick: handleShareX },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={btn.onClick}
                      style={{
                        fontFamily: 'Comic Neue, cursive',
                        fontSize: '14px',
                        padding: '8px 16px',
                        background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
                        color: '#000',
                        border: '3px solid #000',
                        boxShadow: '3px 3px 0 #000',
                        cursor: 'pointer',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '3px 5px 0 #000'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = '3px 3px 0 #000'
                      }}
                    >
                      <span>{btn.icon}</span> {btn.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
