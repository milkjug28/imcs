const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY!
const SAVANT_TOKEN = '0x95fa6fc553F5bE3160b191b0133236367A835C63'

export async function getOwnedSavants(wallet: string): Promise<Set<number>> {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=${SAVANT_TOKEN}&withMetadata=false&pageSize=100`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Alchemy error: ${res.status}`)

  const data = await res.json()
  return new Set(
    (data.ownedNfts || []).map((n: { tokenId: string }) => parseInt(n.tokenId))
  )
}

export async function verifyOwnership(wallet: string, tokenId: number): Promise<boolean> {
  const owned = await getOwnedSavants(wallet)
  return owned.has(tokenId)
}
