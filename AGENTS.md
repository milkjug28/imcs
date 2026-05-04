# IMCS - Imaginary Magic Crypto Savants
## Project Enhancement Plan

---

## Project Overview

**Current State:** Simple single-page HTML site with Google Sheets form submission
**Goal:** Transform into an interactive voting/community platform with gamified access controls
**Vibe:** Chaotic, whimsical, intentionally "dumb but genius" aesthetic - like crypto savants who can't spell but somehow make millions
**Framework:** Migrate to React (Next.js recommended) while maintaining exact visual style and personality

---

## 🚀 Current Progress (Updated: Jan 18, 2026)

### ✅ Completed
- **Backend Architecture** - Server-side only (no RLS needed for security)
  - 10 API routes for all data operations
  - Weighted voting system (wallet=1.0, IP=0.167)
  - Referral system with bonus scoring
  - Auto-whitelist functions
- **Database** - Supabase with simplified schema
  - Tables: submissions, votes, access_attempts, whitelist, referrals
  - Views: user_profiles, leaderboard_submissions, leaderboard_voters
  - Functions: auto-whitelist, referral bonuses, score updates
- **Google Sheets Sync** - Admin route to migrate data
  - POST /api/admin/sync-sheets
  - Compares and syncs data, skips duplicates
  - Full documentation in scripts/sync-google-sheets.md
- **React Foundation**
  - Providers (RainbowKit + React Query)
  - Root layout with noise overlay
  - Splash screen with eye tracking (exact port from index.html)
- **Admin Dashboard** - /admin route
  - View all submissions and whitelist status
  - Real-time stats (total, whitelisted, pending)
  - Sync button for Google Sheets migration
  - Protected by password

### 🔄 In Progress
- **Main Site Layout** - Header, draggable nav, footer (NEXT)
- **Voting Cards** - Texts from last night style voting
- **Circle Drawing Test** - 80% accuracy gate
- **Typing Test** - 30+ WPM fallback

### ⏳ To Do
- Home page with floating emojis
- Form submission page with gates
- Wallet connection integration
- Profile page with scores
- Leaderboard (top 100 + search)
- Popup savants and particle effects
- Music player
- Mobile optimization
- Deploy to Vercel

---

## Core Philosophy

> "i wish i was autistic...in like a super hacker programmer type of way…seeing lines of code like a rainman of the matrix. like an imaginary magic crypto savant"

The site should feel:
- **Chaotic but intentional** - misspellings are features, not bugs
- **Gatekept by absurdity** - circle drawing test, typing test, etc.
- **Cult-like and weird** - inspired by goblintown.wtf and similar projects
- **Surprisingly functional** - the chaos hides actual utility (voting, whitelist, profiles)

---

## Current Site Structure

```
index.html (~1300 lines)
├── Splash Screen
│   ├── Flashlight effect following cursor
│   ├── Eyes that track mouse movement
│   └── Enter button ("walcum tu savant wurld")
│
├── Main Site
│   ├── Header (rainbow gradient)
│   ├── Draggable Navigation Buttons
│   │   ├── hoem
│   │   ├── savant lisssst (form page)
│   │   ├── idk sumthin nuw hear suun (imagination page)
│   │   └── epik savant gallurie (locked gallery)
│   │
│   ├── Content Pages
│   │   ├── Home - floating emojis
│   │   ├── Form - Google Sheets submission
│   │   ├── Gallery - locked overlay
│   │   └── Imagination - rainbow gradient "use ur imaginashun, dork"
│   │
│   └── Footer Marquee
│
├── Interactive Elements
│   ├── Click particle effects (random emojis)
│   ├── Popup savant characters (from edges)
│   ├── Randomized music playlist (4 tracks)
│   └── Noise overlay
│
└── Form Submission
    ├── Honeypot spam protection
    ├── localStorage duplicate check
    ├── Basic wallet validation
    └── Twitter share prompt on success
```

### Assets
```
assets/
├── eyes/              # 8 eye layer images for splash screen
├── character/         # 4 savant character PNGs
├── audio/            # 4 music tracks + fart2.mp3 sound effect
└── noise.png         # Noise overlay texture
```

---

## New Features to Implement

### 1. Submission Voting System ("Texts from Last Night" Style)

**User Experience:**
- Users see one submission card at a time
- Card shows: submission text + truncated wallet address
- Example: *"My stomach is performing a rug pull on my intestines." - 0x1234...567*
- Buttons: 👍 (upvote) and 👎 (downvote)
- After voting, next card appears
- Each submission starts at score 0
- Upvote = +1, Downvote = -1
- Users can skip to next card without voting

**Technical Implementation:**
- Backend needed to store votes (cannot use Google Sheets alone)
- Options:
  - **Supabase** (recommended - free tier, real-time, Postgres)
  - **Firebase Firestore** (good for real-time, but more expensive)
  - **Custom API + PostgreSQL** (most control, requires deployment)
- Track which cards each IP/user has voted on (prevent duplicate voting)
- Randomize card order for each user
- Cache viewed cards to avoid showing same card twice in session

**Database Schema:**
```
submissions:
  - id
  - wallet_address
  - name
  - info (the actual submission text)
  - score (calculated field: upvotes - downvotes)
  - created_at

votes:
  - id
  - submission_id (foreign key)
  - voter_identifier (IP or wallet address)
  - vote_type (upvote/downvote)
  - created_at
```

**UI Design (maintain current aesthetic):**
- Cards styled like current `.form-container`
- Bright gradient backgrounds (pink/yellow)
- Thick black borders, drop shadows
- Comic Neue font
- Rotated slightly (-1 to 2 degrees)
- Animate card transitions (slide out left/right, new card slides in)
- Show vote count after user votes (briefly)

---

### 2. Circle Drawing Access Gate

**User Experience:**
- When user clicks on "savant lisssst" nav button, circle drawing challenge appears BEFORE showing form
- Black canvas with pastel-colored drawing effect
- Instruction: "draw a perfect circle, use ur imaginashun" (no visible circle guide)
- User draws with mouse/touch
- Algorithm checks if shape is ≥80% similar to perfect circle
- Success → form appears
- Fail → "try agen dummie" message, allow retry
- After 3 failures (tracked by IP), switch to typing test

**Technical Implementation:**
- Canvas API for drawing
- Algorithm to measure circle accuracy:
  1. Calculate center point of drawn shape
  2. Measure distance from center to each point
  3. Calculate standard deviation
  4. Compare to perfect circle (low std dev = good circle)
  5. Check if shape is roughly circular (not ellipse/spiral)
- Track attempts in localStorage + backend (by IP)
- Drawing effect: use thick pastel stroke, chalk-like texture, glow effect
- Clear button to restart drawing

**Circle Accuracy Algorithm (pseudo-code):**
```javascript
function calculateCircleAccuracy(points) {
  // Find center (average x, average y)
  const center = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length
  };

  // Calculate distances from center
  const distances = points.map(p =>
    Math.sqrt(Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2))
  );

  // Average radius
  const avgRadius = distances.reduce((a, b) => a + b) / distances.length;

  // Standard deviation of distances
  const variance = distances.reduce((sum, d) =>
    sum + Math.pow(d - avgRadius, 2), 0
  ) / distances.length;
  const stdDev = Math.sqrt(variance);

  // Circle score (lower stdDev relative to radius = better circle)
  const score = 1 - (stdDev / avgRadius);

  return score; // 0.8+ = pass (80% accurate)
}
```

**UI Design:**
- Full-screen canvas overlay
- Pastel drawing color (random: pink, purple, cyan, yellow)
- "Magic" cursor trail effect
- Sparkle particles follow drawing path
- Success animation: circle glows, spins, explodes into emojis
- Failure animation: circle wobbles, cracks, breaks apart

---

### 3. Typing Test Fallback

**User Experience:**
- Triggered after 3 failed circle attempts (tracked by IP)
- Full-screen typing test interface
- Must type the copypasta at ≥30 WPM:
  > "i wish i was autistic...in like a super hacker programmer type of way…seeing lines of code like a rainman of the matrix. like an imaginary magic crypto savant"
- Show WPM in real-time as they type
- Highlight correct/incorrect characters
- Success → form appears
- Fail → can retry immediately
- No limit on typing test attempts

**Technical Implementation:**
- Track keystrokes with timestamps
- Calculate WPM: `(characters typed / 5) / (time in minutes)`
- Character-by-character validation
- Show live WPM counter
- Track accuracy (% correct characters)
- Store successful completion in localStorage + backend (by IP)

**UI Design:**
- Matrix-style falling characters in background (green on black)
- Monospace font for typing (but Comic Neue for UI elements)
- Highlight correct chars in green, incorrect in red
- WPM counter pulses when threshold reached
- Success animation: "HACKER MODE ACTIVATED" with glitch effect

---

### 4. Profile System & Wallet Connection

**User Experience:**
- New nav button: "my savant profil"
- Profile page requires wallet connection (MetaMask, WalletConnect, etc.)
- If wallet not in database (never submitted form), show: "u dont exist yet, dummie"
- If wallet in database, show profile:
  - Their name
  - Their submission text
  - Their submission score (upvotes - downvotes)
  - Their voting karma (based on voting activity)
  - Whitelist status: "u ar on savant lissst" or "not yet, keep votin"
  - Link to verify wallet ownership

**Profile Data:**
- **Submission Score:** Total votes received on their submission
- **Voting Karma:** Points earned by voting on others' submissions
  - Upvoting submissions that later succeed = +karma
  - Downvoting submissions that later fail = +karma
  - (This rewards "good taste" in voting)
- **Whitelist Algorithm:**
  - Top 50% by submission score automatically on whitelist
  - OR top 30% by voting karma
  - OR manual approval by team

**Technical Implementation:**
- Web3 wallet connection (wagmi + RainbowKit or web3modal)
- Verify wallet signature to confirm ownership
- Query backend for profile data
- Real-time updates when new votes come in

**UI Design:**
- Profile card similar to form container style
- Gradient background based on whitelist status (green = yes, red = no)
- Show score with big numbers and emoji reactions
- Confetti animation if on whitelist
- If not on whitelist, show progress bar toward next tier

---

### 5. Leaderboard Page

**User Experience:**
- Accessible from nav ("savant leederboard")
- Two tabs: "best submishuns" and "best voters"
- **Best Submissions:**
  - Ranked by score (upvotes - downvotes)
  - Show: rank, submission text, wallet, score
  - Highlight top 3 with different colors/sizes
- **Best Voters:**
  - Ranked by voting karma
  - Show: rank, wallet (or name if available), karma score
  - Explain karma system briefly

**Technical Implementation:**
- Query backend, sort by score/karma
- Pagination (show top 50, load more)
- Real-time updates every 30 seconds
- Cache results to reduce backend load

**UI Design:**
- Podium for top 3 (gold, silver, bronze)
- Scrollable list below
- Each entry styled like gallery item (card with border, slight rotation)
- Animated rank changes (if user moves up/down)

---

### 6. Gallery Unlock

**Current State:** Gallery page is locked with overlay
**New State:**
- Gallery unlocks once user is on whitelist
- Shows actual savant NFT previews (when available)
- If not on whitelist, overlay remains with message: "u need whitelist 2 c dis, dummie"

---

## Migration to React Framework

### Recommended Stack:
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Inline styles in components (maintain exact current CSS)
- **State Management:** React Context + hooks
- **Backend:** Supabase (database + auth)
- **Wallet Connection:** wagmi + RainbowKit
- **Deployment:** Vercel (automatic, free tier works)

### Why Next.js?
- Server-side rendering for SEO (important for social sharing)
- API routes for backend logic (if not using Supabase exclusively)
- Image optimization (for character sprites, gallery)
- Easy deployment to Vercel
- File-based routing matches current page structure

### Migration Strategy:

**Phase 1: Setup & Structure**
1. Create Next.js app: `npx create-next-app@latest imcs-app`
2. Set up Supabase project
3. Configure wallet connection (RainbowKit)
4. Set up project structure:
```
src/
├── app/
│   ├── layout.tsx         # Root layout with noise overlay
│   ├── page.tsx           # Splash screen
│   └── site/
│       ├── layout.tsx     # Main site layout (header, nav, footer)
│       ├── page.tsx       # Home page
│       ├── vote/
│       │   └── page.tsx   # Voting cards
│       ├── submit/
│       │   └── page.tsx   # Form (with circle/typing gate)
│       ├── profile/
│       │   └── page.tsx   # User profile
│       ├── leaderboard/
│       │   └── page.tsx   # Leaderboard
│       └── gallery/
│           └── page.tsx   # Gallery (locked/unlocked)
│
├── components/
│   ├── Eyes.tsx           # Splash screen eyes
│   ├── NavButtons.tsx     # Draggable nav
│   ├── VotingCard.tsx     # Submission card
│   ├── CircleDrawing.tsx  # Circle test
│   ├── TypingTest.tsx     # Typing test
│   ├── ProfileCard.tsx    # Profile display
│   ├── PopupSavant.tsx    # Character popups
│   └── MusicPlayer.tsx    # Background music
│
├── lib/
│   ├── supabase.ts        # Supabase client
│   ├── wallet.ts          # Wallet connection utils
│   └── voting.ts          # Voting logic
│
└── styles/
    └── globals.css        # Global styles (fonts, keyframes)
```

**Phase 2: Component Migration**
1. Recreate each page as React component
2. Copy CSS directly into component style tags or CSS modules
3. Maintain exact visual appearance
4. Test each component in isolation

**Phase 3: Interactive Features**
1. Implement circle drawing canvas component
2. Implement typing test component
3. Set up voting system with backend
4. Add wallet connection and profile

**Phase 4: Backend Integration**
1. Set up Supabase tables
2. Create API routes or use Supabase client directly
3. Implement vote tracking, profile queries
4. Set up real-time subscriptions for live updates

**Phase 5: Testing & Polish**
1. Test all interactive elements
2. Mobile responsiveness (already have mobile styles in current site)
3. Performance optimization
4. SEO meta tags for social sharing

---

## Database Schema (Supabase)

```sql
-- Submissions table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  info TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id),
  voter_identifier TEXT NOT NULL, -- IP or wallet
  vote_type TEXT CHECK(vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(submission_id, voter_identifier)
);

-- Access attempts table (for circle/typing tests)
CREATE TABLE access_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  attempt_type TEXT CHECK(attempt_type IN ('circle', 'typing')),
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Whitelist table
CREATE TABLE whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL UNIQUE,
  status TEXT CHECK(status IN ('approved', 'pending', 'rejected')),
  added_at TIMESTAMP DEFAULT NOW(),
  reason TEXT
);

-- Views for calculated scores
CREATE VIEW submission_scores AS
SELECT
  s.id,
  s.wallet_address,
  s.name,
  s.info,
  COUNT(CASE WHEN v.vote_type = 'upvote' THEN 1 END) as upvotes,
  COUNT(CASE WHEN v.vote_type = 'downvote' THEN 1 END) as downvotes,
  COUNT(CASE WHEN v.vote_type = 'upvote' THEN 1 END) -
  COUNT(CASE WHEN v.vote_type = 'downvote' THEN 1 END) as score
FROM submissions s
LEFT JOIN votes v ON s.id = v.submission_id
GROUP BY s.id;
```

---

## Additional "Troll" Feature Ideas

1. **Random Page Rotations:** Entire page randomly rotates 1-2 degrees every 10 seconds
2. **"Rug Pull" Button:** Fake button that appears randomly, says "claim free ETH", redirects to imagination page
3. **Konami Code:** Entering ↑↑↓↓←→←→BA unlocks secret sound effect or animation
4. **Cursor Trails:** Random emoji trails follow cursor on certain pages
5. **Fake Loading Bars:** "Connecting to blockchain..." that fills at random speeds (even when not actually loading anything)
6. **Random Savant Wisdom:** Popup quotes that appear randomly, saying absurd crypto "wisdom"
   - "wen lambo? wen u stop askin"
   - "bear market is just hibernation for ur bags"
   - "technical analysis is astrology for men"
7. **Wallet Balance Troll:** If user connects wallet with <0.01 ETH, show message: "u ar so poor, how u gonna mint?"
8. **Easter Egg Gallery:** Clicking specific emojis in specific order unlocks hidden gallery of memes
9. **Fake Error Messages:** Occasional browser alerts with savant-style errors
   - "Error 420: Too much hopium detected"
   - "Error 69: Nice try, nerd"
10. **"Use Imagination" Fallback:** Any unimplemented feature just redirects to imagination page

---

## Content/Copy Suggestions

### Navigation
- "hoem" → stays same
- "savant lisssst" → "becum savant"
- "my savant profil" → "am i savant?"
- "savant leederboard" → "who is best savant"
- "epik savant gallurie" → stays same
- "idk sumthin nuw hear suun" → "use imaginashun"

### Messages
- **Circle Test Fail:** "dat not a circle dummie, try agen"
- **Circle Test Success:** "wow ur actualy smart (for once)"
- **Typing Test Slow:** "u type liek boomer, go faster"
- **Typing Test Success:** "ok u can type, big deal"
- **No Profile Found:** "ur wallet not savant yet. submit form first, nerd"
- **Not on Whitelist:** "u not savant enuf. get more votes, dork"
- **On Whitelist:** "CONGRAAAATS U AR SAVANT!!! 🎉🚀✨"
- **Already Voted:** "u alredy voted on dis one, dummy"
- **Vote Submitted:** random responses like "ur opinyun noted" or "thx i gess" or "ok"

---

## SEO & Social Sharing

Even though site is intentionally chaotic, social sharing should look good:

```html
<meta property="og:title" content="Imaginary Magic Crypto Savants">
<meta property="og:description" content="i wish i was autistic...in like a super hacker programmer type of way">
<meta property="og:image" content="/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@imcsnft">
```

Create OG image with one of the savant characters + project name in savant-style text.

---

## Timeline & Prioritization

### Phase 1: Foundation (Week 1)
- ✅ Set up Next.js project
- ✅ Migrate splash screen + basic navigation
- ✅ Set up Supabase
- ✅ Copy all assets
- ✅ Maintain exact visual styling

### Phase 2: Core Features (Week 2)
- ✅ Implement voting card system
- ✅ Backend for votes
- ✅ Circle drawing test
- ✅ Typing test

### Phase 3: Advanced Features (Week 3)
- ✅ Wallet connection
- ✅ Profile system
- ✅ Leaderboard
- ✅ Whitelist logic

### Phase 4: Polish (Week 4)
- ✅ Troll features
- ✅ Mobile testing
- ✅ Performance optimization
- ✅ Deploy to production

---

## Technical Considerations

### Performance
- Lazy load character images
- Optimize audio files (consider using MP3 compression)
- Use Next.js Image component for all images
- Implement virtual scrolling for leaderboard if >1000 entries

### Security
- Sanitize all user inputs (prevent XSS in submissions)
- Rate limit voting (prevent spam bots)
- Validate wallet signatures properly
- Use honeypot field in form (already have this!)
- CAPTCHA fallback if abuse detected

### Accessibility
- Even though site is chaotic, maintain keyboard navigation
- Screen reader friendly (use proper semantic HTML)
- Alt text for images (can be funny/on-brand)
- Skip-to-content link for splash screen

### Mobile Experience
- Already have mobile styles, maintain these
- Touch-friendly circle drawing (test on mobile devices)
- Responsive voting cards
- Draggable nav works on touch devices? (May need adjustment)

---

## Development Environment

### Local Setup
```bash
# Install dependencies
npm install

# Set up environment variables (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-wc-id

# Run dev server
npm run dev

# Open http://localhost:3000
```

### Testing
- Test circle drawing on multiple devices/browsers
- Test typing test with various keyboard layouts
- Test wallet connection with MetaMask, Coinbase Wallet, WalletConnect
- Test voting with multiple IPs (use VPN or proxy)
- Test mobile responsiveness

---

## Launch Checklist

- [ ] All pages migrated to React
- [ ] Voting system functional
- [ ] Circle + typing tests working
- [ ] Wallet connection working
- [ ] Profile system complete
- [ ] Leaderboard live
- [ ] Whitelist algorithm tested
- [ ] Mobile responsive
- [ ] Performance optimized
- [ ] Security audit passed
- [ ] Deployed to production
- [ ] DNS configured (imcs.world)
- [ ] OG images set up
- [ ] Analytics added (optional)
- [ ] Twitter announcement ready
- [ ] Discord/community notified

---

## Post-Launch Features

Ideas for after initial launch:

1. **Savant Battles:** Top 2 submissions face off, community votes
2. **Daily Challenges:** New circle/typing challenges for extra karma
3. **Referral System:** "bring frenz 2 savant wurld, get points"
4. **Meme Generator:** Let users create savant memes with templates
5. **Voice Chat Integration:** Allow savants to talk to each other (chaos mode)
6. **On-chain Verification:** Store whitelist on-chain (more trustless)
7. **Savant Merch Shop:** Sell physical merch with savant designs
8. **Staking Mechanism:** Stake tokens to boost submission visibility
9. **NFT Traits Voting:** Community votes on NFT trait rarities
10. **Real-time Chat:** Savant-themed chat room (moderated chaos)

---

## Conclusion

This project is about creating a genuinely entertaining and engaging community platform disguised as a chaotic meme site. The key is balancing the intentional "dumbness" (misspellings, absurd gates, troll features) with actual utility (fair voting, profile system, whitelist logic).

Every feature should feel slightly ridiculous but ultimately serve the purpose of identifying true community members who "get it" and filtering out those who don't.

The migration to React will enable all these features while maintaining the exact visual chaos and personality of the current site. Nothing should feel "professional" or "corporate" - it's all magic internet money and imagination, dork.

---

## Questions to Answer Before Starting

1. **Backend choice:** Supabase (recommended), Firebase, or custom API?
2. **Wallet integration:** RainbowKit (easiest) or custom solution?
3. **Deployment:** Vercel (recommended), Netlify, or custom hosting?
4. **Domain:** Keep imcs.world and point to new app?
5. **Google Sheets:** Keep as backup data store, or migrate fully to new DB?
6. **Music:** Keep same tracks, or add more? Auto-play still okay (browsers may block)?
7. **Whitelist size:** Top 50%? Top 100 people? Manual curation?
8. **Vote weights:** All votes equal, or weight by voter's karma?
9. **Anonymous voting:** Allow without wallet, or require connection?
10. **Data ownership:** Allow users to delete their submissions later?

---

**Built with imagination, chaos, and probably too much caffeine.**
**May your bags pump and your circles be round.**
**🧙‍♂️✨🚀**
