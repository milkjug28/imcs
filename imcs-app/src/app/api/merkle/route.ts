import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

const PHASES = ['gtd', 'community', 'fcfs'] as const

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')?.toLowerCase()
  const phase = request.nextUrl.searchParams.get('phase')

  if (!wallet || !phase) {
    return NextResponse.json(
      { error: 'wallet and phase params required' },
      { status: 400 }
    )
  }

  if (!PHASES.includes(phase as typeof PHASES[number])) {
    return NextResponse.json(
      { error: 'phase must be gtd, community, or fcfs' },
      { status: 400 }
    )
  }

  const proofsPath = path.resolve(process.cwd(), `${phase}-proofs.json`)
  const treePath = path.resolve(process.cwd(), `${phase}-tree.json`)

  if (!fs.existsSync(proofsPath) || !fs.existsSync(treePath)) {
    return NextResponse.json(
      { error: `${phase} merkle data not generated yet` },
      { status: 404 }
    )
  }

  const proofs = JSON.parse(fs.readFileSync(proofsPath, 'utf8'))
  const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'))

  const proof = proofs[wallet]
  const root = tree.tree?.[0] || null

  return NextResponse.json({
    wallet,
    phase,
    root,
    proof: proof || null,
    eligible: !!proof,
  })
}
