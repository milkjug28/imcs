export const dynamic = 'force-dynamic'

import { SAVANT_TOKEN_ADDRESS } from '@/config/contracts'

export async function GET() {
  try {
    const res = await fetch(
      `https://api.etherscan.io/api?module=stats&action=tokensupply&contractaddress=${SAVANT_TOKEN_ADDRESS}&apikey=${process.env.ETHERSCAN_API_KEY}`
    )
    const data = await res.json()

    if (data.status === '1' && data.result) {
      return Response.json(
        { totalSupply: Number(data.result) },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } },
      )
    }

    throw new Error(data.message || 'Etherscan API failed')
  } catch (e) {
    return Response.json({ totalSupply: 0, error: String(e) }, { status: 500 })
  }
}
