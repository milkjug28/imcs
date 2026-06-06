'use client'

import { useAccount, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'

const USE_SEPOLIA = process.env.NEXT_PUBLIC_TRAIT_CHAIN_ENV === 'sepolia'
const TARGET_CHAIN = USE_SEPOLIA ? baseSepolia : base
const EQUIPMENT = (process.env.NEXT_PUBLIC_EQUIPMENT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

const BURN_ABI = [
  { name: 'burnBatch', type: 'function', stateMutability: 'nonpayable', outputs: [], inputs: [
    { name: 'account', type: 'address' }, { name: 'ids', type: 'uint256[]' }, { name: 'values', type: 'uint256[]' }] },
] as const

export type BurnPick = { traitId: number; amount: number }

export type BurnResult = {
  traitsBurned: number
  credited: number
  capped: boolean
  remaining: number
  alreadyClaimed?: boolean
}

export function useTraitBurn() {
  const { address, chainId } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id })

  // Self-burn picked traits on-chain, then have the backend verify the receipt and credit IQ.
  // onSigned fires the moment the wallet signature lands (before tx confirmation) so the UI
  // can raise its burn/loading overlay while the chain + backend + refresh run underneath.
  async function burnTraits(picks: BurnPick[], onSigned?: () => void): Promise<BurnResult> {
    if (!address) throw new Error('connect wallet first')
    if (!publicClient) throw new Error('no rpc client')

    const clean = picks.filter(p => p.amount > 0)
    if (clean.length === 0) throw new Error('pick at least one trait to burn')

    if (chainId !== TARGET_CHAIN.id) {
      await switchChainAsync({ chainId: TARGET_CHAIN.id })
    }

    const ids = clean.map(p => BigInt(p.traitId))
    const values = clean.map(p => BigInt(p.amount))

    const hash = await writeContractAsync({
      address: EQUIPMENT, abi: BURN_ABI, functionName: 'burnBatch',
      args: [address, ids, values], chainId: TARGET_CHAIN.id,
    })
    onSigned?.()
    await publicClient.waitForTransactionReceipt({ hash })

    const res = await fetch('/api/iq/burn', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet: address, txHash: hash }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'could not credit burn')

    return data as BurnResult
  }

  return { burnTraits, targetChainId: TARGET_CHAIN.id }
}
