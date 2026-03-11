# Hover Definitions: Blog Integration Spec

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2026-03-10
**Status:** Draft
**Depends on:** `2026-03-10-hover-memories-implementation.md` (shared infrastructure)

## Problem

Blog posts on The Web often use philosophical terms, make claims with nuance that would break the flow if explained inline, or reference concepts from elsewhere on the site. Right now there is no mechanism for layered depth. The reader either gets the compressed version or nothing.

## Solution

Inline hover definitions within blog post markdown. When writing a post, Mike can mark any word or phrase as hoverable. The text reads normally without interaction, but a subtle visual cue (faint color shift + dotted underline) signals that more depth is available. On desktop, hover reveals a definition card. On mobile, tap reveals it.

This is a "built-in asterisk" that does not break reading flow.

## Use Cases

1. **Philosophical terms** ("eudaimonia") with formal definition, optional Greek text, optional source
2. **Caveats and nuance** (a claim where Mike wants to add a qualifier without disrupting the sentence)
3. **Cross-references** (a concept like "the Tree of Human Flourishing" that links to a deeper explanation)
4. **Color and personality** (an aside, inside joke, or personal note for those who notice)

---

## Design Decisions

### 1. Where Definitions Live

**Decision: Inline in the markdown body, with an optional shared definitions table for reuse.**

Three options were considered:

| Option | Pros | Cons |
|--------|------|------|
| A. In the post's `theme` JSON | Co-located with the post | Clutters the theme object, awkward to write |
| B. Shared Supabase `definitions` table | Reusable across posts, single source of truth | Extra DB query per post, over-engineered for v1 |
| **C. Inline in the markdown itself** | Zero friction to write, self-contained, portable | Definitions are per-post (duplicated if reused) |

**For v1: Option C (inline).** The markdown body contains both the trigger text and its definition. No database changes. No new API fields. If a definition is used across 5+ posts, we add Option B later as a "shared glossary" layer.

**Future v2:** Add a `definitions` JSONB column to `blog_posts` (or a separate `glossary` table) so commonly used terms like "eudaimonia" are defined once and referenced by key. The markdown syntax would then support both inline definitions and glossary references.

### 2. Markdown Syntax

**Decision: Custom syntax using double-colon notation, parsed via a react-markdown plugin.**

```
::term or phrase|definition text::
::term or phrase|definition text|source::
::term or phrase|definition text|source|greek text::
```

Pipe-separated fields inside double-colon delimiters. Only the first field (the visible text) is required along with the definition.

**Examples in a blog post body:**

```markdown
Aristotle argued that ::eudaimonia|The condition of human flourishing. Not happiness in the modern hedonic sense, but the state of living well and doing well, achieved through virtuous activity over a complete life.|Nicomachean Ethics, Book I|ευδαιμονια:: is the highest human good.

This claim rests on a specific assumption ::that I should note|I am treating "well-being" and "flourishing" as synonymous here, which not all philosophers accept. Hedonists, desire-satisfaction theorists, and objective-list theorists would each define "well-being" differently.:: about what well-being means.

The ::Tree of Human Flourishing|A framework for understanding what humans need to thrive, organized as roots (psychological foundations), trunk (core identity), branches (life domains), and fruit (the outcomes of a well-lived life).:: maps this more concretely.
```

**Why this syntax:**
- Double colons (`::`) are not used by standard markdown, avoiding collisions
- Pipe (`|`) is a natural field separator (not common inside prose definitions)
- The visible text comes first, so the markdown is readable even in raw form
- Pipe characters inside definitions can be escaped as `\|` if ever needed

### 3. How the MarkdownRenderer Parses It

The current `MarkdownRenderer.tsx` uses `react-markdown` with custom component overrides. Two integration approaches:

**Decision: Pre-process the markdown string before passing to react-markdown.**

Rather than writing a remark/rehype plugin (which requires AST manipulation and is harder to debug), we pre-process the markdown body to replace `::...|...::` syntax with a custom HTML-like token that react-markdown will pass through to a custom component.

**Implementation:**

1. A `preprocessHoverDefinitions()` function scans the markdown body for `::...|...::` patterns
2. It replaces each match with `<hoverdef term="..." definition="..." source="..." greek="...">visible text</hoverdef>`
3. The `MarkdownRenderer` registers a custom component for the `hoverdef` element
4. That component renders a `<HoverTrigger>` with an inline `DefinitionCardData`

This approach:
- Keeps the react-markdown configuration simple (just one more custom component)
- Avoids remark plugin complexity
- Is easy to test in isolation (the preprocessor is a pure function)
- Works with rehypeRaw (already a common react-markdown plugin) to handle the HTML tags

### 4. Visual Treatment of Hover Triggers in Blog Text

The highlighted text must be subtle enough to not distract, but discoverable for curious readers.

**Styling:**
- Text color: `text-purple-300/90` (slightly brighter than body text `text-gray-300`, using the blog's purple accent)
- Underline: `decoration-dotted decoration-purple-500/30 underline-offset-4` (faint dotted underline, low opacity)
- On hover: `hover:text-purple-200 hover:decoration-purple-400/50` (brightens slightly, underline becomes more visible)
- Cursor: `cursor-help` (signals interactivity without looking like a link)
- Transition: `transition-colors duration-200`

**The card itself** reuses the `DefinitionCard` component from the hover memories system (Task 5 in the existing plan), with minor adaptations:
- Width slightly wider for blog context: `w-[280px]` (vs `w-[260px]` on portfolio)
- Background: `bg-gray-800/95` (matches blog's dark theme, not the portfolio's `dark:bg-gray-900/90`)
- Accent divider: purple gradient (`from-purple-400 to-purple-600`) instead of blue-to-emerald, to match the blog's color language

### 5. Desktop vs Mobile Behavior

Inherits from the shared `useHoverCard` hook (Task 2 in existing plan):

| Platform | Trigger | Dismiss |
|----------|---------|---------|
| Desktop | Mouse hover (150ms linger delay to prevent flicker) | Mouse leave (150ms grace period to reach card) |
| Mobile | Tap on highlighted text | Tap outside card, or scroll |

**Additional mobile consideration for blog:** Blog posts are long-scroll content. The card should dismiss on scroll (already handled by `useHoverCard`). On mobile, tapping the highlighted text should NOT navigate anywhere (it is not a link). The card appears in-place, positioned above or below depending on viewport space.

### 6. Integration with the Existing Hover Memories Plan

The hover memories plan (`2026-03-10-hover-memories-implementation.md`) builds:
- `useHoverCard` hook (Task 2)
- `DefinitionCard` component (Task 5)
- `HoverTrigger` wrapper (Task 6)

The blog integration reuses all of these. The key changes to the existing plan:

**Modifications needed:**

1. **`HoverTrigger` must accept inline data, not just a `cardId` lookup.** Currently it looks up `hoverCards[cardId]` from the static data file. For blog definitions, the data comes from the markdown (parsed at render time), not from a static map. Add an optional `inlineData` prop:

```tsx
interface HoverTriggerProps {
  cardId?: string;           // lookup from static hoverCards map
  inlineData?: HoverCardData; // pass data directly (for blog definitions)
  href?: string;
  children: React.ReactNode;
}
```

If `inlineData` is provided, it takes priority over `cardId`. This keeps the static data file approach working for the portfolio page while enabling dynamic data for blog posts.

2. **`DefinitionCard` needs a blog variant.** Add an optional `variant` prop (`"portfolio" | "blog"`) that adjusts width, background, and accent colors. Default is `"portfolio"`.

3. **The barrel export (`src/components/hover-cards/index.ts`) should also export the types** so the blog preprocessor can construct `DefinitionCardData` objects.

**New implementation order (replanning Tasks 1-9):**

The existing plan's task order is still correct, but Task 6 (HoverTrigger) needs the `inlineData` prop from the start, and a new Task 7.5 is inserted for the blog integration (before Task 7 which wires into AboutContent). This way the shared infrastructure is blog-ready from day one.

---

## Implementation Tasks

> These tasks assume the shared hover card infrastructure from the hover memories plan (Tasks 1-6) has been built OR is being built in the same session. If building from scratch, do the hover memories Tasks 1-6 first, incorporating the modifications noted above, then continue here.

### Task B1: Add rehype-raw to MarkdownRenderer

**Files:**
- Modify: `src/app/the-web/components/MarkdownRenderer.tsx`
- Install: `rehype-raw` package

**Step 1: Install rehype-raw**

```bash
cd ~/Downloads/Dev/mikedouz-portfolio && npm install rehype-raw
```

**Step 2: Add rehype-raw to the ReactMarkdown config**

This is needed so that the HTML tags we inject during preprocessing (`<hoverdef>`) are passed through to our custom component renderer instead of being stripped.

```tsx
import rehypeRaw from 'rehype-raw';

// In the ReactMarkdown component:
<ReactMarkdown
  rehypePlugins={[rehypeRaw]}
  components={{...}}
>
```

**Step 3: Commit**

```bash
git add package.json package-lock.json src/app/the-web/components/MarkdownRenderer.tsx
git commit -m "feat: add rehype-raw to blog MarkdownRenderer"
```

---

### Task B2: Build the Hover Definition Preprocessor

**Files:**
- Create: `src/app/the-web/lib/preprocessDefinitions.ts`

**Step 1: Build the preprocessor**

A pure function that takes a markdown string and returns a transformed markdown string with `::...|...::` replaced by `<hoverdef>` tags.

```ts
// src/app/the-web/lib/preprocessDefinitions.ts

/**
 * Regex to match hover definition syntax: ::visible text|definition|source?|greek?::
 *
 * Captures:
 *   1: visible text (the trigger phrase shown in the post)
 *   2: definition text
 *   3: source (optional, may be empty)
 *   4: greek text (optional, may be empty)
 *
 * Supports escaped pipes (\|) within fields.
 */
const HOVER_DEF_REGEX = /::([^|:]+?)\|([^:]+?)(?:\|([^|:]*?))?(?:\|([^|:]*?))?::/g;

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\?\|/g, '|'); // unescape any escaped pipes
}

export function preprocessDefinitions(markdown: string): string {
  return markdown.replace(HOVER_DEF_REGEX, (_match, text, definition, source, greek) => {
    const attrs: string[] = [
      `term="${escapeAttr(text.trim())}"`,
      `definition="${escapeAttr(definition.trim())}"`,
    ];

    if (source?.trim()) {
      attrs.push(`source="${escapeAttr(source.trim())}"`);
    }

    if (greek?.trim()) {
      attrs.push(`greek="${escapeAttr(greek.trim())}"`);
    }

    return `<hoverdef ${attrs.join(' ')}>${text.trim()}</hoverdef>`;
  });
}
```

**Step 2: Write tests (optional but recommended)**

```ts
// Quick sanity checks:
// preprocessDefinitions('The ::good life|eudaimonia definition:: matters.')
// => 'The <hoverdef term="good life" definition="eudaimonia definition">good life</hoverdef> matters.'
//
// preprocessDefinitions('::eudaimonia|def|source|ευδαιμονια::')
// => '<hoverdef term="eudaimonia" definition="def" source="source" greek="ευδαιμονια">eudaimonia</hoverdef>'
```

**Step 3: Commit**

```bash
git add src/app/the-web/lib/preprocessDefinitions.ts
git commit -m "feat: add hover definition markdown preprocessor"
```

---

### Task B3: Create BlogDefinitionCard Component

**Files:**
- Create: `src/app/the-web/components/BlogDefinitionCard.tsx`

**Step 1: Build the blog-specific definition card**

This wraps the shared HoverTrigger but constructs inline DefinitionCardData from the parsed attributes. It also applies blog-specific styling to the trigger text.

```tsx
// src/app/the-web/components/BlogDefinitionCard.tsx
'use client';

import React from 'react';
import { HoverTrigger } from '@/components/hover-cards';
import type { DefinitionCardData } from '@/data/hover-cards';

interface BlogDefinitionCardProps {
  term: string;
  definition: string;
  source?: string;
  greek?: string;
  children: React.ReactNode;
}

export default function BlogDefinitionCard({
  term,
  definition,
  source,
  greek,
  children,
}: BlogDefinitionCardProps) {
  const data: DefinitionCardData = {
    type: 'definition',
    id: `blog-def-${term.toLowerCase().replace(/\s+/g, '-')}`,
    term,
    definition,
    source,
    greek,
  };

  return (
    <HoverTrigger inlineData={data} variant="blog">
      <span
        className="
          text-purple-300/90
          decoration-dotted decoration-purple-500/30
          underline underline-offset-4
          hover:text-purple-200 hover:decoration-purple-400/50
          cursor-help
          transition-colors duration-200
        "
      >
        {children}
      </span>
    </HoverTrigger>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/the-web/components/BlogDefinitionCard.tsx
git commit -m "feat: add BlogDefinitionCard wrapper for hover definitions in posts"
```

---

### Task B4: Integrate into MarkdownRenderer

**Files:**
- Modify: `src/app/the-web/components/MarkdownRenderer.tsx`

**Step 1: Import preprocessor and BlogDefinitionCard**

```tsx
import { preprocessDefinitions } from '../lib/preprocessDefinitions';
import BlogDefinitionCard from './BlogDefinitionCard';
```

**Step 2: Preprocess the content before passing to ReactMarkdown**

```tsx
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const processedContent = preprocessDefinitions(content);

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeRaw]}
      components={{
        // ... existing component overrides ...

        // Hover definition handler
        hoverdef: ({ node, children, ...props }: any) => {
          const term = props.term || '';
          const definition = props.definition || '';
          const source = props.source;
          const greek = props.greek;

          return (
            <BlogDefinitionCard
              term={term}
              definition={definition}
              source={source}
              greek={greek}
            >
              {children}
            </BlogDefinitionCard>
          );
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}
```

**Step 3: Verify the build compiles**

```bash
cd ~/Downloads/Dev/mikedouz-portfolio && npx next build
```

**Step 4: Commit**

```bash
git add src/app/the-web/components/MarkdownRenderer.tsx
git commit -m "feat: integrate hover definitions into blog MarkdownRenderer"
```

---

### Task B5: Modify Shared HoverTrigger for Blog Support

> This task modifies files from the hover memories plan. If building both plans in one session, incorporate these changes during Task 6 of the hover memories plan instead of doing them separately.

**Files:**
- Modify: `src/components/hover-cards/HoverTrigger.tsx`
- Modify: `src/components/hover-cards/DefinitionCard.tsx`
- Modify: `src/components/hover-cards/index.ts`

**Step 1: Add `inlineData` and `variant` props to HoverTrigger**

```tsx
interface HoverTriggerProps {
  cardId?: string;
  inlineData?: HoverCardData;
  href?: string;
  variant?: 'portfolio' | 'blog';
  children: React.ReactNode;
}

export default function HoverTrigger({
  cardId,
  inlineData,
  href,
  variant = 'portfolio',
  children,
}: HoverTriggerProps) {
  // Use inlineData if provided, otherwise look up from static map
  const data = inlineData || (cardId ? hoverCards[cardId] : undefined);

  // ... rest of component, passing variant to CardContent
}
```

**Step 2: Add variant styling to DefinitionCard**

```tsx
interface DefinitionCardProps {
  data: DefinitionCardData;
  variant?: 'portfolio' | 'blog';
}

export default function DefinitionCard({ data, variant = 'portfolio' }: DefinitionCardProps) {
  const isBlog = variant === 'blog';

  return (
    <div className={`
      ${isBlog ? 'w-[280px]' : 'w-[260px]'}
      rounded-xl overflow-hidden
      ${isBlog ? 'bg-gray-800/95' : 'bg-white/90 dark:bg-gray-900/90'}
      backdrop-blur-md shadow-xl
      ${isBlog ? 'border-gray-700/50' : 'border-gray-200/50 dark:border-gray-700/50'}
      border px-4 py-3
    `}>
      {/* Term header */}
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={`
          text-base font-serif font-semibold italic
          ${isBlog ? 'text-gray-100' : 'text-gray-900 dark:text-gray-100'}
        `}>
          {data.term}
        </span>
        {data.greek && (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-light">
            {data.greek}
          </span>
        )}
      </div>

      {/* Accent divider */}
      <div className={`
        w-8 h-px mb-2
        ${isBlog
          ? 'bg-gradient-to-r from-purple-400 to-purple-600'
          : 'bg-gradient-to-r from-blue-400 to-emerald-400'}
      `} />

      {/* Definition */}
      <p className={`
        text-xs leading-relaxed font-light
        ${isBlog ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}
      `}>
        {data.definition}
      </p>

      {/* Source */}
      {data.source && (
        <p className="mt-2 text-[10px] text-gray-500 italic">
          {data.source}
        </p>
      )}
    </div>
  );
}
```

**Step 3: Export types from barrel**

```ts
// src/components/hover-cards/index.ts
export { default as HoverTrigger } from './HoverTrigger';
export { default as MemoryBubble } from './MemoryBubble';
export { default as DefinitionCard } from './DefinitionCard';
export { default as MusicOverlay } from './MusicOverlay';
export type { HoverCardData, DefinitionCardData, MemoryBubbleData } from '@/data/hover-cards';
```

**Step 4: Commit**

```bash
git add src/components/hover-cards/
git commit -m "feat: add inlineData and variant support to shared hover card components"
```

---

### Task B6: Test with a Real Blog Post

**Files:** None (manual testing)

**Step 1: Create a test post via the API (or use an existing post)**

Write a test markdown body with hover definitions:

```markdown
Aristotle argued that the highest human good is ::eudaimonia|The condition of human flourishing or of living well. Not happiness in the modern hedonic sense, but the state of living well and doing well, achieved through virtuous activity of the soul in accordance with excellence, over a complete life.|Nicomachean Ethics, Book I|ευδαιμονία::, which is often translated as "happiness" but means something much deeper.

This framing matters because ::most people optimize for comfort|I am making a deliberate distinction here between comfort (the absence of discomfort) and flourishing (the presence of meaning, growth, and purpose). Comfort is a component of flourishing, but optimizing for comfort alone produces stagnation.:: when they should be optimizing for growth.

The ::Tree of Human Flourishing|A framework for organizing what humans need to thrive. Roots are psychological foundations (secure attachment, self-knowledge). Trunk is core identity. Branches are life domains (work, relationships, health). Fruit is what a well-lived life produces for others.:: is an attempt to map this concretely.
```

**Step 2: Verify rendering**

- Load the post at `/the-web/[slug]`
- Confirm "eudaimonia" appears with subtle purple highlight and dotted underline
- Hover over it on desktop: definition card appears with term, Greek text, definition, and source
- The surrounding text reads naturally without hovering
- Card dismisses on mouse leave
- Test on mobile viewport: tap reveals card, tap outside dismisses

**Step 3: Edge cases to check**

- Multiple hover definitions in the same paragraph
- Hover definition at the start or end of a paragraph
- Hover definition inside a blockquote
- Hover definition inside a list item
- Long definition text (card should not overflow viewport)
- Two hover definitions adjacent to each other
- Post with no hover definitions (should render identically to before)

---

### Task B7: Update Preview Stripping

**Files:**
- Modify: `src/lib/blog.ts`

The `generatePreview()` function strips markdown for post previews on the listing page. It needs to strip hover definition syntax too, keeping only the visible text.

**Step 1: Add a regex strip for `::...|...::` in generatePreview**

Add this line to the chain of `.replace()` calls in `generatePreview()`:

```ts
.replace(/::(.*?)\|[^:]*?::/g, '$1')  // hover definitions (keep visible text)
```

Place it before the general whitespace cleanup. This ensures post previews on `/the-web` show "eudaimonia" as plain text, not the full `::eudaimonia|definition::` syntax.

**Step 2: Commit**

```bash
git add src/lib/blog.ts
git commit -m "feat: strip hover definition syntax from blog post previews"
```

---

## File Map (New and Modified)

| File | Action | Purpose |
|------|--------|---------|
| `src/app/the-web/lib/preprocessDefinitions.ts` | Create | Parses `::...\|...::` syntax into `<hoverdef>` tags |
| `src/app/the-web/components/BlogDefinitionCard.tsx` | Create | Blog-styled wrapper around shared HoverTrigger |
| `src/app/the-web/components/MarkdownRenderer.tsx` | Modify | Add rehype-raw, preprocessor, and hoverdef component |
| `src/components/hover-cards/HoverTrigger.tsx` | Modify | Add `inlineData` and `variant` props |
| `src/components/hover-cards/DefinitionCard.tsx` | Modify | Add `variant` prop for blog styling |
| `src/components/hover-cards/index.ts` | Modify | Export types |
| `src/lib/blog.ts` | Modify | Strip hover syntax in `generatePreview()` |
| `package.json` | Modify | Add `rehype-raw` dependency |

## Data Flow

```
Blog post markdown (Supabase body field)
  |
  v
preprocessDefinitions() — replaces ::text|def:: with <hoverdef> tags
  |
  v
ReactMarkdown + rehype-raw — parses markdown, passes <hoverdef> to custom component
  |
  v
BlogDefinitionCard — constructs DefinitionCardData, renders HoverTrigger
  |
  v
HoverTrigger (inlineData mode) — handles hover/tap, positions card via useHoverCard
  |
  v
DefinitionCard (variant="blog") — renders the card with blog-appropriate styling
```

## Writing Hover Definitions (Author Guide)

When writing a blog post for The Web, use this syntax for hover definitions:

```
::visible text|definition::
::visible text|definition|source::
::visible text|definition|source|greek text::
```

**Rules:**
- The visible text is what appears in the normal reading flow
- The definition should be 1-3 sentences (longer definitions work but may crowd the card)
- Source is optional, shown in small italic text at the bottom
- Greek text is optional, shown next to the term header
- Do not nest hover definitions
- Do not use `::` elsewhere in markdown (it is not standard markdown syntax, so this should not conflict)
- If your definition contains a pipe character, escape it as `\|`
- If your definition contains `::`, restructure to avoid it

**Style guidance:**
- Write definitions that add genuine depth, not just dictionary lookups
- Caveats are powerful: "This is true, ::but with a caveat|here is the nuance that would break the flow::"
- Use sparingly. 2-5 per post is the sweet spot. More than that and the text starts feeling like a minefield.
- The best hover definitions make the reader feel rewarded for being curious.

---

## Revised Implementation Order (Combined with Hover Memories Plan)

If implementing both hover memories and blog definitions in one session, the optimal order is:

1. **Task 1** (hover-memories): Create hover card data types and data file
2. **Task 2** (hover-memories): Build useHoverCard hook
3. **Task 3** (hover-memories): Build MemoryBubble component
4. **Task 4** (hover-memories): Build MusicOverlay component
5. **Task 5** (hover-memories): Build DefinitionCard component — **include `variant` prop from the start**
6. **Task 6** (hover-memories): Build HoverTrigger wrapper — **include `inlineData` and `variant` props from the start**
7. **Task B1** (blog): Add rehype-raw to MarkdownRenderer
8. **Task B2** (blog): Build the hover definition preprocessor
9. **Task B3** (blog): Create BlogDefinitionCard component
10. **Task B4** (blog): Integrate into MarkdownRenderer
11. **Task B7** (blog): Update preview stripping in blog.ts
12. **Task 7** (hover-memories): Integrate into AboutContent
13. **Task 8** (hover-memories): Add placeholder photos
14. **Task 9** (hover-memories): Final polish and build verification — **now includes blog integration testing**
15. **Task B6** (blog): Test with a real blog post

---

## Implementation Prompt

Copy this prompt into a new Claude Code session in the `~/Downloads/Dev/mikedouz-portfolio/` directory to implement the full hover card system (shared infrastructure + blog integration + portfolio integration):

````
Read these two implementation plans in order:
1. `docs/plans/2026-03-10-hover-memories-implementation.md`
2. `docs/plans/2026-03-10-hover-definitions-blog-integration.md`

The blog integration spec contains a "Revised Implementation Order" section at the bottom that merges both plans into one sequence. Follow that order exactly.

Key modifications to the hover memories plan (described in detail in the blog integration spec):

1. When building DefinitionCard (Task 5), include a `variant` prop (`"portfolio" | "blog"`) from the start. The blog variant uses `w-[280px]`, `bg-gray-800/95`, and a purple gradient divider.

2. When building HoverTrigger (Task 6), include an `inlineData` prop (optional `HoverCardData`) and a `variant` prop from the start. If `inlineData` is provided, use it directly instead of looking up from the static `hoverCards` map. Pass `variant` through to the card components.

3. Export types (`HoverCardData`, `DefinitionCardData`, `MemoryBubbleData`) from the barrel export in `src/components/hover-cards/index.ts`.

4. After the shared infrastructure (Tasks 1-6), implement the blog integration tasks (B1-B4, B7) before wiring into AboutContent (Task 7).

5. The blog's MarkdownRenderer is at `src/app/the-web/components/MarkdownRenderer.tsx`. It currently uses react-markdown with custom component overrides. The integration adds rehype-raw, a markdown preprocessor for `::text|definition::` syntax, and a `hoverdef` custom component.

6. The preprocessor (`src/app/the-web/lib/preprocessDefinitions.ts`) is a pure function: markdown string in, transformed markdown string out. It replaces `::visible text|definition|source?|greek?::` with `<hoverdef term="..." definition="..." source="..." greek="...">visible text</hoverdef>`.

7. `BlogDefinitionCard` (`src/app/the-web/components/BlogDefinitionCard.tsx`) wraps HoverTrigger with blog-specific trigger styling: `text-purple-300/90`, dotted underline at `decoration-purple-500/30`, `cursor-help`.

8. Update `generatePreview()` in `src/lib/blog.ts` to strip `::...|...::` syntax, keeping only the visible text.

After implementation, run `npx next build` to verify everything compiles cleanly.
````
