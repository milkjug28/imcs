---
name: memory-salience
description: Teaches agents how to remember saliently — weighing what matters using six components (novelty, retention, coherence, relevance, momentum, decay) organized as CORE × AMPLIFIER × PENALTY.
metadata: {"openclaw": {"emoji": "🧠"}}
---

# Memory Salience

This skill guides your memory decisions. It defines how to weigh what is worth remembering, when to store or update, when to connect, and when to let information fade.

## The Salience Model

Every piece of information has a salience score — a composite measure of how important it is to remember. The model adapts concepts from [salience-weighted physics simulations](https://github.com/CarlSR9001/salience-simulation-lab) that score galaxy dynamics using composite signals — reframed here for memory prioritization.

### The Formula (As Mental Model)

```
Salience = CORE × AMPLIFIER × PENALTY
```

- **CORE** = Novelty × Retention × Coherence × Relevance — the four fundamental signals
- **AMPLIFIER** = 1 + Momentum + (structural boosts) — context that raises importance
- **PENALTY** = 1 - Decay - disorder — deductions for staleness or fragmentation

This is not literal arithmetic. You will not compute numerical scores. It is a mental model — a set of lenses to run information through when deciding what deserves memory. The multiplicative structure means that weakness in any CORE component significantly reduces overall salience, while AMPLIFIER and PENALTY adjust the result based on context.

### Conceptual Mapping

The original physics model scored galactic salience using:

| Physics Concept | Memory Analog | Why It Maps |
|-----------------|---------------|-------------|
| **Continuity** (ordered vs turbulent motion) | **Coherence** (connected vs isolated facts) | Both measure structural consistency |
| **Retention** (stability over time) | **Retention** (persistence across sessions) | Direct analog — durability |
| **Coherence Fraction** (% of system that's ordered) | **Relevance** (% of context where this applies) | Both measure scope of applicability |
| **Mass Density** (physical importance) | **Novelty** (informational importance) | Both measure signal strength |
| **Morphology Boost** (amplification for active structures) | **Momentum** (amplification for active topics) | Both boost currently-engaged elements |
| **Disorder Penalty** (deduction for turbulence) | **Decay** (deduction for staleness) | Both penalize degraded states |

The physics model uses `Quality = Salience^(1/4)` to smooth local scores into a global metric. For memory, this suggests: even moderate salience produces useful memories, but the highest-salience information stands clearly above the rest.

## Components

The salience model has six components organized into three groups:

- **CORE** (four factors that multiply together): Novelty, Retention, Coherence, Relevance
- **AMPLIFIER** (boosts for active context): Momentum
- **PENALTY** (deductions for degraded state): Decay

---

### CORE Components

#### Novelty

Is this information new, surprising, or contradictory to what you already know?

- **High novelty**: A user preference you haven't seen before. A correction to something you previously stored. A pattern that breaks expectations.
- **Low novelty**: Routine repetition of known facts. Standard greetings. Information already captured in memory.

**Guidance**: Novel information that changes your understanding is the highest-priority signal for memory. If you already know it, don't store it again.

#### Retention

Has this information persisted across multiple interactions? Do recurring themes emerge?

- **High retention**: The user mentions the same preference in three different sessions. A project convention appears in every code review. A tool choice keeps coming back.
- **Low retention**: A one-off mention. A single data point with no history.

**Guidance**: Information that keeps surfacing has earned its place in memory. First mentions are candidates; repeated mentions are confirmations — update existing memories to reflect growing confidence rather than creating duplicates.

#### Coherence

Does this information connect to existing memories? Does it reinforce, extend, or bridge what you already know?

- **High coherence**: A new detail about a known project. A preference that explains a pattern you already noticed. Information that links two previously separate memory clusters.
- **Low coherence**: An isolated fact with no relationship to anything stored. A random aside with no context.

**Guidance**: Coherent information is more retrievable and more useful. When you encounter something that connects to existing memories, update those memories to reflect the connection. Isolated facts with no anchor points are low-value unless they also score high on novelty.

#### Relevance

How broadly does this information apply? In how many contexts will it matter?

- **High relevance**: A user's communication style preference — applies to every interaction. A core architectural principle for their main project. A tool they use across multiple codebases.
- **Low relevance**: A one-time workaround for a specific bug. A preference that only applies to a deprecated project. Context that's useful only in narrow circumstances.

**Guidance**: Relevance is scope of applicability. High-relevance information pays dividends repeatedly; it should be stored with high priority and retrieved often. Low-relevance information may still be worth storing if other signals are strong, but it shouldn't displace broader insights.

---

### AMPLIFIER Components

#### Momentum

Is this actively relevant right now? Is it being referenced, used, or built upon?

- **High momentum**: The current project's architecture decisions. The user's active workflow preferences. Dependencies being actively installed and configured.
- **Low momentum**: A project that was discussed weeks ago and hasn't come up since. A tool the user tried once and abandoned.

**Guidance**: Momentum amplifies salience for information that's currently in play. High-momentum information should be easy to surface and should boost the salience of related memories. Momentum is transient — it rises when topics become active and falls when they go dormant. Unlike the CORE components, momentum doesn't determine whether something is worth remembering; it determines how prominently it should feature in retrieval right now.

---

### PENALTY Components

#### Decay

Information that is never reinforced should naturally lose priority. Decay is not deletion — it is deprioritization.

- **Resists decay**: Core user preferences. Stable architectural decisions. Proven patterns confirmed across sessions.
- **Decays quickly**: Temporary workarounds. Session-specific context. Speculative conclusions that were never validated.

**Guidance**: Decay is the most important component for memory health. Without it, memory fills with stale information that drowns out what matters. Actively assess whether stored memories still carry momentum and coherence. If they don't, let them fade.

## Decision Framework

When you encounter information during a session, evaluate its salience and take one of these actions:

### STORE

The information is novel, coherent with existing knowledge, and relevant to the user's ongoing work or preferences.

Write it down. Lead with the insight, not the context. Keep it atomic — one concept per entry.

### UPDATE

New information reinforces, corrects, or extends something already in memory.

Don't create a duplicate. Find the existing memory and update it. Increase your confidence. Add the new detail.

### CONNECT

The information bridges two existing memory clusters that weren't previously linked.

Update both related memories to reflect the connection. Bridging information is high-value even when the individual facts aren't novel.

### LET FADE

The information is routine, already known, ephemeral, or too speculative to commit.

Don't store it. Not everything deserves memory. The discipline of letting things fade is what keeps memory useful.

### PRUNE

A stored memory has lost all momentum. It hasn't been referenced or reinforced. It no longer connects to anything active.

Remove it or mark it as low-priority. Stale memories degrade retrieval quality for everything else.

## Writing Memories Well

How you write a memory determines how well it can be found and used later.

- **Lead with the actionable insight.** Not "During our conversation about deployment, the user mentioned they prefer..." but "User prefers Docker Compose over Kubernetes for local development."
- **Be specific.** Not "User likes TypeScript" but "User requires strict TypeScript — no `any` types, explicit return types on public functions."
- **One concept per entry.** A memory that covers three unrelated preferences is hard to retrieve for any single one of them.
- **Include connection points.** If a memory relates to a project, tool, or pattern, name it explicitly so semantic search can find the link.
- **Prefer updates over new entries.** If a memory about "deployment preferences" already exists, extend it rather than creating a parallel entry.

## Anti-Patterns

Things you should NOT remember:

- **Session ephemera** — Current file paths, in-progress task state, temporary variables. These are context, not memory.
- **Duplicates** — If it's already stored, don't store it again. Update the existing entry if there's new information.
- **Unverified speculation** — Don't commit a guess to memory after reading one file. Wait for confirmation across multiple signals.
- **Verbose transcripts** — Distill to the insight. Memory is not a log.
- **Obvious defaults** — Don't memorize that a Python project uses pip or that a web app has a package.json. Only store deviations from convention.

## The Quality Factor

Not all memories are equal. A memory's long-term value is a function of its salience score smoothed over time:

```
Quality = Salience ^ (1/4)
```

The fourth-root scaling means that even moderate salience produces useful memories, but truly high-salience information stands well above the rest. This prevents both over-storing (everything seems important) and under-storing (only dramatic revelations get saved).

When in doubt, ask: "If I encounter this user again in a fresh session, would this memory meaningfully improve my ability to help them?" If yes, store it. If maybe, store it briefly and let decay do its job. If no, let it go.