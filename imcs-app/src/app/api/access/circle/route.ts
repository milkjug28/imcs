import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST: Record circle attempt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ip, success, score } = body

    if (!ip) {
      return NextResponse.json(
        { error: 'IP required' },
        { status: 400 }
      )
    }

    // Record attempt
    await supabase
      .from('access_attempts')
      .insert({
        ip_address: ip,
        attempt_type: 'circle',
        success,
        score,
      })

    // Count failed attempts
    const { count } = await supabase
      .from('access_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .eq('attempt_type', 'circle')
      .eq('success', false)

    return NextResponse.json({
      success: true,
      failedAttempts: count || 0,
    })
  } catch (error) {
    console.error('Circle attempt error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}

// GET: Get failed attempts count
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const ip = searchParams.get('ip')

    if (!ip) {
      return NextResponse.json(
        { error: 'IP required' },
        { status: 400 }
      )
    }

    const { count } = await supabase
      .from('access_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ip)
      .eq('attempt_type', 'circle')
      .eq('success', false)

    return NextResponse.json({
      failedAttempts: count || 0,
    })
  } catch (error) {
    console.error('Get circle attempts error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
