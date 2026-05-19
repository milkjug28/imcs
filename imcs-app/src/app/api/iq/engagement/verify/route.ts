import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'
import { isAddress } from 'viem'

export const dynamic = 'force-dynamic'

function extractTweetId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  return match ? match[1] : null
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, '...')
    .trim()
}

function textsMatch(actual: string, required: string): boolean {
  const a = normalizeText(actual)
  const b = normalizeText(required)
  return a.includes(b) || b.includes(a)
}

export async function POST(request: NextRequest) {
  const ip = getRequestIP(request)
  const rl = rateLimit(`engagement-verify:${ip}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 })
  }

  const body = await request.json()
  const { wallet, campaign_id, tweet_url } = body

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: 'invalid wallet' }, { status: 400 })
  }
  if (!campaign_id || !tweet_url) {
    return NextResponse.json({ error: 'campaign_id and tweet_url required' }, { status: 400 })
  }

  const walletLower = wallet.toLowerCase()
  const taskType = `engagement_${campaign_id}`

  const { data: existing } = await supabase
    .from('iq_task_completions')
    .select('id')
    .eq('wallet_address', walletLower)
    .eq('task_type', taskType)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'already claimed dis one' }, { status: 409 })
  }

  const { data: campaign } = await supabase
    .from('x_engagement_campaigns')
    .select('*')
    .eq('id', campaign_id)
    .eq('active', true)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: 'campaign not found or expired' }, { status: 404 })
  }

  if (campaign.expires_at && new Date(campaign.expires_at) < new Date()) {
    return NextResponse.json({ error: 'campaign expired' }, { status: 410 })
  }

  const { data: xLink } = await supabase
    .from('iq_task_completions')
    .select('metadata')
    .eq('wallet_address', walletLower)
    .eq('task_type', 'link_x')
    .single()

  if (!xLink?.metadata?.x_user_id) {
    return NextResponse.json({ error: 'link ur x account first' }, { status: 400 })
  }

  const linkedXUserId = xLink.metadata.x_user_id

  const userTweetId = extractTweetId(tweet_url)
  if (!userTweetId) {
    return NextResponse.json({ error: 'invalid tweet url' }, { status: 400 })
  }

  const bearerToken = process.env.X_BEARER_TOKEN
  if (!bearerToken) {
    console.error('X_BEARER_TOKEN not configured')
    return NextResponse.json({ error: 'verification unavailable' }, { status: 503 })
  }

  const fields = campaign.engagement_type === 'post_copypasta'
    ? 'author_id,text'
    : 'author_id'
  const expansions = campaign.engagement_type === 'post_copypasta'
    ? ''
    : '&expansions=referenced_tweets'

  const xApiUrl = `https://api.x.com/2/tweets/${userTweetId}?tweet.fields=${fields}${expansions}`

  const xRes = await fetch(xApiUrl, {
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  })

  if (!xRes.ok) {
    const errText = await xRes.text()
    console.error('X API error:', xRes.status, errText)
    if (xRes.status === 404) {
      return NextResponse.json({ error: 'tweet not found. is it public?' }, { status: 400 })
    }
    return NextResponse.json({ error: 'x api verification failed' }, { status: 502 })
  }

  const xData = await xRes.json()
  const tweet = xData.data

  if (!tweet) {
    return NextResponse.json({ error: 'tweet not found' }, { status: 400 })
  }

  if (tweet.author_id !== linkedXUserId) {
    return NextResponse.json({ error: 'dat tweet not from ur linked x account' }, { status: 403 })
  }

  // Verify by engagement type
  if (campaign.engagement_type === 'post_copypasta') {
    if (!campaign.required_text) {
      return NextResponse.json({ error: 'campaign misconfigured' }, { status: 500 })
    }
    if (!textsMatch(tweet.text, campaign.required_text)) {
      return NextResponse.json({ error: 'tweet text doesnt match da copypasta. post da exact text, no changes' }, { status: 400 })
    }
  } else {
    const refs = tweet.referenced_tweets || []

    if (campaign.engagement_type === 'quote_repost') {
      const quotedRef = refs.find((r: { type: string; id: string }) => r.type === 'quoted' && r.id === campaign.target_tweet_id)
      if (!quotedRef) {
        return NextResponse.json({ error: 'dis tweet doesnt quote repost da target tweet' }, { status: 400 })
      }
    } else if (campaign.engagement_type === 'reply') {
      const replyRef = refs.find((r: { type: string; id: string }) => r.type === 'replied_to' && r.id === campaign.target_tweet_id)
      if (!replyRef) {
        return NextResponse.json({ error: 'dis tweet doesnt reply 2 da target tweet' }, { status: 400 })
      }
    }
  }

  const { error: insertError } = await supabase
    .from('iq_task_completions')
    .insert({
      wallet_address: walletLower,
      task_type: taskType,
      iq_awarded: campaign.iq_reward,
      metadata: {
        campaign_id: campaign.id,
        tweet_id: userTweetId,
        tweet_url,
        engagement_type: campaign.engagement_type,
      },
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'already claimed' }, { status: 409 })
    }
    console.error('insert error:', insertError)
    return NextResponse.json({ error: 'verification failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, iq_awarded: campaign.iq_reward })
}
