ok so right now here's where im at, heres my README.

# Mike Veson Portfolio

A modern, full-stack personal portfolio built with Next.js 15 and TypeScript, featuring **Iris** — an intelligent AI assistant that transforms how visitors explore professional work, experience, and projects through natural language conversations.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-API-green)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🌟 Overview

This portfolio goes beyond traditional static sites by integrating an advanced RAG (Retrieval-Augmented Generation) system that enables intelligent, context-aware conversations about work experience, technical projects, coursework, and personal background.

**Live Demo**: [mikeveson.com](https://mikeveson.com) *(Press ⌘K to chat with Iris)*

---

## 🤖 Iris: AI Assistant Architecture

### About Iris

**Iris** is named after the Greek messenger goddess and represents part of a long-term vision for AI assistants. As the digital counterpart to a planned physical robot (Hermes), Iris serves as an intelligent interface between visitors and Mike's structured knowledge base.

### Key Capabilities

- **Natural Language Understanding**: LLM-based intent classification with structured output
- **Semantic Search**: Embeddings-based retrieval using cosine similarity
- **Structured Filtering**: Precise queries like "Python projects from 2025" or "ML classes"
- **Contextual Awareness**: Year-based filtering, skill matching, and personal context retrieval
- **Streaming Responses**: Real-time SSE (Server-Sent Events) for instant feedback
- **Intelligent Caching**: Redis-based response caching with 1-hour TTL
- **Smart Contact Integration**: Seamless "Ask Mike" inbox for direct communication

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Query (⌘K)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │  Intent Detection     │
                │  (GPT-4o-mini)        │
                │  Function Calling     │
                └───────────┬───────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼──────┐
│ Structured     │  │ Semantic       │  │  Personal   │
│ Filtering      │  │ Search (RAG)   │  │  Context    │
│ • Year         │  │ • Embeddings   │  │  • Stories  │
│ • Skills       │  │ • Cosine Sim   │  │  • Values   │
│ • Type         │  │ • Reranking    │  │  • Interests│
└───────┬────────┘  └───────┬────────┘  └──────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                   ┌────────▼─────────┐
                   │  Context Builder │
                   │  • Format docs   │
                   │  • Add metadata  │
                   │  • Detail levels │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │   LLM Generation │
                   │   (Streaming)    │
                   │   gpt-4.1-mini   │
                   └────────┬─────────┘
                            │
                   ┌────────▼─────────┐
                   │  SSE Response    │
                   │  to Frontend     │
                   └──────────────────┘
```

### Intent System

Iris uses a simplified 5-intent classification system powered by OpenAI function calling:

| Intent | Purpose | Example Queries |
|--------|---------|----------------|
| **`contact`** | Fast-path for contact info (no LLM) | "how to reach Mike?" |
| **`filter_query`** | Structured filtering with exact matches | "Python projects", "2025 work", "ML classes" |
| **`specific_item`** | Details about a specific item | "tell me about HiLiTe", "when did I take APCS A?" |
| **`personal`** | Family/values/interests | "Mike's story", "why Douzinas?" |
| **`general`** | Semantic search across all content | "technical work", "AI experience" |

### Ask Mike Integration

When Iris encounters questions it cannot fully answer or when users explicitly request contact, it seamlessly integrates with the **"Ask Mike"** inbox system:

#### Trigger Scenarios

1. **Explicit Requests**: "How can I contact you?", "I'd like to message Mike"
2. **Insufficient Context**: Questions about topics not in the knowledge base
3. **Additional Detail**: When users want more information than Iris can provide

#### Smart UI Directives

Iris emits structured directives during streaming responses:

```xml
<ui:contact reason="insufficient_context" draft="Ask about summer internship plans" />
<ui:contact reason="user_request" draft="Contact Mike directly" />
<ui:contact reason="more_detail" draft="Get more details about HiLiTe" />
```

#### Contact Methods

- **Email**: Validated email addresses with instant delivery
- **Phone**: E.164 formatted numbers with international support  
- **Anonymous**: No contact info required for privacy

### Knowledge Base Structure

The knowledge base is organized into typed JSON documents with embeddings for semantic search:

```typescript
// Core document types
type KBItem = 
  | ProjectT      // Technical projects with architecture, tech stack
  | ExperienceT   // Work experience with specifics, dates, skills
  | ClassT        // Academic courses with professors, terms
  | BlogT         // Blog posts and articles
  | StoryT        // Personal background stories
  | ValueT        // Core values and beliefs
  | InterestT     // Hobbies and interests

// Each item includes:
interface BaseKBItem {
  id: string;
  summary: string;
  skills: string[];      // Linked to skills.json
  dates?: DateRange;     // For temporal filtering
  specifics?: string[];  // Detailed bullet points
}
```

### RAG Pipeline

1. **Query Processing**
   - User submits natural language query via ⌘K palette
   - Intent detected using GPT-4o-mini with function calling
   - Structured filters extracted (skills, year, type, etc.)

2. **Retrieval Strategy**
   ```typescript
   // Structured filtering (precise)
   if (intent === 'filter_query') {
     const items = applyFilters(allKBItems, filters);
     // Returns complete filtered list, not just top-K
   }
   
   // Semantic search (flexible)
   else {
     const results = await retrieve(query, {
       topK: 5,
       types: TYPE_FILTERS[intent],
       fields: FIELD_MAP[intent]
     });
     // Cosine similarity on embeddings
   }
   ```

   **Matching Skills Philosophy**:
   - **Stage 1 (Retrieval)**: Intentionally broad fuzzy matching to capture all potentially relevant items
     - Handles singular/plural variations ("transformer" ↔ "transformers")
     - Matches skill names to IDs ("Framer Motion" → "framer_motion")
     - Normalizes underscores, hyphens, and word order
     - Goal: Get relevant items into context, even if slightly over-inclusive
     
3. **Context Building**
   - Documents formatted with detail levels:
     - **Minimal**: Name + summary (for broad lists)
     - **Standard**: + skills (for filter queries)
     - **Full**: Everything including specifics, architecture (for deep dives)
   - Date information prominently displayed
   - Technical reranking for engineering queries

4. **LLM Generation**
   - Streaming response via OpenAI Chat API
   - Model: `gpt-4.1-mini` (configurable in `config.ts`)
   - Anti-hallucination instructions in system prompt
   - Multi-item synthesis for comprehensive answers

5. **Response Streaming**
   - Server-Sent Events (SSE) for real-time UX
   - Chunk-by-chunk delivery as generated
   - Cached for 1 hour (Redis)

### Technical Implementation

#### Backend (`src/app/api/iris/answer/route.ts`)
- **Framework**: Next.js 15 App Router with Node.js runtime
- **Streaming**: Native ReadableStream API with SSE format
- **Error Handling**: Graceful fallbacks, detailed logging
- **Caching**: Redis with TTL-based invalidation

### Inbox System (`src/app/api/inbox/route.ts`)
- **Message Processing**: Zod validation, sanitization, rate limiting
- **Email Notifications**: Rich HTML emails via Resend API
- **Security**: Honeypot spam detection, IP hashing, input sanitization
- **Database**: Supabase integration with proper schema and migrations

#### Embeddings Generation (`scripts/build_embeddings.ts`)
```bash
# Pre-compute embeddings for all KB items
npm run build:embeddings

# Outputs to: src/data/iris/derived/embeddings.json
# Alternative: npx tsx scripts/build_embeddings.ts
```

#### Frontend (`src/components/IrisPalette.tsx`)
- **UI Framework**: React with shadcn/ui components
- **Keyboard Shortcut**: ⌘K (Mac) / Ctrl+K (Windows/Linux)
- **State Management**: React hooks with useRef for streaming
- **Accessibility**: Full keyboard navigation, ARIA labels

#### Inbox Components (`src/components/iris/`)
- **MessageComposer**: Contact form with validation and localStorage caching
- **ContactCta**: Call-to-action button for suggested contact scenarios
- **useUiDirectives**: Parser hook for streaming UI directives from Iris

### Configuration

#### Environment Variables
```bash
# Required for Iris to function
OPENAI_API_KEY=sk-...                    # OpenAI API key for embeddings & chat

# Required for production caching (optional for local dev)
UPSTASH_REDIS_REST_URL=https://...       # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN=...             # Upstash Redis token

# Required for analytics and inbox (optional for basic Iris functionality)
NEXT_PUBLIC_SUPABASE_URL=https://...     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=...            # Service role key (server-side only)

# Optional: Enhances responses with live activity
GITHUB_TOKEN=ghp_...                     # GitHub PAT for commit history
```

> **📖 Complete Setup Guide**: See [SETUP.md](./SETUP.md) for detailed instructions on obtaining API keys and configuring each service.
>
> **🚀 Quick Vercel Deploy**: See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for production deployment checklist.

#### Model Configuration (`src/lib/iris/config.ts`)
```typescript
export const config = {
  models: {
    chat: 'gpt-4.1-mini',      // Main generation model
    embeddings: 'text-embedding-3-small'  // Embedding model
  },
  chatSettings: {
    temperature: 1,
    maxTokens: 800
  }
};
```

### Data Structure

#### Knowledge Base (`src/data/iris/kb/`)
```
kb/
├── projects.json       # Technical projects with dates, skills
├── experience.json     # Work history with companies, roles
├── classes.json        # Academic courses with terms
├── skills.json         # Skill taxonomy (851 entries)
├── profile.json        # Personal info, stories, values, interests, location, availability
├── blogs.json          # Blog posts and articles
└── contact.json        # Contact information
```

#### Derived Data (`src/data/iris/derived/`)
```
derived/
├── embeddings.json     # Pre-computed embeddings (36 vectors)
└── typeahead.json      # Search suggestions
```

### Performance Optimizations

1. **Pre-computed Embeddings**: All KB items embedded at build time
2. **Response Caching**: 1-hour Redis cache for repeated queries
3. **Streaming**: Progressive rendering with SSE
4. **Intent Fast-paths**: Contact queries skip LLM entirely
5. **Field Filtering**: Only retrieve necessary fields per intent
6. **Type Filtering**: Restrict search space by document type

### Example Queries

**Structured Filtering**:
- "Show me all Python projects"
- "What did Mike do in 2025?"
- "List classes involving machine learning"
- "Mobile development experience"

**Specific Items**:
- "Tell me about the HiLiTe project"
- "When did Mike take APCS A?"
- "Details on the Veson internship"

**Personal Context**:
- "What are Mike's values?"
- "Tell me his story"
- "Why is his name Douzinas?"

**Semantic Search**:
- "What technical work has Mike done?"
- "Tell me about AI projects"
- "What's his data science background?"

---

## Features

### Portfolio Website
- **Modern UI**: Clean, accessible design with dark mode support
- **Responsive Layout**: Optimized for mobile, tablet, and desktop
- **Smooth Animations**: Framer Motion for polished interactions
- **Command Palette**: Arc-inspired ⌘K interface for quick navigation
- **Interactive Mouse Glow System**: Universal cursor-following lighting effects
  - **Global Glow**: Subtle blue ring that follows cursor across the site
  - **Contained Glows**: Color-coded glows within cards (green for projects, purple for blogs, blue for experience)
  - **Custom Glows**: Specialized effects for interactive elements (profile picture tilt, Iris button animation)
  - **Smart Detection**: Automatically disabled on mobile/touch devices for optimal performance
  - **Seamless Transitions**: Global glow hides when hovering over elements with custom effects

### Projects Showcase
- **Interactive Demos**: Live project previews and links
- **Rack Rush**: Built-in word game with Scrabble-style mechanics, time pressure, and exchange mechanics
- **GitHub Integration**: Live commit activity (production only)

### Playground Tools
The portfolio includes an interactive playground with custom-built tools:

- **Decision Maker**: Helps overcome choice paralysis by randomly selecting from user options and providing thoughtful reasoning
  - Enter multiple options (one per line)
  - Optional criteria for consideration
  - Simulated "thinking" time for better UX
  - Smart reasoning templates to help validate the choice

- **Quotes Collection**: Personal curated quotes with context
  - Auto-rotating display (6-second intervals with pause/resume)
  - Each quote includes personal reasoning for why it resonates
  - Manual navigation and direct selection
  - Progress indicators and smooth transitions

- **Ranked by MV**: Systematic rating system inspired by Beli
  - 5 weighted categories: Quality, Innovation, Practical Value, Design, Personal Appeal
  - 0-10 scoring with 0.5 increments
  - Calculated weighted averages for overall scores
  - LocalStorage persistence for saved ratings
  - Color-coded score visualization (green/yellow/orange/red)

### Work Experience
- **Timeline View**: Chronological display of roles and companies
- **Skill Tagging**: 850+ skills categorized and indexed
- **Technical Depth**: Architecture diagrams, tech stacks, impact metrics

### Ask Mike Inbox System
- **Smart Integration**: Seamlessly triggered by Iris when context is insufficient
- **Multiple Contact Methods**: Email, phone, or anonymous messaging
- **Rich Email Notifications**: HTML-formatted emails with full context via Resend
- **Admin Dashboard**: Secure message management with status tracking
- **Security Features**: Rate limiting, spam detection, input sanitization
- **Privacy Protection**: IP hashing, optional anonymous messaging
- **Real-time Processing**: Instant email delivery with comprehensive logging

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Animations**: Framer Motion
- **Interactive Effects**: Custom mouse glow system with mobile detection
- **State**: React Hooks

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **AI/ML**: OpenAI API (GPT-4.1, text-embedding-3-small)
- **Caching**: Redis (via Upstash)
- **Validation**: Zod schemas
- **Email**: Resend API for inbox notifications
- **Database**: Supabase with PostgreSQL

### Infrastructure
- **Hosting**: Vercel
- **Database**: JSON-based knowledge base with pre-computed embeddings + Supabase PostgreSQL
- **CDN**: Vercel Edge Network
- **Email**: Resend for inbox notifications
- **Analytics**: (Optional) Vercel Analytics

---

## 📦 Installation & Development

### Prerequisites
- Node.js 18+ and npm/pnpm
- OpenAI account (required - for Iris AI and embeddings)
- Upstash account (optional - for response caching, ~50-70% cost reduction)
- Supabase account (optional - for analytics and inbox features)
- GitHub token (optional - for live activity context in responses)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/mikedouzinas/mikedouz-portfolio.git
   cd mikedouz-portfolio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys (see SETUP.md for details)
   ```

4. **Set up services** (see [SETUP.md](./SETUP.md) for detailed instructions)
   - **OpenAI**: Get API key from platform.openai.com
   - **Upstash Redis** (optional): Create free database for caching
   - **Supabase** (optional): Set up for analytics and inbox

5. **Set up Supabase tables** (if using analytics/inbox)
   ```bash
   # In Supabase SQL Editor, run:
   # 1. sql/iris_analytics.sql (analytics tables)
   # 2. supabase/migrations/20251027_inbox.sql (inbox table)
   # 3. supabase/migrations/20251027_inbox_add_context.sql (inbox context)
   ```

6. **Build knowledge base** (required for Iris)
   ```bash
   npm run kb:rebuild
   # This runs: build:embeddings + build:typeahead
   ```

7. **Run development server**
   ```bash
   npm run dev
   ```

8. **Open in browser**
   ```
   http://localhost:3000
   # Press ⌘K to open Iris
   ```

> **📘 Need Help?** See comprehensive setup guides:
> - [SETUP.md](./SETUP.md) - Detailed setup for all services
> - [VERCEL_SETUP.md](./VERCEL_SETUP.md) - Production deployment guide

### Scripts

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Build embeddings for Iris
npm run build:embeddings

# Build typeahead suggestions
npm run build:typeahead

# Verify knowledge base structure
npm run verify:kb

# Rebuild entire knowledge base (verify + embeddings + typeahead)
npm run kb:rebuild
```

---

## 📁 Project Structure

```
mikedouz-portfolio/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── iris/
│   │   │   │   ├── answer/route.ts      # Main Iris endpoint
│   │   │   │   ├── suggest/route.ts     # Typeahead suggestions
│   │   │   │   └── health/route.ts      # Health check
│   │   │   └── inbox/
│   │   │       └── route.ts              # Ask Mike inbox API
│   │   ├── admin/
│   │   │   └── inbox/
│   │   │       └── page.tsx              # Admin inbox dashboard
│   │   ├── about/                       # About section
│   │   ├── projects/                    # Projects showcase
│   │   ├── games/rack-rush/             # Word game
│   │   └── playground/                  # Interactive demos
│   ├── components/
│   │   ├── IrisPalette.tsx              # AI command palette
│   │   ├── iris/
│   │   │   ├── MessageComposer.tsx      # Contact form component
│   │   │   ├── ContactCta.tsx           # Contact CTA button
│   │   │   └── useUiDirectives.ts       # UI directive parser
│   │   ├── ContainedMouseGlow.tsx       # Contained glow component
│   │   ├── mouse_glow.tsx               # Global mouse glow
│   │   ├── base_card.tsx                # Card with glow support
│   │   ├── ui/                          # shadcn components
│   │   └── ...
│   ├── data/
│   │   └── iris/
│   │       ├── kb/                      # Knowledge base (JSON)
│   │       └── derived/                 # Pre-computed data
│   ├── lib/
│   │   ├── iris/
│   │   │   ├── retrieval.ts             # Semantic search
│   │   │   ├── embedding.ts             # Embedding generation
│   │   │   ├── config.ts                # Configuration
│   │   │   ├── schema.ts                # Zod schemas
│   │   │   ├── load.ts                  # Data loading
│   │   │   └── cache.ts                 # Redis caching
│   │   ├── supabaseAdmin.ts             # Supabase client & queries
│   │   ├── types.ts                     # Shared TypeScript types
│   │   ├── env.ts                       # Environment validation
│   │   ├── security.ts                  # Input sanitization
│   │   ├── rateLimit.ts                 # Rate limiting
│   │   └── phone.ts                     # Phone validation
│   └── styles/
├── supabase/
│   └── migrations/
│       ├── 20251027_inbox.sql           # Inbox table schema
│       └── 20251027_inbox_add_context.sql # Context fields
├── scripts/
│   ├── build_embeddings.ts              # Pre-compute embeddings
│   ├── build_typeahead.ts               # Generate suggestions
│   └── verify_kb.ts                     # Validate KB structure
├── public/                              # Static assets
├── INBOX_FEATURE.md                     # Inbox feature documentation
├── GLOW_SYSTEM.md                       # Mouse glow documentation
└── README.md
```

---

## 🔧 Configuration

### Customizing Iris

#### Update Knowledge Base
Edit files in `src/data/iris/kb/`:
- `projects.json` - Add/update projects
- `experience.json` - Add/update work history
- `classes.json` - Add/update courses
- `skills.json` - Extend skill taxonomy
- `profile.json` - Update personal information

After changes, rebuild embeddings:
```bash
npm run kb:rebuild
# Or just embeddings: npm run build:embeddings
```

#### Change AI Models
Edit `src/lib/iris/config.ts`:
```typescript
export const config = {
  models: {
    chat: 'gpt-4-turbo',  // or gpt-4, gpt-3.5-turbo, etc.
    embeddings: 'text-embedding-3-large'  // or text-embedding-ada-002
  }
};
```

#### Adjust Response Length
In `src/lib/iris/config.ts`:
```typescript
chatSettings: {
  maxTokens: 800,      // Increase for longer responses
  temperature: 1       // 0-2, higher = more creative
}
```

### Customizing Mouse Glow Effects

The portfolio features a universal mouse glow system that can be customized per component. See [GLOW_SYSTEM.md](GLOW_SYSTEM.md) for detailed documentation.

#### Quick Customization

**Change Card Glow Colors:**
```tsx
// In project_card.tsx, experience_card.tsx, or blog_card.tsx
<BaseCard 
  glowColor="34, 197, 94"  // RGB values (green, purple, blue, etc.)
  glowIntensity={0.35}      // 0-1 opacity
>
```

**Adjust Global Glow:**
```tsx
// In src/components/mouse_glow.tsx
<div className="w-20 h-20 bg-blue-300 dark:bg-blue-500 opacity-50 ..." />
//             ^^^^^^ size   ^^^^^^^^^^^ colors   ^^^^^^^^^ intensity
```

**Add Glow to New Components:**
```tsx
import ContainedMouseGlow from '@/components/ContainedMouseGlow';

<div className="relative overflow-hidden" data-has-contained-glow="true">
  <ContainedMouseGlow color="147, 197, 253" intensity={0.4} />
  {/* Your content */}
</div>
```

---

## 🚢 Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Vercel auto-detects Next.js

3. **Add Environment Variables**
   - Settings → Environment Variables
   - Add `OPENAI_API_KEY`
   - Add `RESEND_API_KEY` (for inbox)
   - Add `ADMIN_API_KEY` (for inbox admin)
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for inbox)
   - Add `GITHUB_TOKEN` (optional)

4. **Deploy**
   - Vercel deploys automatically on push
   - Production URL: `your-project.vercel.app`

### Other Platforms

The app can be deployed to any platform supporting Next.js:
- **Netlify**: Use Next.js runtime
- **AWS Amplify**: Full Next.js support
- **Docker**: Use official Next.js Docker image
- **Self-hosted**: Run `npm run build && npm start`

---

## 🤝 Contributing

While this is a personal portfolio, contributions to improve Iris or fix bugs are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit your changes (`git commit -m 'Add improvement'`)
4. Push to the branch (`git push origin feature/improvement`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT and embedding models
- **Vercel** for Next.js and hosting platform
- **shadcn** for beautiful UI components
- **Upstash** for serverless Redis

---

## 📧 Contact

**Mike Veson**
- Website: [mikeveson.com](https://mikeveson.com)
- LinkedIn: [linkedin.com/in/mikedouzinas](https://linkedin.com/in/mikedouzinas)
- GitHub: [github.com/mikedouzinas](https://github.com/mikedouzinas)
- Email: mike@douzinas.com

*Try asking Iris on the website! Press ⌘K and say "tell me about this project"*

---

Built with ❤️ using Next.js, TypeScript, and OpenAI
