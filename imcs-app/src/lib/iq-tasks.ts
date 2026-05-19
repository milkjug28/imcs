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
    target_tweet_url?: string
    intent_url?: string
    engagement_type: 'quote_repost' | 'reply' | 'post_copypasta'
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
  target_tweet_id: string | null
  target_tweet_url: string | null
  engagement_type: 'quote_repost' | 'reply' | 'post_copypasta'
  required_text: string | null
  iq_reward: number
  active: boolean
  created_at: string
  expires_at: string | null
}

export function campaignToTask(campaign: EngagementCampaign): IQTaskDefinition {
  const typeLabels = {
    quote_repost: 'quote repost dis tweet',
    reply: 'reply 2 dis tweet',
    post_copypasta: 'post da copypasta',
  }

  const icons = {
    quote_repost: '🔁',
    reply: '💬',
    post_copypasta: '📜',
  }

  let intentUrl: string | undefined
  if (campaign.engagement_type === 'post_copypasta' && campaign.required_text) {
    const cleaned = campaign.required_text
      .replace(/\r/g, '')
      .replace(/\n\n/g, '<<BREAK>>')
      .replace(/\n/g, ' ')
      .replace(/<<BREAK>>/g, '\n\n')
      .replace(/ {2,}/g, ' ')
      .trim()
    intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(cleaned)}`
  }

  return {
    id: `engagement_${campaign.id}`,
    name: campaign.name,
    description: campaign.description,
    iq_reward: campaign.iq_reward,
    icon: icons[campaign.engagement_type],
    action_label: typeLabels[campaign.engagement_type],
    action_type: 'verify_engagement',
    engagement: {
      campaign_id: campaign.id,
      target_tweet_url: campaign.target_tweet_url || undefined,
      intent_url: intentUrl,
      engagement_type: campaign.engagement_type,
    },
  }
}
