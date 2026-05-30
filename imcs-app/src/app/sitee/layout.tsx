'use client'

import { ReactNode, useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import SavantRadioWidget from '@/components/SavantRadioWidget'
import PopupSavants from '@/components/PopupSavants'
import ConnectWallet from '@/components/ConnectWallet'

type NavButton = {
  id: string
  label: string
  path: string
  defaultPos: { x: number; y: number }
  disabled?: boolean
}

const navButtons: NavButton[] = [
  { id: 'home', label: 'hoem', path: '/sitee', defaultPos: { x: 20, y: 15 } },
  { id: 'leaderboard', label: 'leederbord', path: '/sitee/leederbord', defaultPos: { x: 110, y: 15 } },
  { id: 'profile', label: 'profil', path: '/sitee/profil', defaultPos: { x: 250, y: 15 } },
  { id: 'tuulz', label: 'tuulz', path: '/sitee/tuulz', defaultPos: { x: 350, y: 15 } },
  { id: 'games', label: 'gaymes', path: '/sitee/gaymes', defaultPos: { x: 480, y: 15 }, disabled: true },
]

export default function SiteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  const allowedPaths = ['/sitee', '/sitee/leederbord', '/sitee/profil', '/sitee/verify', '/sitee/tuulz', '/sitee/ekwip', '/sitee/rip']
  useEffect(() => {
    if (!allowedPaths.includes(pathname)) {
      router.replace('/sitee')
    }
  }, [pathname, router])
  const [draggedBtn, setDraggedBtn] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => {
      // Default positions (relative to nav bar)
      return navButtons.reduce((acc, btn) => {
        acc[btn.id] = btn.defaultPos
        return acc
      }, {} as Record<string, { x: number; y: number }>)
    }
  )
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [hasDragged, setHasDragged] = useState(false)
  const startPosRef = useRef({ x: 0, y: 0 })

  // Check for mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleMouseDown = (e: React.MouseEvent, btnId: string) => {
    if (isMobile) return // No dragging on mobile
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    startPosRef.current = { x: e.clientX, y: e.clientY }
    setDraggedBtn(btnId)
    setIsDragging(true)
    setHasDragged(false)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggedBtn || !isDragging || !navRef.current || isMobile) return

    // Check if user moved enough to consider it a drag
    const moveDistance = Math.abs(e.clientX - startPosRef.current.x) + Math.abs(e.clientY - startPosRef.current.y)
    if (moveDistance > 5) {
      setHasDragged(true)
    }

    const navRect = navRef.current.getBoundingClientRect()
    const btn = document.querySelector(`[data-btn-id="${draggedBtn}"]`) as HTMLElement
    const btnWidth = btn?.offsetWidth || 120
    const btnHeight = btn?.offsetHeight || 40

    // Calculate position relative to nav bar
    let newX = e.clientX - navRect.left - dragOffset.x
    let newY = e.clientY - navRect.top - dragOffset.y

    // Constrain to nav bar boundaries
    newX = Math.max(0, Math.min(newX, navRect.width - btnWidth))
    newY = Math.max(0, Math.min(newY, navRect.height - btnHeight))

    setPositions(prev => ({
      ...prev,
      [draggedBtn]: { x: newX, y: newY }
    }))
  }, [draggedBtn, isDragging, isMobile, dragOffset])

  const handleMouseUp = useCallback(() => {
    setDraggedBtn(null)
    setIsDragging(false)
  }, [])

  const handleClick = (e: React.MouseEvent, path: string) => {
    // Only navigate if we didn't drag (or on mobile, always navigate)
    if (!hasDragged || isMobile) {
      router.push(path)
    }
  }

  useEffect(() => {
    if (isDragging && !isMobile) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isMobile, handleMouseMove, handleMouseUp])

  return (
    <div id="main-site">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ flex: '1', minWidth: '200px' }}>imaginary magic crypto savants</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 100 }}>
          <a href="https://x.com/imcsnft" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', background: '#000', borderRadius: '8px',
            border: '2px solid #000', boxShadow: '2px 2px 0 #000',
            textDecoration: 'none', color: '#fff', fontSize: '16px', fontWeight: 'bold',
          }}>&#120143;</a>
          <a href="https://discord.com/invite/AmU4rSyw64" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', background: '#5865F2', borderRadius: '8px',
            border: '2px solid #000', boxShadow: '2px 2px 0 #000',
            textDecoration: 'none',
          }}><svg width="20" height="15" viewBox="0 0 71 55" fill="none"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.2a58.9 58.9 0 0017.7 9 .2.2 0 00.3-.1 42.1 42.1 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4c.4-.3.7-.6 1.1-.9a.2.2 0 01.2 0c11.6 5.3 24.2 5.3 35.7 0a.2.2 0 01.2 0l1.1.9a.2.2 0 010 .4c-1.8 1-3.6 1.9-5.6 2.6a.2.2 0 00-.1.4 47.3 47.3 0 003.7 5.9.2.2 0 00.2.1 58.7 58.7 0 0017.7-9 .2.2 0 00.1-.2c1.4-15-2.3-28.4-9.8-40.1a.2.2 0 00-.1-.1zM23.7 37.3c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7zm23.3 0c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7z" fill="#fff"/></svg></a>
          <a href="https://opensea.io/collection/imaginary-magic-crypto-savants/overview" target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', background: '#2081e2', borderRadius: '8px',
            border: '2px solid #000', boxShadow: '2px 2px 0 #000',
            textDecoration: 'none', color: '#fff', fontSize: '14px', fontWeight: 'bold',
          }}>OS</a>
          <div style={{ display: isMobile ? 'none' : 'block' }}>
            <ConnectWallet compact={true} />
          </div>
        </div>
      </header>

      {/* Navigation Bar - Magenta bar with draggable buttons (desktop) or flex buttons (mobile) */}
      <nav ref={navRef}>
        {navButtons.map(btn => {
          const isActive = pathname === btn.path
          const pos = positions[btn.id] || btn.defaultPos

          return (
            <button
              key={btn.id}
              data-btn-id={btn.id}
              className={`nav-btn ${isActive ? 'active' : ''} ${draggedBtn === btn.id ? 'dragging' : ''} ${btn.disabled ? 'disabled' : ''}`}
              disabled={btn.disabled}
              style={isMobile ? {} : {
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              onMouseDown={(e) => {
                if (!isMobile && !btn.disabled) {
                  e.preventDefault()
                  handleMouseDown(e, btn.id)
                }
              }}
              onClick={(e) => !btn.disabled && handleClick(e, btn.path)}
            >
              {btn.label}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div id="content" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          {children}
        </div>

        {/* Footer Marquee */}
        <div className="marquee">
          <div className="marquee-content">
            ✨ walcum to imcs magic ralm! cliq for surprises anywar! we pramis to onli tek ur mani ✨
          </div>
        </div>
      </div>

      {/* Savant Radio */}
      <SavantRadioWidget />

      {/* Popup Savant Characters */}
      <PopupSavants />
    </div>
  )
}
