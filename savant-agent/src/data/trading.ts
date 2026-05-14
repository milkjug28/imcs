import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ethers } from 'ethers'
import { config } from '../config'
import { log, logError } from '../utils/log'
import { getBalance } from './wallet'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = resolve(__dirname, '..', '..', 'scripts', 'opensea')

const SEAPORT_ABI = [
  'function fulfillAdvancedOrder(tuple(tuple(address offerer, address zone, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount)[] offer, tuple(uint8 itemType, address token, uint256 identifierOrCriteria, uint256 startAmount, uint256 endAmount, address recipient)[] consideration, uint8 orderType, uint256 startTime, uint256 endTime, bytes32 zoneHash, uint256 salt, bytes32 conduitKey, uint256 totalOriginalConsiderationItems) parameters, uint120 numerator, uint120 denominator, bytes signature, bytes extraData) advancedOrder, tuple(uint256 orderIndex, uint8 side, uint256 index, uint256 identifier, bytes32[] criteriaProof)[] criteriaResolvers, bytes32 fulfillerConduitKey, address recipient) external payable returns (bool fulfilled)',
]

export interface BuyResult {
  success: boolean
  txHash?: string
  tokenId?: string
  priceEth?: number
  error?: string
}

interface Listing {
  orderHash: string
  priceEth: number
  tokenId: string
}

function runScript(script: string, args: string[]): string {
  const cmd = [script, ...args].map(a => `'${a}'`).join(' ')
  return execSync(cmd, {
    encoding: 'utf-8',
    timeout: 30_000,
    env: { ...process.env, OPENSEA_API_KEY: config.openseaKey },
  }).trim()
}

export async function getFloorListings(limit = 5): Promise<Listing[]> {
  const raw = runScript(
    resolve(SCRIPTS, 'opensea-listings-collection.sh'),
    [config.collectionSlug, String(limit)],
  )

  const data = JSON.parse(raw) as { listings?: unknown[] }
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

    return { orderHash, priceEth: Number(priceWei) / 1e18, tokenId }
  }).sort((a, b) => a.priceEth - b.priceEth)
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
  const totalCost = cheapest.priceEth + 0.001

  if (balance < totalCost) {
    return {
      success: false,
      error: `not enuf eth. have ${balance.toFixed(4)}, need ~${totalCost.toFixed(4)} (${cheapest.priceEth.toFixed(4)} + gas)`,
    }
  }

  log(`[trading] attempting buy: savant #${cheapest.tokenId} at ${cheapest.priceEth.toFixed(4)} ETH`)

  try {
    const fulfillRaw = runScript(
      resolve(SCRIPTS, 'opensea-fulfill-listing.sh'),
      ['ethereum', cheapest.orderHash, config.savantWallet],
    )

    const fulfillment = JSON.parse(fulfillRaw) as {
      fulfillment_data?: { transaction?: Record<string, unknown> }
    }

    const tx = fulfillment?.fulfillment_data?.transaction
    if (!tx) {
      return { success: false, error: 'no transaction data from opensea' }
    }

    const inputData = tx.input_data as Record<string, unknown> | string | undefined
    if (!inputData) {
      return { success: false, error: 'no input_data in fulfillment' }
    }

    const provider = new ethers.JsonRpcProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${config.alchemyKey}`,
    )
    const wallet = new ethers.Wallet(config.savantPrivateKey, provider)

    let calldata: string

    if (typeof inputData === 'string') {
      calldata = inputData
    } else {
      const seaport = new ethers.Interface(SEAPORT_ABI)
      calldata = seaport.encodeFunctionData('fulfillAdvancedOrder', [
        inputData.advancedOrder,
        inputData.criteriaResolvers || [],
        inputData.fulfillerConduitKey || ethers.ZeroHash,
        inputData.recipient || config.savantWallet,
      ])
    }

    const txResponse = await wallet.sendTransaction({
      to: tx.to as string,
      data: calldata,
      value: tx.value ? BigInt(String(tx.value)) : 0n,
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
      `https://eth-mainnet.g.alchemy.com/nft/v3/${config.alchemyKey}/getNFTsForOwner?owner=${config.savantWallet}&contractAddresses[]=${config.contractAddress}&withMetadata=false`,
    )
    if (!res.ok) return []
    const data = await res.json() as { ownedNfts?: { tokenId: string }[] }
    return (data.ownedNfts || []).map(n => n.tokenId)
  } catch {
    return []
  }
}
