import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import merkleData from './merkle-data.json'

const PHASES = [
  {
    id: 'phase1_gtd',
    name: 'GTD (Guaranteed)',
    dropStageIndex: 1,
    startTime: 1778252400,
    endTime: 1778471940,
  },
  {
    id: 'phase2_community',
    name: 'Community',
    dropStageIndex: 2,
    startTime: 1778271600,
    endTime: 1778471940,
  },
  {
    id: 'phase3_fcfs',
    name: 'FCFS',
    dropStageIndex: 3,
    startTime: 1778288400,
    endTime: 1778471940,
  },
]

type ProofEntry = {
  proof: string[]
  mintParams: {
    mintPrice: string
    maxTotalMintableByWallet: string
    startTime: string
    endTime: string
    dropStageIndex: string
    maxTokenSupplyForStage: string
    feeBps: string
    restrictFeeRecipients: boolean
  }
}

type MerklePhase = {
  root: string
  config: { name: string; dropStageIndex: number }
  proofs: Record<string, ProofEntry>
}

const MERKLE_DATA = merkleData as Record<string, MerklePhase>

function getActivePhase(): typeof PHASES[number] | null {
  const now = Math.floor(Date.now() / 1000)
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (now >= PHASES[i].startTime && now <= PHASES[i].endTime) {
      return PHASES[i]
    }
  }
  return null
}

function getNextPhase(): typeof PHASES[number] | null {
  const now = Math.floor(Date.now() / 1000)
  for (const phase of PHASES) {
    if (now < phase.startTime) return phase
  }
  return null
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  const checksummed = getAddress(address)
  const activePhase = getActivePhase()

  const eligiblePhases: string[] = []
  for (const phase of PHASES) {
    const data = MERKLE_DATA[phase.id]
    if (data?.proofs[checksummed]) {
      eligiblePhases.push(phase.name)
    }
  }

  if (!activePhase) {
    const next = getNextPhase()
    if (next) {
      return NextResponse.json({
        eligible: false,
        phase: next.name,
        mintOpen: false,
        startTime: next.startTime,
        eligiblePhases,
      })
    }
    return NextResponse.json({ eligible: false, phase: 'Mint Ended', mintOpen: false, eligiblePhases })
  }

  const phaseData = MERKLE_DATA[activePhase.id]

  if (!phaseData) {
    return NextResponse.json({
      eligible: false,
      phase: activePhase.name,
      mintOpen: true,
      eligiblePhases,
    })
  }

  const entry = phaseData.proofs[checksummed]

  if (!entry) {
    return NextResponse.json({
      eligible: false,
      phase: activePhase.name,
      mintOpen: true,
      eligiblePhases,
    })
  }

  return NextResponse.json({
    eligible: true,
    phase: activePhase.name,
    mintOpen: true,
    proof: entry.proof,
    mintParams: entry.mintParams,
    eligiblePhases,
  })
}
