# TODO - mikeveson.com

Planned improvements and feature ideas.

---

## UI/UX

- [ ] **About section hover transitions** — The hover cards and text hover effects in the About section (`about_section.tsx`, `HoverTrigger.tsx`, `AboutContent.tsx`) feel too fast on hover-out. Needs smoother exit timing so the transition doesn't snap away abruptly. Likely involves adjusting Framer Motion exit duration and/or CSS transition durations.

## HARLEQUIN portal transitions (#19)

- [ ] **Exit "wind-up" pre-roll (idea — not now)** — During the small (~0.3s) beat between clicking the back-diamond and the disintegration starting, play a short build-up animation that reads as the page *gathering itself* to disintegrate — so the delay feels intentional, like the effect is charging up *into* the diamond-ash dissolve rather than a dead pause. Mike's idea; logged for later. Lives around `HarlequinExit.tsx` / the cover phase.
