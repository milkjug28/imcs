import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * X OAuth 2.0 PKCE Authorization
 * Redirects user to X to authorize, then X sends them back to our callback.
 */
export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase()

    if (!wallet) {
      return NextResponse.json({ error: 'wallet required' }, { status: 400 })
    }

    const clientId = process.env.X_CLIENT_ID!
    const redirectUri = `${request.nextUrl.origin}/api/auth/x/callback`

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')

    // Generate state to prevent CSRF (includes wallet address)
    const state = Buffer.from(JSON.stringify({
      wallet,
      nonce: crypto.randomBytes(16).toString('hex'),
    })).toString('base64url')

    // Build X OAuth 2.0 authorization URL
    const authUrl = new URL('https://x.com/i/oauth2/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    // Store code_verifier in a cookie (needed for token exchange)
    const response = NextResponse.redirect(authUrl.toString())
    response.cookies.set('x_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })
    response.cookies.set('x_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('X OAuth init error:', error)
    return NextResponse.json({ error: 'failed to start X auth' }, { status: 500 })
  }
}
