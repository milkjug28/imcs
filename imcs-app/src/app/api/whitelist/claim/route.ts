import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Claim WL spot — validates tweet link format and marks as claimed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet, tweet_link } = body
    const walletLower = wallet?.toLowerCase()

    if (!walletLower || !tweet_link) {
      return NextResponse.json(
        { error: 'wallet and tweet_link required' },
        { status: 400 }
      )
    }

    // Validate tweet URL format + extract username
    // Accept: https://x.com/USERNAME/status/NUMBERS or https://twitter.com/USERNAME/status/NUMBERS
    const tweetRegex = /^https?:\/\/(x\.com|twitter\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/
    const match = tweet_link.match(tweetRegex)
    if (!match) {
      return NextResponse.json({
        success: false,
        error: 'dats not a valid tweet link dummie. copy da url from ur post',
      }, { status: 400 })
    }

    const tweetUsername = match[2] // extracted username from URL

    // Check that this wallet has WL + X linked
    const { data: wl } = await supabase
      .from('whitelist')
      .select('id, status, x_username, claimed')
      .eq('wallet_address', walletLower)
      .single()

    if (!wl) {
      return NextResponse.json({
        success: false,
        error: 'ur not on da list. how did u even get here?',
      }, { status: 404 })
    }

    if (!wl.x_username) {
      return NextResponse.json({
        success: false,
        error: 'u need to link ur X account first dummy',
      }, { status: 400 })
    }

    // Verify the tweet is from the correct X account
    if (tweetUsername.toLowerCase() !== wl.x_username.toLowerCase()) {
      return NextResponse.json({
        success: false,
        error: `dats not ur tweet dummie! ur linked as @${wl.x_username} but dat tweet is from @${tweetUsername}`,
      }, { status: 400 })
    }

    if (wl.claimed) {
      return NextResponse.json({
        success: true,
        message: 'u already claimed ur spot! chill out',
        already_claimed: true,
      })
    }

    // Mark as claimed!
    const { error: updateError } = await supabase
      .from('whitelist')
      .update({
        claimed: true,
        claimed_at: new Date().toISOString(),
        tweet_link: tweet_link,
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletLower)

    if (updateError) {
      console.error('Claim update error:', updateError)
      return NextResponse.json({ error: 'failed to claim' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'CONGRAAATS!!! ur spot is claimed savant! 🎉🧙‍♂️',
      claimed: true,
    })
  } catch (error) {
    console.error('Claim error:', error)
    return NextResponse.json({ error: 'sumthin went wrong' }, { status: 500 })
  }
}
