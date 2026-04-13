/**
 * Utility functions for IMCS app
 */

// Circle drawing accuracy calculation
export type Point = { x: number; y: number }

export function calculateCircleAccuracy(points: Point[]): number {
  if (points.length < 10) return 0 // Need minimum points

  // Find center (average x, average y)
  const center = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length
  }

  // Calculate distances from center
  const distances = points.map(p =>
    Math.sqrt(Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2))
  )

  // Average radius
  const avgRadius = distances.reduce((a, b) => a + b) / distances.length

  // Standard deviation of distances
  const variance = distances.reduce((sum, d) =>
    sum + Math.pow(d - avgRadius, 2), 0
  ) / distances.length
  const stdDev = Math.sqrt(variance)

  // Circle score (lower stdDev relative to radius = better circle)
  const score = 1 - (stdDev / avgRadius)

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, score))
}

// Typing test WPM calculation
export function calculateWPM(charactersTyped: number, timeInSeconds: number): number {
  if (timeInSeconds === 0) return 0
  const words = charactersTyped / 5 // Standard: 5 characters = 1 word
  const minutes = timeInSeconds / 60
  return Math.round(words / minutes)
}

// Get client IP (for server-side)
export function getClientIP(request: Request): string {
  // Try various headers that proxies/CDNs might set
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return '0.0.0.0' // Fallback
}

// Truncate wallet address for display
export function truncateAddress(address: string, startLength = 6, endLength = 4): string {
  if (address.length <= startLength + endLength) return address
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

// Validate Ethereum address
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Random array element
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

// Savant messages based on score
export function getWhitelistMessage(score: number): string {
  if (score >= 1000) {
    return "CONGRAAAATS U AR SAVANT!!! 🎉🚀✨"
  } else if (score >= 500) {
    return "ur almost there dummie, need sum magic ✨"
  } else if (score >= 100) {
    return "u just startin, use ur imaginashun 🧠"
  } else if (score === 0) {
    return "do u even kno how 2 imaginate? 🤨"
  } else {
    return "lmaooo u got negative points, ngmi 💀"
  }
}

// Random vote response
export function getVoteResponse(): string {
  const responses = [
    "ur opinyun noted",
    "thx i gess",
    "ok",
    "cool story bro",
    "wow such vote",
    "ur a savant voter",
    "imaginashun activated"
  ]
  return randomElement(responses)
}

// Random circle fail message
export function getCircleFailMessage(): string {
  const messages = [
    "dat not a circle dummie, try agen",
    "bruh... that's not even close",
    "did u even try?",
    "my grandma draws better circles",
    "use ur imaginashun!!!",
    "are u serious rn?",
    "that's a potato not a circle"
  ]
  return randomElement(messages)
}

// Circle success message
export function getCircleSuccessMessage(): string {
  const messages = [
    "wow ur actualy smart (for once)",
    "ok u can draw, big deal",
    "not bad dummie",
    "ur a circle savant now",
    "finally, jeez"
  ]
  return randomElement(messages)
}

// Typing test messages
export function getTypingFailMessage(): string {
  return "u type liek boomer, go faster 🐌"
}

export function getTypingSuccessMessage(): string {
  const messages = [
    "ok u can type, big deal",
    "wow so fast, r u hacker now?",
    "not bad for a boomer",
    "ur fingers work, congraaaats"
  ]
  return randomElement(messages)
}

// Already voted message
export function getAlreadyVotedMessage(): string {
  const messages = [
    "u alredy voted on dis one, dummy",
    "nice try, u voted already",
    "no double voting dork",
    "ur vote already counted genius"
  ]
  return randomElement(messages)
}

// No profile found message
export function getNoProfileMessage(): string {
  return "ur wallet not savant yet. submit form first, nerd"
}

// Get IP from client side (using third-party service)
export async function getClientIPClient(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch {
    return '0.0.0.0'
  }
}

// Shuffle array (Fisher-Yates)
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// Format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Get random pastel color for circle drawing
export function getRandomPastelColor(): string {
  const colors = [
    '#FFB3BA', // Pink
    '#BAFFC9', // Green
    '#BAE1FF', // Blue
    '#FFFFBA', // Yellow
    '#E0BBE4', // Purple
    '#FFDAB9', // Peach
  ]
  return randomElement(colors)
}

// Confetti celebration
export async function celebrateWhitelist() {
  const confetti = (await import('canvas-confetti')).default

  const duration = 3000
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#ff00ff', '#ffff00', '#00ff00', '#00bfff']
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#ff00ff', '#ffff00', '#00ff00', '#00bfff']
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  frame()
}

// Vote weight calculator
export function calculateVoteWeight(hasWallet: boolean): number {
  // Wallet-connected vote = 100
  // IP-only vote = 16.7 (1/6 of 100)
  return hasWallet ? 100 : 16.7
}

// Check if whitelist eligible based on score
export function isWhitelistEligible(score: number): boolean {
  return score >= 1000
}

// Sanitize user input (prevent XSS)
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// Validate submission text (not empty, reasonable length)
export function validateSubmissionText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'u gotta write sumthin dummie' }
  }

  if (text.length < 10) {
    return { valid: false, error: 'write more than that, be creative' }
  }

  if (text.length > 500) {
    return { valid: false, error: 'thats 2 long bro, keep it short' }
  }

  return { valid: true }
}

// Normalize X/Twitter handle (strip @, lowercase, trim)
export function normalizeXHandle(handle: string): string {
  return handle.replace(/^@/, '').trim().toLowerCase()
}

// Validate X/Twitter handle (after normalization)
export function validateXHandle(handle: string): { valid: boolean; error?: string } {
  if (!handle || handle.length === 0) {
    return { valid: false, error: 'who u banishin dummie?' }
  }
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) {
    return { valid: false, error: 'thats not a real x handle' }
  }
  return { valid: true }
}

// Validate name
export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'u need a name dork' }
  }

  if (name.length > 50) {
    return { valid: false, error: 'name 2 long' }
  }

  return { valid: true }
}
