const ONE_OF_ONE_TOKENS = new Set([315, 851, 1023, 1865, 2902, 3541, 4248])

const BASE_IQ = 69
const ONE_OF_ONE_IQ = 111

export function getBaseIQ(tokenId: number): number {
  return ONE_OF_ONE_TOKENS.has(tokenId) ? ONE_OF_ONE_IQ : BASE_IQ
}
