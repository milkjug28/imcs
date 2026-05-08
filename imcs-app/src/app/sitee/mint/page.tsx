'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useChainId } from 'wagmi'
import {
  SAVANT_TOKEN_ADDRESS,
  SEADROP_ADDRESS,
  FEE_RECIPIENT,
  MINT_CHAIN,
  SEADROP_ABI,
  SAVANT_TOKEN_ABI,
} from '@/config/contracts'

const PREREVEAL_IMAGE = '/assets/imcs.png'

type ProofData = {
  eligible: boolean
  phase: string
  mintOpen?: boolean
  startTime?: number
  eligiblePhases?: string[]
  proof?: string[]
  mintParams?: {
    mintPrice: string
    maxTotalMintableByWallet: string
    startTime: string
    endTime: string
    dropStageIndex: string
    maxTokenSupplyForStage: string
    feeBps: string
    restrictFeeRecipients: boolean
  }
}

const SAVANT_MESSAGES = [
  'ur imaginashun iz strong...',
  'preparing savant magic...',
  'consulting the blockchain wizards...',
  'channeling crypto energy...',
  'almost there, try not 2 blink...',
]

export default function MintPage() {
  const { address, isConnected, isReconnecting, connect } = useWallet()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const queryClient = useQueryClient()
  const [proofData, setProofData] = useState<ProofData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savantMsg, setSavantMsg] = useState('')
  const [countdown, setCountdown] = useState('')
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!proofData?.startTime || proofData.mintOpen) return
    const tick = () => {
      const now = Math.floor(Date.now() / 1000)
      const diff = proofData.startTime! - now
      if (diff <= 0) {
        setCountdown('')
        fetchProof()
        return
      }
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setCountdown(`${h}h ${m}m ${s}s`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [proofData?.startTime, proofData?.mintOpen])

  const wrongChain = chainId !== MINT_CHAIN.id

  const [totalSupplyData, setTotalSupplyData] = useState<number>(0)

  useEffect(() => {
    const fetchSupply = () => {
      fetch('/api/mint/supply')
        .then(r => r.json())
        .then(d => { if (d.totalSupply) setTotalSupplyData(d.totalSupply) })
        .catch(() => {})
    }
    fetchSupply()
    const interval = setInterval(fetchSupply, 10000)
    return () => clearInterval(interval)
  }, [])

  const { data: mintStats, queryKey: mintStatsKey } = useReadContract({
    address: SAVANT_TOKEN_ADDRESS,
    abi: SAVANT_TOKEN_ABI,
    functionName: 'getMintStats',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const minterNumMinted = mintStats ? Number(mintStats[0]) : 0
  const totalSupply = totalSupplyData
  const maxSupply = 4269

  const {
    writeContract,
    data: txHash,
    isPending: isMintPending,
    error: mintError,
    reset: resetMint,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  useEffect(() => {
    if (isConfirmed) {
      queryClient.invalidateQueries({ queryKey: mintStatsKey })
      fetch('/api/mint/supply')
        .then(r => r.json())
        .then(d => { if (d.totalSupply) setTotalSupplyData(d.totalSupply) })
        .catch(() => {})
    }
  }, [isConfirmed, queryClient, mintStatsKey])

  const fetchProof = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mint/proof?address=${address}`)
      const data = await res.json()
      setProofData(data)
    } catch {
      setError('failed 2 check allowlist')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (address) {
      fetchProof()
      resetMint()
    }
  }, [address, fetchProof, resetMint])

  useEffect(() => {
    if (isReconnecting) return
    if (!isConnected) {
      setInitialLoad(false)
      return
    }
    if (proofData !== null || error) {
      setInitialLoad(false)
    }
  }, [isReconnecting, isConnected, proofData, error])

  useEffect(() => {
    if (isMintPending || isConfirming) {
      const interval = setInterval(() => {
        setSavantMsg(SAVANT_MESSAGES[Math.floor(Math.random() * SAVANT_MESSAGES.length)])
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [isMintPending, isConfirming])

  const handleMint = () => {
    if (!proofData?.proof || !proofData.mintParams) return

    const mp = proofData.mintParams
    writeContract({
      address: SEADROP_ADDRESS,
      abi: SEADROP_ABI,
      functionName: 'mintAllowList',
      args: [
        SAVANT_TOKEN_ADDRESS,
        FEE_RECIPIENT,
        '0x0000000000000000000000000000000000000000' as `0x${string}`,
        BigInt(1),
        {
          mintPrice: BigInt(mp.mintPrice),
          maxTotalMintableByWallet: BigInt(mp.maxTotalMintableByWallet),
          startTime: BigInt(mp.startTime),
          endTime: BigInt(mp.endTime),
          dropStageIndex: BigInt(mp.dropStageIndex),
          maxTokenSupplyForStage: BigInt(mp.maxTokenSupplyForStage),
          feeBps: BigInt(mp.feeBps),
          restrictFeeRecipients: mp.restrictFeeRecipients,
        },
        proofData.proof as `0x${string}`[],
      ],
      value: BigInt(mp.mintPrice),
      chain: MINT_CHAIN,
    })
  }

  const alreadyMinted = minterNumMinted > 0
  const mintInProgress = isMintPending || isConfirming

  const getMintErrorMessage = (err: Error | null): string => {
    if (!err) return ''
    const msg = err.message || ''
    if (msg.includes('MintQuantityExceedsMaxMintedPerWallet')) return 'u already minted ur savant, greedy'
    if (msg.includes('NotActive')) return 'mint phase not active yet, patience young savant'
    if (msg.includes('InvalidProof')) return 'ur proof is bad. u not on da list, nerd'
    if (msg.includes('User rejected') || msg.includes('user rejected')) return 'u rejected it... y?'
    return 'sumthing went wrong. try agen'
  }

  if (initialLoad) {
    return (
      <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)',
          border: '4px solid #000',
          borderRadius: '15px',
          padding: '30px',
          boxShadow: '8px 8px 0 #000',
          transform: 'rotate(-1deg)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: "'Comic Neue', cursive",
            fontSize: '2.5em',
            color: '#000',
            textShadow: '3px 3px 0 #fff',
            marginBottom: '20px',
          }}>
            MINT UR SAVANT
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px',
            padding: '30px 0',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #000',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '1.2em',
              color: '#000',
            }}>
              loading savant magic...
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <>
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <div style={{
        background: 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)',
        border: '4px solid #000',
        borderRadius: '15px',
        padding: '30px',
        boxShadow: '8px 8px 0 #000',
        transform: 'rotate(-1deg)',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: "'Comic Neue', cursive",
          fontSize: '2.5em',
          color: '#000',
          textShadow: '3px 3px 0 #fff',
          marginBottom: '10px',
        }}>
          MINT UR SAVANT
        </h2>

        <div style={{
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '10px',
          padding: '15px',
          margin: '15px 0',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '0.9em',
        }}>
          <div>{totalSupply} / {maxSupply} minted</div>
          <div style={{
            background: '#333',
            borderRadius: '5px',
            height: '12px',
            marginTop: '8px',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #0f0, #0ff)',
              height: '100%',
              width: `${(totalSupply / maxSupply) * 100}%`,
              transition: 'width 0.5s',
            }} />
          </div>
        </div>

        {!isConnected ? (
          <button onClick={connect} style={{
            background: '#ff00ff',
            color: '#fff',
            border: '3px solid #000',
            borderRadius: '10px',
            padding: '15px 40px',
            fontSize: '1.3em',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '4px 4px 0 #000',
          }}>
            connekt wallet
          </button>
        ) : wrongChain ? (
          <button onClick={() => switchChain({ chainId: MINT_CHAIN.id })} style={{
            background: '#ff4444',
            color: '#fff',
            border: '3px solid #000',
            borderRadius: '10px',
            padding: '15px 40px',
            fontSize: '1.3em',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '4px 4px 0 #000',
          }}>
            switch 2 {MINT_CHAIN.name}
          </button>
        ) : proofData && !proofData.mintOpen ? (
          <div style={{
            color: '#000',
            fontFamily: "'Comic Neue', cursive",
            fontSize: '1.2em',
            padding: '20px',
          }}>
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>⏳</div>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              {proofData.phase} opens soon
            </div>
            {countdown && (
              <div style={{
                background: 'rgba(0,0,0,0.7)',
                color: '#0ff',
                fontFamily: 'monospace',
                fontSize: '1.5em',
                padding: '12px 20px',
                borderRadius: '8px',
                display: 'inline-block',
              }}>
                {countdown}
              </div>
            )}
            <div style={{ fontSize: '0.8em', marginTop: '12px', color: '#333' }}>
              patience young savant...
            </div>
          </div>
        ) : loading ? (
          <div style={{
            color: '#000',
            fontFamily: "'Comic Neue', cursive",
            fontSize: '1.2em',
            padding: '20px',
          }}>
            checkin if u r savant material...
          </div>
        ) : isConfirmed ? (
          <div>
            <div style={{
              border: '4px solid #000',
              borderRadius: '12px',
              overflow: 'hidden',
              margin: '15px auto',
              maxWidth: '280px',
              boxShadow: '6px 6px 0 #000',
              animation: 'mintReveal 0.6s ease-out',
            }}>
              <img
                src={PREREVEAL_IMAGE}
                alt="ur savant"
                style={{ width: '100%', display: 'block' }}
              />
              <div style={{
                background: '#000',
                color: '#0f0',
                fontFamily: 'monospace',
                padding: '8px',
                fontSize: '0.8em',
                textAlign: 'center',
              }}>
                savaant #{totalSupply} | IQ: ???
              </div>
            </div>
            <div style={{
              color: '#000',
              fontFamily: "'Comic Neue', cursive",
              fontSize: '1.5em',
              fontWeight: 'bold',
              marginTop: '10px',
            }}>
              CONGRAAAATS U AR SAVANT!!!
            </div>
            <div style={{
              color: '#333',
              fontFamily: 'monospace',
              fontSize: '0.7em',
              marginTop: '8px',
              wordBreak: 'break-all',
            }}>
              tx: {txHash}
            </div>
          </div>
        ) : alreadyMinted ? (
          <div style={{
            color: '#000',
            fontFamily: "'Comic Neue', cursive",
            fontSize: '1.3em',
            padding: '20px',
          }}>
            u already minted {minterNumMinted} savant{minterNumMinted > 1 ? 's' : ''}, greedy
          </div>
        ) : proofData?.eligible ? (
          <div>
            <div style={{
              border: '3px solid #000',
              borderRadius: '12px',
              overflow: 'hidden',
              margin: '15px auto',
              maxWidth: '220px',
              boxShadow: '4px 4px 0 #000',
              opacity: 0.8,
            }}>
              <img
                src={PREREVEAL_IMAGE}
                alt="pre-reveal savant"
                style={{ width: '100%', display: 'block', filter: 'blur(2px)' }}
              />
            </div>

            <div style={{
              background: 'rgba(0,255,0,0.2)',
              border: '2px solid #0f0',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '15px',
              color: '#000',
              fontFamily: "'Comic Neue', cursive",
            }}>
              ✅ u r on da {proofData.phase} list!!
            </div>

            <button
              onClick={handleMint}
              disabled={mintInProgress}
              style={{
                background: mintInProgress ? '#888' : '#00ff00',
                color: '#000',
                border: '3px solid #000',
                borderRadius: '10px',
                padding: '15px 40px',
                fontSize: '1.5em',
                fontFamily: "'Comic Neue', cursive",
                fontWeight: 'bold',
                cursor: mintInProgress ? 'wait' : 'pointer',
                boxShadow: mintInProgress ? 'none' : '4px 4px 0 #000',
                transform: mintInProgress ? 'none' : 'rotate(1deg)',
                transition: 'all 0.2s',
              }}
            >
              {mintInProgress ? savantMsg || 'minting...' : 'MINT (FREE)'}
            </button>

            {mintError && (
              <div style={{
                background: 'rgba(255,0,0,0.2)',
                border: '2px solid #f00',
                borderRadius: '8px',
                padding: '10px',
                marginTop: '15px',
                color: '#000',
                fontFamily: "'Comic Neue', cursive",
              }}>
                {getMintErrorMessage(mintError)}
              </div>
            )}
          </div>
        ) : proofData && !proofData.eligible ? (
          <div style={{
            color: '#000',
            fontFamily: "'Comic Neue', cursive",
            fontSize: '1.2em',
            padding: '20px',
          }}>
            <div style={{ fontSize: '2em', marginBottom: '10px' }}>🚫</div>
            u not on da {proofData.phase.replace('GTD (Guaranteed)', 'gtd').replace('Community', 'kummuntity').replace('FCFS', 'fcfs')} list, dork
            <div style={{
              fontSize: '0.8em',
              marginTop: '10px',
              color: '#333',
            }}>
              check opensea 4 public mint
            </div>
          </div>
        ) : error ? (
          <div style={{
            color: '#f00',
            fontFamily: "'Comic Neue', cursive",
            fontSize: '1.2em',
            padding: '20px',
          }}>
            {error}
          </div>
        ) : null}

        {proofData?.eligiblePhases && proofData.eligiblePhases.length > 0 && (
          <div style={{
            marginTop: '15px',
            color: '#000',
            fontFamily: "'Comic Neue', cursive",
            fontSize: '0.9em',
          }}>
            elijuhbull: {proofData.eligiblePhases.map(p =>
              p.replace('GTD (Guaranteed)', 'gtd').replace('Community', 'komuntitty').replace('FCFS', 'fcfs')
            ).join(', ')}
          </div>
        )}

        <div style={{
          marginTop: '10px',
          color: '#333',
          fontFamily: 'monospace',
          fontSize: '0.75em',
        }}>
          {address && `wallet: ${address.slice(0, 6)}...${address.slice(-4)}`}
          {minterNumMinted > 0 && ` | minted: ${minterNumMinted}`}
        </div>
      </div>
    </div>

    {/* FAQ */}
    <div style={{
      maxWidth: '600px',
      margin: '40px auto 60px',
      padding: '0 20px',
    }}>
      <h2 style={{
        textAlign: 'center',
        fontSize: '2em',
        marginBottom: '30px',
        color: '#000',
        textShadow: '2px 2px 0px #ff69b4',
      }}>
        frequentlee askd kwestshuns
      </h2>

      {[
        {
          q: 'wutt iz savaantt??',
          a: 'imaginate it, dork. wee r majik. if u hav 2 ask u prolly dont dezurv 2 noe.',
        },
        {
          q: 'shud i mint savaantt?',
          a: 'yesssss. mor savaants da bettah. ur wallet iz lonely and sad widout one.',
        },
        {
          q: 'wut iz iq?',
          a: 'brayne powah ideeott. eech savant haz iq. hiyur iq = mor brayne = mor powah. u prolly hav loe iq tho.',
        },
        {
          q: 'wenn reveehull?',
          a: 'aftur minttt lyke all kollekshuns lewzer. u want instunt gratuhfikashun? go buy a sandwitch.',
        },
        {
          q: 'iz dis a rug?',
          a: 'da only rug iz da one undur ur feet wen u slip on ur own stoopidity. we r legit savants hear.',
        },
        {
          q: 'how menny can i mintt?',
          a: 'dependz on how speshul u r. chek ur elijuhbillitee abuv. if u cant mint, skill issu.',
        },
        {
          q: 'y iz da art not showing?',
          a: 'reed da previus anser about reveehull u impatient nerd. art cumz wen art iz reddy.',
        },
        {
          q: 'wen moon?',
          a: 'wen u stop askin wen moon. da moon cumz 2 those hoo r payshunt and also hoo mint.',
        },
      ].map((faq, i) => (
        <div key={i} style={{
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(255,105,180,0.15), rgba(255,102,0,0.15))',
          border: '2px solid #000',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '3px 3px 0px #000',
          transform: `rotate(${(i % 2 === 0 ? -0.5 : 0.7)}deg)`,
        }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '1.1em',
            marginBottom: '8px',
            color: '#ff69b4',
          }}>
            Q: {faq.q}
          </div>
          <div style={{
            fontSize: '1em',
            color: '#000',
            lineHeight: '1.5',
          }}>
            A: {faq.a}
          </div>
        </div>
      ))}
    </div>
  </>
  )
}
