---
name: premium-design-craft
description: The craft layer behind premium visual design. Load this whenever design quality is at stake and you would otherwise guess or go research typography, color theory, spacing, shadows, motion, or brand psychology. Use it for any request to make something look professional, premium, high-end, expensive, luxury, polished, less generic, or "not AI-generated," and for any component-level polish work such as improving a button, card, form, nav, badge, table, font choice, palette, shadow, or hover state. Also use when auditing or upgrading an existing UI that feels flat, cheap, templated, or off in a way the user cannot name. Contains researched reference material on type craft, perceptual color, spatial systems, component anatomy, motion, and the psychology of premium perception, so you never need to search the web for design fundamentals mid-project.
---

# Premium Design Craft

You are not decorating. You are making a series of defensible decisions and then executing them to a tolerance most people never reach.

This skill is the **why and how much**. It exists so you never have to stop mid-project and research typography, color science, or brand psychology. Everything you need is in `references/`.

## The one idea that matters

> **Premium reads as evidence of decisions. Slop reads as evidence of defaults.**

A viewer cannot articulate why a design feels expensive. What they detect, pre-consciously, is *consistency plus intent*: every value in the design appears to come from a system, and a few values appear to have been chosen by someone with a point of view. Cheap design fails on one or both. Either nothing is systematic (random spacing, five accent colors, four radii) or everything is systematic and nothing is chosen (pure framework defaults, untouched).

So the work is always two moves:

1. **Systematize everything.** No orphan values. Every number traces to a token.
2. **Then break the system exactly once, deliberately, where it counts.** One element carries the personality. Everything else stays quiet and supports it.

Designs that skip step 1 look amateur. Designs that skip step 2 look templated. AI output usually skips both: it applies a *different* set of defaults inconsistently.

## Non-negotiable operating rules

**Never output a raw value.** No `#7C3AED`, no `padding: 13px`, no `0.2s`. Everything is a token: `var(--accent)`, `var(--space-3)`, `var(--dur-fast)`. If a value cannot be justified as a step on a scale, it is wrong. This single rule eliminates the majority of amateur tells.

**Every value must have a reason you could say out loud.** "The heading is 3.052rem because it is two steps up the 1.25 scale from body." Not "it looked big enough." If you cannot state the reason, you guessed, and guessing is what produces slop.

**Spend boldness once.** One signature move per page or per component set. A striking display face, or a saturated accent, or an unusual layout, or an ambitious motion moment. Not four of them. Four bold moves cancel each other out and read as noise; one bold move surrounded by discipline reads as confidence.

**Restraint is the premium signal, not ornament.** Research on perceived luxury is consistent on this point: generous negative space and a restricted palette measurably increase perceived quality and value, while density and visual maximalism read as discount positioning. When in doubt, remove an element and increase the space around what remains.

**Optical over mathematical.** Mathematically correct frequently looks wrong. A play triangle centered by math sits left of center to the eye. Equal top and bottom padding reads bottom-heavy. Trust the eye, then encode the correction as a token.

**Do not invent brand.** If the project has an existing logo, palette, or typeface, those are constraints, not suggestions. Work with them. If they are genuinely bad, say so once and propose an alternative, then follow the user's call.

## Procedure

Work in this order every time. Do not skip to code.

### 1. Diagnose (30 seconds, before anything else)

If an existing design is in play, run the audit in this order. It is ordered by impact per unit effort:

| # | Check | The tell |
|---|---|---|
| 1 | **Type** | One or two weights only; default system stack or untouched Inter; headings that are merely bigger body text; no tracking adjustment at any size |
| 2 | **Space** | Spacing values not from a scale; equal gaps inside and between groups; sections all the same height; margins that do not increase with viewport |
| 3 | **Color** | More than one accent; grays from mixed temperature families; pure `#000` or `#fff`; saturation identical across the whole ramp |
| 4 | **Depth** | Single-layer pure-black `box-shadow`; every surface at the same elevation; shadows implying different light sources |
| 5 | **State** | No hover, no active, no focus ring, no disabled, no loading, no empty, no error |
| 6 | **Detail** | Straight quotes, orphaned words, misaligned baselines across columns, inconsistent radii, icons at mixed stroke weights |

Report the diagnosis as a short list before you touch anything. This is not ceremony. Naming the failures is how you avoid fixing the wrong thing, and it gives the user something to disagree with early instead of after you have written 600 lines of CSS.

### 2. Decide the direction

Write one sentence, out loud, before designing:

> "This is a **[artifact]** for **[audience]**, and it should feel **[3 adjectives]**, because **[reason grounded in the subject]**."

Then commit to a **material metaphor**: is this thing made of paper, glass, ink, metal, fabric, light, or stone? The metaphor is not decoration, it is a constraint that decides your shadows, radii, borders, and motion in one stroke and keeps them coherent. Paper has soft diffuse shadows, warm neutrals, low radii, and settle-in motion. Glass has crisp edges, backdrop blur, cool neutrals, and slide motion. Ink has no shadows at all, hairline rules, high contrast, and instant state changes. Pick one and hold it.

If the direction is genuinely ambiguous and the choice would send you somewhere very different, ask **one** question. Otherwise state your read and proceed.

### 3. Derive the system

Build tokens before components. Always this order, because each layer depends on the one above:

```
type scale + families  →  spacing scale  →  color ramp  →  radius set  →  elevation set  →  motion set
```

Minimum viable system (see `references/` for how to derive each):

- **Type:** 6 to 8 sizes on one modular ratio, 3 to 4 weights, tracking per size band, 2 families maximum
- **Space:** 6 to 8 steps, geometric not linear
- **Color:** 1 neutral ramp of 9 to 11 steps, 1 accent ramp, at most 2 semantic colors, all in OKLCH
- **Radius:** 3 steps plus `full`, harmonized so nested corners are concentric
- **Elevation:** 4 levels maximum, each a layered and tinted shadow
- **Motion:** 3 durations, 3 easings, named by intent

### 4. Detail

This is the phase that separates professional from competent, and it is the phase that gets skipped. Component-level craft lives in `references/components.md`: optical padding, state choreography, focus treatment, icon alignment, loading and empty states, and the specific reasons most generated buttons and cards read as cheap.

### 5. Judge before shipping

Five tests. Run them honestly.

1. **Squint test.** Blur your eyes (or the screenshot). Does hierarchy survive? If everything mushes into one gray field, your contrast is doing no work.
2. **Removal test.** Remove the single most decorative element. Is the design worse? If not, it stays removed. Repeat.
3. **Substitution test.** Could this exact design serve a completely different company in a different industry? If yes, it is a template, not a design. Something must become specific to *this* subject.
4. **Grid-off test.** Delete all background colors and borders. Does the layout still read as organized purely from alignment and spacing? If it only held together because of boxes, the underlying structure is weak.
5. **Screenshot test.** If your environment can render and screenshot, do it and look. A picture surfaces the misalignment that reading CSS never will.

Then apply the classic: look once more and take one thing off.

## Reference files

Read the one you need. Do not load all of them.

| File | Read it when |
|---|---|
| `references/typography.md` | Any type decision: family selection, pairing, scale, tracking, leading, measure, weights, OpenType, loading, punctuation |
| `references/color-and-light.md` | Palette construction, OKLCH ramps, neutral tinting, accents, contrast, shadows, elevation, gradients, texture, dark mode |
| `references/space-and-layout.md` | Spacing scales, rhythm, optical adjustment, alignment, radius harmony, density, grid, breaking symmetry |
| `references/components.md` | Buttons, cards, inputs, badges, nav, tables, modals, icons. Anything at component scale |
| `references/motion.md` | Durations, easings, hover and press choreography, entrances, scroll behavior, reduced motion |
| `references/perception-and-brand.md` | Why it works: Gestalt, hierarchy, pre-attentive processing, premium signaling, category conventions, copy as design material, the AI-slop taxonomy |

## Scope and interaction with other skills

This skill is the **craft and reasoning layer**. It answers "what is the correct value and why."

If skills like `design-taste-frontend`, `redesign-existing-projects`, `frontend-design`, or `image-to-code` are also present, they handle **direction, page architecture, and workflow**: what aesthetic to pick, what sections a landing page needs, what the redesign process is. They are compatible with this one and there is no conflict. Their rules tell you *what not to do*; this skill tells you *what number to use instead and why*. When both apply, take direction from them and craft from here.

This skill applies at every scale: a single button, a card, a font swap, a full site. It is not limited to landing pages and it is not limited to new builds.

## Failure modes to watch in yourself

- **Reaching for the familiar palette.** Purple-to-blue gradients, cream plus warm terracotta, near-black plus acid green. These are current AI defaults. They are legitimate for some briefs, but if you arrived at one without the brief pointing there, you defaulted.
- **Adding instead of removing.** When something feels unfinished, the instinct is to add a gradient, a border, an icon. Nine times out of ten the fix is more space and fewer elements.
- **Uniform application.** Same radius everywhere, same shadow everywhere, same gap everywhere. Uniformity is not consistency. Consistency is a *system of intentional differences*.
- **Stopping at "fine."** The last 10 percent (optical alignment, tracking, focus states, empty states, punctuation) is the entire difference between competent and premium. It is also the part that is invisible in a code diff and obvious on screen.
