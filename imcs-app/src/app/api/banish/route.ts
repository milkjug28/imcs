import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isValidAddress, sanitizeInput, normalizeXHandle, validateXHandle } from '@/lib/utils'
import { rateLimit, getRequestIP } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIP(request)

    // Rate limit: 5 banishments per minute per IP
    const rateLimitResult = rateLimit(`banish:${ip}`, { limit: 5, windowMs: 60_000 })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'slow down dummie, too many banishments' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimitResult.retryAfter) },
        }
      )
    }

    const body = await request.json()
    const { submitter_wallet, target_x_handle, target_wallet_address, reason } = body

    // Validate submitter wallet
    if (!submitter_wallet || !isValidAddress(submitter_wallet)) {
      return NextResponse.json(
        { error: 'connect ur wallut first dummie' },
        { status: 400 }
      )
    }
    const submitterWallet = submitter_wallet.toLowerCase()

    // Validate and normalize X handle
    if (!target_x_handle) {
      return NextResponse.json(
        { error: 'who u banishin dummie?' },
        { status: 400 }
      )
    }
    const normalizedHandle = normalizeXHandle(target_x_handle)
    const handleValidation = validateXHandle(normalizedHandle)
    if (!handleValidation.valid) {
      return NextResponse.json(
        { error: handleValidation.error },
        { status: 400 }
      )
    }

    // Validate reason
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'give a real reason (5+ chars)' },
        { status: 400 }
      )
    }
    if (reason.trim().length > 500) {
      return NextResponse.json(
        { error: 'reason 2 long bro, keep it under 500' },
        { status: 400 }
      )
    }
    const sanitizedReason = sanitizeInput(reason.trim())

    // Validate target wallet (optional)
    let targetWallet: string | null = null
    if (target_wallet_address && target_wallet_address.trim()) {
      if (!isValidAddress(target_wallet_address)) {
        return NextResponse.json(
          { error: 'thats not a valid wallet address' },
          { status: 400 }
        )
      }
      targetWallet = target_wallet_address.toLowerCase()

      // Prevent self-banishment
      if (targetWallet === submitterWallet) {
        return NextResponse.json(
          { error: 'u cant banish urself lmao' },
          { status: 400 }
        )
      }
    }

    // Insert banishment
    const { data: banishment, error: insertError } = await supabase
      .from('banishments')
      .insert({
        target_x_handle: normalizedHandle,
        target_wallet_address: targetWallet,
        reason: sanitizedReason,
        submitter_wallet: submitterWallet,
        ip_address: ip,
      })
      .select()
      .single()

    if (insertError) {
      // Unique constraint violation - already banished this handle
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'u already banished dis person, chill' },
          { status: 400 }
        )
      }
      console.error('Banish insert error:', insertError)
      return NextResponse.json(
        { error: 'sumthin went wrong, try agen' },
        { status: 500 }
      )
    }

    // Check if this is NOT the first submission for this handle (for points)
    let pointsAwarded = 0
    let pointsRecipient: string | null = null

    const { data: firstSubmitter } = await supabase
      .from('banishments')
      .select('submitter_wallet')
      .eq('target_x_handle', normalizedHandle)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (firstSubmitter && firstSubmitter.submitter_wallet !== submitterWallet) {
      // Award 250 points to the original submitter
      const originatorWallet = firstSubmitter.submitter_wallet

      const { data: existing, error: lookupError } = await supabase
        .from('task_completions')
        .select('*')
        .eq('wallet_address', originatorWallet)
        .eq('task_type', 'banish')
        .single()

      if (lookupError && lookupError.code !== 'PGRST116') {
        console.error('Task lookup error:', lookupError)
      }

      if (existing) {
        await supabase
          .from('task_completions')
          .update({
            score: existing.score + 250,
            completion_count: (existing.completion_count || 1) + 1,
            completed_at: new Date().toISOString(),
          })
          .eq('wallet_address', originatorWallet)
          .eq('task_type', 'banish')
      } else {
        await supabase
          .from('task_completions')
          .insert({
            wallet_address: originatorWallet,
            task_type: 'banish',
            score: 250,
            completion_count: 1,
          })
      }

      pointsAwarded = 250
      pointsRecipient = originatorWallet
    }

    // Get total submission count for this handle
    const { count } = await supabase
      .from('banishments')
      .select('*', { count: 'exact', head: true })
      .eq('target_x_handle', normalizedHandle)

    return NextResponse.json({
      success: true,
      message: 'banished! 🔨',
      banishment,
      total_submissions: count,
      points_awarded: pointsAwarded,
      points_recipient: pointsRecipient,
    })
  } catch (error) {
    console.error('Banish error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong, try agen' },
      { status: 500 }
    )
  }
}
