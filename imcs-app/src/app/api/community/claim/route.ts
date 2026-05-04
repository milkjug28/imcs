import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPublicClient, http, getAddress, type Chain, type Hex } from 'viem'
import { mainnet, base } from 'viem/chains'
import { verifyMessage } from 'viem'
import { getCollectionBySlug } from '@/lib/collections'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY

const RPC_URLS: Record<number, string> = {
  1: ALCHEMY_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : 'https://cloudflare-eth.com',
  8453: ALCHEMY_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    : 'https://mainnet.base.org',
}

const CHAINS_BY_ID: Record<number, Chain> = {
  1: mainnet,
  8453: base,
}

const ERC721_BALANCE_OF_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

function buildSignMessage(collection: string, mintWallet: string, timestamp: number): string {
  return [
    'IMCS Community Whitelist Claim',
    '',
    `Collection: ${collection}`,
    `Mint wallet: ${mintWallet}`,
    `Timestamp: ${timestamp}`,
    '',
    'This signature only proves wallet ownership.',
    'No transaction will be executed.',
  ].join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { holderWallet, mintWallet, collectionSlug, signature, timestamp } = body

    if (!holderWallet || !mintWallet || !collectionSlug || !signature || !timestamp) {
      return NextResponse.json(
        { error: 'missing required fields' },
        { status: 400 }
      )
    }

    if (!ETH_ADDRESS_RE.test(holderWallet) || !ETH_ADDRESS_RE.test(mintWallet)) {
      return NextResponse.json(
        { error: 'invalid wallet address format' },
        { status: 400 }
      )
    }

    const msgAge = Date.now() - timestamp
    if (msgAge > 5 * 60 * 1000 || msgAge < -30_000) {
      return NextResponse.json(
        { error: 'signature expired, try again' },
        { status: 400 }
      )
    }

    const collection = getCollectionBySlug(collectionSlug)
    if (!collection) {
      return NextResponse.json(
        { error: 'unknown collection' },
        { status: 400 }
      )
    }

    const normalizedHolder = holderWallet.toLowerCase()
    const normalizedMint = mintWallet.toLowerCase()

    // Check if holder already claimed ANY collection (1 claim per holder globally)
    const { data: existingClaim } = await supabase
      .from('community_claims')
      .select('collection_slug')
      .eq('holder_wallet', normalizedHolder)
      .single()

    if (existingClaim) {
      return NextResponse.json(
        { error: `u alredy claimed ur spot (via ${existingClaim.collection_slug}). 1 per wallut, no exceptionss` },
        { status: 409 }
      )
    }

    // Check if mint wallet already used by anyone
    const { data: existingMint } = await supabase
      .from('community_claims')
      .select('holder_wallet')
      .eq('mint_wallet', normalizedMint)
      .single()

    if (existingMint) {
      return NextResponse.json(
        { error: 'dat mint wallut alredy claimed by sumone else' },
        { status: 409 }
      )
    }

    const message = buildSignMessage(collection.name, normalizedMint, timestamp)
    const isValid = await verifyMessage({
      address: getAddress(holderWallet),
      message,
      signature: signature as Hex,
    })

    if (!isValid) {
      return NextResponse.json(
        { error: 'signature verification failed' },
        { status: 401 }
      )
    }

    const chain = CHAINS_BY_ID[collection.chainId]
    if (!chain) {
      return NextResponse.json(
        { error: 'unsupported chain' },
        { status: 400 }
      )
    }

    const rpcUrl = RPC_URLS[collection.chainId]
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 10_000 }),
    })

    // Check balanceOf across all contract addresses for this collection
    // (e.g. CyberKongz has Genesis + Evolution Babies)
    let totalBalance = BigInt(0)
    for (const contractAddr of collection.contractAddresses) {
      try {
        const balance = await publicClient.readContract({
          address: getAddress(contractAddr) as `0x${string}`,
          abi: ERC721_BALANCE_OF_ABI,
          functionName: 'balanceOf',
          args: [getAddress(holderWallet)],
        })
        totalBalance += balance
      } catch {
        console.error(`Failed to check balance on ${contractAddr}`)
      }
    }

    if (totalBalance === BigInt(0)) {
      return NextResponse.json(
        { error: `u dont own any ${collection.displayName} nftss, nice try` },
        { status: 403 }
      )
    }

    // Check collection cap
    const { count } = await supabase
      .from('community_claims')
      .select('*', { count: 'exact', head: true })
      .eq('collection_slug', collectionSlug)

    if (count !== null && count >= collection.cap) {
      return NextResponse.json(
        { error: `${collection.displayName} spotss r full (${collection.cap}/${collection.cap})` },
        { status: 409 }
      )
    }

    const { error: insertError } = await supabase
      .from('community_claims')
      .insert({
        holder_wallet: normalizedHolder,
        mint_wallet: normalizedMint,
        collection_slug: collectionSlug,
        collection_address: collection.contractAddresses[0].toLowerCase(),
        chain_id: collection.chainId,
        signature,
      })

    if (insertError) {
      if (insertError.code === '23505') {
        if (insertError.message.includes('unique_holder_global')) {
          return NextResponse.json(
            { error: 'u alredy claimed ur spot. 1 per wallut, no exceptionss' },
            { status: 409 }
          )
        }
        if (insertError.message.includes('unique_mint_global')) {
          return NextResponse.json(
            { error: 'dat mint wallut alredy in use' },
            { status: 409 }
          )
        }
        return NextResponse.json(
          { error: 'duplicate claim detected' },
          { status: 409 }
        )
      }
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'sumthin went wrong saving ur claim' },
        { status: 500 }
      )
    }

    // Add mint wallet to whitelist with community=true
    const { data: existing } = await supabase
      .from('whitelist')
      .select('id, community')
      .eq('wallet_address', normalizedMint)
      .single()

    if (existing) {
      if (!existing.community) {
        await supabase
          .from('whitelist')
          .update({ community: true, source: 'community' })
          .eq('wallet_address', normalizedMint)
      }
    } else {
      await supabase
        .from('whitelist')
        .insert({
          wallet_address: normalizedMint,
          status: 'approved',
          method: 'community_claim',
          community: true,
          fcfs: false,
          gtd: false,
          source: 'community',
          notes: `claimed via ${collection.name} (holder: ${normalizedHolder})`,
        })
    }

    return NextResponse.json({
      success: true,
      message: `ur in! ${collection.displayName} spot claimed`,
      collection: collection.name,
      spotsRemaining: collection.cap - ((count || 0) + 1),
    })
  } catch (error) {
    console.error('Community claim error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
