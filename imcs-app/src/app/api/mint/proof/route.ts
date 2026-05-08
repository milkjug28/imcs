import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'

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

const MERKLE_DATA: Record<string, {
  root: string
  config: { name: string; dropStageIndex: number }
  proofs: Record<string, ProofEntry>
}> = {
  phase0_dev: {
    root: "0xfc7988dc89013643b2e8d23628fc30f753e3e23b80fd14fb281474757834eb12",
    config: { name: "Dev Mint", dropStageIndex: 0 },
    proofs: {
      "0x6878144669e7E558737FEB3820410174CEef04e6": {
        proof: [],
        mintParams: { mintPrice: "0", maxTotalMintableByWallet: "128", startTime: "1778245200", endTime: "1778471940", dropStageIndex: "0", maxTokenSupplyForStage: "3000", feeBps: "0", restrictFeeRecipients: true }
      }
    }
  },
}

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

  if (!activePhase) {
    const next = getNextPhase()
    if (next) {
      return NextResponse.json({
        eligible: false,
        phase: next.name,
        mintOpen: false,
        startTime: next.startTime,
      })
    }
    return NextResponse.json({ eligible: false, phase: 'Mint Ended', mintOpen: false })
  }

  const phaseData = MERKLE_DATA[activePhase.id]

  if (!phaseData) {
    return NextResponse.json({
      eligible: false,
      phase: activePhase.name,
      mintOpen: true,
    })
  }

  const entry = phaseData.proofs[checksummed]

  if (!entry) {
    return NextResponse.json({
      eligible: false,
      phase: activePhase.name,
      mintOpen: true,
    })
  }

  return NextResponse.json({
    eligible: true,
    phase: activePhase.name,
    mintOpen: true,
    proof: entry.proof,
    mintParams: entry.mintParams,
  })
}
