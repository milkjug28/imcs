import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * X OAuth 2.0 Callback
 * X redirects here after user authorizes.
 * Exchanges code for token, fetches user info, stores X link.
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const storedState = request.cookies.get('x_oauth_state')?.value
    const codeVerifier = request.cookies.get('x_code_verifier')?.value

    // Validate state
    if (!state || !storedState || state !== storedState) {
      return NextResponse.redirect(new URL('/sitee?error=invalid_state', request.nextUrl.origin))
    }

    if (!code || !codeVerifier) {
      return NextResponse.redirect(new URL('/sitee?error=missing_code', request.nextUrl.origin))
    }

    // Decode state to get wallet
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    const wallet = stateData.wallet?.toLowerCase()

    if (!wallet) {
      return NextResponse.redirect(new URL('/sitee?error=no_wallet', request.nextUrl.origin))
    }

    // Exchange code for access token
    const clientId = process.env.X_CLIENT_ID!
    const clientSecret = process.env.X_CLIENT_SECRET!
    const redirectUri = `${request.nextUrl.origin}/api/auth/x/callback`

    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(new URL('/sitee?error=token_failed', request.nextUrl.origin))
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // Fetch user info from X
    const userRes = await fetch('https://api.x.com/2/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    })

    if (!userRes.ok) {
      console.error('User fetch failed:', await userRes.text())
      return NextResponse.redirect(new URL('/sitee?error=user_fetch_failed', request.nextUrl.origin))
    }

    const userData = await userRes.json()
    const xUsername = userData.data?.username
    const xUserId = userData.data?.id

    if (!xUsername) {
      return NextResponse.redirect(new URL('/sitee?error=no_username', request.nextUrl.origin))
    }

    // Record task completion for IQ reward
    await supabase
      .from('iq_task_completions')
      .upsert({
        wallet_address: wallet,
        task_type: 'link_x',
        iq_awarded: 5,
        metadata: { x_username: xUsername, x_user_id: xUserId },
      }, { onConflict: 'wallet_address,task_type' })

    const response = NextResponse.redirect(
      new URL(`/sitee/profil?tab=eern-iq&x_linked=true&x_username=${encodeURIComponent(xUsername)}`, request.nextUrl.origin)
    )
    response.cookies.delete('x_code_verifier')
    response.cookies.delete('x_oauth_state')

    return response
  } catch (error) {
    console.error('X OAuth callback error:', error)
    return NextResponse.redirect(new URL('/sitee?error=callback_failed', request.nextUrl.origin))
  }
}
