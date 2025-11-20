# CLAUDE.md - AI Assistant Guide

**Last Updated**: 2025-11-20
**Project**: Mike Veson Portfolio with Iris AI Assistant
**Stack**: Next.js 15, TypeScript, OpenAI, Redis, Supabase

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

- **Iris AI Assistant**: Command palette (⌘K) with semantic search and structured filtering
- **RAG System**: OpenAI embeddings + GPT-4o-mini for context-aware responses
- **Smart Inbox**: "Ask Mike" contact system with email notifications
- **Interactive UI**: Mouse glow effects, animations, dark mode
- **Knowledge Base**: 10 document types (projects, experience, classes, skills, etc.)
- **Streaming Responses**: Real-time SSE with progressive rendering

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, OpenAI API, Upstash Redis, Supabase PostgreSQL
- **UI**: shadcn/ui, Framer Motion, cmdk (command palette)
- **Email**: Resend API for inbox notifications

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
│   │   ├── iris/               # Iris AI system (34 files)
│   │   │   ├── answer-utils/   # Modular answer pipeline (14 files)
│   │   │   ├── config.ts       # Feature toggles, model config
│   │   │   ├── schema.ts       # Zod schemas & TypeScript types
│   │   │   ├── load.ts         # KB data loaders
│   │   │   ├── retrieval.ts    # Semantic search & filtering
│   │   │   ├── embedding.ts    # OpenAI embeddings
│   │   │   ├── cache.ts        # Redis caching
│   │   │   ├── intents.ts      # Intent classification
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
│               ├── embeddings.json   # Pre-computed vectors
│               └── typeahead.json    # Search suggestions
│
├── scripts/                    # Build & test utilities
│   ├── build_embeddings.ts     # Pre-compute embeddings
│   ├── build_typeahead.ts      # Generate suggestions (v1)
│   ├── build_typeahead_v2.ts   # Enhanced suggestions (v2)
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

#### Intent System (5 Types)

Iris classifies queries into 5 intent types using GPT-4o-mini with function calling:

| Intent | Purpose | Routing Logic |
|--------|---------|---------------|
| **`contact`** | Fast-path for contact info | Skips LLM, returns static contact data |
| **`filter_query`** | Structured filtering | Uses `applyFilters()` with exact skill/year/type matching |
| **`specific_item`** | Details about a specific item | Semantic search + reranking for specificity |
| **`personal`** | Family/values/interests | Searches `stories`, `values`, `interests`, `bio` |
| **`general`** | Semantic search | Cosine similarity on embeddings across all types |

**File**: `src/lib/iris/answer-utils/intent.ts`

#### RAG Pipeline

```
User Query (⌘K)
    ↓
Intent Detection (GPT-4o-mini function calling)
    ↓
┌─────────────┬─────────────┬─────────────┐
│  Structured │   Semantic  │  Personal   │
│  Filtering  │   Search    │  Context    │
│  (exact)    │  (cosine)   │  (stories)  │
└─────────────┴─────────────┴─────────────┘
    ↓
Context Builder (format docs, add metadata)
    ↓
LLM Generation (gpt-4o-mini, streaming)
    ↓
SSE Response (to frontend)
```

**Key Files**:
- `src/lib/iris/retrieval.ts` - Semantic search with cosine similarity
- `src/lib/iris/answer-utils/filters.ts` - Structured filtering logic
- `src/lib/iris/answer-utils/formatting.ts` - Context formatting (minimal/standard/full)
- `src/lib/iris/answer-utils/planning.ts` - Pre-routing, contact planning

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

#### Quick Actions

**File**: `src/lib/iris/quickActions.ts`

5 action types generated after each response:

1. **Affirmative**: "Tell me more", "Show details"
2. **Specific**: Pre-filled queries about specific items
3. **Custom Input**: Inline text field for freeform follow-ups
4. **Contact Links**: GitHub, LinkedIn, email with toast notifications
5. **Message Mike**: Opens MessageComposer with smart drafts

**Depth Limiting**: Max 2 follow-up levels to prevent infinite threading

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
   OPENAI_API_KEY=sk-...
   ```

   **Optional (production features)**:
   ```bash
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
   # Runs: verify:kb + build:embeddings + build:typeahead
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
npm run kb:rebuild       # Full rebuild (verify + embeddings + typeahead)
npm run verify:kb        # Validate KB structure with Zod schemas
npm run build:embeddings # Pre-compute embeddings (required after KB changes)
npm run build:typeahead  # Generate suggestions (v1 + v2)

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
npm run build:embeddings # Rebuild embeddings (REQUIRED)
npm run test:iris        # Test queries
```

**Important**: Always use skill IDs (`react`, `python`) not display names ("React", "Python") in KB files.

#### 2. Modifying Iris Behavior

**Change AI Models** (`src/lib/iris/config.ts`):
```typescript
export const config = {
  models: {
    chat: 'gpt-4o-mini',  // or gpt-4-turbo, gpt-3.5-turbo
    embeddings: 'text-embedding-3-small'  // or text-embedding-3-large
  },
  chatSettings: {
    temperature: 1,
    maxTokens: 800  // Increase for longer responses
  }
};
```

**Adjust Intent Detection** (`src/lib/iris/answer-utils/intent.ts`):
- Modify function calling schema
- Add new intent types
- Change routing logic

**Update System Prompt** (`src/app/api/iris/answer/route.ts` ~line 845):
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

# 2. Rebuild embeddings if KB changed
npm run build:embeddings

# 3. Run tests
npm run test:iris

# 4. Check linting
npm run lint

# 5. Build for production
npm run build
```

### Common Issues

**Issue**: Empty results fallback triggering too often
**Solution**: Rebuild embeddings
```bash
npm run build:embeddings
```

**Issue**: Hallucinated information
**Fix**: Review system prompt anti-hallucination rules in `src/app/api/iris/answer/route.ts` ~line 845

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

2. **Rebuild embeddings**:
```bash
npm run build:embeddings
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
npm run build:embeddings
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

1. **Edit** `src/lib/iris/answer-utils/intent.ts`:
```typescript
// Add to function calling schema
const functions = [
  {
    name: 'new_intent',
    description: 'When user asks about...',
    parameters: {
      type: 'object',
      properties: {
        // ... parameters
      }
    }
  }
];
```

2. **Update routing** in `src/app/api/iris/answer/route.ts`:
```typescript
if (intent === 'new_intent') {
  // Handle new intent
  const results = await handleNewIntent(query);
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
| `src/app/api/iris/answer/route.ts` | Main Iris endpoint (POST/GET) | ~1000 |
| `src/lib/iris/schema.ts` | Zod schemas & TypeScript types | 1600+ |
| `src/lib/iris/load.ts` | KB data loaders | 200+ |
| `src/lib/iris/retrieval.ts` | Semantic search & filtering | 150+ |
| `src/lib/iris/quickActions.ts` | Smart follow-up generation | 400+ |
| `src/lib/iris/answer-utils/` | Modular answer pipeline | 14 files |

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
- ✅ **Always rebuild embeddings** after changing KB files: `npm run build:embeddings`
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
- ❌ **Don't skip embeddings rebuild** after KB changes
- ❌ **Don't use display names for skills** - use IDs
- ❌ **Don't weaken anti-hallucination prompts** - accuracy is critical
- ❌ **Don't break backward compatibility** without good reason
- ❌ **Don't add dependencies** without discussion
- ❌ **Don't remove error handling** - graceful degradation is key
- ❌ **Don't hardcode secrets** - use environment variables
- ❌ **Don't ignore TypeScript errors** - fix them before committing

### Understanding Iris Queries

**When a user reports an issue**:

1. **Check the intent classification** - Did Iris detect the right intent?
   - File: `src/lib/iris/answer-utils/intent.ts`
   - Test: Run query through `/api/iris/answer` and check logs

2. **Check retrieval results** - Are the right KB items being found?
   - Semantic search: `src/lib/iris/retrieval.ts`
   - Structured filtering: `src/lib/iris/answer-utils/filters.ts`

3. **Check formatting** - Is context being formatted correctly?
   - File: `src/lib/iris/answer-utils/formatting.ts`
   - Detail levels: minimal, standard, full

4. **Check system prompt** - Are instructions clear and complete?
   - File: `src/app/api/iris/answer/route.ts` ~line 845

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
npm run kb:rebuild          # Full rebuild (verify + embeddings + typeahead)
npm run verify:kb           # Validate KB structure
npm run build:embeddings    # Pre-compute embeddings (REQUIRED after KB changes)
npm run build:typeahead     # Generate search suggestions

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

**Last Updated**: 2025-11-20
**Version**: 1.0
**Maintainer**: Mike Veson (mike@douzinas.com)

For questions about this guide or the codebase, press ⌘K on [mikeveson.com](https://mikeveson.com) and ask Iris!
