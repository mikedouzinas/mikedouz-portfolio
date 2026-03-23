# Blog Interaction Features — MikeVeson.com / The Web

**Date:** March 22, 2026
**Origin:** Conversation with Nico Bers, March 20, 2026 (at his house)
**Status:** Ideas / Planning
**Priority:** Layer 2 (after core content is established)

---

## Feature 1: Hypertext Commenting / Discussion Layer

### The Idea (Nico's)
Readers can highlight text in a blog post and leave comments attached to specific passages. Not a generic comment section at the bottom. Inline, contextual, attached to the words that sparked the thought.

### Design Thoughts
- Could have a toggle mode: "discussion view" that shows reader annotations vs. clean reading view
- Comments would be non-login (pseudonym-based) or login-based (TBD)
- Visual: subtle background highlights or margin bubbles, not cluttering the main text
- Inspired by the Talmudic hypertext structure: central text with commentary around it, commentary on commentary, built from the middle out

### The Philosophical Basis
Nico's mom (Marina Bers) did research on hypertext and Jewish textual tradition. The Talmud is essentially a hypertext system built over centuries: someone having a conversation with someone who lived hundreds of years before them. Applying that to a blog creates living discourse around ideas rather than static articles.

### Technical Considerations
- Would need a backend for storing annotations (Supabase `blog_annotations` table?)
- Each annotation anchored to a text range (start/end offset or text hash)
- Per-post or global toggle
- Moderation: open vs. curated?

---

## Feature 2: Iris Integration on The Web

### The Idea (from conversation)
A floating Iris bubble on the blog that readers can interact with. Select text, ask Iris about it, and get a response informed by Mike's vault context (not just the blog post).

### How It Would Work
- Small Iris icon (eye button or similar) floating on the side
- Reader selects text, clicks Iris, types a question or comment
- Iris responds using:
  1. The blog post context
  2. Mike's broader vault context (curated, not full vault)
  3. Its own reasoning
- Creates a mini-conversation visible to the reader

### What Makes This Different
- Iris could "advocate on Mike's perspective" when readers misunderstand something
- Could surface related thinking from other posts or vault docs
- Could leave its own "comments" that Mike reviews
- Essentially makes the blog a living, interactive thinking space rather than static articles

### Privacy/Security Notes
- Iris on the blog would need a curated subset of vault context, NOT the full vault
- API costs per interaction need to be considered
- Rate limiting essential

---

## Feature 3: Reader Notifications / Feedback to Mike

### The Idea
When readers interact (comment, highlight, ask Iris), Mike gets notified about:
- Which passages generate the most engagement
- What questions people are asking
- Where his writing was unclear (Iris could flag: "3 readers asked about this paragraph")
- Potential follow-up post ideas from reader questions

### Connection to Existing Systems
- Could integrate with the existing inbox/subscription system
- Iris comments could auto-generate vault notes for Mike to review

---

## Feature 4: Music Context on Posts

### Already Exists (Partially)
The music timeline feature on mikeveson.com already maps songs to time periods. Could extend this to blog posts: "what Mike was listening to when he wrote this" or a small music player embedded in each post showing the soundtrack of the writing session.

### From Conversation
Mike talked about how songs map to specific emotional states and scenes in the movie trilogy. The blog could have a similar quality: each post has a sonic context that adds another dimension of meaning.

---

## Implementation Priority

1. **Now:** Keep writing blog posts. The interaction features are Layer 2. The content is Layer 1.
2. **Next:** Simple highlighting + commenting (no Iris, just reader annotations). Test if people actually engage.
3. **Later:** Iris integration. This requires the commenting system to exist first and enough traffic to justify the API cost.
4. **Eventually:** Full hypertext discussion system with threading, connections across posts, and Iris participation.

---

## Feature 5: Music Panel Background Change

### The Ask
Change the background of the music panel (Spotify sidebar section). Current background needs updating.

### Details
TBD — Mike to specify what the new background should look like (color, gradient, image, etc.)

### Files to Modify
- Likely in the Spotify sidebar component (check `src/components/` for the music/spotify component)

---

## Issue: Sidebar Overflow on Short Viewports

### The Problem
On smaller laptops (13" screens, etc.) and tablets (iPad), the left sidebar content overflows:
- The Spotify music bubble overlaps with the nav items above it
- Social icons (GitHub, LinkedIn, email, Calendly) get pushed off the bottom of the screen
- Discovered by Nico on his laptop (March 20, 2026)
- Fine on 15" MacBook, breaks on anything shorter

### Root Cause
Sidebar uses `flex flex-col h-full justify-between` with three sections (profile+nav, Spotify bubble, social icons). The Spotify bubble doesn't adapt to available vertical space — on short viewports it squeezes out the bottom section.

### Status
Needs fix — affects real visitors on common screen sizes.

---

## References
- Talmudic hypertext structure (via Nico/Marina Bers)
- Marina Bers' PhD thesis: "Identity Construction Environment" (MIT Media Lab)
- Sherry Turkle's work on technology and self
- Mike's conversation with Nico, March 20, 2026

---

*Filed from Limitless pendant transcription, March 20, 2026*
