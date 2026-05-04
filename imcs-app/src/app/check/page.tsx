'use client'

import { useState } from 'react'

type CheckResult = {
  wallet: string
  found: boolean
  phases: {
    gtd: boolean
    community: boolean
    fcfs: boolean
  }
  totalMints: number
  source: 'collab' | 'leaderboard' | 'snapshot' | null
  total_points: number
}

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const SOURCE_LABELS: Record<string, string> = {
  collab: 'collab fren',
  leaderboard: 'real savant',
  snapshot: 'snapshot holder',
}

export default function CheckPage() {
  const [wallet, setWallet] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = async () => {
    const trimmed = wallet.trim()

    if (!ETH_ADDRESS_RE.test(trimmed)) {
      setError('dats not a wallet address u dummy')
      setResult(null)
      return
    }

    setError(null)
    setResult(null)
    setLoading(true)

    try {
      const res = await fetch(`/api/check?wallet=${encodeURIComponent(trimmed)}`, {
        cache: 'no-store',
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'sumthin went wrong')
      } else {
        setResult(data)
      }
    } catch {
      setError('cant reach da server, try agen')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCheck()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #ff69b4 0%, #ffff00 40%, #00ffff 80%, #ff00ff 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        fontFamily: 'Comic Neue, cursive',
      }}
    >
      {/* Main card */}
      <div
        style={{
          background: '#fff',
          border: '4px solid #000',
          boxShadow: '8px 8px 0 #000',
          padding: 'clamp(24px, 5vw, 48px)',
          maxWidth: '600px',
          width: '100%',
          transform: 'rotate(-1deg)',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: 'clamp(32px, 8vw, 56px)',
            fontWeight: 700,
            color: '#000',
            textShadow: '3px 3px 0 #ff00ff',
            marginBottom: '8px',
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          r u a savant???
        </h1>
        <p
          style={{
            fontSize: 'clamp(14px, 3.5vw, 18px)',
            textAlign: 'center',
            marginBottom: '32px',
            color: '#333',
            fontWeight: 700,
          }}
        >
          paste ur wallet 2 find out, dork
        </p>

        {/* Input row */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0x..."
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontSize: 'clamp(14px, 3vw, 18px)',
              padding: '14px 16px',
              border: '4px solid #000',
              boxShadow: '4px 4px 0 #000',
              background: '#ffffcc',
              outline: 'none',
              width: '100%',
              transform: 'rotate(0.5deg)',
            }}
          />
          <button
            onClick={handleCheck}
            disabled={loading}
            style={{
              fontFamily: 'Comic Neue, cursive',
              fontWeight: 700,
              fontSize: 'clamp(18px, 4vw, 24px)',
              padding: '14px 24px',
              background: loading
                ? '#ccc'
                : 'linear-gradient(135deg, #ff00ff, #ffff00)',
              border: '4px solid #000',
              boxShadow: loading ? '2px 2px 0 #000' : '5px 5px 0 #000',
              cursor: loading ? 'not-allowed' : 'pointer',
              transform: loading ? 'none' : 'rotate(-0.5deg)',
              transition: 'box-shadow 0.1s, transform 0.1s',
              letterSpacing: '0.03em',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                const el = e.currentTarget
                el.style.transform = 'rotate(-0.5deg) translateY(-2px)'
                el.style.boxShadow = '7px 7px 0 #000'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                const el = e.currentTarget
                el.style.transform = 'rotate(-0.5deg)'
                el.style.boxShadow = '5px 5px 0 #000'
              }
            }}
          >
            {loading ? 'hmmmm lemme check...' : 'check'}
          </button>
        </div>

        {/* Loading pulse */}
        {loading && (
          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              fontSize: '28px',
              animation: 'pulse 0.8s ease-in-out infinite alternate',
            }}
          >
            <style>{`
              @keyframes pulse {
                from { opacity: 0.3; transform: scale(0.95); }
                to   { opacity: 1;   transform: scale(1.05); }
              }
              @keyframes shimmer {
                0%   { background-position: -200% center; }
                100% { background-position:  200% center; }
              }
            `}</style>
            🔍✨🔍
          </div>
        )}

        {/* Validation error */}
        {error && (
          <div
            style={{
              marginTop: '20px',
              background: '#ff4444',
              border: '3px solid #000',
              boxShadow: '4px 4px 0 #000',
              padding: '16px',
              fontSize: 'clamp(16px, 3.5vw, 20px)',
              fontWeight: 700,
              color: '#fff',
              textShadow: '1px 1px 0 #000',
              transform: 'rotate(0.5deg)',
            }}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <ResultCard result={result} />
        )}
      </div>
    </div>
  )
}

function ResultCard({ result }: { result: CheckResult }) {
  if (!result.found) {
    return (
      <div
        style={{
          marginTop: '24px',
          background: 'linear-gradient(135deg, #ff6b6b, #ff4444)',
          border: '4px solid #000',
          boxShadow: '6px 6px 0 #000',
          padding: '24px',
          textAlign: 'center',
          transform: 'rotate(1deg)',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>💀</div>
        <p
          style={{
            fontSize: 'clamp(18px, 4vw, 24px)',
            fontWeight: 700,
            color: '#fff',
            textShadow: '2px 2px 0 #000',
          }}
        >
          lol ur not a savant. go away
        </p>
        {result.total_points > 0 && (
          <p
            style={{
              marginTop: '10px',
              fontSize: '16px',
              color: '#ffe',
              fontWeight: 700,
            }}
          >
            but u hav {result.total_points} savant points tho
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: '24px',
        background: 'linear-gradient(135deg, #00ff88, #00ffcc)',
        border: '4px solid #000',
        boxShadow: '6px 6px 0 #000',
        padding: '24px',
        transform: 'rotate(-0.5deg)',
      }}
    >
      {/* Source badge */}
      {result.source && (
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span
            style={{
              display: 'inline-block',
              background: '#000',
              color: '#ffff00',
              fontWeight: 700,
              fontSize: 'clamp(12px, 2.5vw, 15px)',
              padding: '4px 14px',
              border: '2px solid #ffff00',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {SOURCE_LABELS[result.source] ?? result.source}
          </span>
        </div>
      )}

      {/* Total mints */}
      <p
        style={{
          fontSize: 'clamp(26px, 6vw, 40px)',
          fontWeight: 700,
          textAlign: 'center',
          color: '#000',
          textShadow: '2px 2px 0 #fff',
          marginBottom: '20px',
          lineHeight: 1.2,
        }}
      >
        u can mint{' '}
        <span
          style={{
            display: 'inline-block',
            background: '#ff00ff',
            color: '#fff',
            padding: '0 10px',
            border: '3px solid #000',
          }}
        >
          {result.totalMints}
        </span>{' '}
        time{result.totalMints !== 1 ? 's' : ''}!!!
      </p>

      {/* Phase rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <PhaseRow
          label="GTD"
          active={result.phases.gtd}
          yesText="GARANTEED"
          noText="no gtd 4 u"
        />
        <PhaseRow
          label="COMMUNITY"
          active={result.phases.community}
          yesText="COMUNITY HOLDER"
          noText="not in da club"
        />
        <PhaseRow
          label="FCFS"
          active={result.phases.fcfs}
          yesText="FIRST CUM FIRST SURVED"
          noText="no fcfs either lmao"
        />
      </div>

      {/* Points */}
      {result.total_points > 0 && (
        <div
          style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: 'clamp(14px, 3vw, 18px)',
            fontWeight: 700,
            color: '#000',
          }}
        >
          {result.total_points} savant points
        </div>
      )}
    </div>
  )
}

function PhaseRow({
  label,
  active,
  yesText,
  noText,
}: {
  label: string
  active: boolean
  yesText: string
  noText: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: active ? '#fff' : 'rgba(0,0,0,0.08)',
        border: `3px solid ${active ? '#000' : '#555'}`,
        boxShadow: active ? '3px 3px 0 #000' : 'none',
        padding: '10px 14px',
        gap: '10px',
      }}
    >
      <span
        style={{
          fontWeight: 700,
          fontSize: 'clamp(12px, 2.5vw, 15px)',
          letterSpacing: '0.05em',
          color: active ? '#000' : '#555',
          minWidth: '80px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: 700,
          fontSize: 'clamp(13px, 3vw, 17px)',
          color: active ? '#000' : '#777',
          textAlign: 'right',
        }}
      >
        {active ? `${yesText} ` : `${noText} `}
        {active ? '✅' : '❌'}
      </span>
    </div>
  )
}
