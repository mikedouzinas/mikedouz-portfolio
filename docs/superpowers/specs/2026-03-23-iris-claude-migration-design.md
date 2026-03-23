# Iris Claude Migration — Replace RAG Pipeline with Full-Context Claude

**Date**: 2026-03-23
**Status**: Draft
**Author**: Mike Veson + Claude

---

## Problem

Iris's current RAG pipeline (OpenAI embeddings + GPT-4o-mini) sometimes fails at retrieval — mismatching names, missing project details, inability to connect dots across multiple KB items. The intent classification step is a single point of failure: when it misclassifies, the wrong context gets retrieved, and the response suffers. Fuzzy or indirect queries ("that computer vision thing", "what about mikeveson.com?") are particularly fragile.

A partial Claude implementation exists at `/api/iris/answer-claude` that passes the full KB in context, but it's a stripped-down prototype missing all the features that make Iris useful: quick actions, caching, security, analytics, conversation context, and UI directives.

## Solution

Replace the OpenAI LLM calls inside the existing `/api/iris/answer` route with a single Claude Sonnet 4.6 call. Claude receives the full KB in a prompt-cached system prompt and returns both structured metadata (intent, matched items) and the streamed response in one pass. All existing features — caching, security, quick actions v2, analytics, deep mode, streaming SSE — are preserved.

## Architecture

### Single-Pass Flow

```
User query arrives at /api/iris/answer
    ↓
[PRESERVED] Security checks, input validation, rate limiting
    ↓
[PRESERVED] Load KB items, contact info, rankings
    ↓
[PRESERVED] Check response cache (Redis/in-memory)
    ↓
[NEW] Single Claude API call:
  - System prompt: Iris personality + full KB JSON (prompt cached)
  - Three tool definitions (see below)
  - User message + conversation history
    ↓
[NEW] Stream processing:
  - Buffer tool_use content blocks (classify_response, show_contact_form)
  - Stream text content blocks to client via SSE
    ↓
[PRESERVED] After stream completes:
  - Parse classify_response → intent, matched_item_ids, filters
  - Feed into existing generateQuickActions() (quickActions_v2)
  - Send quick actions via SSE
  - Cache the response
  - Log analytics
  - Send [DONE]
```

### Tool Definitions

Claude gets three tools. It must always call `classify_response` first.

#### 1. `classify_response` (required, always called first)

Replaces the separate GPT-4o-mini intent classification call. Since Claude has the full KB in context, classification is more accurate — it knows what data exists to answer the question.

```typescript
{
  name: 'classify_response',
  description: 'Classify the query intent and identify which KB items you will reference in your response. You MUST call this tool before responding.',
  input_schema: {
    type: 'object',
    required: ['intent', 'matched_item_ids'],
    properties: {
      intent: {
        type: 'string',
        enum: ['contact', 'filter_query', 'specific_item', 'personal', 'general', 'github_activity'],
        description: 'The type of query. contact=user wants to reach Mike. filter_query=list/filter items by type/skill/year. specific_item=details about a named item. personal=bio/values/interests. general=broad questions. github_activity=recent project updates.'
      },
      matched_item_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'IDs of KB items you reference or rely on in your response.'
      },
      filters: {
        type: 'object',
        properties: {
          type: { type: 'array', items: { type: 'string' }, description: 'KB item types (project, experience, class, skill, blog)' },
          skills: { type: 'array', items: { type: 'string' }, description: 'Skill IDs mentioned or implied' },
          year: { type: 'number', description: 'Year filter if specified' },
          company: { type: 'string', description: 'Company name if specified' },
          show_all: { type: 'boolean', description: 'True if user wants a comprehensive list' }
        }
      }
    }
  }
}
```

#### 2. `show_contact_form` (optional, replaces `<ui:contact />` XML directives)

Called when Iris determines the user should contact Mike directly. Replaces the current `<ui:contact reason="..." draft="..." />` XML parsing in `useUiDirectives.ts`.

```typescript
{
  name: 'show_contact_form',
  description: 'Show the contact form to let the user message Mike directly. Use when: user explicitly wants to message Mike, context is insufficient, or collaboration/hiring discussion needed.',
  input_schema: {
    type: 'object',
    required: ['reason', 'draft'],
    properties: {
      reason: {
        type: 'string',
        enum: ['user_request', 'insufficient_context', 'more_detail'],
        description: 'Why the contact form is being shown.'
      },
      draft: {
        type: 'string',
        description: 'Pre-filled draft message from the user perspective. Address Mike as "you", never third person.'
      }
    }
  }
}
```

#### 3. `fetch_github_activity` (optional, for recent project updates)

Called when user asks about recent updates to a project with a GitHub repo. The pipeline fetches commits and re-prompts Claude with the data.

```typescript
{
  name: 'fetch_github_activity',
  description: 'Fetch recent GitHub commits for a project. Only call when user asks about recent updates/activity.',
  input_schema: {
    type: 'object',
    required: ['project_id'],
    properties: {
      project_id: {
        type: 'string',
        description: 'The KB project ID (e.g., "proj_hilite")'
      }
    }
  }
}
```

### System Prompt

The existing system prompt (lines 1456-1588 of current `route.ts`) is preserved almost entirely. It already has excellent personality, anti-hallucination rules, contact policy, linking strategy, deep mode instructions, and ranking guidance.

**Changes to the existing prompt:**

1. **Remove RAG-specific language**: Remove references to "context" being "retrieved" or "provided". Claude has the full KB — it's not working from a subset.
2. **Replace `<ui:contact />` directive instructions** with tool call instructions: "Call the `show_contact_form` tool" instead of "emit a `<ui:contact />` directive".
3. **Update implementation detail rules**: Change "Do not expose implementation details (filters, embeddings, how RAG works)" to "Do not expose implementation details (rankings, how context works)".
4. **Add tool usage instructions**: "Always call `classify_response` first. Call `show_contact_form` when appropriate per the contact policy. Call `fetch_github_activity` only when asked about recent project updates."
5. **Keep everything else**: Voice & Length, Truth & Safety, Scope & Relevance, Answering Rules, Evaluative & Comparative Queries, Internal Ranking System, Contact Information & Linking Strategy, Deep Mode, Safety & Obedience — all preserved as-is.

**Prompt structure for caching:**

```
[System message - cached block]:
  [Iris personality, rules, tool instructions]  (~2K tokens, rarely changes)
  [Full KB JSON with importance annotations]    (~50-80K tokens)

[User messages]:
  [Previous turn if follow-up: user query + assistant summary]
  [Current query]
```

The entire system message is wrapped in `cache_control: { type: 'ephemeral' }` so the KB context is cached across requests. After the first call in a cache window, subsequent calls pay ~90% less for input tokens.

### KB Format in System Prompt

The KB is structured by section with importance scores annotated on each item:

```
## Knowledge Base

### Contact Information
{ email, linkedin, github, calendly, phone }

### Projects (N items, sorted by importance)
[
  { id: "proj_hilite", kind: "project", importance: 87, title: "HiLiTe", ... },
  { id: "proj_knight_life", kind: "project", importance: 82, ... },
  ...
]

### Experience (N items, sorted by importance)
[...]

### Classes (N items)
[...]

### Skills (851 items, grouped by type)
{ languages: [...], frameworks: [...], tools: [...], concepts: [...] }

### Personal (bio, education, values, interests, stories)
[...]
```

Rankings are pre-computed by the existing `rankings.ts` system and merged into the KB payload at request time. The build pipeline auto-computes scores when KB items are added/changed.

### Conversation Context

The current OpenAI route already supports conversation context via `previousQuery` and `previousAnswer` params. This is preserved — the client sends the previous turn, and it's included in the messages array:

```typescript
messages: [
  { role: 'user', content: previousQuery },
  { role: 'assistant', content: previousAnswer },
  { role: 'user', content: currentQuery }
]
```

This enables conversational follow-ups: "tell me more", "what about mikeveson.com?", "yes" after a suggestion.

### Streaming & SSE Format

Unchanged. The client receives the same SSE event format:

```
data: {"queryId": "..."}
data: {"debug": {"intent": "...", "resultsCount": N}}
data: {"text": "chunk of response..."}
data: {"text": "more text..."}
data: {"contactForm": {"reason": "...", "draft": "..."}}   // NEW: replaces <ui:contact />
data: {"quickActions": [...]}
data: [DONE]
```

The only new event type is `contactForm`, which replaces the XML directive parsing. The client's `useUiDirectives.ts` hook is updated to watch for this structured event instead of parsing `<ui:contact />` from the text stream.

### Quick Actions Integration

The `generateQuickActions()` function from `quickActions_v2.ts` is called exactly as today, but with `matched_item_ids` sourced from Claude's `classify_response` tool call instead of from RAG retrieval results:

```typescript
const quickActions = generateQuickActions({
  query,
  intent: classifyResult.intent,           // From Claude's tool call
  results: matchedItems.map((item, i) => ({
    score: 1 - (i * 0.01),                 // Ordered by Claude's mention order
    doc: item,
  })),
  fullAnswer: accumulatedText,
  allItems: kbItems,
  rankings,
  depth,
  visitedNodes,
});
```

This means:
- "Get details" drill-down queries work as before
- GitHub/demo links appear for projects
- Skills dropdowns for items with skills
- "Message Mike" and "Ask a follow up" always available
- Depth limiting prevents infinite suggestion loops

### Caching Strategy

Preserved. The existing Redis + in-memory two-tier cache continues to work:

- **Cache key**: `answer:{normalizedQuery}:{intent}` (intent now comes from Claude's tool call)
- **TTL**: 1 hour
- **Time-sensitive bypass**: Queries with "today", "now", "recent" skip cache
- **Cache includes**: Full response text + quick actions + metadata

### GitHub Activity Flow

When Claude calls `fetch_github_activity`:

1. Pipeline intercepts the tool call
2. Fetches recent commits via GitHub API (existing `github.ts`)
3. Re-prompts Claude with the commit data as a follow-up message
4. Claude summarizes the activity conversationally
5. Response streams to client as normal

This replaces the current `github_activity` intent routing in the OpenAI route.

## What Gets Removed

### Files deleted
- `src/app/api/iris/answer-claude/route.ts` — merged into main route
- `src/lib/iris/embedding.ts` — no more embeddings
- `src/lib/iris/retrieval.ts` — no more semantic search
- `src/lib/iris/answer-utils/intent.ts` — Claude handles intent in single pass
- `src/lib/iris/answer-utils/planning.ts` — pre-routing/micro-planner not needed
- `src/lib/iris/answer-utils/aliases.ts` — Claude understands aliases from full KB context
- `src/data/iris/derived/embeddings.json` — no longer generated
- `scripts/build_embeddings.ts` — replaced by rankings build

### Code removed
- Version toggle (`'claude' | 'custom'`) in `IrisPalette.tsx`
- `openai` npm dependency (verify not used elsewhere first)
- Embedding-related imports and references throughout `answer-utils/`

### Files modified
- `src/app/api/iris/answer/route.ts` — major rewrite (OpenAI → Claude, tool-based intent)
- `src/components/IrisPalette.tsx` — remove version toggle, handle `contactForm` SSE event
- `src/components/iris/useUiDirectives.ts` — simplify to handle structured `contactForm` events instead of XML parsing
- `src/lib/iris/config.ts` — update model config to Claude, remove OpenAI settings
- `package.json` — update scripts (remove `build:embeddings` from `kb:rebuild`)

### Files preserved as-is
- `src/lib/iris/quickActions_v2.ts` — unchanged
- `src/lib/iris/actionConfig.ts` — unchanged
- `src/lib/iris/rankings.ts` — unchanged
- `src/lib/iris/loadRankings.ts` — unchanged
- `src/lib/iris/cache.ts` — unchanged
- `src/lib/iris/analytics.ts` — unchanged
- `src/lib/iris/load.ts` — unchanged
- `src/lib/iris/schema.ts` — unchanged
- `src/lib/iris/answer-utils/filters.ts` — kept for quick actions formatting
- `src/lib/iris/answer-utils/formatting.ts` — kept for KB formatting
- `src/lib/iris/answer-utils/responses.ts` — kept for fallbacks/guardrails
- `src/lib/iris/answer-utils/security.ts` — kept for input validation
- `src/lib/iris/answer-utils/ranking.ts` — kept for quick actions
- `src/lib/iris/answer-utils/text.ts` — kept for text utilities
- `src/lib/iris/answer-utils/types.ts` — kept for shared types
- All KB files in `src/data/iris/kb/`
- `src/data/iris/derived/rankings.json`
- `src/data/iris/derived/typeahead.json`

## Build Pipeline

```bash
# Before
npm run kb:rebuild  →  verify:kb + build:embeddings + build:typeahead

# After
npm run kb:rebuild  →  verify:kb + build:rankings + build:typeahead
```

`build:rankings` runs `rankings.ts` to compute importance scores for all KB items and writes `derived/rankings.json`. This replaces the OpenAI API call needed by `build:embeddings` — no external API key required at build time.

## Environment Variables

```bash
# Required (changed)
ANTHROPIC_API_KEY=sk-ant-...     # Replaces OPENAI_API_KEY for chat

# Kept
UPSTASH_REDIS_REST_URL=...       # Response caching
UPSTASH_REDIS_REST_TOKEN=...
GITHUB_TOKEN=ghp_...             # GitHub activity
NEXT_PUBLIC_SUPABASE_URL=...     # Analytics
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...               # Email notifications
ADMIN_API_KEY=...                # Admin dashboard

# Removed
# OPENAI_API_KEY — no longer needed (unless used elsewhere)
```

## Testing Strategy

### 1. Regression testing — existing suite

Run `npm run test:iris` (80+ cases) against the new Claude-powered endpoint. Same SSE format, same expected behavior. This is the primary regression gate.

Test categories:
- Base functionality and filter queries
- Employer/recruiter questions
- Specific item queries ("tell me about HiLiTe")
- Personal/bio information
- Edge cases, anti-hallucination
- Complex synthesis and multi-item responses
- Conversation threading and quick actions
- "Get details" drill-down queries (from quick action buttons)

### 2. New fuzzy query cases

The main motivation for this migration. Add test cases for queries that tripped up the RAG system:
- Indirect references: "that computer vision thing" → HiLiTe
- Multi-hop: "what skills did Mike use at his most recent job?"
- Conversational follow-ups: "tell me more" after a previous response
- Ambiguous: "what's the Greek game?" → Olympus Ascent
- Partial names: "the knight app" → Knight Life
- Cross-referencing: "projects that used the same tech as VesselsValue"

### 3. Tool call verification

Verify that Claude's tool calls produce correct structured output:
- `classify_response` returns valid intent + real KB item IDs
- `show_contact_form` triggers on appropriate queries
- `fetch_github_activity` triggers only on explicit activity requests
- Quick actions generated from tool call data match expected behavior

### 4. Updated typeahead suggestions

Since Claude handles fuzzier queries, update typeahead suggestions to be more natural/conversational. Test that the new suggestions produce good responses.

## Cost Estimate

With Claude Sonnet 4.6 and prompt caching:

- **KB size**: ~50-80K tokens (full JSON)
- **First request** (cache miss): ~$0.15-0.24 input + ~$0.01 output ≈ $0.25
- **Subsequent requests** (cache hit, ~90% discount): ~$0.015-0.024 input + ~$0.01 output ≈ $0.03
- **Redis caching**: Identical queries within 1 hour cost $0 (served from cache)

Compared to current OpenAI costs (2 GPT-4o-mini calls per query + embeddings at build time), this is comparable or cheaper for cached requests.

## Model Configuration

```typescript
// src/lib/iris/config.ts
export const config = {
  models: {
    chat: 'claude-sonnet-4-6',
  },
  chatSettings: {
    maxTokens: 1024,
  },
  // Performance budgets (unchanged)
  typeaheadMaxMs: 16,
  answerTargetLatencyMs: 2000,    // Slightly relaxed for Claude
  claudeTimeoutMs: 30000,
  retrievalTimeoutMs: 10000,      // Kept for GitHub API calls
};
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Claude occasionally doesn't call `classify_response` | Include firm instruction in system prompt + validate in stream handler, fall back to intent='general' |
| KB size exceeds context window | Currently ~50-80K tokens, well within 200K limit. Monitor as KB grows. |
| Prompt caching misses increase cost | System prompt is stable across requests — cache hits should be >90% in production |
| Response quality regression on specific query types | Run full test suite before deploying. Keep OpenAI route in git history for rollback reference. |
| `show_contact_form` tool call not recognized by client | Graceful degradation — if client doesn't see `contactForm` event, contact buttons still available via quick actions |
| Latency increase vs GPT-4o-mini | Claude Sonnet 4.6 TTFB may be slightly higher. Redis caching mitigates for repeated queries. Streaming masks perceived latency. |
