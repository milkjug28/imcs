import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isValidAddress, validateName, validateSubmissionText } from '@/lib/utils'

// Helper to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP

  return '0.0.0.0'
}

// Helper to generate referral code
function generateReferralCode(walletAddress: string): string {
  // Take last 6 chars of wallet + random 4 chars
  const walletPart = walletAddress.slice(-6)
  const randomPart = Math.random().toString(36).substring(2, 6)
  return `${walletPart}${randomPart}`.toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet_address, name, info, referrer_code } = body

    // Validation
    if (!wallet_address || !isValidAddress(wallet_address)) {
      return NextResponse.json(
        { error: 'invalid wallet address dummie' },
        { status: 400 }
      )
    }

    const nameValidation = validateName(name)
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      )
    }

    const infoValidation = validateSubmissionText(info)
    if (!infoValidation.valid) {
      return NextResponse.json(
        { error: infoValidation.error },
        { status: 400 }
      )
    }

    // Check if wallet already submitted
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('wallet_address', wallet_address)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'u alredy submitted dork, only one per wallet' },
        { status: 400 }
      )
    }

    // Get client IP
    const ip = getClientIP(request)

    // Generate unique referral code
    const newReferralCode = generateReferralCode(wallet_address)

    // Insert into Supabase
    const { data: submission, error: supabaseError } = await supabase
      .from('submissions')
      .insert({
        wallet_address: wallet_address.toLowerCase(),
        name: name.trim(),
        info: info.trim(),
        ip_address: ip,
        referrer_code: newReferralCode,
      })
      .select()
      .single()

    if (supabaseError) {
      console.error('Supabase error:', supabaseError)
      return NextResponse.json(
        { error: 'failed to save submission' },
        { status: 500 }
      )
    }

    // If referrer code provided, apply referral bonus
    if (referrer_code) {
      try {
        await supabase.rpc('apply_referral_bonus', {
          ref_code: referrer_code,
          referred_wallet: wallet_address.toLowerCase(),
        })
      } catch (err) {
        // Referral failed, but submission succeeded - that's ok
        console.error('Referral bonus failed:', err)
      }
    }

    // Also submit to Google Sheets (backup)
    const googleScriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL
    if (googleScriptUrl) {
      try {
        await fetch(googleScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address,
            name,
            info,
            timestamp: new Date().toISOString(),
          }),
        })
      } catch (err) {
        // Google Sheets backup failed - not critical
        console.error('Google Sheets backup failed:', err)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ur submission saved! now let others vote on it 🎉',
      submission,
      referrer_code: newReferralCode,
    })
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong, try agen' },
      { status: 500 }
    )
  }
}
