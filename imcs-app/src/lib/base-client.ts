import { createPublicClient, http } from 'viem'
import { base, baseSepolia } from 'viem/chains'

// TRAIT_CHAIN_ENV=sepolia selects Base Sepolia for testnet wiring; default mainnet.
const USE_SEPOLIA = process.env.TRAIT_CHAIN_ENV === 'sepolia'
export const TRAIT_CHAIN = USE_SEPOLIA ? baseSepolia : base
const ALCHEMY_SUBDOMAIN = USE_SEPOLIA ? 'base-sepolia' : 'base-mainnet'

export function getBaseClient() {
  return createPublicClient({
    chain: TRAIT_CHAIN,
    transport: http(`https://${ALCHEMY_SUBDOMAIN}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY!}`, { timeout: 10_000 }),
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

export async function getTokenCombo(tokenId: number): Promise<`0x${string}`> {
  const combo = await getBaseClient().readContract({
    address: EQUIP_MANAGER_ADDRESS,
    abi: EQUIP_MANAGER_ABI,
    functionName: 'tokenToCombo',
    args: [BigInt(tokenId)],
  })
  return combo as `0x${string}`
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

const INV_CHUNK = 40 // keep each balanceOfBatch eth_call small (free-tier reliable)

// one balanceOfBatch chunk with a single retry
async function balancesForChunk(wallet: `0x${string}`, ids: number[]): Promise<bigint[]> {
  const accounts = ids.map(() => wallet)
  const bigIds = ids.map(id => BigInt(id))
  const call = () => getBaseClient().readContract({
    address: EQUIPMENT_ADDRESS,
    abi: EQUIPMENT_ABI,
    functionName: 'balanceOfBatch',
    args: [accounts, bigIds],
  }) as Promise<readonly bigint[]>
  try {
    return [...(await call())]
  } catch {
    await new Promise(r => setTimeout(r, 350))
    return [...(await call())] // throws if the retry also fails -> caller keeps last-good data
  }
}

// Chunked so a 187-id batch doesn't 1-shot a heavy eth_call that intermittently
// returns partial/empty on free tier (was wiping the user's whole inventory).
export async function getInventory(wallet: `0x${string}`, traitIds: number[]): Promise<Map<number, number>> {
  if (traitIds.length === 0) return new Map()

  const chunks: number[][] = []
  for (let i = 0; i < traitIds.length; i += INV_CHUNK) chunks.push(traitIds.slice(i, i + INV_CHUNK))

  const result = new Map<number, number>()
  for (const chunk of chunks) {
    const balances = await balancesForChunk(wallet, chunk)
    for (let i = 0; i < chunk.length; i++) {
      const bal = Number(balances[i])
      if (bal > 0) result.set(chunk[i], bal)
    }
  }
  return result
}
