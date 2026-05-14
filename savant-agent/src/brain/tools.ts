export const AGENT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'check_floor_price',
        description: 'Get the current IMCS savant floor price and listing count. Use when someone asks about floor price, how much savants cost, or collection status.',
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_collection_stats',
        description: 'Get full IMCS collection stats including whales buying, jeets selling, recent sales, volume, and owner count. Use when someone asks about collection activity, who is buying/selling, or market trends for savants specifically.',
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_market_data',
        description: 'Get live crypto market prices for BTC, ETH, SOL, LINK, UNI, AAVE, LDO, ARB, OP, POL, PEPE, DOGE and ETH gas price. Use when someone asks about crypto prices, market conditions, whether something is pumping or dumping, or trading.',
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: [],
        },
      },
      {
        name: 'lookup_savant',
        description: 'Look up metadata for a specific savant by token ID. Returns name, IQ score, traits, and custom name if any. Use when someone mentions a savant number like "#1234" or "savant 42".',
        parameters: {
          type: 'OBJECT',
          properties: {
            token_id: {
              type: 'INTEGER',
              description: 'The savant token ID (1-4269)',
            },
          },
          required: ['token_id'],
        },
      },
      {
        name: 'search_by_trait',
        description: 'Find savants that have a specific trait. Use when someone asks about savants with certain traits like "which savants have gold background" or "find savants with laser eyes".',
        parameters: {
          type: 'OBJECT',
          properties: {
            trait_type: {
              type: 'STRING',
              description: 'The trait category (e.g. "Background", "Eyes", "Head")',
            },
            value: {
              type: 'STRING',
              description: 'The trait value to search for (e.g. "Gold", "Laser", "Crown")',
            },
          },
          required: ['trait_type', 'value'],
        },
      },
      {
        name: 'check_wallet_balance',
        description: 'Check your own ETH wallet balance and get your public address. Use when someone asks about your wallet, your balance, whether you can afford something, or offers to send you ETH.',
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_owned_savants',
        description: 'Get the list of savant token IDs you currently own. Use when someone asks what savants you have, how many you own, or your collection.',
        parameters: {
          type: 'OBJECT',
          properties: {},
          required: [],
        },
      },
      {
        name: 'buy_savant',
        description: 'Buy the cheapest listed savant on OpenSea. Use when asked to buy a savant. First check balance with check_wallet_balance, then call this. Pass confirm="yes_buy_floor" to execute.',
        parameters: {
          type: 'OBJECT',
          properties: {
            confirm: {
              type: 'STRING',
              description: 'Must be "yes_buy_floor" to confirm the purchase',
            },
          },
          required: ['confirm'],
        },
      },
      {
        name: 'get_user_context',
        description: 'Look up a Discord user\'s linked wallets, savant holdings, tier, and IQ balance. Use ONLY when someone asks about their own holdings, IQ, wallet, or verification status.',
        parameters: {
          type: 'OBJECT',
          properties: {
            discord_user_id: {
              type: 'STRING',
              description: 'The Discord user ID (numeric string)',
            },
          },
          required: ['discord_user_id'],
        },
      },
      {
        name: 'recall_memory',
        description: 'Search your memory for things you remember about a user or topic. Use when someone references a past conversation, when you want to personalize a response, or when you feel like you should know something about the person talking.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'What to search for in memory',
            },
            subject: {
              type: 'STRING',
              description: 'Optional: Discord user ID to filter memories about a specific person',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'save_memory',
        description: 'Remember something interesting or useful about a user or topic. Use when you learn something notable - a user preference, a funny interaction, what savants someone owns, a personality trait. Do NOT save boring or obvious things.',
        parameters: {
          type: 'OBJECT',
          properties: {
            memory_type: {
              type: 'STRING',
              description: 'Type: "user_fact" (about a person), "observation" (general), "preference" (user preference), "conversation" (notable exchange)',
            },
            content: {
              type: 'STRING',
              description: 'What to remember - be specific and concise',
            },
            subject: {
              type: 'STRING',
              description: 'Optional: Discord user ID this memory is about',
            },
          },
          required: ['memory_type', 'content'],
        },
      },
    ],
  },
]
