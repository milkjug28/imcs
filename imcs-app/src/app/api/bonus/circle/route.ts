import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Add bonus points from circle test to existing submission
 * POST /api/bonus/circle
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet_address, bonus_points, accuracy } = body

    // Validation
    if (!wallet_address || !bonus_points) {
      return NextResponse.json(
        { error: 'missing wallet_address or bonus_points' },
        { status: 400 }
      )
    }

    // Check if wallet exists
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('id, score, wallet_address')
      .eq('wallet_address', wallet_address.toLowerCase())
      .single()

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: 'wallet not found. u need 2 fell owt forhm first!' },
        { status: 404 }
      )
    }

    // Add bonus points to existing score
    const newScore = submission.score + bonus_points

    const { error: updateError } = await supabase
      .from('submissions')
      .update({ score: newScore })
      .eq('id', submission.id)

    if (updateError) {
      console.error('Error updating score:', updateError)
      return NextResponse.json(
        { error: 'failed to add bonus points' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `added ${bonus_points} bonus points! new score: ${newScore}`,
      old_score: submission.score,
      bonus_points,
      new_score: newScore,
      accuracy
    })
  } catch (error) {
    console.error('Bonus circle error:', error)
    return NextResponse.json(
      { error: 'sumthin went wrong' },
      { status: 500 }
    )
  }
}
