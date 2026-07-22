import { getOwnedTokenIds, verifyOwnership as verify } from './alchemy'

export async function getOwnedSavants(wallet: string): Promise<Set<number>> {
  const { tokenIds } = await getOwnedTokenIds(wallet)
  return new Set(tokenIds)
}

export async function verifyOwnership(wallet: string, tokenId: number): Promise<boolean> {
  return verify(wallet, [tokenId])
}
