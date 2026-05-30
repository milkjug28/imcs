'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatEther } from 'viem'
import { usePackRip } from '@/hooks/usePackRip'

const MAX_PER_TX = 10

export default function BuyPackModal({
  open,
  onClose,
  onBought,
}: {
  open: boolean
  onClose: () => void
  onBought?: () => void
}) {
  const { buy, priceWei, packBalance } = usePackRip()
  const [qty, setQty] = useState(1)
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [boughtQty, setBoughtQty] = useState<number | null>(null)

  const clamp = (n: number) => Math.max(1, Math.min(MAX_PER_TX, n))
  const total = priceWei * BigInt(qty)

  const handleClose = () => {
    if (buying) return
    onClose()
    setQty(1)
    setBoughtQty(null)
    setBuyError(null)
  }

  const handleBuy = async () => {
    setBuyError(null)
    setBuying(true)
    try {
      await buy(qty)
      onBought?.()
      setBoughtQty(qty)
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'buy failed')
    } finally {
      setBuying(false)
    }
  }

  const confetti = ['🎉', '✨', '🧠', '🎊', '🃏', '💥', '🔥', '⭐']

  const stepBtn: React.CSSProperties = {
    width: '40px', height: '40px', fontFamily: "'Comic Neue', cursive", fontWeight: 900,
    fontSize: '22px', color: '#78350f', background: '#fde68a', border: '3px solid #000',
    borderRadius: '12px', cursor: 'pointer', boxShadow: '2px 2px 0 #000', lineHeight: 1,
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px',
            background: 'rgba(30,27,75,0.55)', backdropFilter: 'blur(3px)', pointerEvents: 'auto',
          }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', damping: 16 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '340px', background: '#fffbeb', border: '4px solid #000',
              borderRadius: '20px', boxShadow: '6px 6px 0 #000', padding: '24px', textAlign: 'center',
              fontFamily: "'Comic Neue', cursive", transform: 'rotate(-1deg)',
            }}
          >
            {boughtQty !== null ? (
              <div style={{ position: 'relative' }}>
                {/* confetti burst */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
                  {confetti.map((emoji, i) => (
                    <motion.span key={i}
                      initial={{ opacity: 0, y: 0, x: 0, scale: 0.6 }}
                      animate={{ opacity: [0, 1, 0], y: -90 - (i % 3) * 30, x: (i - 4) * 26, scale: 1.2, rotate: (i - 4) * 40 }}
                      transition={{ duration: 1.3, delay: i * 0.04, ease: 'easeOut' }}
                      style={{ position: 'absolute', left: '50%', top: '40%', fontSize: '22px' }}>
                      {emoji}
                    </motion.span>
                  ))}
                </div>
                <motion.div
                  initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 10 }}
                  style={{ fontSize: '56px', marginBottom: '6px' }}>
                  🎉
                </motion.div>
                <h3 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', color: '#15803d', marginBottom: '4px' }}>
                  koppd {boughtQty} pak{boughtQty > 1 ? 's' : ''}!
                </h3>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '16px' }}>
                  u now own {packBalance ?? '...'} sealed pak{(packBalance ?? 0) === 1 ? '' : 's'}. go rip em!
                </p>
                <button onClick={handleClose} style={{
                  width: '100%', fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900,
                  color: '#000', background: '#6ee7b7', border: '3px solid #000',
                  padding: '12px', borderRadius: '14px', cursor: 'pointer', boxShadow: '3px 3px 0 #000', fontSize: '14px',
                }}>
                  ✊ niiice
                </button>
              </div>
            ) : (
            <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/card-pack.png" alt="pak" style={{ width: '72px', height: '72px', objectFit: 'contain', imageRendering: 'pixelated', marginBottom: '8px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', color: '#78350f', marginBottom: '4px' }}>
              grub fresh paks
            </h3>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '16px' }}>
              1 sealed pak = 3 chancez at trayts + iq boostz
            </p>

            {/* qty stepper */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '14px' }}>
              <button onClick={() => setQty(q => clamp(q - 1))} disabled={buying || qty <= 1} style={{ ...stepBtn, opacity: qty <= 1 ? 0.4 : 1 }}>−</button>
              <span style={{ fontSize: '30px', fontWeight: 900, color: '#000', minWidth: '44px' }}>{qty}</span>
              <button onClick={() => setQty(q => clamp(q + 1))} disabled={buying || qty >= MAX_PER_TX} style={{ ...stepBtn, opacity: qty >= MAX_PER_TX ? 0.4 : 1 }}>+</button>
            </div>
            <p style={{ fontSize: '9px', fontFamily: 'monospace', color: '#92400e', marginBottom: '12px' }}>
              max {MAX_PER_TX} per kop {packBalance !== undefined ? `· u own ${packBalance}` : ''}
            </p>

            <div style={{
              fontSize: '15px', fontWeight: 900, fontFamily: 'monospace', color: '#000',
              background: '#fde68a', border: '3px solid #000', borderRadius: '12px', padding: '10px',
              marginBottom: '16px',
            }}>
              {formatEther(total)} ETH
            </div>

            {buyError && (
              <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#881337', background: '#fecdd3', border: '2px solid #881337', borderRadius: '8px', padding: '8px', marginBottom: '12px', wordBreak: 'break-word' }}>
                {buyError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={handleBuy} disabled={buying} style={{
                flex: 1, fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900,
                color: '#000', background: buying ? '#a7f3d0' : '#6ee7b7', border: '3px solid #000',
                padding: '12px', borderRadius: '14px', cursor: buying ? 'wait' : 'pointer',
                boxShadow: '3px 3px 0 #000', fontSize: '13px',
              }}>
                {buying ? '⏳ koppin...' : `🛒 KOP ${qty}`}
              </button>
              <button onClick={handleClose} disabled={buying} style={{
                fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900,
                color: '#78350f', background: '#fecaca', border: '3px solid #78350f',
                padding: '12px 16px', borderRadius: '14px', cursor: buying ? 'not-allowed' : 'pointer',
                boxShadow: '3px 3px 0 #78350f', fontSize: '13px',
              }}>
                nvm
              </button>
            </div>
            </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
