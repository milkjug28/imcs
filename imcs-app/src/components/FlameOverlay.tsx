'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

// Over-the-top burn overlay: real fire video (black bg, screen-blended) +
// a flipped copy for top-down engulf + a green-screen clip chroma-keyed on top.
export default function FlameOverlay() {
  const greenVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const video = greenVideoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    let raf = 0
    const W = canvas.width
    const H = canvas.height

    const draw = () => {
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, W, H)
        try {
          const frame = ctx.getImageData(0, 0, W, H)
          const d = frame.data
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2]
            // knock out green-screen pixels
            if (g > 90 && g > r * 1.25 && g > b * 1.25) d[i + 3] = 0
          }
          ctx.putImageData(frame, 0, 0)
        } catch { /* cross-origin shouldn't happen for same-origin asset */ }
      }
      raf = requestAnimationFrame(draw)
    }
    video.play().catch(() => {})
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ duration: 0.12 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', overflow: 'hidden',
        background: '#000',
      }}
      className="flame-shake-wrap"
    >
      {/* bottom-up real fire (black bg removed by screen blend) */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src="/assets/fire-1.mp4" autoPlay muted loop playsInline
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          mixBlendMode: 'screen',
        }}
      />
      {/* flipped copy from the top so the whole screen is engulfed */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src="/assets/fire-1.mp4" autoPlay muted loop playsInline
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          mixBlendMode: 'screen', transform: 'scaleY(-1) scaleX(-1)', opacity: 0.85,
        }}
      />
      {/* green-screen clip, chroma-keyed onto a canvas, layered on top */}
      <canvas
        ref={canvasRef} width={640} height={360}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          mixBlendMode: 'screen',
        }}
      />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={greenVideoRef} src="/assets/fire-2-has-greenscreen.mp4" muted loop playsInline
        style={{ display: 'none' }}
      />

      {/* warm flicker wash + vignette for extra heat */}
      <div className="flame-wash" />
    </motion.div>
  )
}
