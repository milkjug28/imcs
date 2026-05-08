export const dynamic = 'force-dynamic'

import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { SAVANT_TOKEN_ADDRESS, SAVANT_TOKEN_ABI } from '@/config/contracts'

export async function GET() {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
    })

    const totalSupply = await client.readContract({
      address: SAVANT_TOKEN_ADDRESS,
      abi: SAVANT_TOKEN_ABI,
      functionName: 'totalSupply',
      blockTag: 'latest',
    })

    return Response.json(
      { totalSupply: Number(totalSupply) },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (e) {
    return Response.json({ totalSupply: 0, error: String(e) }, { status: 500 })
  }
}
