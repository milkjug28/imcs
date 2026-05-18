export type IQTaskDefinition = {
  id: string
  name: string
  description: string
  iq_reward: number
  icon: string
  action_label: string
  action_type: 'oauth_x' | 'external_link'
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
]
