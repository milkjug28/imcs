export type ContractEntry = {
  address: string
  chainId: number
}

export type CollectionConfig = {
  slug: string
  name: string
  displayName: string
  contractAddresses: string[]
  chainId: number
  contracts?: ContractEntry[]
  cap: number
  logo?: string
  closed?: boolean
}

export function getContracts(c: CollectionConfig): ContractEntry[] {
  if (c.contracts) return c.contracts
  return c.contractAddresses.map(address => ({ address, chainId: c.chainId }))
}

export const COLLECTIONS: CollectionConfig[] = [
  {
    slug: 'cyberkongz',
    name: 'CyberKongz',
    displayName: 'cyberkongz',
    contractAddresses: [
      '0x57a204aa1042f6e66dd7730813f4024114d74f37',
      '0x7b1a5e0807383f84a66c8a1b1af494061a169336',
    ],
    chainId: 1,
    cap: 100,
  },
  {
    slug: 'anonymice',
    name: 'Anonymice',
    displayName: 'anonymice',
    contractAddresses: ['0xbad6186e92002e312078b5a1dafd5ddf63d3f731'],
    chainId: 1,
    cap: 50,
  },
  {
    slug: 'steddy-teddys',
    name: 'Steddy Teddys',
    displayName: 'steddy teddyz',
    contractAddresses: ['0x88888888a9361f15aadbaca355a6b2938c6a674e'],
    chainId: 80094,
    contracts: [
      { address: '0x88888888a9361f15aadbaca355a6b2938c6a674e', chainId: 80094 },
      { address: '0x10a7aca36d27ef3fb63B638B39Ca0d87D15972a0', chainId: 1 },
    ],
    cap: 75,
  },
  {
    slug: 'normies',
    name: 'Normies',
    displayName: 'normiez',
    contractAddresses: ['0x9Eb6E2025B64f340691e424b7fe7022fFDE12438'],
    chainId: 1,
    cap: 75,
  },
  {
    slug: 'ratical',
    name: 'Ratical',
    displayName: 'ratikul',
    contractAddresses: ['0xaebbeaf2dc377a5646e47e2b8dee46bd164a9e46'],
    chainId: 1,
    cap: 80,
  },
  {
    slug: 'bad-frogs',
    name: 'Bad Frogs',
    displayName: 'bad frogz',
    contractAddresses: ['0x13e2A004EA4C77412C9806dAAdAfD09DE65645a3'],
    chainId: 1,
    cap: 105,
  },
  {
    slug: 'del-mundos',
    name: 'Del Mundos',
    displayName: 'del mundoz',
    contractAddresses: ['0x313e99D23d6A9eD47Af8DCCd545C2685F21eC44b'],
    chainId: 1,
    cap: 50,
  },
  {
    slug: 'nakamigos',
    name: 'Nakamigos',
    displayName: 'nakamigoz',
    contractAddresses: ['0xd774557b647330C91Bf44cfEAB205095f7E6c367'],
    chainId: 1,
    cap: 59,
  },
  {
    slug: 'good-vibes-club',
    name: 'Good Vibes Club',
    displayName: 'gud vibez club',
    contractAddresses: ['0xB8Ea78fcaCEf50d41375E44E6814ebbA36Bb33c4'],
    chainId: 1,
    cap: 100,
    closed: true,
  },
  {
    slug: 'regenerates',
    name: 'Regenerates',
    displayName: 'regenerates',
    contractAddresses: ['0x26c42724eba22f2d1a2ac5d35b0344bf2f3f8188'],
    chainId: 8453,
    cap: 75,
    closed: true,
  },
  {
    slug: 'quirkies',
    name: 'Quirkies',
    displayName: 'quirkiez',
    contractAddresses: ['0xD4B7D9bb20fA20dDADa9eCEf8a7355ca983cCCB1'],
    chainId: 1,
    cap: 50,
  },
  {
    slug: 'chimpers',
    name: 'Chimpers',
    displayName: 'chimperz',
    contractAddresses: ['0x307AF7d28AfEE82092aA95D35644898311CA5360'],
    chainId: 1,
    cap: 50,
  },
  {
    slug: 'less-than-three-50',
    name: 'Less Than Three 50',
    displayName: 'less than three 50',
    contractAddresses: ['0x4eF6f6A7Ee7d1CF7F1f7BFAd2BA56bAab868dE48'],
    chainId: 1,
    cap: 50,
  },
  {
    slug: 'crypto-teddies',
    name: 'Crypto Teddies',
    displayName: 'crypto teddiez',
    contractAddresses: ['0x441698f426365Bbb1c16a46c1b722461567925AA'],
    chainId: 1,
    cap: 10,
  },
  {
    slug: 'buumee',
    name: 'BUUMEE',
    displayName: 'BUUMEE',
    contractAddresses: ['0x02Cf8fe86C9BBC4fc3e95567Fc82398687e73367'],
    chainId: 2741,
    cap: 20,
  },
  {
    slug: 'the-humanoids',
    name: 'The Humanoids',
    displayName: 'humanoidz',
    contractAddresses: ['0x3a5051566b2241285BE871f650C445A88A970edd'],
    chainId: 1,
    cap: 25,
    closed: true,
  },
  {
    slug: 'mega-honey-badgers',
    name: 'Mega Honey Badgers',
    displayName: 'mega honey badgerz',
    contractAddresses: ['0x9aeA7d84fc8d359F09493B75C68E6F2880c3dD7B'],
    chainId: 1,
    cap: 20,
  },
  {
    slug: 'ok-degen',
    name: 'OK DEGEN',
    displayName: 'OK DEGEN',
    contractAddresses: ['0x79F74c164DE0305D68e6ad8cA3CDae6c349eD2Ee'],
    chainId: 8453,
    cap: 35,
  },
  {
    slug: 'based-minis',
    name: 'Based Minis',
    displayName: 'based minis',
    contractAddresses: ['0xCe4FB8E814583659b667b0d4a0167B7aaBF5a80f'],
    chainId: 8453,
    cap: 35,
  },
  {
    slug: 'pixel-frens',
    name: 'Pixel Frens',
    displayName: 'pixul frenz',
    contractAddresses: ['0x47ADC54c941F65194e259806d755287A68BD3c9f'],
    chainId: 1,
    cap: 75,
  },
  {
    slug: 'penguish',
    name: 'Penguish',
    displayName: 'penguish',
    contractAddresses: ['0x571f4Ffaf630f66EC0f8ff7A9f6b61020DE5Ec67'],
    chainId: 1,
    cap: 75,
    closed: true,
  },
  {
    slug: 'goblynz',
    name: 'Goblynz',
    displayName: 'goblynz',
    contractAddresses: ['0x131E64936a9DdF8Fb94967d8C316A16C7fC7d0c2'],
    chainId: 1,
    cap: 100,
    closed: true,
  },
  {
    slug: 'dropdedgorgez',
    name: 'DropDedGorgez',
    displayName: 'dropdedgorgez',
    contractAddresses: ['0x9c51a3cb5094b26aa1dcb380f3dc7e1a7c681c2d'],
    chainId: 1,
    cap: 75,
    closed: true,
  },
  {
    slug: 'human-resources',
    name: 'Human Resources',
    displayName: 'hooman resorces',
    contractAddresses: ['0x88A409734e5997F1fDA972CB1BB577E5b88c19dA'],
    chainId: 1,
    cap: 50,
    closed: true,
  },
]

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  80094: 'Berachain',
  10: 'Optimism',
  42161: 'Arbitrum',
  137: 'Polygon',
  2741: 'Abstract',
}

export function getCollectionBySlug(slug: string): CollectionConfig | undefined {
  return COLLECTIONS.find(c => c.slug === slug)
}
