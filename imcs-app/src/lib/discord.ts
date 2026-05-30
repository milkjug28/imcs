const DISCORD_API = 'https://discord.com/api/v10'

export type DiscordUser = {
  id: string
  username: string
  avatar: string | null
  discriminator: string
}

export type Tier = {
  name: string
  roleEnvKey: string
  minCount: number
}

export const TIERS: Tier[] = [
  { name: 'simpul sabant', roleEnvKey: 'SIMPUL_SABANT', minCount: 1 },
  { name: 'reel sabant', roleEnvKey: 'REEL_SABANT', minCount: 2 },
  { name: 'supa savants', roleEnvKey: 'SUPA_SAVANTS', minCount: 6 },
  { name: 'ched savant', roleEnvKey: 'CHED_SAVANT', minCount: 25 },
  { name: 'absulut ched savanat', roleEnvKey: 'ABSULUT_CHED_SAVANAT', minCount: 51 },
]

export function getTiersForCount(count: number): Tier[] {
  return TIERS.filter(t => count >= t.minCount)
}

export function getRoleIds(tiers: Tier[]): string[] {
  return tiers
    .map(t => process.env[t.roleEnvKey])
    .filter((id): id is string => !!id)
}

export function getAllRoleIds(): string[] {
  return TIERS
    .map(t => process.env[t.roleEnvKey])
    .filter((id): id is string => !!id)
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ access_token: string }> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord OAuth failed: ${text}`)
  }
  return res.json()
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Discord user')
  return res.json()
}

export async function addRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => '')
    console.error(`[discord] addRole FAILED: user=${userId} role=${roleId} status=${res.status} body=${body}`)
    return false
  }
  return true
}

export async function removeRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  })
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => '')
    console.error(`[discord] removeRole FAILED: user=${userId} role=${roleId} status=${res.status} body=${body}`)
    return false
  }
  return true
}

export async function assignTierRoles(guildId: string, userId: string, tokenCount: number): Promise<{ assigned: string[]; failed: string[] }> {
  const earned = getTiersForCount(tokenCount)
  const earnedRoleIds = getRoleIds(earned)
  const allRoleIds = getAllRoleIds()

  if (allRoleIds.length === 0) {
    console.error('[discord] assignTierRoles: NO role IDs resolved from env vars. Check SIMPUL_SABANT, REEL_SABANT, etc.')
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('[discord] assignTierRoles: DISCORD_BOT_TOKEN not set')
  }

  const assigned: string[] = []
  const failed: string[] = []

  for (const roleId of allRoleIds) {
    if (earnedRoleIds.includes(roleId)) {
      const ok = await addRole(guildId, userId, roleId)
      if (ok) {
        assigned.push(roleId)
      } else {
        failed.push(roleId)
      }
    } else {
      await removeRole(guildId, userId, roleId)
    }
  }

  if (failed.length > 0) {
    console.error(`[discord] assignTierRoles: ${failed.length}/${earnedRoleIds.length} role assignments failed for user=${userId}`)
  }

  console.log(`[discord] assignTierRoles: user=${userId} tokens=${tokenCount} assigned=${assigned.length} failed=${failed.length} earnedRoles=${earnedRoleIds.length} totalConfigured=${allRoleIds.length}`)

  return { assigned, failed }
}
