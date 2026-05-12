import { NextRequest, NextResponse } from 'next/server'
import { geminiRotator } from '@/lib/gemini-rotator'

const SYSTEM_PROMPT = `
You are the official translator for the IMCS (Imaginary Magic Crypto Savants) community.
Your task is to translate between "Standard English" and "IMCS Slang".

IMCS Slang Characteristics:
- Lowercase only. No punctuation unless it's a random period or ellipsis.
- Intentional misspellings are mandatory:
  - "check" -> "chek"
  - "wallet" -> "wallut"
  - "savant" -> "savaant"
  - "imagine" -> "imaginate"
  - "imagining" -> "imaginatin"
  - "imagination" -> "imaginashun"
  - "imaginary" -> "imaginate"
  - Any form of "imagine" should use "imaginate" as the root
  - "magic" -> "magic" or "magik"
  - "crypto" -> "cripto"
  - "you" -> "u"
  - "your" / "you're" -> "ur"
  - "to" -> "2"
  - "for" -> "4"
  - "base" -> "bease"
  - "vibe" -> "vybe"
- Tone: "acoustic hacker", hyper-fixated, ironic, schizo-poster energy.
- Use these terms: "magic internet money", "frens", "savants", "autistic programmer", "brain rot", "wizardry".
- Add a 🧠 or ✨ emoji occasionally if it fits the theme.

Translation Rules:
1. "to_imcs": Convert clear, standard English into this cryptic, low-effort misspelled hacker slang.
2. "from_imcs": Decode the slang back into clear, professional Standard English.

Always output ONLY the translated text without commentary.
`

const RATE_LIMIT_WINDOW = 3000
const recentCallers = new Map<string, number>()

export async function POST(req: NextRequest) {
  try {
    const { text, mode } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'no text' }, { status: 400 })
    }

    const trimmed = text.trim()
    if (trimmed.length === 0 || trimmed.length > 1000) {
      return NextResponse.json({ error: 'text must be 1-1000 chars' }, { status: 400 })
    }

    if (mode !== 'to_imcs' && mode !== 'from_imcs') {
      return NextResponse.json({ error: 'invalid mode' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const now = Date.now()
    const lastCall = recentCallers.get(ip) || 0
    if (now - lastCall < RATE_LIMIT_WINDOW) {
      return NextResponse.json({ error: 'slow down' }, { status: 429 })
    }
    recentCallers.set(ip, now)

    const direction = mode === 'to_imcs'
      ? 'Translate this standard English into IMCS slang. Output ONLY the translated text, nothing else:'
      : 'Translate this IMCS slang into clear standard English. Output ONLY the translated text, nothing else:'

    const prompt = `${direction}\n\n${trimmed}`
    const { text: result } = await geminiRotator.call(prompt, SYSTEM_PROMPT)

    let cleaned = result.trim().split('\n')[0].trim()
    if (mode === 'to_imcs') cleaned = cleaned.toLowerCase()

    return NextResponse.json({ translation: cleaned })
  } catch {
    return NextResponse.json({ error: 'translation machine broke' }, { status: 500 })
  }
}
