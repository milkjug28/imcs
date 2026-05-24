import { NextResponse } from 'next/server'
import { traits, SLOT_NAMES, REQUIRED_SLOTS } from '@/lib/trait-data'

export async function GET() {
  return NextResponse.json({
    traits,
    slotNames: SLOT_NAMES,
    requiredSlots: [...REQUIRED_SLOTS],
  })
}
