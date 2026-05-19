export type IQTaskDefinition = {
  id: string
  name: string
  description: string
  iq_reward: number
  icon: string
  action_label: string
  action_type: 'oauth_x' | 'link_discord' | 'external_link' | 'verify_engagement'
  claimable_label?: string
  engagement?: {
    campaign_id: string
    target_tweet_url: string
    engagement_type: 'quote_repost' | 'reply'
  }
}

export const IQ_TASKS: IQTaskDefinition[] = [
  {
    id: 'link_x',
    name: 'link ur x account',
    description: 'connect ur x/twitter 2 ur wallet. proves u r real (maybe)',
    iq_reward: 5,
    icon: '𝕏',
    action_label: 'link x account',
    action_type: 'oauth_x',
  },
  {
    id: 'link_discord',
    name: 'link ur discrod',
    description: 'connect ur discrod 2 ur wallet. join da savant cult',
    iq_reward: 5,
    icon: '💬',
    action_label: 'link discrod',
    action_type: 'link_discord',
    claimable_label: 'claim +5 iq',
  },
]

export type EngagementCampaign = {
  id: string
  name: string
  description: string
  target_tweet_id: string
  target_tweet_url: string
  engagement_type: 'quote_repost' | 'reply'
  iq_reward: number
  active: boolean
  created_at: string
  expires_at: string | null
}

export function campaignToTask(campaign: EngagementCampaign): IQTaskDefinition {
  const typeLabel = campaign.engagement_type === 'quote_repost' ? 'quote repost' : 'reply 2'
  return {
    id: `engagement_${campaign.id}`,
    name: campaign.name,
    description: campaign.description,
    iq_reward: campaign.iq_reward,
    icon: '🔁',
    action_label: `${typeLabel} dis tweet`,
    action_type: 'verify_engagement',
    engagement: {
      campaign_id: campaign.id,
      target_tweet_url: campaign.target_tweet_url,
      engagement_type: campaign.engagement_type,
    },
  }
}
