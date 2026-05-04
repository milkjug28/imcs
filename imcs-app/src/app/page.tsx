'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, Suspense } from 'react'

function SplashScreenContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const irisLeftRef = useRef<HTMLImageElement>(null)
  const irisRightRef = useRef<HTMLImageElement>(null)
  const eyesWrapperRef = useRef<HTMLDivElement>(null)
  const [preloadedCount, setPreloadedCount] = useState<number | null>(null)

  // Capture referral code from URL and store in localStorage
  useEffect(() => {
    const refCode = searchParams.get('ref')
    if (refCode) {
      localStorage.setItem('referralCode', refCode.toUpperCase())
    }
  }, [searchParams])

  // Preload WL count while user is on splash screen (lightweight endpoint)
  useEffect(() => {
    fetch('/api/stats/wl-count')
      .then(r => r.json())
      .then(data => {
        const count = data.count || 0
        setPreloadedCount(count)
        sessionStorage.setItem('wlCount', String(count))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })

      // Eye tracking
      if (!eyesWrapperRef.current || !irisLeftRef.current || !irisRightRef.current) return

      const wrapperRect = eyesWrapperRef.current.getBoundingClientRect()
      const centerX = wrapperRect.left + wrapperRect.width / 2
      const centerY = wrapperRect.top + wrapperRect.height / 2

      const MAX_MOVEMENT = 8
      const SENSITIVITY = 30

      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
      const distance = Math.min(
        MAX_MOVEMENT,
        Math.hypot(e.clientX - centerX, e.clientY - centerY) / SENSITIVITY
      )
      const moveX = Math.cos(angle) * distance
      const moveY = Math.sin(angle) * distance

      irisLeftRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`
      irisRightRef.current.style.transform = `translate(${moveX}px, ${moveY}px)`
    }

    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const handleEnter = () => {
    router.push('/sitee')
  }

  return (
    <div id="splash">
      {/* Flashlight effect */}
      <div
        id="flashlight"
        style={{
          left: mousePos.x - 150 + 'px',
          top: mousePos.y - 150 + 'px',
        }}
      />

      {/* Eyes */}
      <div className="eyes-wrapper" ref={eyesWrapperRef}>
        {/* Base layer - establishes size */}
        <img
          className="eye-layer-base eye-white-left"
          src="/assets/eyes/eye-white-left.png"
          alt=""
        />

        {/* Layer 1: Other eye white */}
        <img
          className="eye-layer eye-white-right"
          src="/assets/eyes/eye-white-right.png"
          alt=""
        />

        {/* Layer 2: Eye irises (move with cursor) */}
        <img
          ref={irisLeftRef}
          className="eye-layer eye-iris-left"
          src="/assets/eyes/eye-iris-left.png"
          alt=""
        />
        <img
          ref={irisRightRef}
          className="eye-layer eye-iris-right"
          src="/assets/eyes/eye-iris-right.png"
          alt=""
        />

        {/* Layer 3: Skin layer */}
        <img
          className="eye-layer eye-skin"
          src="/assets/eyes/top-skin-inder-outliine.png"
          alt=""
        />

        {/* Layer 4: Face outline (top) */}
        <img
          className="eye-layer eye-outline"
          src="/assets/eyes/top-face-outline.png"
          alt=""
        />

        {/* Vignette overlay */}
        <div className="skin-vignette" />
      </div>

      {/* Enter button */}
      <button id="enter-btn" onClick={handleEnter}>
        walcum tu savant wurld
      </button>
    </div>
  )
}

// Wrap in Suspense for useSearchParams
export default function SplashScreen() {
  return (
    <Suspense fallback={
      <div id="splash" style={{ background: '#000' }}>
        <div style={{ color: '#fff', fontSize: '24px' }}>loading...</div>
      </div>
    }>
      <SplashScreenContent />
    </Suspense>
  )
}
