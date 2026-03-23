# CLAUDE.md - AI Assistant Guide

**Last Updated**: 2026-03-23
**Project**: mikeveson.com — Portfolio, Iris AI Assistant & The Web
**Stack**: Next.js 15, React 19, TypeScript, Anthropic Claude, Redis, Supabase, Twilio, Resend

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Architecture](#codebase-architecture)
3. [Key Systems](#key-systems)
4. [Development Workflow](#development-workflow)
5. [Code Conventions](#code-conventions)
6. [Testing Guidelines](#testing-guidelines)
7. [Common Tasks](#common-tasks)
8. [Important Files Reference](#important-files-reference)
9. [AI Assistant Guidelines](#ai-assistant-guidelines)

---

## 🌟 Project Overview

This is a **modern full-stack personal portfolio** featuring **Iris** - an intelligent AI assistant that uses RAG (Retrieval-Augmented Generation) to answer questions about Mike's work experience, projects, education, and background.

### Core Features

- **Iris AI Assistant**: Command palette (⌘K) powered by Claude Sonnet 4.6 with the full KB in context
- **Full-Context AI**: Entire knowledge base passed in a prompt-cached system prompt — no embeddings or semantic search
- **Smart Inbox**: "Ask Mike" contact system with email notifications
- **Interactive UI**: Mouse glow effects, animations, dark mode
- **Knowledge Base**: 10 document types (projects, experience, classes, skills, etc.)
- **Streaming Responses**: Real-time SSE with progressive rendering

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Anthropic Claude API, Upstash Redis, Supabase PostgreSQL
- **UI**: shadcn/ui, Framer Motion, cmdk (command palette)
- **Email**: Resend API for inbox notifications
- **Note**: OpenAI API is still used for blog Iris draft generation (not the main Iris assistant)

---

## 🏗️ Codebase Architecture

### Directory Structure

```
mikedouz-portfolio/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/                # API routes
│   │   │   ├── iris/           # Iris AI endpoints
│   │   │   │   ├── answer/     # Main chat endpoint (POST/GET)
│   │   │   │   ├── suggest/    # Typeahead suggestions
│   │   │   │   └── health/     # Health check
│   │   │   └── inbox/          # "Ask Mike" contact API
│   │   ├── admin/inbox/        # Admin message dashboard
│   │   ├── games/rack-rush/    # Word game
│   │   ├── playground/         # Interactive demos
│   │   ├── layout.tsx          # Root layout (theme, analytics, Iris)
│   │   └── page.tsx            # Home page
│   │
│   ├── components/             # React components
│   │   ├── iris/               # Iris-specific components
│   │   │   ├── MessageComposer.tsx    # Contact form
│   │   │   ├── ContactCta.tsx         # Contact CTA button
│   │   │   └── useUiDirectives.ts     # UI directive parser
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── IrisPalette.tsx     # Main Iris command palette
│   │   ├── mouse_glow.tsx      # Global glow effect
│   │   └── ContainedMouseGlow.tsx  # Card glow effect
│   │
│   ├── lib/                    # Business logic & utilities
│   │   ├── iris/               # Iris AI system
│   │   │   ├── answer-utils/   # Modular answer utilities
│   │   │   ├── config.ts       # Feature toggles, model config
│   │   │   ├── schema.ts       # Zod schemas & TypeScript types
│   │   │   ├── load.ts         # KB data loaders (full KB serialized into Claude context)
│   │   │   ├── cache.ts        # Redis caching
│   │   │   ├── quickActions.ts # Smart follow-up suggestions
│   │   │   └── analytics.ts    # Query logging
│   │   ├── supabaseAdmin.ts    # Supabase client & queries
│   │   ├── security.ts         # Input sanitization
│   │   ├── rateLimit.ts        # Rate limiting
│   │   └── types.ts            # Shared TypeScript types
│   │
│   └── data/
│       └── iris/
│           ├── kb/             # Knowledge base (JSON)
│           │   ├── profile.json      # Bio, education, values, interests
│           │   ├── projects.json     # Technical projects
│           │   ├── experience.json   # Work history
│           │   ├── classes.json      # Academic courses
│           │   ├── skills.json       # 851 skills with aliases
│           │   ├── blogs.json        # Blog posts
│           │   └── contact.json      # Contact info
│           └── derived/        # Pre-computed data
│               └── typeahead.json    # Search suggestions
│
├── scripts/                    # Build & test utilities
│   ├── build_typeahead.ts      # Generate suggestions (v1)
│   ├── build_typeahead_v2.ts   # Enhanced suggestions (v2)
│   ├── build_rankings.ts       # Pre-compute importance rankings
│   ├── verify_kb.ts            # Validate KB structure
│   ├── test_iris.ts            # Interactive test suite (80+ cases)
│   └── clear_cache.ts          # Redis cache clearing
│
├── supabase/migrations/        # Database schemas
│   ├── 20251027_inbox.sql      # Inbox table
│   └── 20251027_inbox_add_context.sql  # Context fields
│
├── TESTING.md                  # Comprehensive testing guide
├── README.md                   # Main documentation
└── CLAUDE.md                   # This file
```

---

## 🔑 Key Systems

### 1. Iris AI Assistant

**Location**: `src/app/api/iris/answer/route.ts` (main endpoint), `src/lib/iris/` (core logic)

#### Intent System (via Claude Tool Call)

Iris classifies queries into intent types using Claude Sonnet 4.6 with a tool call — no separate intent classification step. Claude receives the full KB in context and uses a `classify_query` tool to determine intent and any structured parameters in a single pass.

| Intent | Purpose | Routing Logic |
|--------|---------|---------------|
| **`contact`** | Fast-path for contact info | Returns static contact data directly |
| **`filter_query`** | Structured filtering | Uses `applyFilters()` with exact skill/year/type matching |
| **`specific_item`** | Details about a specific item | Claude searches its full-context KB |
| **`personal`** | Family/values/interests | Claude draws from stories, values, interests, bio |
| **`general`** | Open-ended query | Claude answers from full KB context |

Intent detection happens inside the same Claude call that generates the answer — there is no separate GPT step.

#### Claude Full-Context Pipeline

```
User Query (⌘K)
    ↓
Full KB serialized into prompt-cached system prompt
    ↓
Claude Sonnet 4.6 (single API call, streaming)
  ├─ Tool call: classify_query → intent + filters
  └─ Streaming answer (uses full KB in context)
    ↓
SSE Response (to frontend)
```

**Key Files**:
- `src/app/api/iris/answer/route.ts` - Main endpoint (~820 lines); contains KB serialization, Claude call, and streaming logic
- `src/lib/iris/answer-utils/filters.ts` - Structured filtering for `filter_query` intent
- `src/lib/iris/load.ts` - KB data loaders (full KB loaded and serialized per request, cached by Claude prompt caching)

#### Knowledge Base Structure

**Location**: `src/data/iris/kb/`

10 document types with Zod schemas:

```typescript
// Core types (see src/lib/iris/schema.ts)
type KBItem =
  | ProjectT       // Tech projects (architecture, stack, dates)
  | ExperienceT    // Work history (company, role, specifics)
  | ClassT         // Academic courses (term, professor, skills)
  | BlogT          // Blog posts
  | StoryT         // Personal background stories
  | ValueT         // Core values with explanations
  | InterestT      // Hobbies and interests
  | EducationT     // Schools, degrees, GPA, graduation dates
  | BioT           // Personal info, headline, availability
  | SkillT         // 851 skills with aliases, types, evidence

// Each item includes:
interface BaseKBItem {
  id: string;
  summary: string;
  skills?: string[];      // Linked to skills.json
  dates?: DateRange;      // For temporal filtering
  specifics?: string[];   // Detailed bullet points
}
```

**Important**: Skills use IDs (`react`, `python`) not display names. See `skills.json` for the full taxonomy.

#### Caching Strategy

**File**: `src/lib/iris/cache.ts`

- **Response Cache**: 1-hour Redis TTL for identical queries
- **Cache Key**: Normalized query string (lowercase, trimmed)
- **Cache Clearing**: `npm run clear:cache` or `/api/iris/cache/clear` endpoint
- **Development**: Cache may need clearing when testing same queries

#### Quick Actions v2 (Config-Driven System)

**Core Files**:
- `src/lib/iris/quickActions_v2.ts` - Main generation logic
- `src/lib/iris/actionConfig.ts` - Declarative action templates (818 lines)
- `src/lib/iris/rankings.ts` - Importance scoring algorithm
- `src/components/iris/QuickActions.tsx` - UI component

**System Overview**:
Quick Actions v2 is a config-driven system that automatically generates contextual follow-up actions after each Iris response. Actions are determined by:
1. **KB item type** (project, experience, class, skill, blog, etc.)
2. **Available data** (GitHub link, demo, company website, skills)
3. **Importance rankings** (0-100 scores based on complexity, impact, recency)
4. **Conversation depth** (limits follow-ups to prevent infinite loops)

**5 Action Types**:
1. **link** - External links (GitHub, demo, article, company website)
2. **dropdown** - Searchable dropdowns (skills, evidence) [TODO: implement UI]
3. **query** - Pre-filled Iris queries (related projects, work using skills)
4. **message_mike** - Opens MessageComposer
5. **custom_input** - Generic "Ask a follow up..." text field

**Action Configuration** (`actionConfig.ts`):
Each KB item type has declarative action templates:
```typescript
ACTION_CONFIG['project'] = [
  {
    type: 'link',
    label: 'GitHub',
    priority: 9,
    condition: (item) => 'links' in item && 'github' in (item.links || {}),
    getData: (item) => ({ link: item.links?.github, linkType: 'github' })
  },
  {
    type: 'dropdown',
    label: 'Skills',
    priority: 8,
    getData: (item, rankings) => ({
      options: item.skills
        .map(skillId => ({
          id: skillId,
          label: formatSkillId(skillId), // "nlp" → "NLP"
          importance: rankings.skills.find(s => s.id === skillId)?.importance || 50
        }))
        .sort((a, b) => b.importance - a.importance)
    })
  },
  // ... more actions
]
```

**Importance Ranking System** (`rankings.ts`):
All KB items are scored 0-100 based on:

- **Skills**: Evidence count (projects/experience using it), complexity (ML > basic), recency
- **Projects**: Complexity (60%), diversity (25%), impact metrics (25%), demo/production (12%), AI cutting-edge (10%)
- **Experiences**: Complexity (50%), impact (30%), skill breadth (20%), recency (15%)
- **Classes**: Complexity, recency, has projects

**Example Rankings** (internal use only, never shown to users):
- **Top Projects**: HiLiTe (ML/CV sophistication), Knight Life (4.9★ + 100+ users), Iris (RAG complexity)
- **Top Experiences**: VesselsValue, Veson 2024, Lilie, Parsons
- **Top Skills**: RAG, NLP, PyTorch, Machine Learning (high complexity + evidence)

Rankings influence:
1. Which quick actions appear first (priority)
2. Which skills show in dropdowns (top by importance)
3. Which drill-down actions suggest (top items)

**Short Label System** (`actionConfig.ts:23-122`):
Clean, concise labels for better UX:

- **Skills**: `formatSkillId()` transforms raw IDs
  - `nlp` → `NLP` (uppercase acronyms)
  - `machine_learning` → `Machine Learning` (title case)
  - `pytorch` → `PyTorch` (special cases)
  - `csharp` → `C#`, `nextjs` → `Next.js`

- **Experiences**: `getShortExperienceLabel()` creates compact labels
  - Full: "Software Engineering Intern (IMOS – Laytime Automation)"
  - Short: "Veson (SWE)"
  - Pattern: `Company (Role Type)`

**Depth Limiting**:
- **Specific actions** (drill-downs): Only until depth 2
- **Generic follow-up** ("Ask a follow up..."): Until depth 4
- **Contact actions**: Always available
- Prevents infinite suggestion loops while allowing continued conversation

**GitHub Activity Integration**:
- "Fetch recent updates" action for projects with GitHub links
- Triggers `github_activity` intent
- Fetches real commits via GitHub API (`src/lib/iris/github.ts:getRepoCommits()`)
- Iris summarizes commit messages in conversational tone

**Link Policy**:
Quick actions provide ALL links (GitHub, LinkedIn, demo, company).
Iris is instructed to NEVER include raw URLs in response text - only reference that resources exist (e.g., "The code is on GitHub").
This prevents duplicate links (text + button) and provides consistent UX.

### 2. Ask Mike Inbox System

**Location**: `src/app/api/inbox/route.ts`, `src/app/admin/inbox/page.tsx`

#### Features
- **Multiple Contact Methods**: Email, phone (E.164 format), or anonymous
- **Smart Integration**: Triggered by Iris via `<ui:contact />` directives
- **Email Notifications**: Rich HTML emails via Resend API
- **Security**: Rate limiting, honeypot detection, input sanitization
- **Admin Dashboard**: Secure message management with status tracking

#### UI Directives

Iris emits structured directives during streaming:

```xml
<ui:contact reason="insufficient_context" draft="Ask about summer internship plans" />
<ui:contact reason="user_request" draft="Contact Mike directly" />
<ui:contact reason="more_detail" draft="Get more details about HiLiTe" />
```

**Parser**: `src/components/iris/useUiDirectives.ts`

### 3. Mouse Glow System

**Files**: `src/components/mouse_glow.tsx`, `src/components/ContainedMouseGlow.tsx`

- **Global Glow**: Subtle blue ring following cursor across the site
- **Contained Glows**: Color-coded glows within cards (green for projects, purple for blogs, blue for experience)
- **Smart Detection**: Automatically disabled on mobile/touch devices
- **Custom Glows**: Specialized effects for interactive elements

**Usage**:
```tsx
<div className="relative overflow-hidden" data-has-contained-glow="true">
  <ContainedMouseGlow color="147, 197, 253" intensity={0.4} />
  {/* Your content */}
</div>
```

---

## 🔧 Development Workflow

### Environment Setup

1. **Clone & Install**
   ```bash
   git clone https://github.com/mikedouzinas/mikedouz-portfolio.git
   cd mikedouz-portfolio
   npm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env.local
   ```

   **Required for Iris**:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   ```

   **Optional (production features)**:
   ```bash
   OPENAI_API_KEY=sk-...                   # Blog Iris draft generation only (not main Iris)

   UPSTASH_REDIS_REST_URL=https://...      # Caching
   UPSTASH_REDIS_REST_TOKEN=...

   NEXT_PUBLIC_SUPABASE_URL=https://...    # Analytics & inbox
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...

   GITHUB_TOKEN=ghp_...                    # Live activity context
   RESEND_API_KEY=...                      # Email notifications
   ADMIN_API_KEY=...                       # Admin dashboard access
   ```

3. **Build Knowledge Base**
   ```bash
   npm run kb:rebuild
   # Runs: verify:kb + build:typeahead + build:rankings
   # No embeddings step needed — Claude uses full KB in context
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   # Open http://localhost:3000
   # Press ⌘K to open Iris
   ```

### Key Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Production build
npm start                # Start production server

# Knowledge Base
npm run kb:rebuild       # Full rebuild (verify + typeahead + rankings)
npm run verify:kb        # Validate KB structure with Zod schemas
npm run build:typeahead  # Generate suggestions (v1 + v2)
npm run build:rankings   # Pre-compute importance rankings

# Testing
npm run test:iris        # Interactive test suite (80+ cases)
npm run lint             # ESLint check

# Utilities
npm run clear:cache      # Clear Redis cache (if script exists)
```

### Making Changes

#### 1. Updating Knowledge Base

**Edit KB files** in `src/data/iris/kb/`:
- `profile.json` - Bio, education, values, interests
- `projects.json` - Add/update projects
- `experience.json` - Add/update work history
- `classes.json` - Add/update courses
- `skills.json` - Extend skill taxonomy (use IDs not display names)

**After changes**:
```bash
npm run verify:kb        # Check for errors
npm run kb:rebuild       # Rebuild typeahead + rankings
npm run test:iris        # Test queries
```

**Note**: No embeddings rebuild required — Iris is powered by Claude Sonnet 4.6 with the full KB passed in context. The KB is serialized and included directly in the prompt-cached system prompt.

**Important**: Always use skill IDs (`react`, `python`) not display names ("React", "Python") in KB files.

#### 2. Modifying Iris Behavior

**Change AI Models** (`src/lib/iris/config.ts`):
```typescript
export const config = {
  models: {
    chat: 'claude-sonnet-4-6',  // Anthropic Claude Sonnet 4.6
  },
  chatSettings: {
    temperature: 1,
    maxTokens: 800  // Increase for longer responses
  }
};
```

**Adjust Intent Detection** — intent is detected by Claude via tool call inside `route.ts`. To add or modify intent types, update the `classify_query` tool schema in `src/app/api/iris/answer/route.ts`.

**Update System Prompt** (`src/app/api/iris/answer/route.ts` ~line 100):
- Anti-hallucination instructions
- Response style guidelines
- Context formatting rules

#### 3. Adding New Components

Follow shadcn/ui patterns:
```bash
# Add new shadcn component
npx shadcn-ui@latest add <component-name>
```

**Component Guidelines**:
- Use TypeScript with strict types
- Export as default or named export
- Include proper accessibility (ARIA labels)
- Support dark mode with Tailwind dark: variants

#### 4. API Route Changes

**File**: `src/app/api/*/route.ts`

Next.js 15 App Router conventions:
```typescript
// POST handler
export async function POST(request: Request) {
  const body = await request.json();
  // ... logic
  return Response.json(data);
}

// GET handler with params
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // ... logic
  return Response.json(data);
}
```

**Streaming Responses** (SSE):
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
    controller.close();
  }
});
return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

---

## 📝 Code Conventions

### Naming Conventions

| Type | Convention | Examples |
|------|------------|----------|
| **Components** | PascalCase | `IrisPalette.tsx`, `MessageComposer.tsx` |
| **Functions** | camelCase | `getRandomLoadingMessage()`, `applyFilters()` |
| **Types** | PascalCase + 'T' suffix | `ProjectT`, `ExperienceT`, `KBItemT` |
| **Interfaces** | PascalCase | `EmbeddingCache`, `QuickAction` |
| **Constants** | UPPER_SNAKE_CASE | `FIELD_MAP`, `TYPE_FILTERS`, `MAX_RESULTS` |
| **Files** | snake_case or kebab-case | `mouse_glow.tsx`, `base_card.tsx` |

### File Organization

```
src/
├── app/          # Next.js routes (pages, API endpoints)
├── components/   # React components (organized by feature)
├── lib/          # Business logic, utilities, types
├── data/         # Static data, loaders
└── styles/       # Global CSS
```

**Component Organization**:
- Main components in `src/components/`
- Feature-specific components in subdirectories (e.g., `iris/`)
- Shared UI components in `src/components/ui/` (shadcn)

**Library Organization**:
- Domain logic in subdirectories (e.g., `lib/iris/`)
- Shared utilities at root level (e.g., `lib/security.ts`)

### TypeScript Patterns

**Strict Mode** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true
  }
}
```

**Zod Schemas** for validation:
```typescript
import { z } from 'zod';

const ProjectSchema = z.object({
  id: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  dates: z.object({
    start: z.string(),
    end: z.string().optional()
  }).optional()
});

type ProjectT = z.infer<typeof ProjectSchema>;
```

**Path Aliases** (`tsconfig.json`):
```typescript
import { loadProjects } from '@/lib/iris/load';
import IrisPalette from '@/components/IrisPalette';
```

### React Patterns

**Server Components** (default in Next.js 15):
```typescript
// app/page.tsx
export default async function HomePage() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

**Client Components** (for interactivity):
```typescript
'use client';

import { useState } from 'react';

export default function IrisPalette() {
  const [query, setQuery] = useState('');
  // ...
}
```

**Hooks**:
- Use built-in React hooks (useState, useEffect, useRef)
- Custom hooks in separate files (e.g., `useUiDirectives.ts`)
- Follow React naming convention (use*)

---

## ✅ Testing Guidelines

### Manual Testing

**Interactive Test Suite**:
```bash
npm run test:iris
```

This runs 11 test suites with 80+ cases covering:
- Base functionality and filter queries
- Employer/recruiter questions
- Specific item queries and personal/bio information
- Edge cases, anti-hallucination
- Complex synthesis and multi-item responses
- Conversation threading and quick actions

### Test Categories (from TESTING.md)

1. **Base Cases** (6 tests) - Core functionality
2. **Filter Queries** (4 tests) - Structured search
3. **Personal Queries** (4 tests) - Bio/education
4. **Edge Cases** (3 tests) - No context handling
5. **Anti-Hallucination** (3 tests) - No fabrication
6. **Intent Detection** (4 tests) - Query classification
7. **Complex Queries** (3 tests) - Multi-item synthesis

### Pre-Commit Checklist

```bash
# 1. Verify KB structure
npm run verify:kb

# 2. Rebuild KB artifacts if KB changed
npm run kb:rebuild

# 3. Run tests
npm run test:iris

# 4. Check linting
npm run lint

# 5. Build for production
npm run build
```

### Common Issues

**Issue**: Iris returns wrong or incomplete information after KB update
**Solution**: KB is serialized into the prompt at runtime — no embeddings rebuild needed. Just ensure `npm run verify:kb` passes and restart the dev server.

**Issue**: Hallucinated information
**Fix**: Review system prompt anti-hallucination rules in `src/app/api/iris/answer/route.ts` (top of file near system prompt constant)

**Issue**: Filter queries not working
**Check**: `applyFilters()` function in `answer/route.ts`, verify skills in KB match query terms (case-insensitive)

**Issue**: Cache preventing updated responses
**Solution**: Clear cache or modify query slightly
```bash
# If clear_cache.ts script exists:
npm run clear:cache
# Or restart Redis
```

---

## 🔨 Common Tasks

### Task 1: Add a New Project

1. **Edit** `src/data/iris/kb/projects.json`:
```json
{
  "id": "new-project",
  "summary": "Brief description of the project",
  "skills": ["react", "typescript", "tailwindcss"],
  "dates": {
    "start": "2025-01-01",
    "end": "2025-06-01"
  },
  "links": {
    "github": "https://github.com/...",
    "live": "https://..."
  },
  "architecture": "Optional detailed architecture description",
  "specifics": [
    "Bullet point 1",
    "Bullet point 2"
  ]
}
```

2. **Rebuild KB artifacts**:
```bash
npm run verify:kb
npm run kb:rebuild
```

3. **Test**:
```bash
npm run test:iris
# Try query: "tell me about new-project"
```

### Task 2: Add a New Skill

1. **Edit** `src/data/iris/kb/skills.json`:
```json
{
  "id": "new_skill",
  "name": "New Skill",
  "type": "framework",
  "aliases": ["newskill", "new-skill"],
  "evidenceFrom": ["project-id", "experience-id"]
}
```

2. **Update KB items** to reference `new_skill` ID (not display name)

3. **Rebuild**:
```bash
npm run verify:kb
npm run kb:rebuild
```

### Task 3: Modify Iris Response Style

1. **Edit system prompt** in `src/app/api/iris/answer/route.ts` ~line 845:
```typescript
const systemPrompt = `You are Iris, Mike's AI assistant...

Response Guidelines:
- Be concise and direct
- Use markdown for formatting
- Include specific details from context
- NEVER fabricate information not in context
...`;
```

2. **Test changes**:
```bash
npm run dev
# Open http://localhost:3000, press ⌘K, try queries
```

### Task 4: Add New Intent Type

1. **Edit** the `classify_query` tool schema in `src/app/api/iris/answer/route.ts`:
```typescript
// Add new value to the intent enum in the tool input_schema
{
  name: 'classify_query',
  input_schema: {
    properties: {
      intent: {
        enum: [...existingIntents, 'new_intent'],
        description: 'When user asks about...'
      }
    }
  }
}
```

2. **Add routing logic** in the same file after the tool call result:
```typescript
if (intent === 'new_intent') {
  // Handle new intent
}
```

3. **Test thoroughly** with `npm run test:iris`

### Task 5: Clear Redis Cache

**During development**, cached responses can prevent seeing changes:

1. **Option 1**: Modify query slightly
   ```
   "what projects has mike worked on?"
   → "what projects has mike worked on"  (remove punctuation)
   ```

2. **Option 2**: Use cache clearing script (if exists):
   ```bash
   npm run clear:cache
   ```

3. **Option 3**: Hit cache clear endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/iris/cache/clear
   ```

---

## 📚 Important Files Reference

### Configuration

| File | Purpose |
|------|---------|
| `src/lib/iris/config.ts` | Feature toggles, model config, performance budgets |
| `tsconfig.json` | TypeScript compiler options, path aliases |
| `next.config.ts` | Next.js configuration |
| `tailwind.config.ts` | Tailwind CSS theme, colors, plugins |
| `.env.local` | Environment variables (not committed) |
| `.env.example` | Example environment variables |

### Core Iris Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/app/api/iris/answer/route.ts` | Main Iris endpoint — KB serialization, Claude call, streaming, intent routing | ~820 |
| `src/lib/iris/schema.ts` | Zod schemas & TypeScript types | 1600+ |
| `src/lib/iris/load.ts` | KB data loaders (full KB passed to Claude in context) | 200+ |
| `src/lib/iris/quickActions.ts` | Smart follow-up generation | 400+ |
| `src/lib/iris/answer-utils/filters.ts` | Structured filtering for `filter_query` intent | — |
| `src/lib/iris/rankings.ts` | Importance scoring for quick actions | — |

Note: `retrieval.ts`, `embedding.ts`, `intents.ts`, `planning.ts`, and `aliases.ts` were removed in the Claude migration — intent detection and retrieval are now handled by Claude with the full KB in context.

### Knowledge Base

| File | Purpose | Size |
|------|---------|------|
| `src/data/iris/kb/profile.json` | Bio, education, values, interests | 4.3 KB |
| `src/data/iris/kb/projects.json` | Technical projects | 5.8 KB |
| `src/data/iris/kb/experience.json` | Work history | 6.0 KB |
| `src/data/iris/kb/classes.json` | Academic courses | 9.7 KB |
| `src/data/iris/kb/skills.json` | 851 skills with aliases | 27.7 KB |
| `src/data/iris/kb/blogs.json` | Blog posts | 915 B |
| `src/data/iris/kb/contact.json` | Contact info | 243 B |

### Documentation

| File | Purpose |
|------|---------|
| `README.md` | Main project documentation |
| `TESTING.md` | Comprehensive testing guide |
| `CLAUDE.md` | This file - AI assistant guide |
| `.env.example` | Environment variable template |

---

## 🤖 AI Assistant Guidelines

### When Working on This Codebase

#### DO:
- ✅ **Update the KB when shipping new features** — When a significant feature is added to mikeveson.com (new system, new page, new capability), update the `proj_portfolio` entry in `src/data/iris/kb/projects.json` to include it in the specifics. This site has many subsystems (Iris, The Web, Spotify timeline, deep mode, Olympus game, inbox, blog Iris interactions) and the KB entry should reflect the current state so Iris can answer questions about what the site includes. Also update skill IDs and tech stack if new technologies are introduced.
- ✅ **Run `npm run kb:rebuild`** after changing KB files (no embeddings step needed — Claude uses full KB in context)
- ✅ **Use skill IDs** (e.g., `react`, `python`) not display names in KB files
- ✅ **Test with `npm run test:iris`** after significant changes
- ✅ **Run `npm run verify:kb`** to catch schema errors early
- ✅ **Check cache** if responses seem stale (clear or modify query)
- ✅ **Follow TypeScript strict mode** - no `any` types
- ✅ **Use Zod schemas** for all data validation
- ✅ **Preserve anti-hallucination rules** in system prompts
- ✅ **Document complex logic** with comments
- ✅ **Use path aliases** (`@/lib/...`) not relative paths
- ✅ **Test on mobile** - responsive design is critical
- ✅ **Support dark mode** - use Tailwind `dark:` variants

#### DON'T:
- ❌ **Never commit `.env.local`** - contains secrets
- ❌ **Don't modify `node_modules/`** - use package.json
- ❌ **Don't skip `npm run verify:kb`** after KB changes — catches schema errors before they affect Iris
- ❌ **Don't use display names for skills** - use IDs
- ❌ **Don't weaken anti-hallucination prompts** - accuracy is critical
- ❌ **Don't break backward compatibility** without good reason
- ❌ **Don't add dependencies** without discussion
- ❌ **Don't remove error handling** - graceful degradation is key
- ❌ **Don't hardcode secrets** - use environment variables
- ❌ **Don't ignore TypeScript errors** - fix them before committing

### Understanding Iris Queries

**When a user reports an issue**:

1. **Check the intent classification** - Did Claude detect the right intent?
   - Intent is determined via a `classify_query` tool call inside `src/app/api/iris/answer/route.ts`
   - Test: Run query through `/api/iris/answer` and check server logs for the tool call result

2. **Check KB content** - Does the KB contain the relevant information?
   - Claude has the full KB in context — if the answer is wrong or missing, check the KB JSON files
   - Run `npm run verify:kb` to confirm KB passes schema validation

3. **Check structured filtering** - For `filter_query` intent, is filtering working?
   - File: `src/lib/iris/answer-utils/filters.ts`
   - Verify skills in KB match query terms (case-insensitive)

4. **Check system prompt** - Are instructions clear and complete?
   - File: `src/app/api/iris/answer/route.ts` (system prompt near top of file)

5. **Check cache** - Is a stale response being returned?
   - Clear cache or modify query to bypass

### Performance Considerations

**Latency Targets** (from `src/lib/iris/config.ts`):
- Typeahead: <16ms
- Answer p50: 1.5s on broadband
- Retrieval timeout: 10s
- LLM generation timeout: 25s

**Optimization Strategies**:
- Pre-compute embeddings at build time
- Cache responses for 1 hour (Redis)
- Use field filtering to reduce context size
- Limit results to top-K (usually 5)
- Stream responses for perceived speed

### Security Considerations

**Input Validation**:
- All user input validated with Zod schemas
- HTML escaping for XSS prevention (file: `src/lib/security.ts`)
- Phone numbers validated with libphonenumber-js (file: `src/lib/phone.ts`)

**Prompt Injection Detection**:
- Pattern-based checks in `src/lib/iris/answer-utils/security.ts`
- Off-topic detection with entity whitelist

**Rate Limiting**:
- IP-based rate limiting on inbox submissions (file: `src/lib/rateLimit.ts`)
- Honeypot spam detection

**Environment Variables**:
- Server-side only: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_API_KEY`
- Client-side allowed: `NEXT_PUBLIC_*` variables

### Common Debugging Steps

**Iris returns "I don't have information..."**:
1. Check if KB files contain relevant data
2. Verify embeddings are up to date: `npm run build:embeddings`
3. Test semantic search manually in `retrieval.ts`
4. Check if intent detection is correct

**Iris hallucinates information**:
1. Review system prompt anti-hallucination rules
2. Check if context contains incorrect data
3. Verify KB files have accurate information
4. Test with `npm run test:iris` anti-hallucination suite

**Build errors**:
1. Check TypeScript errors: `npm run build`
2. Verify Zod schemas: `npm run verify:kb`
3. Check for missing dependencies: `npm install`
4. Clear `.next` folder and rebuild

**API route errors**:
1. Check environment variables are set
2. Verify API keys are valid (OpenAI, Redis, Supabase)
3. Check network connectivity to external services
4. Review error logs in console

---

## 📋 Quick Reference Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build               # Production build
npm start                   # Start production server

# Knowledge Base Management
npm run kb:rebuild          # Full rebuild (verify + typeahead + rankings; no embeddings needed)
npm run verify:kb           # Validate KB structure
npm run build:typeahead     # Generate search suggestions
npm run build:rankings      # Pre-compute importance rankings for quick actions

# Testing
npm run test:iris           # Interactive test suite (80+ cases)
npm run lint                # ESLint check

# Utilities
npm run clear:cache         # Clear Redis cache (if script exists)
```

---

## 📞 Getting Help

**Documentation**:
- Main README: `README.md`
- Testing Guide: `TESTING.md`
- This Guide: `CLAUDE.md`

**Key Files to Understand**:
1. `src/lib/iris/schema.ts` - All data types
2. `src/lib/iris/config.ts` - Configuration options
3. `src/app/api/iris/answer/route.ts` - Main endpoint logic
4. `TESTING.md` - How to test changes

**Common Issues**:
- KB changes not reflected → Rebuild embeddings
- Cached responses → Clear cache or modify query
- TypeScript errors → Check `tsconfig.json` and types
- Build failures → Run `npm run verify:kb`

---

## 🎮 Games Development: Ascent to Olympus

### Feature Overview

**Location**: `src/app/games/olympus-ascent/`
**Spec Document**: `docs/FEATURE_olympus-ascent-game.md` (READ THIS FIRST)
**Trigger**: Click profile photo (desktop only)

This is a Chrome-dinosaur-style endless runner with deep personal meaning to Mike. Every element (obstacles, collectibles, backgrounds) has real significance. The spec document contains all context needed.

### Critical: Read the Spec First

Before writing ANY code for this game, read the entire `docs/FEATURE_olympus-ascent-game.md`. It contains:

1. **Personal Context**: Why each element matters to Mike
2. **Depth Progression System**: Items unlock based on score (surface stuff early, deep meaning later)
3. **Visual Design**: Colors, sprites, parallax layers
4. **Technical Architecture**: File structure, state management, physics
5. **Sacred Items**: The S Rock, Owl, Shark Tooth, 2025 Coin, and Lily have REAL meaning

### Architecture Pattern

Follow the existing `rack-rush` game pattern:

```
/src/app/games/olympus-ascent/
├── context/GameContext.tsx    # React Context + useReducer (like rack-rush)
├── components/                # UI components (React)
├── engine/                    # Game loop, physics, rendering (Canvas)
├── entities/                  # Player, obstacles, collectibles
├── systems/                   # Spawning, parallax, effects
├── utils/                     # Constants, types, helpers
└── hooks/                     # useGameLoop, useKeyboard, etc.
```

### Key Technical Decisions

1. **Rendering**: Use HTML5 Canvas (not DOM) for 60fps performance
2. **State**: React Context for game state, refs for animation frame
3. **Physics**: Simple AABB collision detection
4. **Assets**: Store sprites in `/public/games/olympus/`
5. **Audio**: Web Audio API (optional, graceful fallback)

### Depth Tier System

**IMPORTANT**: Items unlock based on score tier:

| Tier | Score | What Unlocks |
|------|-------|--------------|
| PUBLIC | 0-119 | Greek obstacles, Barcelona references, drachmas |
| CONVERSATIONAL | 120-239 | HIMYM references, yellow umbrella, Olympian power-ups |
| FRIEND | 240-359 | The Lantern icon, 12-bonuses prominent |
| CLOSE_CIRCLE | 360-479 | Sacred items (S Rock, Owl, Shark Tooth, 2025 Coin) |
| CORE | 480+ | Lily flower, M12V flag, "For Lily" text |

### Testing the Game

```bash
npm run dev
# Navigate to http://localhost:3000
# Click profile photo to trigger game
# Test all score tiers (use dev cheats if needed)
```

### DO NOT:
- ❌ Hardcode all easter eggs at once (use tier system)
- ❌ Skip reading the spec document
- ❌ Use random asset URLs (check `/public/games/olympus/`)
- ❌ Forget the personal significance (Lily is NOT just a flower)

### DO:
- ✅ Read `docs/FEATURE_olympus-ascent-game.md` completely
- ✅ Follow the existing games architecture
- ✅ Implement depth tier unlocking properly
- ✅ Test all tier transitions
- ✅ Make the 12-bonus feel special

---

## The Web Blog System

### Overview

"the web" is Mike's blog on mikeveson.com. Research, reactions, and thinking, all connected. Posts are stored in Supabase (not git), published via API, and rendered at `/the-web`.

### Architecture

- **Database**: Supabase `blog_posts` table with full-text search (weighted tsvector), JSONB `theme` field for per-post visual customization
- **API**: `src/app/api/the-web/route.ts` (list/create), `src/app/api/the-web/[slug]/route.ts` (read/update)
- **Auth**: `ADMIN_API_KEY` env var passed as `x-admin-key` header for POST/PUT
- **Frontend**: `/the-web` page (stream with search + tag filtering), `/the-web/[slug]` (individual post)
- **Visual**: Spider web pattern reveals on mouse hover (CSS mask-image flashlight effect)

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/blog.ts` | Types, Supabase queries, reading time calc |
| `src/app/api/the-web/route.ts` | GET (public list) + POST (admin create) |
| `src/app/api/the-web/[slug]/route.ts` | GET (single post) + PUT (admin update) |
| `src/app/the-web/page.tsx` | Main stream page (client component) |
| `src/app/the-web/[slug]/page.tsx` | Individual post page (server component, SEO) |
| `src/app/the-web/components/WebPattern.tsx` | Hover-reveal spider web background |
| `src/app/the-web/components/PostCard.tsx` | Blog post card with per-post glow color |
| `src/app/the-web/components/MarkdownRenderer.tsx` | Styled markdown rendering |
| `src/app/blogs/blog_card.tsx` | Homepage blog card (in media section) |
| `src/data/iris/kb/blogs.json` | KB entries for Iris + homepage display |
| `supabase/migrations/20260310_blog_posts.sql` | Database schema |

### Publishing a Post

Use the `/publish` Claude Code command from the Obsidian vault, OR manually via API:

```bash
curl -X POST http://localhost:3000/api/the-web \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{
    "title": "Post Title",
    "slug": "post-slug",
    "subtitle": "Optional subtitle",
    "body": "Full markdown content...",
    "tags": ["ethics", "technology"],
    "status": "published",
    "theme": {
      "accent_color": "168, 85, 247"
    }
  }'
```

### Updating an Existing Post

```bash
curl -X PUT http://localhost:3000/api/the-web/post-slug \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{
    "title": "Updated Title",
    "body": "Updated markdown...",
    "tags": ["updated", "tags"]
  }'
```

### Per-Post Theming

Each post can have a custom `theme` JSONB field:

```json
{
  "accent_color": "168, 85, 247",
  "header_style": "gradient",
  "header_gradient_from": "#1a0a2e",
  "header_gradient_to": "#2d1b69"
}
```

The `accent_color` (RGB string) controls the glow color on the post card and can be used for per-post visual identity.

### Available Tags

Common tag categories: `ethics`, `technology`, `philosophy`, `flourishing`, `relationships`, `rice`, `research`, `reactions`, `tree-of-human-flourishing`

### Homepage Display

Blog entries on the homepage come from `src/data/iris/kb/blogs.json`. To add a new blog to the homepage media section, add an entry there. The loader (`src/data/loaders.ts`) maps the JSON to the `Blog` interface. External links get an external link icon on the card.

### Database Schema (Supabase)

Table: `blog_posts`
- `id` (uuid), `title`, `slug` (unique), `subtitle`, `body` (markdown), `tags` (text[])
- `status` (draft/published/archived), `published_at`, `theme` (jsonb)
- `search_vector` (tsvector, auto-updated trigger, weighted: title A, subtitle B, body C)
- RLS enabled, GIN indexes on search_vector and tags

---

**Last Updated**: 2026-03-10
**Version**: 1.1
**Maintainer**: Mike Veson (mike@douzinas.com)

For questions about this guide or the codebase, press ⌘K on [mikeveson.com](https://mikeveson.com) and ask Iris!
