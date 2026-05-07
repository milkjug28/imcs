import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, getAddress, type Chain } from 'viem'
import { mainnet, base, berachain } from 'viem/chains'
import { getCollectionBySlug, getContracts } from '@/lib/collections'

export const dynamic = 'force-dynamic'

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!

const RPC_URLS: Record<number, string> = {
  1: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  8453: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
  80094: 'https://rpc.berachain.com',
}

const CHAINS_BY_ID: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  80094: berachain,
}

const ERC721_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')
    const slug = request.nextUrl.searchParams.get('collection')

    if (!wallet || !slug) {
      return NextResponse.json(
        { error: 'wallet and collection required' },
        { status: 400 }
      )
    }

    if (!ETH_ADDRESS_RE.test(wallet)) {
      return NextResponse.json(
        { error: 'invalid wallet' },
        { status: 400 }
      )
    }

    const collection = getCollectionBySlug(slug)
    if (!collection) {
      return NextResponse.json(
        { error: 'unknown collection' },
        { status: 400 }
      )
    }

    const contracts = getContracts(collection)
    let totalBalance = BigInt(0)

    for (const contract of contracts) {
      const chain = CHAINS_BY_ID[contract.chainId]
      const rpcUrl = RPC_URLS[contract.chainId]
      if (!chain || !rpcUrl) continue

      const client = createPublicClient({
        chain,
        transport: http(rpcUrl, { timeout: 10_000 }),
      })

      try {
        const balance = await client.readContract({
          address: getAddress(contract.address) as `0x${string}`,
          abi: ERC721_BALANCE_OF_ABI,
          functionName: 'balanceOf',
          args: [getAddress(wallet)],
        })
        totalBalance += balance
      } catch {
        // individual contract check failed, continue
      }
    }

    return NextResponse.json(
      {
        owns: totalBalance > BigInt(0),
        balance: Number(totalBalance),
        collection: collection.name,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { error: 'could not check ownership' },
      { status: 500 }
    )
  }
}
