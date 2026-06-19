# Ticket #77 (P1) — Cere confirmed tool calls that were never made

**Investigation:** trace the Cere request/response/tool-call path; find why Cere narrates "DONE" for changes that were never applied (no proposals shown, board unchanged).
**Scope:** read-only. No code changed.

---

## 1. How the Cere flow works today

Cere is a **planner, not an executor.** It never writes to GitHub itself; it proposes
`create`/`update` actions, the user previews them, and only on **Confirm** does the
client POST/PATCH to `/api/dev/issues`, which owns the GitHub write boundary.

Path:

1. **Client send** — `useCere.send()` POSTs `{ message, history }` to `/api/dev/iris`.
   - `src/components/dev/useCere.ts:46-80`

2. **Planner route** — single, **non-streaming** `anthropic.messages.create(...)` with
   `tools: [CREATE_ISSUE_TOOL, UPDATE_ISSUE_TOOL]`. No `stream`, no tool-result loop.
   - `src/app/api/dev/iris/route.ts:42-53`
   - Tools/schemas/system prompt: `src/lib/dev/cere.ts:28-84`, `:134-168`

3. **Parse** — `parseActions(res.content, issues)` walks the content blocks:
   - `text` blocks are concatenated into `reply`. (`cere.ts:189-190`)
   - `tool_use` blocks are Zod-validated into `actions[]`; **invalid input is dropped
     with only a generic warning** ("Skipped a malformed new ticket." / "Skipped a
     malformed change."). (`cere.ts:191-229`)
   - `resolveActionRepos()` then **drops any action whose repo can't be matched**, again
     with only a soft warning. (`cere.ts:239-261`)
   - Route returns `{ reply, actions, warnings }`. (`route.ts:55-61`)

4. **Render** — the client shows `reply` verbatim as the assistant message. If
   `actions.length === 0`, it falls back to `reply || '…'` (it does **not** substitute a
   safe summary; `summarize()` is only used when actions exist).
   - `src/components/dev/useCere.ts:63-71`
   - Proposal card + Confirm/Discard buttons render **only when `actions.length > 0`**.
   - `src/components/dev/CerePanel.tsx:233-263`

5. **Confirm (the only real write)** — `useCere.confirm()` loops the actions, POST/PATCH to
   `/api/dev/issues`, then posts a "Done — N changes applied" message.
   - `src/components/dev/useCere.ts:82-140`; issues route `src/app/api/dev/issues/route.ts:53-104`

**Key structural fact:** the only text the user ever sees that should imply a change *was
applied* is supposed to come from step 5 (after a successful HTTP write). But step 4 prints
**whatever Claude wrote in free text**, with no cross-check against `actions`.

---

## 2. Root-cause hypothesis

**Primary (highest confidence): the planner's natural-language `reply` is decoupled from the
actual tool calls, so Claude can narrate a completed change while emitting zero (or dropped)
`tool_use` blocks — and the client prints that narration verbatim.**

Cere is a *proposer*, but its system prompt and the UI talk like it *does* things. The prompt
tells it to "propose ticket changes" and "Always include one short plain-language sentence
summarizing what you're proposing" (`cere.ts:152-156`), but nothing forbids past-tense
"done/updated/filed" phrasing, and **nothing ties the prose to the presence of a `tool_use`
block.** Sonnet, especially in multi-turn history, will sometimes:

- answer in text only (`stop_reason: "end_turn"`, no tool block) while *describing* the edit
  as if performed, or
- emit a `tool_use` whose `input` fails `CreateInput`/`UpdateInput` Zod parsing or whose
  `repo` doesn't resolve — in which case the action is **silently dropped**
  (`cere.ts:193-194`, `:203-204`, `:252-254`) while the confident text survives in `reply`.

In both cases the route returns `actions: []` (or fewer than described) **plus** the upbeat
text. The client then:
- renders the "done" text (`useCere.ts:64-68`), and
- shows **no proposal card and no Confirm button** because `actions.length === 0`
  (`CerePanel.tsx:234`).

Result = exactly the ticket symptom: Cere says it updated a ticket / filed new ones, **UI shows
no proposals, board is unchanged.** The user never even gets a Confirm step, so nothing is ever
written, yet the language reads as completed.

### Evidence
- `route.ts:42-53` — non-streaming single call; text and tool blocks returned together with no
  reconciliation.
- `cere.ts:189-190` — every `text` block is accepted into `reply` unconditionally.
- `cere.ts:193-194`, `:203-204` — malformed tool input → action dropped, generic warning only.
- `cere.ts:252-254` — unresolvable repo → action dropped, generic warning only.
- `useCere.ts:64` — `const reply = data.reply || (...)` prints model prose as-is; no guard that
  changes-claimed ⇒ actions-present.
- `CerePanel.tsx:234, 247-260` — Confirm UI is gated entirely on `actions.length > 0`.
- `useCere.ts:130-138` — the *legitimate* "Done — N changes applied" line is the only place a
  completion claim is justified (it runs after HTTP writes), which makes the planner's
  premature "done" prose especially misleading because it mimics this real message.

### How to confirm
1. **Reproduce live:** send a phrasing that nudges narration over action, e.g. "go ahead and
   close #X and file a P1 for the header overlap" after a couple of prior turns. Watch the
   `/api/dev/iris` JSON in the Network tab: look for a response where `reply` contains
   past-tense "closed/updated/filed/done" while `actions` is `[]` (or shorter than the prose
   implies). That single response *is* the bug.
2. **Force the drop path:** temporarily inspect `warnings` — if "Skipped a malformed…" or
   "Couldn't match repo…" appears alongside a confident reply, that's the validation/resolve
   drop variant.
3. **Log `res.stop_reason` and `res.content` block types** at `route.ts:54` (read-only logging)
   to see `end_turn` with text-only content for the failing messages.

### Alternates
- **(B) Tool input/repo validation drop:** a tool *was* emitted but Zod-rejected or
  repo-unresolved, so it's dropped (`cere.ts:193,203,252`) while the matching text persists.
  Same user-visible symptom; distinguished by a non-empty `warnings` array. Lower likelihood as
  the *sole* cause but plausibly co-occurring.
- **(C) Confirm step never reached / mis-read:** user (or a future caller) reads the planner's
  "here's what I'll do" prose as completion and closes the panel without clicking Confirm;
  `discard`/close drops the actions (`CerePanel.tsx:106-112`, `useCere.ts:142-148`). This is a
  UX-trust contributor, not the core defect, but the fix should harden against it too.

There is **no** evidence of a swallowed write error or aborted stream as the cause: writes only
happen on explicit Confirm and *do* surface failures ("Applied N, but M failed",
`useCere.ts:134-135`). The phantom-done text originates in the **planner reply**, before any
write is attempted.

---

## 3. Fix plan (maps to the ticket's three checkboxes)

**① Never describe a change as applied unless the tool returned success.**
- **System prompt (server):** in `buildCereSystem` (`cere.ts:152-168`) add an explicit
  contract: Cere is a *proposer*; it must speak in the **future/proposal tense**
  ("I'll file…", "I'm proposing…") and is **forbidden** from saying a change is "done /
  updated / filed / closed / applied." Completion language belongs only to the post-Confirm
  client message.
- **Client (authoritative):** the user-facing completion line must come **only** from the real
  write path that already exists (`useCere.ts:130-138`). Don't let planner prose imply
  completion — see ② for how to neutralize it.

**② Explicit failure / skip language.**
- Make the dropped-action warnings specific instead of generic: include repo/number/title in
  `cere.ts:194, 204, 253` (e.g. "Skipped update to portfolio#77 — invalid fields: …",
  "Couldn't match repo 'foo' — not on your board, skipped"). These already flow to the UI
  (`CerePanel.tsx:244-246`); making them concrete tells the user exactly what *didn't* happen.
- In `useCere.confirm`, capture and surface the per-action HTTP error (currently
  `throw new Error()` with no message, `useCere.ts:118`) so partial failures name the ticket.

**③ Post-response guard: if the summary claims changes, ≥1 tool call must have fired.**
- Add a reconciliation check after `parseActions` in the route (`route.ts:55`), or in
  `useCere.send` after parsing the response (`useCere.ts:63`). Pseudocode:
  ```
  const claimsChange = /\b(filed|created|updated|changed|closed|reopened|marked|applied|done)\b/i
                         .test(reply);
  if (claimsChange && actions.length === 0) {
     // Don't show the misleading reply. Replace with a safe, honest message:
     reply = "I didn't actually make any changes — I can only propose them for you to confirm. " +
             "Want me to draft those tickets so you can review and confirm?";
     warnings.push("Cere described a change but emitted no actionable proposal.");
  }
  ```
  Prefer doing this **server-side** in `route.ts` so every caller (not just this client) is
  protected, and so the guard sits next to where `actions`/`reply` are produced.
- Stronger variant: if `claimsChange && actions.length === 0`, also flip a `phantom: true`
  flag in the response and have the client render the corrective copy in a warning style.
- Optionally tighten the regex to past-tense/applied verbs only, so legitimate proposal prose
  ("I'll file…") isn't falsely caught.

**Tests:** add cases to the Cere test path for (a) text-only "done" reply ⇒ guard rewrites it,
(b) tool emitted but Zod-dropped ⇒ specific warning + guard fires, (c) normal propose→confirm
still passes through unchanged.

---

## 4. Proposed ticket update (paste into #77)

- **Root cause:** Cere's planner reply (Claude's free text) is rendered verbatim and is fully
  decoupled from whether any `tool_use` actually fired. The model can write "done / updated /
  filed" while emitting zero tool blocks (or tool blocks that get Zod- or repo-dropped), so the
  route returns `actions: []` plus confident prose. The UI shows the prose but no proposal card
  / Confirm button — and nothing is ever written. Evidence: `route.ts:42-61`, `cere.ts:189-190`
  + drop paths `cere.ts:193,203,252`, `useCere.ts:64`, `CerePanel.tsx:234`.
- **Trust amplifier:** the premature "done" prose mimics the *real* post-Confirm success line
  (`useCere.ts:130-138`), so it's indistinguishable from a genuine completion.
- **Three-part fix:** (1) system-prompt contract forbidding completion/past-tense language —
  Cere only *proposes*; (2) specific skip/failure warnings naming the ticket instead of the
  current generic "Skipped a malformed…"; (3) a **server-side post-response guard** — if the
  reply claims a change but `actions.length === 0`, replace the reply with honest copy and add a
  warning. (Done-language should only ever come from the confirmed-write client message.)
- **Not the cause:** no swallowed write error / aborted stream. Writes only run on explicit
  Confirm via `/api/dev/issues` and already report failures. The phantom "done" originates in
  the planner reply, before any write is attempted.

---

## 5. Risk / why I didn't auto-fix

- **Hard rule:** this task was read-only and explicitly forbade editing anything under `src/`.
  All proposed changes touch `src/lib/dev/cere.ts`, `src/app/api/dev/iris/route.ts`, and
  `src/components/dev/useCere.ts`, so they're out of scope for this pass.
- **Prompt-contract changes carry behavior risk:** over-aggressive "no completion language"
  rules could make Cere stiff or suppress legitimate proposal summaries; the regex guard needs
  tuning to avoid false positives on proposal-tense prose ("I'll file…"). These want a quick
  live test against the test:iris-style suite before shipping.
- **Confirmation pending:** the live-repro / `stop_reason` logging step (§2) should be run to
  capture a concrete failing `/api/dev/iris` response before implementing, so the guard's regex
  is built from real phantom phrasings rather than assumed ones.
