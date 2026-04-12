# Fast Origin Transfer Optimization Plan

**Created:** 2026-04-12
**Target:** Reduce Vercel Fast Origin Transfer (bytes between CDN and Functions) without regressing the "live points" UX restored in commit 53f3f46.
**Reference:** https://vercel.com/docs/manage-cdn-usage#fast-origin-transfer

---

## Context

FOT is billed on both incoming and outgoing bytes between Vercel's CDN and your Functions. Every uncached origin hit contributes. The main levers are:

1. Cache responses at the CDN so repeat requests don't reach the function.
2. Shrink the response body (drop unused fields, trim oversized payloads).
3. Use ETag / `If-None-Match` to send `304` bodies instead of full payloads.
4. Narrow Supabase `select('*')` queries to only the columns used.

---

## Phase 0 - Clean build logs

The Vercel build succeeds, but several routes log `DYNAMIC_SERVER_USAGE` errors because Next.js tries to prerender them and hits `nextUrl.searchParams`. Adding `export const dynamic = 'force-dynamic'` suppresses the log and is compatible with `Cache-Control` headers.

**Files to edit:**
- `imcs-app/src/app/api/submissions/random/route.ts`
- `imcs-app/src/app/api/whitelist/check/route.ts`
- `imcs-app/src/app/api/auth/x/route.ts`
- `imcs-app/src/app/api/auth/x/callback/route.ts`
- `imcs-app/src/app/api/leaderboard/search/route.ts`
- `imcs-app/src/app/api/leaderboard/voters/route.ts`

**Also audit these useEffect dep warnings** (per lessons.md, unstable callbacks contributed to the 50K edge request incident):
- `imcs-app/src/app/site/layout.tsx:116` - `handleMouseMove`
- `imcs-app/src/app/site/submit/page.tsx:49` - `checkExistingProfile`
- `imcs-app/src/app/site/tasks/page.tsx:97` - `fetchAllData`

Fix each by wrapping the referenced function in `useCallback` with stable deps, or inlining the logic.

---

## Phase 1 - Profile API (biggest win)

**File:** `imcs-app/src/app/api/profile/[wallet]/route.ts`

Commit 53f3f46 removed caching to restore live points. We can keep the UX feeling live while cutting origin hits ~10x with a short CDN cache and SWR.

1. Add to the success response:
   ```
   Cache-Control: private, max-age=5, s-maxage=15, stale-while-revalidate=60
   ```
   Tradeoff: up to 15s staleness at the CDN. Points update within seconds anyway because of SWR.
2. Replace the `...baseProfile` spread with an explicit object. Only return fields the UI reads: `wallet_address, name, info, submission_score, voting_karma, task_points, total_points, rank, whitelist_status, whitelist_method, has_submission`. Drops unused columns from the view.
3. Audit frontend callers: if any pass `cache: 'no-store'` or `next: { revalidate: 0 }`, decide per-caller whether 15s staleness is acceptable. Commit 53f3f46 added several of these.

---

## Phase 2 - Leaderboard payload trim

**File:** `imcs-app/src/app/api/leaderboard/submissions/route.ts`

The `info` field is free-form user text and makes up most of the payload. It's only rendered for visible rows.

1. Drop `info` from the default select. Either:
   - Omit entirely and fetch per-row when a card expands.
   - Or add an opt-in `?include=info` param.
2. Lower default `limit` from 1000 to 100. Callers that need more must pass `?limit=N`.
3. Bump `s-maxage=60` to `s-maxage=300` (the `leaderboard_scores` materialized view refreshes slowly).
4. Grep the frontend for callers of `/api/leaderboard/submissions` to confirm nothing depends on `info` being present inline.

Expected impact: 5-10x reduction in outgoing FOT on this endpoint.

---

## Phase 3 - Tasks API cache

**File:** `imcs-app/src/app/api/tasks/[wallet]/route.ts`

Currently `force-dynamic` with no cache header. Every call hits origin.

1. Add `Cache-Control: private, max-age=10, s-maxage=30, stale-while-revalidate=60`.
2. `force-dynamic` stays. `Cache-Control` still applies.

---

## Phase 4 - Random submission narrowing

**File:** `imcs-app/src/app/api/submissions/random/route.ts`

Line 13 uses `.select('*')`, pulling every column.

1. Replace with the exact columns the voting card consumes: `id, wallet_address, name, info, created_at` (verify against the component).
2. No cache header - endpoint is random per-call by design.

---

## Phase 5 - ETag on heavy routes

Route Handlers do not auto-generate ETags. Adding them trades CPU for outgoing bytes (a `304` response body is empty).

1. Create `imcs-app/src/lib/etag.ts` - hash JSON payload (e.g. first 16 chars of SHA-1).
2. Wrap profile + leaderboard responses:
   - Compute ETag from the body.
   - Compare incoming `If-None-Match`.
   - If match: return `new Response(null, { status: 304, headers: {...} })`.
3. Apply only after Phases 1-4 ship and are measured - ETag helps most once cache MISS rate is lowered.

---

## Phase 6 - Measure

1. Before deploying Phase 1, record current FOT baseline from Vercel Usage (screenshot + note date in this file).
2. Ship Phases 0-4 in one PR. Wait 24-48h.
3. Record new FOT from Usage. Compare by project and by incoming vs outgoing.
4. Decide whether Phase 5 (ETag) is worth the CPU cost based on what's left.

---

## Rollback

Each phase is isolated per-file. Revert individual commits if "live points" feel regresses or data goes stale.

---

## Out of scope (noted, not fixing here)

- **npm deprecation warnings** (WalletConnect, glob, ESLint 8) - all upstream. Will clear when RainbowKit/wagmi update.
- **`<img>` vs `<Image />` warnings** - intentional. `next/image` would route through Vercel Image Optimization (separate billing). Site aesthetic uses many small sprites, current choice is defensible.
- **Build cache 228 MB / build time 2m** - normal for Next.js + wagmi + RainbowKit.
- **First Load JS 90 kB** - healthy, well under Vercel's recommended ~130 kB ceiling.

---

## Execution order

1. Phase 0 (build log cleanup + useEffect audit)
2. Phase 6 step 1 (baseline measurement)
3. Phases 1, 2, 3, 4 (ship together)
4. Phase 6 steps 2-3 (measure 24-48h post-deploy)
5. Phase 5 if still warranted
