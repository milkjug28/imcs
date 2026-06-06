'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/hooks/useWallet'
import { useReadContract, useSignMessage } from 'wagmi'
import { SAVANT_TOKEN_ADDRESS, SAVANT_TOKEN_ABI, MINT_CHAIN } from '@/config/contracts'
import {
  PACK_EQUIPMENT_ADDRESS, PACK_EQUIPMENT_ABI, PACK_TOKEN_ID, PACK_CHAIN,
  PACK_ADDRESS, SAVANT_PACK_ABI,
} from '@/config/pack'
import type { TraitInfo } from '@/lib/trait-data'
import { useTraitBurn } from '@/hooks/useTraitBurn'
import FlameOverlay from '@/components/FlameOverlay'
import ConnectWallet from '@/components/ConnectWallet'
import BuyPackModal from '@/components/BuyPackModal'
import { motion, AnimatePresence } from 'framer-motion'

type InvTrait = { traitId: number; balance: number; trait: TraitInfo }

function traitImageUrl(t: TraitInfo): string {
  if (t.isNew && t.newPath) {
    const parts = t.newPath.split('/')
    const layer = parts[0]
    if (parts.length === 3) {
      return `/api/traits/image?new=1&layer=${encodeURIComponent(layer)}&sub=${encodeURIComponent(parts[1])}&file=${encodeURIComponent(parts[2])}`
    }
    return `/api/traits/image?new=1&layer=${encodeURIComponent(layer)}&file=${encodeURIComponent(parts[1])}`
  }
  return `/api/traits/image?layer=${encodeURIComponent(t.layerName)}&file=${encodeURIComponent(t.filename)}`
}

type Token = {
  tokenId: string
  name: string
  image: string
  iq: number
  savantName?: string | null
  traits: { type: string; value: string }[]
}

type HolderData = {
  wallet: string
  balance: number
  tokens: Token[]
}

type ProfileData = {
  total_points: number
  rank: number | null
  name: string
}

type IQBalance = {
  total_earned: number
  total_allocated: number
  available: number
}

function buildAllocateMessage(wallet: string, allocations: { tokenId: number; points: number }[]): string {
  const lines = allocations.map(a => `  Savant #${a.tokenId}: +${a.points} IQ`)
  const total = allocations.reduce((s, a) => s + a.points, 0)
  return [
    'Allocate IQ Points to Savants',
    '',
    ...lines,
    '',
    `Total: ${total} IQ points`,
    '',
    'This action is permanent and cannot be undone.',
    '',
    `Wallet: ${wallet.toLowerCase()}`,
  ].join('\n')
}

function IQInfoPopup({ onClose }: { onClose: () => void }) {
  const [dontShow, setDontShow] = useState(false)

  const handleClose = () => {
    if (dontShow) {
      localStorage.setItem('hide-iq-info', '1')
    }
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, rotate: -2 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.8 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          border: '4px solid #000',
          boxShadow: '10px 10px 0 #000',
          borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
          maxWidth: '420px',
          width: '100%',
          padding: '24px',
          transform: 'rotate(0.5deg)',
        }}
      >
        <h3 style={{
          fontFamily: "'Comic Neue', cursive",
          fontSize: '22px',
          textAlign: 'center',
          marginBottom: '16px',
          textShadow: '2px 2px 0 #ff69b4',
        }}>
          how iq wurks
        </h3>

        <div style={{
          fontFamily: "'Comic Neue', cursive",
          fontSize: '14px',
          lineHeight: '1.6',
          marginBottom: '16px',
        }}>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#006600' }}>u mint n hold?</strong> +5 IQ poinz pur savnat
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#0044cc' }}>u bye sabant?</strong> +2 IQ poinz pur savaant
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#cc0000' }}>u paypurr haand?!</strong> -10 IQ poinz. paypurrhands r dum
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#cc4400' }}>u lihst savant 4 saal?</strong> -1 IQ pointz pur listin. wee c u
          </div>
        </div>

        <div style={{
          background: '#111',
          border: '2px solid #0f0',
          padding: '12px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#0f0',
            marginBottom: '4px',
          }}>
            CLASSIFIED SAVANT MAFS
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#0f0',
            lineHeight: '1.8',
          }}>
            IQ = (H * 5) + (B * 2) - (S * 10) - (L * 1)
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#666',
            marginTop: '8px',
            lineHeight: '1.6',
          }}>
            where H = mint hodl coefficient<br/>
            B = secondary acquisition factor<br/>
            S = paperhands liquidation index<br/>
            L = intent-to-dump signal ratio<br/>
            <br/>
            leederbord pts to iq conversion:<br/>
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ff0',
            marginTop: '4px',
          }}>
            totalIQ = leaderboardIQ + tradingIQ
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '8px',
            color: '#555',
            marginTop: '4px',
          }}>
            leederIQ = ceil(submissionScore * ln(votingKarma + 1))<br/>
            * sqrt(referralBonus) / (1 + e^(-communityFactor))<br/>
            * cos(0) + i*sin(savantVibes) - 0 + pi*0
          </div>
        </div>

        <div style={{
          fontFamily: "'Comic Neue', cursive",
          fontSize: '12px',
          textAlign: 'center',
          color: '#999',
          marginBottom: '12px',
          fontStyle: 'italic',
        }}>
          iq points can be allocated 2 ur savants. dis is permanent. no takebacks. makes them smarter 4ever.
        </div>

        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: "'Comic Neue', cursive",
          fontSize: '12px',
          marginBottom: '12px',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={dontShow}
            onChange={e => setDontShow(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          dont show me dis agen im not dum
        </label>

        <button
          onClick={handleClose}
          style={{
            fontFamily: "'Comic Neue', cursive",
            fontSize: '14px',
            padding: '8px 20px',
            background: '#ff69b4',
            color: '#fff',
            border: '2px solid #000',
            cursor: 'pointer',
            fontWeight: 'bold',
            width: '100%',
          }}
        >
          ok i get it (i dont)
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { address, isConnected, truncatedAddress } = useWallet()
  const { signMessageAsync } = useSignMessage()
  const [holderData, setHolderData] = useState<HolderData | null>(null)
  const [legacyProfile, setLegacyProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)

  const [iqBalance, setIqBalance] = useState<IQBalance | null>(null)
  const [allocations, setAllocations] = useState<Record<string, number>>({})
  const [allocating, setAllocating] = useState(false)
  const [allocateError, setAllocateError] = useState<string | null>(null)
  const [allocateSuccess, setAllocateSuccess] = useState<string | null>(null)
  const [showAllocator, setShowAllocator] = useState(false)
  const [showIQInfo, setShowIQInfo] = useState(false)

  const [namingToken, setNamingToken] = useState(false)
  const [savantNameInput, setSavantNameInput] = useState('')
  const [namingError, setNamingError] = useState<string | null>(null)
  const [namingSuccess, setNamingSuccess] = useState(false)

  const [activeTab, setActiveTab] = useState<'profil' | 'invintorri' | 'eern-iq'>('profil')
  const [invTraits, setInvTraits] = useState<InvTrait[] | null>(null)
  const [invLoading, setInvLoading] = useState(false)

  // burn-for-IQ state
  const { burnTraits } = useTraitBurn()
  const [burnMode, setBurnMode] = useState(false)
  const [burnPicks, setBurnPicks] = useState<Record<number, number>>({})
  const [burning, setBurning] = useState(false)
  const [burnError, setBurnError] = useState<string | null>(null)
  const [burnSuccess, setBurnSuccess] = useState<string | null>(null)
  const [burnStatus, setBurnStatus] = useState<{ remaining: number; cap: number; iqPerBurn: number } | null>(null)
  const [showFlames, setShowFlames] = useState(false)
  const [showEkwipPicker, setShowEkwipPicker] = useState(false)
  const [tasks, setTasks] = useState<Array<{
    id: string; name: string; description: string; iq_reward: number
    icon: string; action_label: string; action_type: string
    claimable_label?: string
    engagement?: { campaign_id: string; target_tweet_url?: string; intent_url?: string; engagement_type: string }
    requires_x?: boolean
    paused?: boolean
    status: 'not_started' | 'claimable' | 'completed'
    completed_at: string | null
    metadata: { x_username?: string; discord_username?: string; discord_user_id?: string; tweet_url?: string } | null
  }>>([])
  const [xLinkSuccess, setXLinkSuccess] = useState(false)
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)
  const [claimingTask, setClaimingTask] = useState<string | null>(null)
  const [engagementInputs, setEngagementInputs] = useState<Record<string, string>>({})
  const [verifyingTask, setVerifyingTask] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<Record<string, string>>({})
  const [verifySuccess, setVerifySuccess] = useState<Record<string, boolean>>({})

  const { data: balanceRaw } = useReadContract({
    address: SAVANT_TOKEN_ADDRESS,
    abi: SAVANT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: MINT_CHAIN.id,
    query: { enabled: !!address },
  })

  const { data: packBalanceRaw, refetch: refetchPackBalance } = useReadContract({
    address: PACK_EQUIPMENT_ADDRESS,
    abi: PACK_EQUIPMENT_ABI,
    functionName: 'balanceOf',
    args: address ? [address, PACK_TOKEN_ID] : undefined,
    chainId: PACK_CHAIN.id,
    query: { enabled: !!address },
  })
  const packBalance = packBalanceRaw !== undefined ? Number(packBalanceRaw) : undefined
  const [showBuyPaks, setShowBuyPaks] = useState(false)

  const { data: saleOpenRaw } = useReadContract({
    address: PACK_ADDRESS, abi: SAVANT_PACK_ABI, functionName: 'saleOpen',
    chainId: PACK_CHAIN.id,
  })
  const saleOpen = saleOpenRaw === undefined ? false : Boolean(saleOpenRaw)

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!address) { setLoading(false); return }

    const cacheKey = `savant_profil_${address}`
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey)
        if (cached) {
          const { data: cachedData, ts } = JSON.parse(cached)
          if (Date.now() - ts < 120_000) {
            setHolderData(cachedData.holder)
            setLegacyProfile(cachedData.legacy)
            setIqBalance(cachedData.iq)
            setTasks(cachedData.tasks || [])
            if (cachedData.discord) setDiscordUsername(cachedData.discord)
            setLoading(false)
            return
          }
        }
      } catch { /* ignore */ }
    }

    setLoading(true)

    const nc = { cache: 'no-store' as RequestCache }
    const [holderRes, profileRes, iqRes, tasksRes] = await Promise.all([
      fetch(`/api/holder?wallet=${address}`, nc).catch(() => null),
      fetch(`/api/profile/${address}`, nc).catch(() => null),
      fetch(`/api/iq/balance?wallet=${address}`, nc).catch(() => null),
      fetch(`/api/iq/tasks?wallet=${address}`, nc).catch(() => null),
    ])

    const cacheData: Record<string, unknown> = {}

    if (holderRes?.ok) {
      const data = await holderRes.json()
      setHolderData(data)
      cacheData.holder = data
    }

    if (profileRes?.ok) {
      const data = await profileRes.json()
      setLegacyProfile(data)
      cacheData.legacy = data
    }



    if (iqRes?.ok) {
      const data = await iqRes.json()
      setIqBalance(data)
      cacheData.iq = data
    }

    if (tasksRes?.ok) {
      const data = await tasksRes.json()
      setTasks(data.tasks || [])
      if (data.discord?.username) {
        setDiscordUsername(data.discord.username)
        cacheData.discord = data.discord.username
      }
      cacheData.tasks = data.tasks || []
    }

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: cacheData, ts: Date.now() }))
    } catch { /* full storage */ }

    setLoading(false)
  }, [address])

  useEffect(() => {
    if (isConnected && address && !localStorage.getItem('hide-iq-info')) {
      setShowIQInfo(true)
    }
  }, [isConnected, address])

  useEffect(() => {
    if (isConnected && address) {
      fetchData()
    } else {
      setHolderData(null)
      setLegacyProfile(null)
      setSelectedToken(null)
      setIqBalance(null)
      setAllocations({})
      setShowAllocator(false)
      setTasks([])
      setActiveTab('profil')
      setInvTraits(null)
      setDiscordUsername(null)
      setClaimingTask(null)
      setLoading(false)
    }
  }, [isConnected, address, fetchData])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'eern-iq') {
      setActiveTab('eern-iq')
    }
    if (params.get('tab') === 'invintorri') {
      setActiveTab('invintorri')
    }
    if (params.get('x_linked') === 'true') {
      setXLinkSuccess(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'invintorri' || !address) return
    let cancelled = false
    const cacheKey = `savant_inv_${address}`

    // hydrate from cache first so the list never flashes empty on a flaky refetch
    let hasCache = false
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Array.isArray(data)) {
          setInvTraits(data)
          hasCache = true
          if (Date.now() - ts < 120_000) return // fresh enough, skip refetch
        }
      }
    } catch { /* ignore */ }

    if (!hasCache) setInvLoading(true)
    fetch(`/api/traits/inventory?wallet=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d) return // failed fetch -> keep cached/last-good, don't wipe
        const inv = (d.inventory as InvTrait[]).filter(i => i.balance > 0)
        setInvTraits(inv)
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ data: inv, ts: Date.now() })) } catch { /* full */ }
      })
      .catch(() => { /* keep cached/last-good */ })
      .finally(() => { if (!cancelled) setInvLoading(false) })
    return () => { cancelled = true }
  }, [activeTab, address])

  // weekly burn allowance for the burn-for-IQ flow
  useEffect(() => {
    if (activeTab !== 'invintorri' || !address) return
    let cancelled = false
    fetch(`/api/iq/burn/status?wallet=${address}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setBurnStatus({ remaining: d.remaining, cap: d.cap, iqPerBurn: d.iqPerBurn }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeTab, address])

  const burnPickedCount = Object.values(burnPicks).reduce((s, v) => s + (v || 0), 0)
  const burnIQPreview = burnPickedCount * (burnStatus?.iqPerBurn ?? 5)
  const burnRemaining = burnStatus?.remaining ?? 0
  const burnOverCap = burnPickedCount > burnRemaining

  function adjustBurnPick(traitId: number, delta: number, max: number) {
    setBurnPicks(prev => {
      const cur = prev[traitId] || 0
      const next = Math.max(0, Math.min(max, cur + delta))
      const copy = { ...prev }
      if (next === 0) delete copy[traitId]
      else copy[traitId] = next
      return copy
    })
  }

  function exitBurnMode() {
    setBurnMode(false)
    setBurnPicks({})
    setBurnError(null)
  }

  // ekwip needs a chosen savant. 0 -> nothing, 1 -> straight in, many -> picker.
  function startEkwip() {
    const tokens = holderData?.tokens || []
    if (tokens.length === 0) { router.push('/sitee/ekwip'); return }
    if (tokens.length === 1) { router.push(`/sitee/ekwip?tokenId=${tokens[0].tokenId}`); return }
    setShowEkwipPicker(true)
  }

  async function handleBurn() {
    if (!address || burnPickedCount === 0 || burning) return
    setBurning(true)
    setBurnError(null)
    setBurnSuccess(null)
    // tracks when the flames went up so we can keep the loading screen on for a
    // minimum beat even if everything resolves fast.
    let flamesAt = 0
    try {
      const picks = Object.entries(burnPicks).map(([traitId, amount]) => ({ traitId: Number(traitId), amount }))
      // flames raise the instant the wallet signature lands and stay up as a loading
      // screen while the tx confirms, IQ credits, and the gallery refreshes underneath.
      const result = await burnTraits(picks, () => { setShowFlames(true); flamesAt = Date.now() })
      setBurnPicks({})
      setBurnMode(false)

      // refresh inventory, weekly allowance, and IQ balance WHILE the flames cover the page,
      // so the burned trait is gone from the gallery before the overlay fades.
      try { sessionStorage.removeItem(`savant_inv_${address}`) } catch { /* ignore */ }
      const [invRes, statusRes, balRes] = await Promise.all([
        fetch(`/api/traits/inventory?wallet=${address}`).catch(() => null),
        fetch(`/api/iq/burn/status?wallet=${address}`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/iq/balance?wallet=${address}`, { cache: 'no-store' }).catch(() => null),
      ])
      if (invRes?.ok) {
        const d = await invRes.json()
        const inv = (d.inventory as InvTrait[]).filter(i => i.balance > 0)
        setInvTraits(inv)
        try { sessionStorage.setItem(`savant_inv_${address}`, JSON.stringify({ data: inv, ts: Date.now() })) } catch { /* full */ }
      }
      if (statusRes?.ok) {
        const d = await statusRes.json()
        setBurnStatus({ remaining: d.remaining, cap: d.cap, iqPerBurn: d.iqPerBurn })
      }
      if (balRes?.ok) setIqBalance(await balRes.json())

      if (result.alreadyClaimed) {
        setBurnError('dis burn waz alredy claimd')
      } else {
        const capNote = result.capped ? ' (weekly cap hit, sum traits burnd but not credited)' : ''
        setBurnSuccess(`burnd ${result.traitsBurned} trayt${result.traitsBurned === 1 ? '' : 's'} 4 +${result.credited} IQ!${capNote}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'burn faild'
      // user-rejected wallet prompts shouldn't read like a system error
      setBurnError(/reject|denied|cancel/i.test(msg) ? 'u canceld da burn' : msg)
    } finally {
      setBurning(false)
      // hold the inferno for a minimum beat, then fade. gallery is already updated.
      if (flamesAt) {
        const elapsed = Date.now() - flamesAt
        const minHold = 1800
        if (elapsed < minHold) await new Promise(r => setTimeout(r, minHold - elapsed))
      }
      setShowFlames(false)
    }
  }

  // IQ changes from packs/tasks elsewhere; the profil cache is 120s stale, so
  // pull a fresh balance whenever the eern-iq tab opens (before allocating).
  useEffect(() => {
    if (activeTab !== 'eern-iq' || !address) return
    let cancelled = false
    fetch(`/api/iq/balance?wallet=${address}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setIqBalance(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeTab, address])

  const totalAllocating = Object.values(allocations).reduce((s, v) => s + (v || 0), 0)
  const canAllocate = totalAllocating > 0 && totalAllocating <= (iqBalance?.available || 0)

  const handleAllocate = async () => {
    if (!address || !canAllocate) return
    setAllocating(true)
    setAllocateError(null)
    setAllocateSuccess(null)

    const allocs = Object.entries(allocations)
      .filter(([, pts]) => pts > 0)
      .map(([tokenId, points]) => ({ tokenId: parseInt(tokenId), points }))

    if (!allocs.length) return

    const message = buildAllocateMessage(address, allocs)

    try {
      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/iq/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, allocations: allocs, signature, message }),
      })

      const data = await res.json()
      if (data.ok) {
        setAllocateSuccess(`allocated ${totalAllocating} IQ points!`)
        setAllocations({})
        setShowAllocator(false)
        fetchData(true)
      } else {
        setAllocateError(data.error || 'allocation failed')
      }
    } catch (err) {
      setAllocateError(err instanceof Error ? err.message : 'signature rejected')
    }
    setAllocating(false)
  }

  const handleNameSavant = async () => {
    if (!address || !selectedToken || !savantNameInput.trim()) return
    setNamingToken(true)
    setNamingError(null)
    setNamingSuccess(false)

    const tokenId = parseInt(selectedToken.tokenId)
    const trimmed = savantNameInput.trim()
    const message = [
      'Name Your Savant',
      '',
      `Savant #${tokenId}: "${trimmed}"`,
      '',
      `Wallet: ${address.toLowerCase()}`,
    ].join('\n')

    try {
      const signature = await signMessageAsync({ message })

      const res = await fetch('/api/savant/name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, tokenId, name: trimmed, signature, message }),
      })

      const data = await res.json()
      if (data.ok) {
        setSelectedToken({ ...selectedToken, savantName: trimmed })
        setSavantNameInput('')
        setNamingSuccess(true)
        if (holderData) {
          const updated = holderData.tokens.map(t =>
            t.tokenId === selectedToken.tokenId ? { ...t, savantName: trimmed } : t
          )
          setHolderData({ ...holderData, tokens: updated })
        }
      } else {
        setNamingError(data.error || 'failed to set name')
      }
    } catch (err) {
      setNamingError(err instanceof Error ? err.message : 'signature rejected')
    }
    setNamingToken(false)
  }

  const handleVerifyEngagement = async (taskId: string, campaignId: string, isRepost?: boolean) => {
    if (!address || verifyingTask) return
    const tweetUrl = isRepost ? undefined : engagementInputs[taskId]?.trim()
    if (!isRepost && !tweetUrl) return

    setVerifyingTask(taskId)
    setVerifyError(prev => ({ ...prev, [taskId]: '' }))
    setVerifySuccess(prev => ({ ...prev, [taskId]: false }))

    try {
      const res = await fetch('/api/iq/engagement/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address, campaign_id: campaignId, tweet_url: tweetUrl }),
      })
      const data = await res.json()
      if (data.ok) {
        setVerifySuccess(prev => ({ ...prev, [taskId]: true }))
        setEngagementInputs(prev => ({ ...prev, [taskId]: '' }))
        fetchData(true)
      } else {
        setVerifyError(prev => ({ ...prev, [taskId]: data.error || 'verification failed' }))
      }
    } catch {
      setVerifyError(prev => ({ ...prev, [taskId]: 'verification failed' }))
    }
    setVerifyingTask(null)
  }

  const balance = balanceRaw !== undefined ? Number(balanceRaw) : (holderData?.balance ?? null)
  const isHolder = balance !== null && balance > 0
  const totalIQ = holderData?.tokens.reduce((sum, t) => sum + t.iq, 0) || 0

  if (!isConnected) {
    return (
      <div className="page active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
          border: '4px solid #000',
          borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
          boxShadow: '8px 8px 0 #000',
          padding: '40px 30px',
          textAlign: 'center',
          maxWidth: '400px',
          transform: 'rotate(-1deg)',
        }}>
          <h2 style={{ fontFamily: "'Comic Neue', cursive", fontSize: '28px', color: '#000', textShadow: '2px 2px 0 #fff', marginBottom: '16px' }}>
            my savant profil
          </h2>
          <p style={{ fontFamily: "'Comic Neue', cursive", fontSize: '18px', marginBottom: '24px', color: '#000' }}>
            connect ur wallut 2 c ur stats
          </p>
          <ConnectWallet label="connekt wallut" />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Comic Neue', cursive" }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {['#ff69b4', '#00bfff', '#ffd700'].map((color, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, border: '2px solid #000' }}
              />
            ))}
          </div>
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>loading ur profil...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="page active">
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 16px' }}>

        {/* Identity Card */}
        <div style={{
          background: 'linear-gradient(135deg, #ff6b9d, #ffd700)',
          border: '3px solid #000',
          borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
          boxShadow: '8px 8px 0 #000',
          padding: '24px',
          marginBottom: '20px',
          position: 'relative',
        }}>
          {/* Grab paks */}
          <button
            onClick={saleOpen ? () => setShowBuyPaks(true) : undefined}
            disabled={!saleOpen}
            style={{
              position: 'absolute', top: '12px', right: '12px', cursor: saleOpen ? 'pointer' : 'not-allowed',
              background: saleOpen ? '#6ee7b7' : '#cbd5e1', border: '2px solid #000', borderRadius: '8px',
              padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '3px 3px 0 #000', transition: 'transform 0.1s', opacity: saleOpen ? 1 : 0.6,
              fontFamily: "'Comic Neue', cursive", fontSize: '11px', fontWeight: 800, color: '#000',
            }}
            onMouseEnter={e => { if (saleOpen) e.currentTarget.style.transform = 'scale(1.05) rotate(-2deg)' }}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          >
            <span style={{ fontSize: '14px' }}>🛒</span>
            {saleOpen ? 'grub paks' : 'sale klosd'}
          </button>
          {/* Username / Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <h2 style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '28px',
              color: '#000',
              textShadow: '2px 2px 0 #fff',
              margin: 0,
            }}>
              {legacyProfile?.name || truncatedAddress}
            </h2>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontFamily: 'monospace', fontSize: '12px', color: 'rgba(0,0,0,0.6)', margin: 0 }}>
              {truncatedAddress}
            </p>
            {discordUsername && (
              <p style={{ fontFamily: "'Comic Neue', cursive", fontSize: '13px', color: 'rgba(0,0,0,0.7)', margin: '4px 0 0 0' }}>
                💬 {discordUsername}
              </p>
            )}
          </div>

          {/* Stats Row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <StatBox label="savants held" value={balance ?? 0} />
            <StatBox label="total iq" value={totalIQ} />
            {iqBalance && iqBalance.available > 0 && (
              <StatBox label="iq 2 allocate" value={iqBalance.available} highlight />
            )}
            <StatBox label="legacy pts" value={legacyProfile?.total_points || 0} />
            {legacyProfile?.rank && <StatBox label="legacy rank" value={`#${legacyProfile.rank}`} />}
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{
          display: 'flex',
          gap: '0',
          marginBottom: '20px',
          border: '3px solid #000',
          boxShadow: '4px 4px 0 #000',
          overflow: 'hidden',
        }}>
          {(['profil', 'invintorri', 'eern-iq'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                fontFamily: "'Comic Neue', cursive",
                fontSize: '15px',
                fontWeight: 'bold',
                padding: '12px 8px',
                background: activeTab === tab
                  ? (tab === 'eern-iq' ? 'linear-gradient(135deg, #ff6b9d, #ffd700)'
                    : tab === 'invintorri' ? 'linear-gradient(135deg, #00ff87, #60efff)' : '#000')
                  : '#fff',
                color: activeTab === tab ? (tab === 'profil' ? '#0f0' : '#000') : '#333',
                border: 'none',
                borderRight: tab !== 'eern-iq' ? '2px solid #000' : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {tab === 'profil' ? 'profil' : tab === 'invintorri' ? 'invintorri' : 'eern iq'}
              {tab === 'invintorri' && (packBalance ?? 0) > 0 && (
                <span style={{
                  position: 'absolute', top: '3px', right: '3px',
                  minWidth: '20px', height: '20px', padding: '0 5px',
                  background: '#ef4444', color: '#fff',
                  border: '2px solid #000', borderRadius: '9999px',
                  fontFamily: 'monospace', fontSize: '11px', fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '1px 1px 0 #000', lineHeight: 1,
                }}>
                  {packBalance}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'profil' ? (<>

        {/* IQ Allocation Banner */}
        {iqBalance && iqBalance.available > 0 && isHolder && !showAllocator && (
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            style={{
              background: 'linear-gradient(135deg, #00ff87, #60efff)',
              border: '3px solid #000',
              boxShadow: '6px 6px 0 #000',
              padding: '16px 20px',
              marginBottom: '20px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
            onClick={() => setShowAllocator(true)}
          >
            <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
              u hav {iqBalance.available} IQ poinz 2 allowkate!
            </div>
            <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '14px', color: '#333', marginTop: '4px' }}>
              tap heer 2 mayk ur sabants smartur (permanant, no take-sees back-sees)
            </div>
          </motion.div>
        )}

        {/* Allocation Success/Error */}
        {allocateSuccess && (
          <div style={{
            background: '#00ff87',
            border: '2px solid #000',
            padding: '12px',
            marginBottom: '16px',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
            {allocateSuccess}
          </div>
        )}
        {allocateError && (
          <div style={{
            background: '#ff4444',
            color: '#fff',
            border: '2px solid #000',
            padding: '12px',
            marginBottom: '16px',
            fontFamily: "'Comic Neue', cursive",
            fontWeight: 'bold',
            textAlign: 'center',
          }}>
            {allocateError}
          </div>
        )}

        {/* IQ Allocator Panel */}
        <AnimatePresence>
          {showAllocator && iqBalance && holderData && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{
                background: '#111',
                border: '3px solid #0f0',
                boxShadow: '0 0 20px rgba(0,255,0,0.3)',
                marginBottom: '20px',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '20px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}>
                  <h3 style={{
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    color: '#0f0',
                    margin: 0,
                  }}>
                    IQ ALLOCATION TERMINAL
                  </h3>
                  <button
                    onClick={() => { setShowAllocator(false); setAllocations({}) }}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      background: 'transparent',
                      color: '#666',
                      border: '1px solid #333',
                      padding: '2px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    [X]
                  </button>
                </div>

                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: '#0f0',
                  marginBottom: '16px',
                  padding: '8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                }}>
                  Available: {iqBalance.available - totalAllocating} / {iqBalance.available} IQ pts
                  {totalAllocating > 0 && <span style={{ color: '#ff0' }}> (allocating {totalAllocating})</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {holderData.tokens.map(token => (
                    <div
                      key={token.tokenId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px',
                        background: '#1a1a1a',
                        border: '1px solid #333',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={token.image}
                        alt={token.name}
                        style={{ width: '48px', height: '48px', objectFit: 'cover', border: '1px solid #333' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#fff' }}>
                          {token.name}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#888' }}>
                          Current IQ: {token.iq}
                          {(allocations[token.tokenId] || 0) > 0 && (
                            <span style={{ color: '#0f0' }}>
                              {' '}→ {token.iq + (allocations[token.tokenId] || 0)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => {
                            const current = allocations[token.tokenId] || 0
                            if (current > 0) setAllocations(p => ({ ...p, [token.tokenId]: current - 1 }))
                          }}
                          style={{
                            fontFamily: 'monospace',
                            width: '28px',
                            height: '28px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: '1',
                          }}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={iqBalance.available - totalAllocating + (allocations[token.tokenId] || 0)}
                          value={allocations[token.tokenId] || 0}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0)
                            const otherAllocations = totalAllocating - (allocations[token.tokenId] || 0)
                            const clamped = Math.min(val, iqBalance.available - otherAllocations)
                            setAllocations(p => ({ ...p, [token.tokenId]: clamped }))
                          }}
                          style={{
                            fontFamily: 'monospace',
                            width: '60px',
                            textAlign: 'center',
                            background: '#000',
                            color: '#0f0',
                            border: '1px solid #0f0',
                            padding: '4px',
                            fontSize: '14px',
                          }}
                        />
                        <button
                          onClick={() => {
                            const current = allocations[token.tokenId] || 0
                            const remaining = iqBalance.available - totalAllocating
                            if (remaining > 0) setAllocations(p => ({ ...p, [token.tokenId]: current + 1 }))
                          }}
                          style={{
                            fontFamily: 'monospace',
                            width: '28px',
                            height: '28px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            cursor: 'pointer',
                            fontSize: '16px',
                            lineHeight: '1',
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                {holderData.tokens.length > 1 && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                  }}>
                    <button
                      onClick={() => {
                        const perToken = Math.floor(iqBalance.available / holderData.tokens.length)
                        const remainder = iqBalance.available % holderData.tokens.length
                        const newAllocs: Record<string, number> = {}
                        holderData.tokens.forEach((t, i) => {
                          newAllocs[t.tokenId] = perToken + (i < remainder ? 1 : 0)
                        })
                        setAllocations(newAllocs)
                      }}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '4px 10px',
                        background: '#1a1a1a',
                        color: '#0f0',
                        border: '1px solid #0f0',
                        cursor: 'pointer',
                      }}
                    >
                      split evenly
                    </button>
                    <button
                      onClick={() => setAllocations({})}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        padding: '4px 10px',
                        background: '#1a1a1a',
                        color: '#666',
                        border: '1px solid #333',
                        cursor: 'pointer',
                      }}
                    >
                      clear all
                    </button>
                  </div>
                )}

                <button
                  onClick={handleAllocate}
                  disabled={!canAllocate || allocating}
                  style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '12px 24px',
                    width: '100%',
                    background: canAllocate ? '#0f0' : '#333',
                    color: canAllocate ? '#000' : '#666',
                    border: `2px solid ${canAllocate ? '#0f0' : '#333'}`,
                    cursor: canAllocate ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}
                >
                  {allocating
                    ? 'sign in wallet...'
                    : canAllocate
                      ? `allocate ${totalAllocating} IQ points (permanent)`
                      : 'enter points above'
                  }
                </button>

                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#666',
                  textAlign: 'center',
                  marginTop: '8px',
                }}>
                  requires wallet signature. no gas. no takebacks.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Holdings Gallery */}
        {!isHolder ? (
          <div style={{
            border: '3px solid #000',
            borderRadius: '225px 15px 225px 15px / 15px 225px 15px 255px',
            boxShadow: '8px 8px 0 #000',
            background: '#fff',
            padding: '40px 20px',
            textAlign: 'center',
          }}>
            <h3 style={{ fontFamily: "'Comic Neue', cursive", fontSize: '22px', marginBottom: '12px' }}>
              u dont hold any savants
            </h3>
            <p style={{ fontFamily: "'Comic Neue', cursive", fontSize: '16px', color: '#666' }}>
              get 1 on{' '}
              <a href="https://opensea.io/collection/imaginary-magic-crypto-savants/overview" target="_blank" rel="noopener noreferrer" style={{ color: '#ff69b4', textDecoration: 'underline' }}>
                opensee
              </a>
              , dork
            </p>
          </div>
        ) : (
          <div>
            <h3 style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '20px',
              marginBottom: '12px',
              textShadow: '1px 1px 0 #ff69b4',
            }}>
              ur savants ({holderData?.tokens.length || 0})
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '12px',
            }}>
              {holderData?.tokens.map(token => (
                <motion.div
                  key={token.tokenId}
                  whileHover={{ scale: 1.05, rotate: 0 }}
                  onClick={() => setSelectedToken(token)}
                  style={{
                    border: '3px solid #000',
                    boxShadow: '4px 4px 0 #000',
                    background: '#fff',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transform: `rotate(${(parseInt(token.tokenId) % 5 - 2) * 0.8}deg)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={token.image}
                    alt={token.name}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{
                    padding: '6px 8px',
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'space-between',
                    background: '#000',
                    color: '#0f0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{token.name}{token.savantName ? ` - ${token.savantName}` : ''}</span>
                    <span style={{ flexShrink: 0, marginLeft: '4px' }}>IQ:{token.iq}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        </>) : activeTab === 'invintorri' ? (
          /* Invintorri Tab */
          <div>
            {/* Unopened paks - hidden when none to rip */}
            {(packBalance ?? 0) > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                background: 'linear-gradient(135deg, #fde68a, #fbbf24)', border: '3px solid #000',
                boxShadow: '4px 4px 0 #000', padding: '16px 20px', marginBottom: '20px', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/card-pack.png" alt="pak" style={{ width: '56px', height: '56px', objectFit: 'contain', imageRendering: 'pixelated' }} />
                  <div>
                    <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
                      {packBalance} sealed pak{packBalance === 1 ? '' : 's'}
                    </div>
                    <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '13px', color: '#78350f' }}>
                      unrippd. rip em 2 c wut u got.
                    </div>
                  </div>
                </div>
                <button onClick={() => router.push('/sitee/rip')} style={{
                  fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900, color: '#000',
                  background: '#6ee7b7', border: '3px solid #000', padding: '12px 20px', borderRadius: '14px',
                  cursor: 'pointer', boxShadow: '3px 3px 0 #000', fontSize: '14px',
                }}>
                  🎟️ rip paks
                </button>
              </div>
            )}

            {/* Opened traits */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '12px', marginBottom: '12px', flexWrap: 'wrap',
            }}>
              <h3 style={{
                fontFamily: "'Comic Neue', cursive", fontSize: '20px', margin: 0,
                textShadow: '1px 1px 0 #ff69b4',
              }}>
                ur trayts ({invTraits?.reduce((s, i) => s + i.balance, 0) ?? 0})
              </h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {burnMode ? (
                  <button onClick={exitBurnMode} disabled={burning} style={{
                    fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900, color: '#000',
                    background: '#e5e7eb', border: '3px solid #000', padding: '10px 18px', borderRadius: '14px',
                    cursor: burning ? 'not-allowed' : 'pointer', boxShadow: '3px 3px 0 #000', fontSize: '13px',
                  }}>
                    ✕ kancel
                  </button>
                ) : (
                  <>
                    <button onClick={startEkwip} style={{
                      fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900, color: '#000',
                      background: 'linear-gradient(135deg, #00ff87, #60efff)', border: '3px solid #000',
                      padding: '10px 18px', borderRadius: '14px', cursor: 'pointer',
                      boxShadow: '3px 3px 0 #000', fontSize: '13px',
                    }}>
                      🪄 ekwip / unekwip
                    </button>
                    {(invTraits?.length ?? 0) > 0 && (
                      <button onClick={() => { setBurnSuccess(null); setBurnError(null); setBurnMode(true) }} style={{
                        fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900, color: '#fff',
                        background: 'linear-gradient(135deg, #f97316, #dc2626)', border: '3px solid #000',
                        padding: '10px 18px', borderRadius: '14px', cursor: 'pointer',
                        boxShadow: '3px 3px 0 #000', fontSize: '13px',
                      }}>
                        🔥 burn 4 iq
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* burn success / error banners */}
            {burnSuccess && !burnMode && (
              <div style={{
                fontFamily: "'Comic Neue', cursive", fontWeight: 'bold', fontSize: '15px', textAlign: 'center',
                background: '#00ff87', border: '3px solid #000', boxShadow: '4px 4px 0 #000',
                padding: '12px 16px', marginBottom: '16px',
              }}>
                🔥 {burnSuccess}
              </div>
            )}
            {burnError && (
              <div style={{
                fontFamily: "'Comic Neue', cursive", fontWeight: 'bold', fontSize: '14px', textAlign: 'center',
                background: '#fecaca', border: '3px solid #000', boxShadow: '4px 4px 0 #000',
                padding: '12px 16px', marginBottom: '16px', color: '#7f1d1d',
              }}>
                {burnError}
              </div>
            )}

            {/* burn-mode instructions + weekly allowance */}
            {burnMode && (
              <div style={{
                fontFamily: "'Comic Neue', cursive", fontSize: '13px', background: '#fff7ed',
                border: '3px solid #000', boxShadow: '4px 4px 0 #000', padding: '12px 16px', marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>
                  🔥 pik trayts 2 burn 4 +{burnStatus?.iqPerBurn ?? 5} IQ each
                </div>
                <div style={{ color: '#78350f' }}>
                  burnd trayts r GON 4ever. only unekwipd trayts can b burnd.
                  u can burn {burnRemaining} mor dis week (cap {burnStatus?.cap ?? 50}/week, resets sundy).
                </div>
              </div>
            )}

            {invLoading ? (
              <div style={{ fontFamily: "'Comic Neue', cursive", textAlign: 'center', padding: '40px 20px' }}>
                lodin ur trayts...
              </div>
            ) : !invTraits || invTraits.length === 0 ? (
              <div style={{
                fontFamily: "'Comic Neue', cursive", textAlign: 'center', padding: '40px 20px',
                border: '3px dashed #000', background: '#fff',
              }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎨</div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>no trayts yet!</div>
                <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>rip sum paks 2 ern trayts, dummie</div>
              </div>
            ) : (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px',
                paddingBottom: burnMode && burnPickedCount > 0 ? '110px' : 0,
              }}>
                {invTraits.map(({ traitId, balance, trait }) => {
                  const picked = burnPicks[traitId] || 0
                  return (
                  <div key={traitId} style={{
                    border: picked > 0 ? '3px solid #dc2626' : '3px solid #000',
                    boxShadow: picked > 0 ? '4px 4px 0 #dc2626' : '4px 4px 0 #000', background: '#fff',
                    overflow: 'hidden', transform: `rotate(${(traitId % 5 - 2) * 0.8}deg)`, position: 'relative',
                  }}>
                    {picked > 0 && (
                      <div style={{
                        position: 'absolute', top: '4px', right: '4px', zIndex: 2, background: '#dc2626', color: '#fff',
                        fontFamily: "'Comic Neue', cursive", fontWeight: 900, fontSize: '13px',
                        border: '2px solid #000', borderRadius: '999px', padding: '1px 8px',
                      }}>
                        🔥 {picked}
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={traitImageUrl(trait)}
                      alt={trait.name}
                      style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block', background: '#f3f3f3', opacity: burnMode && picked === 0 ? 0.7 : 1 }}
                    />
                    <div style={{
                      padding: '6px 8px', fontFamily: "'Comic Neue', cursive", fontSize: '12px',
                      fontWeight: 'bold', display: 'flex', justifyContent: 'space-between',
                      background: '#000', color: '#0f0', whiteSpace: 'nowrap', overflow: 'hidden',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{trait.name}</span>
                      {balance > 1 && <span style={{ flexShrink: 0, marginLeft: '4px' }}>x{balance}</span>}
                    </div>
                    {burnMode && (
                      <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '2px solid #000' }}>
                        <button onClick={() => adjustBurnPick(traitId, -1, balance)} disabled={picked === 0} style={{
                          flex: 1, fontFamily: "'Comic Neue', cursive", fontWeight: 900, fontSize: '16px',
                          background: picked === 0 ? '#f3f3f3' : '#fecaca', border: 'none', borderRight: '2px solid #000',
                          cursor: picked === 0 ? 'not-allowed' : 'pointer', padding: '4px 0',
                        }}>−</button>
                        <div style={{
                          flex: 1, textAlign: 'center', fontFamily: "'Comic Neue', cursive", fontWeight: 900,
                          fontSize: '14px', alignSelf: 'center',
                        }}>{picked}</div>
                        <button onClick={() => adjustBurnPick(traitId, 1, balance)} disabled={picked >= balance} style={{
                          flex: 1, fontFamily: "'Comic Neue', cursive", fontWeight: 900, fontSize: '16px',
                          background: picked >= balance ? '#f3f3f3' : '#bbf7d0', border: 'none', borderLeft: '2px solid #000',
                          cursor: picked >= balance ? 'not-allowed' : 'pointer', padding: '4px 0',
                        }}>+</button>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            {/* floating confirm island in burn mode */}
            <AnimatePresence>
              {burnMode && burnPickedCount > 0 && (
                <motion.div
                  initial={{ y: 40, opacity: 0, x: '-50%' }}
                  animate={{ y: 0, opacity: 1, x: '-50%' }}
                  exit={{ y: 40, opacity: 0, x: '-50%' }}
                  style={{
                    position: 'fixed', bottom: '24px', left: '50%', zIndex: 50,
                    background: 'linear-gradient(135deg, #f97316, #dc2626)', border: '3px solid #000',
                    boxShadow: '5px 5px 0 #000', padding: '12px 16px', borderRadius: '18px',
                    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'nowrap',
                    maxWidth: 'calc(100vw - 32px)',
                  }}
                >
                  <div style={{ fontFamily: "'Comic Neue', cursive", color: '#fff', fontWeight: 'bold' }}>
                    <div style={{ fontSize: '16px', whiteSpace: 'nowrap' }}>{burnPickedCount} trayt{burnPickedCount === 1 ? '' : 's'} → +{burnIQPreview} IQ</div>
                    {burnOverCap && (
                      <div style={{ fontSize: '11px', color: '#fde68a' }}>
                        over cap! only {burnRemaining} credited
                      </div>
                    )}
                  </div>
                  <button onClick={handleBurn} disabled={burning} style={{
                    fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900, color: '#000',
                    background: burning ? '#d1d5db' : '#fde047', border: '3px solid #000', padding: '12px 22px',
                    borderRadius: '14px', cursor: burning ? 'not-allowed' : 'pointer', boxShadow: '3px 3px 0 #000',
                    fontSize: '15px', whiteSpace: 'nowrap',
                  }}>
                    {burning ? 'burnin...' : '🔥 burn em'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Eern IQ Tab */
          <div>
            <h3 style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '22px',
              marginBottom: '4px',
              textShadow: '1px 1px 0 #ff69b4',
            }}>
              eern iq points
            </h3>
            <p style={{
              fontFamily: "'Comic Neue', cursive",
              fontSize: '14px',
              color: '#666',
              marginBottom: '20px',
            }}>
              complete tasks 2 eern iq 4 ur savants. each task can only b completed once.
            </p>

            {xLinkSuccess && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  background: '#00ff87',
                  border: '3px solid #000',
                  boxShadow: '4px 4px 0 #000',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontFamily: "'Comic Neue', cursive",
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontSize: '16px',
                }}
              >
                x account linked! +5 IQ earned
              </motion.div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.map(task => {
                const isCompleted = task.status === 'completed'
                const isClaimable = task.status === 'claimable'
                const isPaused = !!task.paused && !isCompleted

                const descriptionText = isPaused
                  ? 'kumin suun...'
                  : isCompleted && task.metadata?.x_username
                  ? `leenkt az @${task.metadata.x_username}`
                  : isCompleted && task.metadata?.discord_username
                    ? `leenkt az ${task.metadata.discord_username}`
                    : isCompleted && task.metadata?.tweet_url
                      ? 'verified! ur a real one'
                    : isClaimable && task.metadata?.discord_username
                      ? `${task.metadata.discord_username} detected! claim ur iq`
                      : task.description

                return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: isPaused
                      ? 'linear-gradient(135deg, #e0e0e0, #ccc)'
                      : isCompleted
                        ? 'linear-gradient(135deg, #e8ffe8, #c8ffc8)'
                        : isClaimable
                          ? 'linear-gradient(135deg, #fff8e1, #ffe082)'
                          : 'linear-gradient(135deg, #fff, #f5f5f5)',
                    border: `3px solid ${isPaused ? '#999' : isCompleted ? '#00aa00' : isClaimable ? '#ff8f00' : '#000'}`,
                    borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
                    boxShadow: `6px 6px 0 ${isPaused ? '#999' : isCompleted ? '#00aa00' : isClaimable ? '#ff8f00' : '#000'}`,
                    padding: '20px',
                    transform: `rotate(${isCompleted ? 0 : -0.5}deg)`,
                    opacity: isPaused ? 0.6 : 1,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px',
                      }}>
                        <span style={{ fontSize: '24px' }}>{task.icon}</span>
                        <span style={{
                          fontFamily: "'Comic Neue', cursive",
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: '#000',
                        }}>
                          {task.name}
                        </span>
                        {isCompleted && (
                          <span style={{
                            background: '#00aa00',
                            color: '#fff',
                            fontFamily: "'Comic Neue', cursive",
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}>
                            done
                          </span>
                        )}
                        {isClaimable && (
                          <span style={{
                            background: '#ff8f00',
                            color: '#fff',
                            fontFamily: "'Comic Neue', cursive",
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            animation: 'pulse 2s infinite',
                          }}>
                            claimable!
                          </span>
                        )}
                      </div>
                      <p style={{
                        fontFamily: "'Comic Neue', cursive",
                        fontSize: '14px',
                        color: '#555',
                        margin: 0,
                      }}>
                        {descriptionText}
                      </p>
                    </div>

                    <div style={{
                      background: isCompleted ? '#00aa00' : '#000',
                      color: isCompleted ? '#fff' : '#0f0',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      +{task.iq_reward} IQ
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    {isPaused ? (
                      <div style={{
                        fontFamily: "'Comic Neue', cursive",
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#999',
                        textAlign: 'center',
                        padding: '10px',
                      }}>
                        kumin suun...
                      </div>
                    ) : isCompleted ? (
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#888',
                      }}>
                        kummpleeted {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
                      </div>
                    ) : isClaimable ? (
                      <button
                        onClick={async () => {
                          if (!address || claimingTask) return
                          setClaimingTask(task.id)
                          try {
                            const res = await fetch('/api/iq/tasks/claim', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ wallet: address, task_type: task.id }),
                            })
                            const data = await res.json()
                            if (data.ok) {
                              fetchData(true)
                            } else {
                              alert(data.error || 'claim failed')
                            }
                          } catch {
                            alert('claim failed')
                          }
                          setClaimingTask(null)
                        }}
                        disabled={claimingTask === task.id}
                        style={{
                          fontFamily: "'Comic Neue', cursive",
                          fontSize: '14px',
                          fontWeight: 'bold',
                          padding: '10px 20px',
                          background: 'linear-gradient(135deg, #00ff87, #60efff)',
                          color: '#000',
                          border: '2px solid #000',
                          boxShadow: '3px 3px 0 #000',
                          cursor: 'pointer',
                          width: '100%',
                          transition: 'all 0.15s',
                        }}
                      >
                        {claimingTask === task.id ? 'claiming...' : (task.claimable_label || `claim +${task.iq_reward} iq`)}
                      </button>
                    ) : task.action_type === 'verify_engagement' && task.engagement ? (
                      <div>
                        {task.requires_x ? (
                          <div style={{
                            fontFamily: "'Comic Neue', cursive",
                            fontSize: '13px',
                            color: '#cc0000',
                            background: '#ffe0e0',
                            border: '2px solid #cc0000',
                            padding: '10px',
                            textAlign: 'center',
                          }}>
                            link ur x account first (task above)
                          </div>
                        ) : (
                          <>
                            <a
                              href={task.engagement.intent_url || task.engagement.target_tweet_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'block',
                                fontFamily: "'Comic Neue', cursive",
                                fontSize: '14px',
                                fontWeight: 'bold',
                                padding: '10px 20px',
                                background: task.engagement.engagement_type === 'repost'
                                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                  : task.engagement.intent_url
                                    ? 'linear-gradient(135deg, #ff6b9d, #ffd700)'
                                    : 'linear-gradient(135deg, #1da1f2, #0d8bd9)',
                                color: task.engagement.intent_url && task.engagement.engagement_type !== 'repost' ? '#000' : '#fff',
                                border: '2px solid #000',
                                boxShadow: '3px 3px 0 #000',
                                textAlign: 'center',
                                textDecoration: 'none',
                                marginBottom: '8px',
                              }}
                            >
                              {task.engagement.engagement_type === 'repost'
                                ? '🔄 repost on x'
                                : task.engagement.intent_url
                                  ? 'pohst da kahpipastah onn x'
                                  : 'open tweet on x'}
                            </a>
                            {task.engagement.engagement_type === 'repost' ? (
                              <button
                                onClick={() => handleVerifyEngagement(task.id, task.engagement!.campaign_id, true)}
                                disabled={verifyingTask === task.id}
                                style={{
                                  fontFamily: "'Comic Neue', cursive",
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  padding: '10px 20px',
                                  background: 'linear-gradient(135deg, #00ff87, #60efff)',
                                  color: '#000',
                                  border: '2px solid #000',
                                  boxShadow: '3px 3px 0 #000',
                                  cursor: 'pointer',
                                  width: '100%',
                                }}
                              >
                                {verifyingTask === task.id ? 'checkin...' : 'i reposted it, verify!'}
                              </button>
                            ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                value={engagementInputs[task.id] || ''}
                                onChange={e => setEngagementInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                placeholder="payst ur x url post heer"
                                style={{
                                  flex: 1,
                                  fontFamily: "'Comic Neue', cursive",
                                  fontSize: '13px',
                                  padding: '10px',
                                  border: '2px solid #000',
                                  background: '#fff',
                                }}
                              />
                              <button
                                onClick={() => handleVerifyEngagement(task.id, task.engagement!.campaign_id)}
                                disabled={verifyingTask === task.id || !engagementInputs[task.id]?.trim()}
                                style={{
                                  fontFamily: "'Comic Neue', cursive",
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  padding: '10px 16px',
                                  background: engagementInputs[task.id]?.trim()
                                    ? 'linear-gradient(135deg, #00ff87, #60efff)'
                                    : '#ccc',
                                  color: '#000',
                                  border: '2px solid #000',
                                  boxShadow: '3px 3px 0 #000',
                                  cursor: engagementInputs[task.id]?.trim() ? 'pointer' : 'not-allowed',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {verifyingTask === task.id ? 'checkin...' : 'verify'}
                              </button>
                            </div>
                            )}
                            {verifyError[task.id] && (
                              <div style={{
                                fontFamily: "'Comic Neue', cursive",
                                fontSize: '12px',
                                color: '#cc0000',
                                marginTop: '6px',
                              }}>
                                {verifyError[task.id]}
                              </div>
                            )}
                            {verifySuccess[task.id] && (
                              <div style={{
                                fontFamily: "'Comic Neue', cursive",
                                fontSize: '12px',
                                color: '#00aa00',
                                fontWeight: 'bold',
                                marginTop: '6px',
                              }}>
                                verified! +{task.iq_reward} iq earned
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (task.action_type === 'oauth_x' && address) {
                            window.location.href = `/api/auth/x?wallet=${address}`
                          } else if (task.action_type === 'link_discord') {
                            window.location.href = '/sitee/verify?from=iq-task'
                          }
                        }}
                        disabled={!address}
                        style={{
                          fontFamily: "'Comic Neue', cursive",
                          fontSize: '14px',
                          fontWeight: 'bold',
                          padding: '10px 20px',
                          background: address ? 'linear-gradient(135deg, #ff6b9d, #ffd700)' : '#ccc',
                          color: '#000',
                          border: '2px solid #000',
                          boxShadow: '3px 3px 0 #000',
                          cursor: address ? 'pointer' : 'not-allowed',
                          width: '100%',
                          transition: 'all 0.15s',
                        }}
                      >
                        {task.action_label}
                      </button>
                    )}
                  </div>
                </motion.div>
                )
              })}
            </div>

            {tasks.length === 0 && (
              <div style={{
                fontFamily: "'Comic Neue', cursive",
                fontSize: '16px',
                color: '#999',
                textAlign: 'center',
                padding: '40px 20px',
              }}>
                loading tasks...
              </div>
            )}
          </div>
        )}

      </div>

      {/* IQ Info Popup */}
      <AnimatePresence>
        {showIQInfo && <IQInfoPopup onClose={() => setShowIQInfo(false)} />}
      </AnimatePresence>

      {/* Token Detail Modal */}
      <AnimatePresence>
        {selectedToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedToken(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -3 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff',
                border: '4px solid #000',
                boxShadow: '10px 10px 0 #000',
                borderRadius: '15px 225px 15px 255px / 225px 15px 225px 15px',
                maxWidth: '340px',
                width: '100%',
                overflow: 'hidden',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedToken.image}
                alt={selectedToken.name}
                style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ padding: '16px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}>
                  <h3 style={{ fontFamily: "'Comic Neue', cursive", fontSize: '22px', margin: 0 }}>
                    {selectedToken.savantName || selectedToken.name}
                  </h3>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    background: '#000',
                    color: '#0f0',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                  }}>
                    IQ: {selectedToken.iq}
                  </span>
                </div>

                {selectedToken.savantName && (
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#888',
                    marginBottom: '8px',
                  }}>
                    {selectedToken.name}
                  </div>
                )}

                {/* Savant Naming */}
                <div style={{
                  background: '#f5f5f5',
                  border: '2px solid #000',
                  padding: '10px',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '12px',
                    fontWeight: 'bold',
                    marginBottom: '6px',
                  }}>
                    {selectedToken.savantName ? 'rename ur savant' : 'sett naym'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={savantNameInput}
                      onChange={e => setSavantNameInput(e.target.value)}
                      placeholder={selectedToken.savantName || 'name ur savant...'}
                      maxLength={32}
                      style={{
                        flex: 1,
                        fontFamily: "'Comic Neue', cursive",
                        fontSize: '13px',
                        padding: '6px 8px',
                        border: '2px solid #000',
                        background: '#fff',
                      }}
                    />
                    <button
                      onClick={handleNameSavant}
                      disabled={namingToken || !savantNameInput.trim()}
                      style={{
                        fontFamily: "'Comic Neue', cursive",
                        fontSize: '12px',
                        padding: '6px 12px',
                        background: savantNameInput.trim() ? '#00ff00' : '#ccc',
                        border: '2px solid #000',
                        cursor: savantNameInput.trim() ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                      }}
                    >
                      {namingToken ? '...' : 'sign & save'}
                    </button>
                  </div>
                  {namingSuccess && (
                    <div style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '11px',
                      color: '#00aa00',
                      fontWeight: 'bold',
                      marginTop: '4px',
                    }}>
                      naym saved! ur savant is now known as &quot;{selectedToken.savantName}&quot;
                    </div>
                  )}
                  {namingError && (
                    <div style={{
                      fontFamily: "'Comic Neue', cursive",
                      fontSize: '11px',
                      color: '#ff0000',
                      marginTop: '4px',
                    }}>
                      {namingError}
                    </div>
                  )}
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    color: '#999',
                    marginTop: '4px',
                  }}>
                    requires wallet signature. shows on leederbord & metadata.
                  </div>
                </div>

                <button
                  onClick={() => { window.location.href = `/sitee/ekwip?tokenId=${selectedToken.tokenId}` }}
                  style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '14px',
                    padding: '8px 20px',
                    background: '#00cc88',
                    color: '#000',
                    border: '2px solid #000',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: '14px',
                    width: '100%',
                  }}
                >
                  ekwip / unekwip traits
                </button>
                <button
                  onClick={() => { setSelectedToken(null); setSavantNameInput(''); setNamingError(null); setNamingSuccess(false) }}
                  style={{
                    fontFamily: "'Comic Neue', cursive",
                    fontSize: '14px',
                    padding: '8px 20px',
                    background: '#ff69b4',
                    color: '#fff',
                    border: '2px solid #000',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: '6px',
                    width: '100%',
                  }}
                >
                  close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* full-screen video pyrotechnics on burn (elmo mode) */}
      <AnimatePresence>
        {showFlames && <FlameOverlay />}
      </AnimatePresence>

      {/* savant picker for ekwip flow */}
      <AnimatePresence>
        {showEkwipPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEkwipPicker(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', border: '4px solid #000', boxShadow: '6px 6px 0 #000',
                padding: '20px', maxWidth: '480px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
              }}
            >
              <h3 style={{
                fontFamily: "'Comic Neue', cursive", fontSize: '22px', margin: '0 0 4px',
                textShadow: '1px 1px 0 #00ff87',
              }}>
                pik a savant 2 ekwip
              </h3>
              <p style={{ fontFamily: "'Comic Neue', cursive", fontSize: '13px', color: '#666', margin: '0 0 16px' }}>
                wich savant u wanna dress up?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                {holderData?.tokens.map(token => (
                  <motion.div
                    key={token.tokenId}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => router.push(`/sitee/ekwip?tokenId=${token.tokenId}`)}
                    style={{
                      border: '3px solid #000', boxShadow: '4px 4px 0 #000', background: '#fff',
                      cursor: 'pointer', overflow: 'hidden',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={token.image} alt={token.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                      padding: '6px 8px', fontFamily: "'Comic Neue', cursive", fontSize: '12px', fontWeight: 'bold',
                      display: 'flex', justifyContent: 'space-between', background: '#000', color: '#0f0',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{token.savantName || token.name}</span>
                      <span style={{ flexShrink: 0, marginLeft: '4px' }}>IQ:{token.iq}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <button onClick={() => setShowEkwipPicker(false)} style={{
                fontFamily: "'Comic Neue', cursive", textTransform: 'uppercase', fontWeight: 900, color: '#000',
                background: '#e5e7eb', border: '3px solid #000', padding: '10px 18px', borderRadius: '14px',
                cursor: 'pointer', boxShadow: '3px 3px 0 #000', fontSize: '13px', marginTop: '16px', width: '100%',
              }}>
                ✕ nvm
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BuyPackModal open={showBuyPaks} onClose={() => setShowBuyPaks(false)} onBought={() => refetchPackBalance()} />
    </div>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,255,0.4)',
      border: `2px solid ${highlight ? '#0f0' : '#000'}`,
      padding: '10px 16px',
      textAlign: 'center',
      flex: '1 1 80px',
      ...(highlight && { animation: 'pulse 2s infinite' }),
    }}>
      <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '24px', fontWeight: 'bold' }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Comic Neue', cursive", fontSize: '12px' }}>{label}</div>
    </div>
  )
}
