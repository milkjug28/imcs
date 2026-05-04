export type CollectionConfig = {
  slug: string
  name: string
  displayName: string
  contractAddresses: string[]
  chainId: number
  cap: number
  logo?: string
}

export const COLLECTIONS: CollectionConfig[] = [
  {
    slug: 'bad-frogs',
    name: 'Bad Frogs',
    displayName: 'bad frogz',
    contractAddresses: ['0x13e2A004EA4C77412C9806dAAdAfD09DE65645a3'],
    chainId: 1,
    cap: 75,
  },
  {
    slug: 'cyberkongz',
    name: 'CyberKongz',
    displayName: 'cyberkongz',
    contractAddresses: [
      '0x57a204aa1042f6e66dd7730813f4024114d74f37', // Genesis Kong
      '0x7b1a5e0807383f84a66c8a1b1af494061a169336', // Evolution Babies
    ],
    chainId: 1,
    cap: 100,
  },
  {
    slug: 'pixel-frens',
    name: 'Pixel Frens',
    displayName: 'pixul frenz',
    contractAddresses: ['0x47ADC54c941F65194e259806d755287A68BD3c9f'],
    chainId: 1,
    cap: 50,
  },
  {
    slug: 'good-vibes-club',
    name: 'Good Vibes Club',
    displayName: 'gud vibez club',
    contractAddresses: ['0xB8Ea78fcaCEf50d41375E44E6814ebbA36Bb33c4'],
    chainId: 1,
    cap: 100,
  },
  {
    slug: 'regenerates',
    name: 'Regenerates',
    displayName: 'regenerayts',
    contractAddresses: ['0x26c42724eba22f2d1a2ac5d35b0344bf2f3f8188'],
    chainId: 8453,
    cap: 75,
  },
  {
    slug: 'ratical',
    name: 'Ratical',
    displayName: 'ratikul',
    contractAddresses: ['0xaebbeaf2dc377a5646e47e2b8dee46bd164a9e46'],
    chainId: 1,
    cap: 50,
  },
  {
    slug: 'penguish',
    name: 'Penguish',
    displayName: 'penguish',
    contractAddresses: ['0x571f4Ffaf630f66EC0f8ff7A9f6b61020DE5Ec67'],
    chainId: 1,
    cap: 75,
  },
  {
    slug: 'goblynz',
    name: 'Goblynz',
    displayName: 'goblynz',
    contractAddresses: ['0x131E64936a9DdF8Fb94967d8C316A16C7fC7d0c2'],
    chainId: 1,
    cap: 100,
  },
  {
    slug: 'dropdedgorgez',
    name: 'DropDedGorgez',
    displayName: 'dropdedgorgez',
    contractAddresses: ['0x9c51a3cb5094b26aa1dcb380f3dc7e1a7c681c2d'],
    chainId: 1,
    cap: 75,
  },
  {
    slug: 'human-resources',
    name: 'Human Resources',
    displayName: 'hooman resorces',
    contractAddresses: ['0x88A409734e5997F1fDA972CB1BB577E5b88c19dA'],
    chainId: 1,
    cap: 50,
  },
]

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  10: 'Optimism',
  42161: 'Arbitrum',
  137: 'Polygon',
}

export function getCollectionBySlug(slug: string): CollectionConfig | undefined {
  return COLLECTIONS.find(c => c.slug === slug)
}
