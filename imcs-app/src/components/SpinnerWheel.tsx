'use client'

import { motion } from 'framer-motion'
import { useMemo } from 'react'

interface SpinnerWheelProps {
  items: string[]
  spinning: boolean
  rotation: number
}

const COLORS = [
  '#FF595E',
  '#FF924C',
  '#FFCA3A',
  '#C5CA30',
  '#8AC926',
  '#36949D',
  '#1982C4',
  '#6A4C93',
]

export default function SpinnerWheel({ items, spinning, rotation }: SpinnerWheelProps) {
  const segments = useMemo(() => {
    const angle = 360 / items.length
    return items.map((item, i) => {
      const startAngle = i * angle
      const endAngle = (i + 1) * angle

      const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180)
      const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180)
      const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180)
      const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180)

      const largeArcFlag = angle > 180 ? 1 : 0

      const pathData = [
        `M 50 50`,
        `L ${x1} ${y1}`,
        `A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ')

      return {
        item,
        pathData,
        color: COLORS[i % COLORS.length],
        labelAngle: startAngle + angle / 2,
      }
    })
  }, [items])

  if (items.length === 0) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        textAlign: 'center',
        fontFamily: 'inherit',
        fontWeight: 900,
        fontSize: '20px',
        textTransform: 'uppercase',
        border: '4px dashed #000',
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '15px 15px 0px 0px rgba(0,0,0,0.1)',
      }}>
        add naymes 2 start!
      </div>
    )
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '1',
      margin: '0 auto',
      background: '#fff',
      borderRadius: '50%',
      border: '10px solid #000',
      boxShadow: '15px 15px 0px 0px rgba(0,0,0,0.1)',
    }}>
      {/* Pointer */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%) translateY(-4px)',
        zIndex: 20,
        width: '48px',
        height: '64px',
        background: '#000',
        clipPath: 'polygon(100% 0, 0 0, 50% 100%)',
      }} />

      {/* Wheel */}
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          transformOrigin: 'center center',
        }}
        animate={{ rotate: rotation }}
        transition={{
          duration: spinning ? 4 : 0.5,
          ease: [0.15, 0, 0.15, 1],
        }}
      >
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          {segments.map((seg, i) => (
            <g key={`${seg.item}-${i}`}>
              <path d={seg.pathData} fill={seg.color} stroke="black" strokeWidth="1" />
              <text
                x="50"
                y="50"
                transform={`rotate(${seg.labelAngle} 50 50) translate(28 0)`}
                fill="white"
                stroke="#000"
                strokeWidth={items.length > 20 ? '0.3' : '0.5'}
                paintOrder="stroke"
                fontSize={items.length > 20 ? '3' : items.length > 10 ? '4' : '5'}
                fontWeight="900"
                textAnchor="middle"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  dominantBaseline: 'central',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {seg.item.length > 12 ? seg.item.slice(0, 10) + '..' : seg.item}
              </text>
            </g>
          ))}
          <circle cx="50" cy="50" r="50" fill="transparent" stroke="rgba(0,0,0,0.1)" strokeWidth="4" />
          <circle cx="50" cy="50" r="8" fill="white" stroke="black" strokeWidth="2" />
          <circle cx="50" cy="50" r="2" fill="black" />
        </svg>
      </motion.div>
    </div>
  )
}
