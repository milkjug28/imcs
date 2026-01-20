'use client'

import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { truncateAddress } from '@/lib/utils'

type Submission = {
  id: string
  wallet_address: string
  name: string
  info: string
  score: number
  rank: number
}

type VotingCardProps = {
  submission: Submission
  onVote: (voteType: 'upvote' | 'downvote') => void
  onSkip: () => void
}

export default function VotingCard({ submission, onVote, onSkip }: VotingCardProps) {
  const [hasVoted, setHasVoted] = useState(false)
  const constraintsRef = useRef(null)

  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-25, 25])
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0, 1, 1, 1, 0])
  const greenOpacity = useTransform(x, [0, 150], [0, 0.8])
  const redOpacity = useTransform(x, [-150, 0], [0.8, 0])

  const gradients = [
    'linear-gradient(135deg, #ff6b9d, #ffd700)',
    'linear-gradient(135deg, #00ff87, #60efff)',
    'linear-gradient(135deg, #ff00ff, #00bfff)',
    'linear-gradient(135deg, #ffd700, #ff6b9d)',
    'linear-gradient(135deg, #ff6347, #ffd700)',
  ]
  const [gradient] = useState(() => gradients[Math.floor(Math.random() * gradients.length)])

  const floatingEmojis = ['✨', '⭐', '💫', '🔥', '💀', '🚀', '🧠', '💸', '👀', '⚡', '🤑', '🌟', '💎', '🦧']

  const handleDragEnd = (_: any, info: { offset: { x: number }, velocity: { x: number } }) => {
    if (hasVoted) return

    const swipeThreshold = 100
    const velocityThreshold = 500

    if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      flyAway('upvote', 1)
    } else if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      flyAway('downvote', -1)
    }
  }

  const flyAway = (type: 'upvote' | 'downvote', direction: number) => {
    if (hasVoted) return
    setHasVoted(true)

    // Animate card flying off screen
    animate(x, direction * 500, {
      duration: 0.3,
      ease: 'easeOut',
      onComplete: () => {
        onVote(type)
      }
    })
  }

  const handleButtonVote = (type: 'upvote' | 'downvote') => {
    if (hasVoted) return
    flyAway(type, type === 'upvote' ? 1 : -1)
  }

  return (
    <div
      ref={constraintsRef}
      style={{
        position: 'relative',
        touchAction: 'pan-y',
        maxWidth: '550px',
        margin: '0 auto',
        padding: '0 15px'
      }}
    >
      {/* Floating background emojis */}
      {floatingEmojis.map((emoji, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            fontSize: `${20 + (i % 3) * 8}px`,
            top: `${5 + (i * 7) % 85}%`,
            left: i % 2 === 0 ? `calc(-40px - ${(i % 4) * 15}px)` : 'auto',
            right: i % 2 === 1 ? `calc(-40px - ${(i % 4) * 15}px)` : 'auto',
            zIndex: 0,
            pointerEvents: 'none',
            opacity: 0.9
          }}
          animate={{
            y: [0, -15 - (i % 3) * 10, 0],
            rotate: [0, 10 + i * 2, -10 - i * 2, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 2 + (i % 5) * 0.4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.15
          }}
        >
          {emoji}
        </motion.div>
      ))}

      {/* Main card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        drag={!hasVoted ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        onDragEnd={handleDragEnd}
        style={{
          x,
          rotate,
          opacity,
          background: gradient,
          border: '5px solid #000',
          borderRadius: '20px',
          padding: '30px',
          boxShadow: '10px 10px 0 #000',
          position: 'relative',
          cursor: hasVoted ? 'default' : 'grab',
          overflow: 'visible',
          zIndex: 1
        }}
        whileTap={{ cursor: hasVoted ? 'default' : 'grabbing' }}
      >
        {/* Green overlay (swipe right) */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#00ff00',
            opacity: greenOpacity,
            borderRadius: '15px',
            pointerEvents: 'none'
          }}
        />

        {/* Red overlay (swipe left) */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#ff0000',
            opacity: redOpacity,
            borderRadius: '15px',
            pointerEvents: 'none'
          }}
        />

        {/* Upvote emoji indicator */}
        <motion.div
          style={{
            position: 'absolute',
            top: '50%',
            right: '20px',
            transform: 'translateY(-50%)',
            fontSize: '60px',
            opacity: greenOpacity,
            pointerEvents: 'none'
          }}
        >
          👍
        </motion.div>

        {/* Downvote emoji indicator */}
        <motion.div
          style={{
            position: 'absolute',
            top: '50%',
            left: '20px',
            transform: 'translateY(-50%)',
            fontSize: '60px',
            opacity: redOpacity,
            pointerEvents: 'none'
          }}
        >
          👎
        </motion.div>

        {/* Rank badge */}
        <div style={{
          position: 'absolute',
          top: '-12px',
          right: '-12px',
          background: '#ffff00',
          padding: '4px 10px',
          borderRadius: '8px',
          border: '3px solid #000',
          boxShadow: '2px 2px 0 #000',
          transform: 'rotate(5deg)',
          textAlign: 'center',
          zIndex: 10
        }}>
          <div style={{
            fontFamily: 'Comic Neue, cursive',
            fontSize: '9px',
            color: '#333',
            lineHeight: 1
          }}>
            savant raank
          </div>
          <div style={{
            fontFamily: 'Comic Neue, cursive',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#000',
            lineHeight: 1
          }}>
            #{submission.rank}
          </div>
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Message with dark semi-transparent background for readability */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.75)',
            borderRadius: '12px',
            padding: 'clamp(12px, 4vw, 20px)',
            marginBottom: '15px',
            border: '2px solid rgba(255,255,255,0.3)'
          }}>
            <div style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: 'clamp(16px, 4.5vw, 22px)',
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1.4,
              textAlign: 'center'
            }}>
              &quot;{submission.info}&quot;
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.95)',
            padding: '10px 14px',
            borderRadius: '12px',
            border: '3px solid #000',
            boxShadow: '3px 3px 0 #000'
          }}>
            <div style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: 'clamp(16px, 4vw, 18px)',
              fontWeight: 700,
              color: '#000'
            }}>
              {submission.name}
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: 'clamp(11px, 3vw, 12px)',
              color: '#333',
              fontWeight: 600
            }}>
              {truncateAddress(submission.wallet_address)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Vote buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 'clamp(20px, 8vw, 40px)',
        marginTop: '20px'
      }}>
        <motion.button
          onClick={() => handleButtonVote('downvote')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          disabled={hasVoted}
          style={{
            width: 'clamp(55px, 15vw, 70px)',
            height: 'clamp(55px, 15vw, 70px)',
            borderRadius: '50%',
            background: '#ff4444',
            border: '4px solid #000',
            fontSize: 'clamp(28px, 8vw, 35px)',
            cursor: hasVoted ? 'default' : 'pointer',
            boxShadow: '4px 4px 0 #000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: hasVoted ? 0.5 : 1
          }}
        >
          👎
        </motion.button>

        <motion.button
          onClick={onSkip}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={hasVoted}
          style={{
            padding: '8px 16px',
            borderRadius: '25px',
            background: '#888',
            border: '3px solid #000',
            fontFamily: 'Comic Neue, cursive',
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            cursor: hasVoted ? 'default' : 'pointer',
            boxShadow: '3px 3px 0 #000',
            alignSelf: 'center',
            opacity: hasVoted ? 0.5 : 1
          }}
        >
          meh
        </motion.button>

        <motion.button
          onClick={() => handleButtonVote('upvote')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          disabled={hasVoted}
          style={{
            width: 'clamp(55px, 15vw, 70px)',
            height: 'clamp(55px, 15vw, 70px)',
            borderRadius: '50%',
            background: '#00ff00',
            border: '4px solid #000',
            fontSize: 'clamp(28px, 8vw, 35px)',
            cursor: hasVoted ? 'default' : 'pointer',
            boxShadow: '4px 4px 0 #000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: hasVoted ? 0.5 : 1
          }}
        >
          👍
        </motion.button>
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: '12px',
        fontFamily: 'Comic Neue, cursive',
        fontSize: 'clamp(12px, 3vw, 14px)',
        color: '#888'
      }}>
        swipe or tap 2 vote
      </div>
    </div>
  )
}