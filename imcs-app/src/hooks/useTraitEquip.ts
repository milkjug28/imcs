'use client'

import { useAccount, useSignMessage, useWriteContract, useSwitchChain, usePublicClient } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'

const USE_SEPOLIA = process.env.NEXT_PUBLIC_TRAIT_CHAIN_ENV === 'sepolia'
const TARGET_CHAIN = USE_SEPOLIA ? baseSepolia : base
const MANAGER = (process.env.NEXT_PUBLIC_EQUIP_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
const EQUIPMENT = (process.env.NEXT_PUBLIC_EQUIPMENT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export type SlotChange = { slot: number; newTraitId: number }

const MANAGER_ABI = [
  { name: 'unequip', type: 'function', stateMutability: 'nonpayable', outputs: [], inputs: [
    { name: 'tokenId', type: 'uint256' }, { name: 'slot', type: 'uint256' }, { name: 'newComboHash', type: 'bytes32' },
    { name: 'signature', type: 'bytes' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] },
  { name: 'equip', type: 'function', stateMutability: 'nonpayable', outputs: [], inputs: [
    { name: 'tokenId', type: 'uint256' }, { name: 'slot', type: 'uint256' }, { name: 'traitId', type: 'uint256' },
    { name: 'newComboHash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] },
  { name: 'swap', type: 'function', stateMutability: 'nonpayable', outputs: [], inputs: [
    { name: 'tokenId', type: 'uint256' }, { name: 'slot', type: 'uint256' }, { name: 'newTraitId', type: 'uint256' },
    { name: 'newComboHash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] },
  { name: 'batchModify', type: 'function', stateMutability: 'nonpayable', outputs: [], inputs: [
    { name: 'tokenId', type: 'uint256' }, { name: 'slots', type: 'uint256[]' }, { name: 'newTraitIds', type: 'uint256[]' },
    { name: 'newComboHash', type: 'bytes32' }, { name: 'signature', type: 'bytes' }, { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' }] },
] as const

const EQUIPMENT_ABI = [
  { name: 'isApprovedForAll', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'setApprovalForAll', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [] },
] as const

type ModifyResponse = {
  operation: 'unequip' | 'equip' | 'swap' | 'batchModify'
  slot?: number; traitId?: number; newTraitId?: number
  slots?: number[]; newTraitIds?: number[]
  newComboHash: `0x${string}`; signature: `0x${string}`; deadline: string; nonce: string
}

export function useTraitEquip() {
  const { address, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id })

  // Sign approval message -> get backend EIP-712 sig -> execute on-chain -> wait for receipt.
  async function submitChanges(tokenId: number, changes: SlotChange[]): Promise<ModifyResponse> {
    if (!address) throw new Error('connect wallet first')
    if (!publicClient) throw new Error('no rpc client')

    const timestamp = Date.now()
    const changeLines = changes.map(c => `  Slot ${c.slot}: ${c.newTraitId === 0 ? 'unequip' : `trait ${c.newTraitId}`}`)
    const message = [
      'Modify Savant Traits', '', `Savant #${tokenId}`,
      ...changeLines, '', `Timestamp: ${timestamp}`, `Wallet: ${address.toLowerCase()}`,
    ].join('\n')

    const signature = await signMessageAsync({ message })

    const res = await fetch('/api/traits/modify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ wallet: address, tokenId, changes, signature, message, timestamp }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'approval rejected')
    const op = data as ModifyResponse

    if (chainId !== TARGET_CHAIN.id) {
      await switchChainAsync({ chainId: TARGET_CHAIN.id })
    }

    // equip / swap / batchModify pull 1155 from the user -> need operator approval
    if (op.operation !== 'unequip') {
      const approved = await publicClient.readContract({
        address: EQUIPMENT, abi: EQUIPMENT_ABI, functionName: 'isApprovedForAll', args: [address, MANAGER],
      })
      if (!approved) {
        const hash = await writeContractAsync({
          address: EQUIPMENT, abi: EQUIPMENT_ABI, functionName: 'setApprovalForAll',
          args: [MANAGER, true], chainId: TARGET_CHAIN.id,
        })
        await publicClient.waitForTransactionReceipt({ hash })
      }
    }

    const deadline = BigInt(op.deadline), nonce = BigInt(op.nonce)
    let hash: `0x${string}`
    if (op.operation === 'unequip') {
      hash = await writeContractAsync({ address: MANAGER, abi: MANAGER_ABI, functionName: 'unequip', chainId: TARGET_CHAIN.id,
        args: [BigInt(tokenId), BigInt(op.slot!), op.newComboHash, op.signature, deadline, nonce] })
    } else if (op.operation === 'equip') {
      hash = await writeContractAsync({ address: MANAGER, abi: MANAGER_ABI, functionName: 'equip', chainId: TARGET_CHAIN.id,
        args: [BigInt(tokenId), BigInt(op.slot!), BigInt(op.traitId!), op.newComboHash, op.signature, deadline, nonce] })
    } else if (op.operation === 'swap') {
      hash = await writeContractAsync({ address: MANAGER, abi: MANAGER_ABI, functionName: 'swap', chainId: TARGET_CHAIN.id,
        args: [BigInt(tokenId), BigInt(op.slot!), BigInt(op.newTraitId!), op.newComboHash, op.signature, deadline, nonce] })
    } else {
      hash = await writeContractAsync({ address: MANAGER, abi: MANAGER_ABI, functionName: 'batchModify', chainId: TARGET_CHAIN.id,
        args: [BigInt(tokenId), op.slots!.map(BigInt), op.newTraitIds!.map(BigInt), op.newComboHash, op.signature, deadline, nonce] })
    }
    await publicClient.waitForTransactionReceipt({ hash })

    // re-render composite + update metadata to reflect new on-chain equipment.
    // Pass expected combo so sync waits out Alchemy read-after-write lag.
    try {
      await fetch(`/api/traits/sync?tokenId=${tokenId}&expectedCombo=${op.newComboHash}`, { method: 'POST' })
    } catch {
      // non-fatal: on-chain change succeeded; metadata can be re-synced later
    }

    return op
  }

  return { submitChanges, targetChainId: TARGET_CHAIN.id }
}
