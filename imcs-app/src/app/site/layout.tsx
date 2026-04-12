'use client'

import { ReactNode, useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import MusicPlayer from '@/components/MusicPlayer'
import PopupSavants from '@/components/PopupSavants'
import ConnectWallet from '@/components/ConnectWallet'

type NavButton = {
  id: string
  label: string
  path: string
  defaultPos: { x: number; y: number }
}

const navButtons: NavButton[] = [
  { id: 'home', label: 'hoem', path: '/site', defaultPos: { x: 30, y: 15 } },
  { id: 'tasks', label: 'tu doo', path: '/site/tasks', defaultPos: { x: 140, y: 15 } },
  { id: 'leaderboard', label: 'leederbord', path: '/site/leaderboard', defaultPos: { x: 280, y: 15 } },
  { id: 'profile', label: 'profil', path: '/site/profile', defaultPos: { x: 460, y: 15 } },
  { id: 'banish', label: 'banisht', path: '/site/banish', defaultPos: { x: 560, y: 15 } },
]

export default function SiteLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const [isMobile, setIsMobile] = useState(false)
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
        <div style={{ display: isMobile ? 'none' : 'block' }}>
          <ConnectWallet compact={true} />
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
              className={`nav-btn ${isActive ? 'active' : ''} ${draggedBtn === btn.id ? 'dragging' : ''}`}
              style={isMobile ? {} : {
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              onMouseDown={(e) => {
                if (!isMobile) {
                  e.preventDefault()
                  handleMouseDown(e, btn.id)
                }
              }}
              onClick={(e) => handleClick(e, btn.path)}
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

      {/* Background Music Player */}
      <MusicPlayer />

      {/* Popup Savant Characters */}
      <PopupSavants />
    </div>
  )
}
