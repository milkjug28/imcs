# IQ Formula

## Range
- Minimum IQ: 69
- Maximum IQ: 420 (for now - may go higher post-launch)
- Starting IQ bonus cap: 150

## Formula
```
bonusIQ = floor(((points - 1017) / (maxPoints - 1017)) * 150)
startingIQ = 69 + bonusIQ
```

- `points` = player's leaderboard total_points
- `maxPoints` = highest leaderboard score at snapshot time
- Players below 1017 pts (community/FCFS holders): startingIQ = 69
- Players at threshold (1017 pts): startingIQ = 69
- Top player: startingIQ = 219

## Pre-reveal
- All tokens show IQ = 69 (minimum)
- Post-reveal: each token gets minter's mapped IQ

## Top 25 at current scores (max = 5126)

| Rank | Name | Points | Starting IQ |
|------|------|--------|-------------|
| 1 | 0xpaxi | 5126 | 219 |
| 2 | Hello | 5003 | 214 |
| 3 | AlphaVictor.eth | 4436 | 193 |
| 4 | Angel | 3892 | 173 |
| 5 | Mosamillions | 3870 | 173 |
| 10 | Big Ij | 3570 | 162 |
| 15 | Wrazzy05 | 3389 | 155 |
| 20 | Unfettered | 3278 | 151 |
| 25 | Cloud | 3175 | 147 |
| -- | Threshold (1017) | 1017 | 69 |
| -- | Community/FCFS | 0 | 69 |

## Post-mint IQ rates

### Passive
- Hold in same wallet: **+10 IQ/week**
- Floor to cap (69 -> 420) = ~35 weeks pure holding

### Trading penalties/bonuses
- **Sell: -30 IQ** (3x weekly rate)
- **Buy: +5 IQ**
- Floor is always 69 (can't go below)

### Pre-reveal trading analysis
1. Freeze trading on contract
2. Query all Transfer events (filter out mints)
3. Per wallet: count sells (appeared as `from`), count buys (appeared as `to`)
4. Apply: startingIQ - (30 * sells) + (5 * buys), min 69
5. Generate metadata with final IQ
6. Reveal + unfreeze

### Other IQ sources (TBD)
- Quests and games on site
- Equipment trait bonuses
- Social actions (referrals, votes)
