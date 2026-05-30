'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount, useWriteContract, useSwitchChain, usePublicClient, useReadContract } from 'wagmi'
import { parseEventLogs } from 'viem'
import {
  PACK_ADDRESS, PACK_EQUIPMENT_ADDRESS, PACK_EQUIPMENT_ABI, SAVANT_PACK_ABI,
  PACK_TOKEN_ID, PACK_PRICE_WEI, PACK_CHAIN,
} from '@/config/pack'

// one resolved slot from a rip
export type RipSlot =
  | { kind: 'trait'; slot: number; traitId: number }
  | { kind: 'booster'; slot: number; iq: number }
  | { kind: 'dud'; slot: number }

export type RipPhase = 'idle' | 'approving' | 'opening' | 'waiting' | 'revealed' | 'error'

const SLOTS = 3
const POLL_MS = 2500
const TIMEOUT_MS = 120_000
const MAX_LOG_RANGE = BigInt(10) // Alchemy free-tier eth_getLogs cap (blocks)
const ONE = BigInt(1)

export function usePackRip() {
  const { address, chainId } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: PACK_CHAIN.id })

  const [phase, setPhase] = useState<RipPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<RipSlot[]>([])
  const [lifetimeRips, setLifetimeRips] = useState<number | undefined>(undefined)

  // lifetime paks ript (persists across reloads via pack_rips ledger)
  useEffect(() => {
    if (!address) { setLifetimeRips(undefined); return }
    let cancelled = false
    fetch(`/api/pack/record?wallet=${address}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d && typeof d.rips === 'number') setLifetimeRips(d.rips) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [address])

  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: PACK_EQUIPMENT_ADDRESS, abi: PACK_EQUIPMENT_ABI, functionName: 'balanceOf',
    args: address ? [address, PACK_TOKEN_ID] : undefined,
    chainId: PACK_CHAIN.id, query: { enabled: !!address },
  })
  const packBalance = balanceRaw !== undefined ? Number(balanceRaw) : undefined

  const { data: seasonOpenRaw } = useReadContract({
    address: PACK_ADDRESS, abi: SAVANT_PACK_ABI, functionName: 'seasonOpen',
    chainId: PACK_CHAIN.id,
  })
  const seasonOpen = seasonOpenRaw === undefined ? true : Boolean(seasonOpenRaw)

  const { data: saleOpenRaw } = useReadContract({
    address: PACK_ADDRESS, abi: SAVANT_PACK_ABI, functionName: 'saleOpen',
    chainId: PACK_CHAIN.id,
  })
  const saleOpen = saleOpenRaw === undefined ? false : Boolean(saleOpenRaw)

  // collect the SLOTS slot-events (TraitWon/BoosterWon/SlotDud) for this requestId.
  // Scans in <=10-block windows: Alchemy's free tier rejects eth_getLogs ranges >10
  // blocks, and VRF fulfills many blocks after openPack, so an unbounded
  // fromBlock->latest query always 400s.
  async function collectResults(requestId: bigint, fromBlock: bigint): Promise<RipSlot[]> {
    if (!publicClient) throw new Error('no rpc client')
    const deadline = Date.now() + TIMEOUT_MS
    const slots: RipSlot[] = []
    let cursor = fromBlock
    while (Date.now() < deadline) {
      const head = await publicClient.getBlockNumber()
      while (cursor <= head) {
        const toBlock = cursor + MAX_LOG_RANGE - ONE > head ? head : cursor + MAX_LOG_RANGE - ONE
        const [traits, boosters, duds] = await Promise.all([
          publicClient.getContractEvents({ address: PACK_ADDRESS, abi: SAVANT_PACK_ABI,
            eventName: 'TraitWon', args: { requestId }, fromBlock: cursor, toBlock }),
          publicClient.getContractEvents({ address: PACK_ADDRESS, abi: SAVANT_PACK_ABI,
            eventName: 'BoosterWon', args: { requestId }, fromBlock: cursor, toBlock }),
          publicClient.getContractEvents({ address: PACK_ADDRESS, abi: SAVANT_PACK_ABI,
            eventName: 'SlotDud', args: { requestId }, fromBlock: cursor, toBlock }),
        ])
        for (const e of traits) slots.push({ kind: 'trait', slot: -1, traitId: Number((e.args as { traitTokenId: bigint }).traitTokenId) })
        for (const e of boosters) slots.push({ kind: 'booster', slot: -1, iq: Number((e.args as { iqAmount: bigint }).iqAmount) })
        for (const e of duds) slots.push({ kind: 'dud', slot: Number((e.args as { slot: bigint }).slot) })
        cursor = toBlock + ONE
      }
      if (slots.length >= SLOTS) return slots.slice(0, SLOTS)
      await new Promise(r => setTimeout(r, POLL_MS))
    }
    throw new Error('VRF timeout - results did not arrive')
  }

  const rip = useCallback(async (): Promise<RipSlot[]> => {
    if (!address) throw new Error('connect wallet first')
    if (!publicClient) throw new Error('no rpc client')
    setError(null)
    setResults([])
    try {
      if (chainId !== PACK_CHAIN.id) await switchChainAsync({ chainId: PACK_CHAIN.id })

      // pack burns the sealed token from the user -> needs operator approval (one-time)
      const approved = await publicClient.readContract({
        address: PACK_EQUIPMENT_ADDRESS, abi: PACK_EQUIPMENT_ABI,
        functionName: 'isApprovedForAll', args: [address, PACK_ADDRESS],
      })
      if (!approved) {
        setPhase('approving')
        const aHash = await writeContractAsync({
          address: PACK_EQUIPMENT_ADDRESS, abi: PACK_EQUIPMENT_ABI,
          functionName: 'setApprovalForAll', args: [PACK_ADDRESS, true], chainId: PACK_CHAIN.id,
        })
        await publicClient.waitForTransactionReceipt({ hash: aHash })
      }

      setPhase('opening')
      const hash = await writeContractAsync({
        address: PACK_ADDRESS, abi: SAVANT_PACK_ABI, functionName: 'openPack', chainId: PACK_CHAIN.id,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      const requested = parseEventLogs({ abi: SAVANT_PACK_ABI, logs: receipt.logs, eventName: 'PackOpenRequested' })
      const requestId = (requested[0]?.args as { requestId: bigint } | undefined)?.requestId
      if (requestId === undefined) throw new Error('no requestId in openPack receipt')

      setPhase('waiting')
      const slots = await collectResults(requestId, receipt.blockNumber)
      setResults(slots)
      setPhase('revealed')
      refetchBalance()

      // record the rip (lifetime ledger) + credit any booster IQ to off-chain balance.
      // fires on every rip so COUNT(*) = lifetime paks ript, SUM(iq) = pack IQ earned.
      fetch('/api/pack/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          requestId: requestId.toString(),
          fromBlock: receipt.blockNumber.toString(),
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && typeof d.rips === 'number') setLifetimeRips(d.rips) })
        .catch(() => {})
      return slots
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'rip failed'
      setError(msg)
      setPhase('error')
      throw e
    }
  }, [address, chainId, publicClient, switchChainAsync, writeContractAsync, refetchBalance])

  const buy = useCallback(async (amount = 1): Promise<void> => {
    if (!address) throw new Error('connect wallet first')
    if (!publicClient) throw new Error('no rpc client')
    if (chainId !== PACK_CHAIN.id) await switchChainAsync({ chainId: PACK_CHAIN.id })
    const hash = await writeContractAsync({
      address: PACK_ADDRESS, abi: SAVANT_PACK_ABI, functionName: 'buyPack',
      args: [BigInt(amount)], value: PACK_PRICE_WEI * BigInt(amount), chainId: PACK_CHAIN.id,
    })
    await publicClient.waitForTransactionReceipt({ hash })
    // balanceOf at 'latest' can lag the mint by a block on Alchemy, showing 1 short.
    // poll 'latest' until it reflects the higher balance before refreshing the UI.
    const before = balanceRaw !== undefined ? BigInt(balanceRaw as bigint) : undefined
    for (let i = 0; i < 6; i++) {
      const fresh = await publicClient.readContract({
        address: PACK_EQUIPMENT_ADDRESS, abi: PACK_EQUIPMENT_ABI, functionName: 'balanceOf',
        args: [address, PACK_TOKEN_ID],
      }) as bigint
      if (before === undefined || fresh > before) break
      await new Promise(r => setTimeout(r, 800))
    }
    await refetchBalance()
  }, [address, chainId, publicClient, switchChainAsync, writeContractAsync, refetchBalance, balanceRaw])

  const reset = useCallback(() => { setPhase('idle'); setError(null); setResults([]) }, [])

  return { packBalance, refetchBalance, seasonOpen, saleOpen, rip, buy, reset, phase, error, results, lifetimeRips, priceWei: PACK_PRICE_WEI }
}
