'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

type Tool = {
  id: string
  name: string
  description: string
  path: string
  emoji?: string
  image?: string
  color: string
  badge: string
  external?: boolean
}

const tools: Tool[] = [
  {
    id: 'spinor',
    name: 'sabant spinor',
    description: 'spin da wheel 4 raffles n giveaways. add naymes n walluts, den spin 2 get weeners.',
    path: '/spinor',
    emoji: '🎉',
    color: '#FF595E',
    badge: 'hold 1+ savant',
    external: true,
  },
  {
    id: 'pak-rippur',
    name: 'pak rippur',
    description: 'rip open mystree paks 2 get ekskloosiv trayts 4 ur savants. eech pak haz 3 random trayts!',
    path: '/sitee/rip',
    image: '/assets/card-pack.png',
    color: '#1dd1a1',
    badge: '+80 savant IQ',
  },
]

export default function ToolesPage() {
  const router = useRouter()

  return (
    <div className="page active" style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{
        fontFamily: "'Comic Neue', cursive",
        fontSize: '48px',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '8px',
        transform: 'rotate(-1deg)',
      }}>
        savant tuulz
      </h2>
      <p style={{
        fontFamily: "'Comic Neue', cursive",
        fontSize: '18px',
        textAlign: 'center',
        marginBottom: '40px',
        opacity: 0.7,
      }}>
        hold savants, get tuulz. simpel.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '24px',
      }}>
        {tools.map((tool, i) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => tool.external ? window.open(tool.path, '_blank') : router.push(tool.path)}
            style={{
              background: '#fff',
              border: '4px solid #000',
              borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
              boxShadow: '8px 8px 0 #000',
              padding: '32px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)`,
              position: 'relative',
              overflow: 'hidden',
            }}
            whileHover={{
              scale: 1.03,
              rotate: 0,
              boxShadow: '4px 4px 0 #000',
            }}
            whileTap={{ scale: 0.97 }}
          >
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: tool.color,
              borderRadius: '50%',
              opacity: 0.15,
            }} />

            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {tool.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tool.image} alt={tool.name} style={{ width: '56px', height: 'auto', filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.2))' }} />
              ) : tool.emoji}
            </div>

            <h3 style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '8px',
            }}>
              {tool.name}
            </h3>

            <p style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '16px',
              color: '#555',
              marginBottom: '16px',
              lineHeight: 1.4,
            }}>
              {tool.description}
            </p>

            <div style={{
              display: 'inline-block',
              background: tool.color,
              color: '#fff',
              fontFamily: "'Comic Neue', cursive",
              fontWeight: 'bold',
              fontSize: '13px',
              padding: '4px 12px',
              border: '2px solid #000',
              borderRadius: '4px',
              boxShadow: '2px 2px 0 #000',
            }}>
              {tool.badge}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
