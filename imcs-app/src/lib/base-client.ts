import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

function getBaseClient() {
  return createPublicClient({
    chain: base,
    transport: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY!}`, { timeout: 10_000 }),
  })
}

export const EQUIP_MANAGER_ADDRESS = (process.env.EQUIP_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const EQUIPMENT_ADDRESS = (process.env.EQUIPMENT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export const EQUIP_MANAGER_ABI = [
  {
    name: 'getEquipped',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256[10]' }],
  },
  {
    name: 'comboToToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenToCombo',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const

export const EQUIPMENT_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOfBatch',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'accounts', type: 'address[]' },
      { name: 'ids', type: 'uint256[]' },
    ],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
] as const

export async function getEquipped(tokenId: number): Promise<number[]> {
  const result = await getBaseClient().readContract({
    address: EQUIP_MANAGER_ADDRESS,
    abi: EQUIP_MANAGER_ABI,
    functionName: 'getEquipped',
    args: [BigInt(tokenId)],
  })
  return [...(result as readonly bigint[])].map(Number)
}

export async function isComboTaken(comboHash: `0x${string}`, excludeTokenId?: number): Promise<boolean> {
  const taken = await getBaseClient().readContract({
    address: EQUIP_MANAGER_ADDRESS,
    abi: EQUIP_MANAGER_ABI,
    functionName: 'comboToToken',
    args: [comboHash],
  })
  const takenBy = Number(taken)
  if (takenBy === 0) return false
  if (excludeTokenId && takenBy === excludeTokenId) return false
  return true
}

export async function getInventory(wallet: `0x${string}`, traitIds: number[]): Promise<Map<number, number>> {
  if (traitIds.length === 0) return new Map()

  const accounts = traitIds.map(() => wallet)
  const ids = traitIds.map(id => BigInt(id))

  const balances = await getBaseClient().readContract({
    address: EQUIPMENT_ADDRESS,
    abi: EQUIPMENT_ABI,
    functionName: 'balanceOfBatch',
    args: [accounts, ids],
  })

  const result = new Map<number, number>()
  for (let i = 0; i < traitIds.length; i++) {
    const bal = Number((balances as bigint[])[i])
    if (bal > 0) result.set(traitIds[i], bal)
  }
  return result
}
