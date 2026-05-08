export const dynamic = 'force-dynamic'

import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { SAVANT_TOKEN_ADDRESS, SAVANT_TOKEN_ABI } from '@/config/contracts'

async function getContractSupply(): Promise<number> {
  const rpcs = [
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
  ]

  for (const rpc of rpcs) {
    try {
      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpc),
      })
      const result = await client.readContract({
        address: SAVANT_TOKEN_ADDRESS,
        abi: SAVANT_TOKEN_ABI,
        functionName: 'totalSupply',
      })
      return Number(result)
    } catch {
      continue
    }
  }
  return 0
}

async function getEtherscanSupply(): Promise<number> {
  try {
    const res = await fetch(
      `https://api.etherscan.io/v2/api?chainid=1&module=stats&action=tokensupply&contractaddress=${SAVANT_TOKEN_ADDRESS}&apikey=${process.env.ETHERSCAN_API_KEY}`
    )
    const data = await res.json()
    if (data.status === '1' && data.result) return Number(data.result)
  } catch {}
  return 0
}

export async function GET() {
  const [contract, etherscan] = await Promise.all([
    getContractSupply(),
    getEtherscanSupply(),
  ])

  const totalSupply = Math.max(contract, etherscan)

  return Response.json(
    { totalSupply },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
