export function normalizeTrait(traitType: string, value: string): string {
  if (traitType === 'ayezz') {
    if (value === 'fayded-darhk' || value === 'fayded-lite') return 'fayded'
  }

  if (traitType === 'extruhs') {
    for (const suffix of [' derk', ' lyte', ' aylien', '-derk', '-lite', '-ayeliun']) {
      if (value.endsWith(suffix)) return value.slice(0, -suffix.length)
      if (value.startsWith(suffix.trim())) return value.slice(suffix.trim().length).trim()
    }
    if (value.startsWith('derk ') || value.startsWith('lyte ')) {
      return value.split(' ').slice(1).join(' ')
    }
  }

  return value
}
