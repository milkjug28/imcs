import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Community claims are closed' }, { status: 403 })
}
