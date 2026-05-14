import { ethers } from 'ethers'
import { config } from '../config'
import { log, logError } from '../utils/log'
import { getBalance } from './wallet'

const OPENSEA_API = 'https://api.opensea.io'
const SEAPORT_V1_6 = '0x0000000000000068f116a894984e2db1123eb395'

interface Listing {
  orderHash: string
  priceEth: number
  tokenId: string
  chain: string
}

export interface BuyResult {
  success: boolean
  txHash?: string
  tokenId?: string
  priceEth?: number
  error?: string
}

async function openseaGet(path: string): Promise<unknown> {
  const res = await fetch(`${OPENSEA_API}${path}`, {
    headers: {
      'x-api-key': config.openseaKey,
      'User-Agent': 'savant-agent/1.0',
    },
  })
  if (!res.ok) throw new Error(`OpenSea GET ${path}: ${res.status}`)
  return res.json()
}

async function openseaPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${OPENSEA_API}${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': config.openseaKey,
      'User-Agent': 'savant-agent/1.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenSea POST ${path}: ${res.status} - ${text}`)
  }
  return res.json()
}

export async function getFloorListings(limit = 5): Promise<Listing[]> {
  const data = await openseaGet(
    `/api/v2/listings/collection/${config.collectionSlug}/all?limit=${limit}`
  ) as { listings?: unknown[] }

  const listings = data?.listings || []

  return listings.map((l: unknown) => {
    const listing = l as Record<string, unknown>
    const price = listing.price as Record<string, unknown> | undefined
    const current = price?.current as Record<string, unknown> | undefined
    const priceWei = current?.value ? String(current.value) : '0'
    const orderHash = listing.order_hash as string || ''

    const protocol = listing.protocol_data as Record<string, unknown> | undefined
    const parameters = protocol?.parameters as Record<string, unknown> | undefined
    const offer = (parameters?.offer as unknown[]) || []
    const firstOffer = offer[0] as Record<string, unknown> | undefined
    const tokenId = firstOffer?.identifierOrCriteria as string || '?'

    return {
      orderHash,
      priceEth: Number(priceWei) / 1e18,
      tokenId,
      chain: 'ethereum',
    }
  }).sort((a: Listing, b: Listing) => a.priceEth - b.priceEth)
}

export async function buyFloor(): Promise<BuyResult> {
  if (!config.savantPrivateKey || !config.savantWallet) {
    return { success: false, error: 'no wallet configured' }
  }

  const balance = await getBalance()
  if (balance === null) {
    return { success: false, error: 'couldnt check balance' }
  }

  const listings = await getFloorListings(3)
  if (listings.length === 0) {
    return { success: false, error: 'no listings found' }
  }

  const cheapest = listings[0]
  const totalCost = cheapest.priceEth + 0.002

  if (balance < totalCost) {
    return {
      success: false,
      error: `not enuf eth. have ${balance.toFixed(4)}, need ~${totalCost.toFixed(4)} (${cheapest.priceEth.toFixed(4)} + gas)`,
    }
  }

  log(`[trading] attempting buy: savant #${cheapest.tokenId} at ${cheapest.priceEth.toFixed(4)} ETH`)

  try {
    const fulfillment = await openseaPost('/api/v2/listings/fulfillment_data', {
      listing: {
        hash: cheapest.orderHash,
        chain: 'ethereum',
        protocol_address: SEAPORT_V1_6,
      },
      fulfiller: {
        address: config.savantWallet,
      },
    }) as { fulfillment_data?: { transaction?: Record<string, unknown> } }

    const tx = fulfillment?.fulfillment_data?.transaction
    if (!tx) {
      return { success: false, error: 'no transaction data from opensea' }
    }

    const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${config.alchemyKey}`)
    const wallet = new ethers.Wallet(config.savantPrivateKey, provider)

    const txResponse = await wallet.sendTransaction({
      to: tx.to as string,
      data: tx.input_data as string,
      value: tx.value ? BigInt(tx.value as string) : 0n,
    })

    log(`[trading] tx sent: ${txResponse.hash}`)
    const receipt = await txResponse.wait()

    if (receipt && receipt.status === 1) {
      log(`[trading] bought savant #${cheapest.tokenId} for ${cheapest.priceEth.toFixed(4)} ETH`)
      return {
        success: true,
        txHash: txResponse.hash,
        tokenId: cheapest.tokenId,
        priceEth: cheapest.priceEth,
      }
    } else {
      return { success: false, error: 'tx reverted', txHash: txResponse.hash }
    }
  } catch (err) {
    logError('[trading] buy failed', err)
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' }
  }
}

export async function getOwnedSavants(): Promise<string[]> {
  if (!config.alchemyKey || !config.savantWallet) return []

  try {
    const res = await fetch(
      `https://eth-mainnet.g.alchemy.com/nft/v3/${config.alchemyKey}/getNFTsForOwner?owner=${config.savantWallet}&contractAddresses[]=${config.contractAddress}&withMetadata=false`
    )
    if (!res.ok) return []
    const data = await res.json() as { ownedNfts?: { tokenId: string }[] }
    return (data.ownedNfts || []).map(n => n.tokenId)
  } catch {
    return []
  }
}
