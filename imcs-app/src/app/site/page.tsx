'use client'

export default function HomePage() {
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

  return (
    <div className="page active" id="home">
      {emojis.map((item, i) => (
        <div
          key={i}
          className="floating-emoji"
          style={{
            top: item.top,
            bottom: item.bottom,
            left: item.left,
            right: item.right,
            animationDelay: item.delay
          }}
        >
          {item.emoji}
        </div>
      ))}
    </div>
  )
}
