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
  return res.ok || res.status === 204
}

export async function removeRole(guildId: string, userId: string, roleId: string): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
  })
  return res.ok || res.status === 204
}

export async function assignTierRoles(guildId: string, userId: string, tokenCount: number): Promise<string[]> {
  const earned = getTiersForCount(tokenCount)
  const earnedRoleIds = getRoleIds(earned)
  const allRoleIds = getAllRoleIds()

  const assigned: string[] = []

  for (const roleId of allRoleIds) {
    if (earnedRoleIds.includes(roleId)) {
      await addRole(guildId, userId, roleId)
      assigned.push(roleId)
    } else {
      await removeRole(guildId, userId, roleId)
    }
  }

  return assigned
}
