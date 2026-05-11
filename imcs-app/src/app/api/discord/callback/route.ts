import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, getDiscordUser } from '@/lib/discord'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')

    if (!code) {
      return NextResponse.redirect(`${SITE_URL}/sitee/verify?error=no_code`)
    }

    const storedState = (await cookies()).get('discord_oauth_state')?.value
    if (!state || state !== storedState) {
      return NextResponse.redirect(`${SITE_URL}/sitee/verify?error=invalid_state`)
    }

    const redirectUri = `${SITE_URL}/api/discord/callback`
    const tokenData = await exchangeCode(code, redirectUri)
    const user = await getDiscordUser(tokenData.access_token)

    const cookieStore = await cookies()

    cookieStore.set('discord_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 min - just long enough to complete verification
      path: '/',
    })

    cookieStore.delete('discord_oauth_state')

    const params = new URLSearchParams({
      linked: 'true',
      discord_user: user.username,
      discord_id: user.id,
    })

    return NextResponse.redirect(`${SITE_URL}/sitee/verify?${params}`)
  } catch (err) {
    console.error('Discord callback error:', err)
    return NextResponse.redirect(`${SITE_URL}/sitee/verify?error=oauth_failed`)
  }
}
