'use client'

import { useRouter } from 'next/navigation'

type SharePromptProps = {
  title: string
  score: number | string
  scoreLabel: string
  shareText: string
  onClose?: () => void
  onPlayAgain?: () => void
  showPlayAgain?: boolean
  backRoute?: string
}

export default function SharePrompt({
  title,
  score,
  scoreLabel,
  shareText,
  onClose,
  onPlayAgain,
  showPlayAgain = true,
  backRoute = '/sitee/tasks',
}: SharePromptProps) {
  const router = useRouter()

  const handleShare = () => {
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
    window.open(shareUrl, '_blank')
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
        padding: '30px',
        border: '5px solid #000',
        boxShadow: '10px 10px 0 #000',
        textAlign: 'center',
        maxWidth: '450px',
        width: '100%',
        transform: 'rotate(-1deg)',
      }}>
        <h2 style={{
          fontSize: 'clamp(24px, 8vw, 36px)',
          marginBottom: '10px',
          color: '#fff',
          textShadow: '3px 3px 0 #000',
        }}>
          {title}
        </h2>

        <div style={{
          fontSize: 'clamp(48px, 15vw, 72px)',
          color: '#fff',
          textShadow: '4px 4px 0 #000',
          marginBottom: '10px',
          fontWeight: 'bold',
        }}>
          {score}
        </div>

        <p style={{
          fontSize: '20px',
          marginBottom: '25px',
          color: '#000',
        }}>
          {scoreLabel}
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <button
            onClick={handleShare}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: 'clamp(18px, 5vw, 22px)',
              padding: '15px 30px',
              background: '#1DA1F2',
              border: '4px solid #000',
              cursor: 'pointer',
              color: '#fff',
              boxShadow: '5px 5px 0 #000',
              transition: 'all 0.1s',
            }}
          >
            share on X 🐦
          </button>

          {showPlayAgain && onPlayAgain && (
            <button
              onClick={onPlayAgain}
              style={{
                fontFamily: 'Comic Neue, cursive',
                fontSize: 'clamp(18px, 5vw, 22px)',
                padding: '15px 30px',
                background: '#ffff00',
                border: '4px solid #000',
                cursor: 'pointer',
                boxShadow: '5px 5px 0 #000',
                transition: 'all 0.1s',
              }}
            >
              play again 🔄
            </button>
          )}

          <button
            onClick={() => {
              if (onClose) onClose()
              router.push(backRoute)
            }}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: 'clamp(18px, 5vw, 22px)',
              padding: '15px 30px',
              background: '#00ff00',
              border: '4px solid #000',
              cursor: 'pointer',
              boxShadow: '5px 5px 0 #000',
              transition: 'all 0.1s',
            }}
          >
            bak 2 tasks
          </button>
        </div>
      </div>
    </div>
  )
}
