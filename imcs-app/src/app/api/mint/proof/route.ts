import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'

const MERKLE_DATA: Record<string, {
  root: string
  config: { name: string; dropStageIndex: number }
  proofs: Record<string, {
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
  }>
}> = {
  phase1_gtd: {
    root: "0xb7e03fb12d3cb2b841ad1a701667ae6bbe8791f54e29b8683611143b92a17261",
    config: { name: "GTD (Guaranteed)", dropStageIndex: 1 },
    proofs: {
      "0x87a2ECbfA6481dcF91a5e6f1A2dE0B7D4CF5Ba39": {
        proof: ["0x7e59991cbd9bc7cfd69ab3843c637749c0e46d72ffa336a00c5e9955676e390d"],
        mintParams: { mintPrice: "0", maxTotalMintableByWallet: "1", startTime: "1777948480", endTime: "1780540480", dropStageIndex: "1", maxTokenSupplyForStage: "3000", feeBps: "0", restrictFeeRecipients: true }
      },
      "0x8978a5536f4388024493E8C62739C697745ac447": {
        proof: ["0x606a641df08fd6eb40915b837b6d861b7cf9e5405f5a7a7708b38c653f2711aa"],
        mintParams: { mintPrice: "0", maxTotalMintableByWallet: "1", startTime: "1777948480", endTime: "1780540480", dropStageIndex: "1", maxTokenSupplyForStage: "3000", feeBps: "0", restrictFeeRecipients: true }
      }
    }
  },
  phase2_community: {
    root: "0xdb9716ff10e456a1f671ab0434f267d367e1c9ea31795ff89e7a4d9ad3d91d33",
    config: { name: "Community", dropStageIndex: 2 },
    proofs: {
      "0x87a2ECbfA6481dcF91a5e6f1A2dE0B7D4CF5Ba39": {
        proof: ["0x783f95d340eeaceeea8ed810448dd3fe54526e9fe46b86bec1fcfa20f9134cf9"],
        mintParams: { mintPrice: "0", maxTotalMintableByWallet: "1", startTime: "1777948480", endTime: "1780540480", dropStageIndex: "2", maxTokenSupplyForStage: "3000", feeBps: "0", restrictFeeRecipients: true }
      },
      "0x8978a5536f4388024493E8C62739C697745ac447": {
        proof: ["0x17912477d65e58cc43851f22554427b1f8356a393a435f374a128a683cdbe77e"],
        mintParams: { mintPrice: "0", maxTotalMintableByWallet: "1", startTime: "1777948480", endTime: "1780540480", dropStageIndex: "2", maxTokenSupplyForStage: "3000", feeBps: "0", restrictFeeRecipients: true }
      }
    }
  },
  phase3_fcfs: {
    root: "0x8d972d3a9452da398283b7ab9c7c0154acedcc059400d2cec5b903880f2f3af9",
    config: { name: "FCFS", dropStageIndex: 3 },
    proofs: {
      "0x87a2ECbfA6481dcF91a5e6f1A2dE0B7D4CF5Ba39": {
        proof: ["0x8c87c8ab04eb8cb67655cb9311644105dca0a5f90362806384e7559fc4d34406"],
        mintParams: { mintPrice: "0", maxTotalMintableByWallet: "1", startTime: "1777948480", endTime: "1780540480", dropStageIndex: "3", maxTokenSupplyForStage: "3000", feeBps: "0", restrictFeeRecipients: true }
      },
      "0x8978a5536f4388024493E8C62739C697745ac447": {
        proof: ["0xa7461fa721053b3b42a92158a4923dad709b9cb815466fb25edc734cf875d098"],
        mintParams: { mintPrice: "0", maxTotalMintableByWallet: "1", startTime: "1777948480", endTime: "1780540480", dropStageIndex: "3", maxTokenSupplyForStage: "3000", feeBps: "0", restrictFeeRecipients: true }
      }
    }
  }
}

const ACTIVE_PHASE = 'phase1_gtd'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  const checksummed = getAddress(address)
  const phase = MERKLE_DATA[ACTIVE_PHASE]

  if (!phase) {
    return NextResponse.json({ error: 'No active phase' }, { status: 404 })
  }

  const entry = phase.proofs[checksummed]

  if (!entry) {
    return NextResponse.json({
      eligible: false,
      phase: phase.config.name,
    })
  }

  return NextResponse.json({
    eligible: true,
    phase: phase.config.name,
    proof: entry.proof,
    mintParams: entry.mintParams,
  })
}
