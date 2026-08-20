# Space and Layout

Space is the cheapest premium signal available and the one most consistently underused. There is a measurable, repeatedly demonstrated relationship between negative space and perceived value: studies of consumer perception have found that generous white space significantly raises both perceived luxury and perceived product quality, with effects large enough to influence pricing power.

The mechanism is signaling. Filling every pixel says "I need to show you everything because you might not buy." Leaving space says "this one thing is worth your attention, and I can afford to show you nothing else." A discount flyer crams forty products into the space a luxury brand gives to one.

**Contents:** Spacing scale · Proximity · Rhythm · Optical adjustment · Alignment · Radius · Grid · Density · Breaking symmetry · Diagnostics

---

## 1. The spacing scale

Geometric, not linear. Linear scales (4, 8, 12, 16, 20, 24…) produce steps that are indistinguishable at the top end. Geometric scales keep every step perceptually meaningful.

```css
:root {
  --space-1: 0.25rem;   /*  4px  icon gaps, inline adjustments */
  --space-2: 0.5rem;    /*  8px  tight internal padding */
  --space-3: 0.75rem;   /* 12px  input padding, chip padding */
  --space-4: 1rem;      /* 16px  default gap, card padding (small) */
  --space-5: 1.5rem;    /* 24px  card padding, gap between cards */
  --space-6: 2rem;      /* 32px  block separation */
  --space-7: 3rem;      /* 48px  subsection separation */
  --space-8: 4rem;      /* 64px  section padding (compact) */
  --space-9: 6rem;      /* 96px  section padding (standard) */
  --space-10: 8rem;     /* 128px section padding (generous) */
}
```

**Every spatial value in the design comes from this list.** No exceptions, no `margin-top: 13px`. This one constraint is responsible for a large share of the difference between designs that feel systematic and designs that feel assembled.

---

## 2. Proximity is the strongest grouping signal

The Gestalt law of proximity outranks borders, backgrounds, and color for communicating what belongs with what. This has a direct, mechanical consequence:

> **The gap inside a group must be visibly smaller than the gap between groups. Not slightly smaller. Visibly.**

A useful ratio is **1 : 2 : 4**. If elements inside a group sit `--space-2` apart, groups sit `--space-4` apart, and sections sit `--space-8` apart. When the difference is only one step, the eye cannot resolve the hierarchy and the layout reads as an undifferentiated list.

Concrete failure this fixes: a form where the label sits 8px above its input and the previous input sits 12px above the label. The labels visually attach to the *wrong* field. Every user has experienced this and none of them could name it.

Same principle for headings: a heading belongs to the content *below* it, so its bottom margin must be smaller than its top margin, typically by a factor of 2 to 3. Symmetric heading margins are a persistent tell.

---

## 3. Vertical rhythm and section pacing

**Sections should not all be the same height.** Uniform section heights produce a metronomic scroll that reads as templated. Vary deliberately: a tall hero, a compact proof strip, a tall feature section, a short CTA. The rhythm itself is a design decision.

Working values for marketing-style pages:

| Element | Vertical space |
|---|---|
| Section padding, mobile | `--space-7` to `--space-8` (48 to 64px) |
| Section padding, desktop | `--space-9` to `--space-10` (96 to 128px) |
| Between heading and its body | `--space-4` (16px) |
| Between a paragraph and the next heading | `--space-7` (48px) |
| Between sibling cards | `--space-5` (24px) |
| Hero top padding | Larger than any other section |

**Space should scale with viewport.** A 96px section gap on a 1920px screen and on a 390px screen are not equivalent experiences. Use `clamp()`:

```css
--section-y: clamp(3rem, 8vw, 8rem);
```

**On generosity:** when a design feels cramped, the fix is almost never a smaller font. It is more space. When in doubt, double the vertical space between sections and see how it reads. The instinct to fill space is the instinct that produces discount-flyer design.

---

## 4. Optical adjustment

Mathematically correct frequently looks wrong. Professional work corrects for the eye; amateur work trusts the numbers. A partial list of the corrections that matter:

- **Optical centering.** An element in a container looks centered when it sits slightly *above* the mathematical center, because the eye reads the visual center as higher than the geometric one. For a lone element in a large container, shift up by roughly 1 to 3% of the height.
- **Triangles and asymmetric icons.** A play triangle centered by its bounding box looks left-heavy. Shift right by about 5 to 8% of its width. Same for any icon with uneven mass.
- **Round shapes overshoot.** A circle must be drawn slightly larger than a square to look the same size, because the square's corners give it more perceived mass. Well-drawn icon sets already do this. If you mix icon sets, they will not agree.
- **Text in buttons.** Cap height is not the visual center of a text run. Text with descenders sits differently from text without. Buttons frequently need 1 to 2px less bottom padding than top padding to look balanced. See `components.md`.
- **Optical margin alignment.** Letters with round or angular left edges (`O`, `C`, `A`, `W`, `V`, quotation marks) look indented when set flush to a hard edge. Pull them out slightly with a negative margin, or use `hanging-punctuation: first` where supported.
- **Bottom padding in containers.** Equal top and bottom padding usually reads bottom-heavy because the last line's descender space is already visually padding. Reduce bottom padding slightly, or increase the top.
- **Aligning text to icons.** Align to the text's *optical* center, not its box. `line-height: 1` on the text and `align-items: center` usually gets close; check and nudge.

Encode each correction as a token or utility so it stays consistent, rather than fixing it inline in five places.

---

## 5. Alignment

**The number of alignment edges in a layout should be small and deliberate.** Every additional left edge is another line the eye must track. Most well-composed layouts use two or three vertical alignment lines total.

Failures that read as broken even when nothing is technically wrong:

- **Baselines not aligned across columns.** Three cards side by side where the titles are on different baselines because one title wraps to two lines. Fix with a fixed-height title block, `grid-template-rows: auto 1fr auto`, or subgrid.
- **CTAs at different heights in a card row.** When card content varies in length, buttons land wherever. Pin them to the bottom so they form one horizontal line. This is a `grid-template-rows` problem with a one-line fix and it is skipped constantly.
- **Feature lists starting at different Y positions** in pricing tables. Same cause, same fix.
- **Mixing centered and left-aligned** without a reason. Centered text is for short, ceremonial content: a hero line, a section eyebrow, a CTA. Body copy of more than about three lines should be left-aligned, because centered text gives the eye no consistent return point.
- **Never justify text on the web.** Browsers do not hyphenate or space well enough, and you get rivers.

---

## 6. Radius harmony

Uniform radius on everything is a tell. Radius should encode scale and nesting.

**The concentric rule:** when one rounded element sits inside another with padding between them, the corners are only concentric if:

```
outer radius = inner radius + padding
```

A card with a 16px radius and 12px padding containing an image should give the image a 4px radius. Give it 16px and the corners will visibly disagree. This is subtle, it is everywhere, and getting it right is a professional fingerprint.

**A working radius set:**

```css
--radius-sm: 4px;    /* badges, small inputs, nested elements */
--radius-md: 8px;    /* buttons, inputs */
--radius-lg: 12px;   /* cards */
--radius-xl: 20px;   /* modals, large panels, feature blocks */
--radius-full: 9999px; /* avatars, pills, icon buttons */
```

General rules: larger elements take larger radii. Nested elements take smaller radii than their parents. Zero radius is a legitimate, strong choice (editorial, brutalist, technical) but must be total, not selective. Full-round pills for every button is a distinct aesthetic, not a neutral default, so choose it on purpose.

---

## 7. Grid and containers

- **Always set a max-width container.** Content stretching edge to edge on a 2560px monitor is unreadable and unconsidered. 1200 to 1440px for most sites. Text within it constrained further to 60 to 75ch.
- **Use CSS Grid for structure, Flexbox for one-dimensional arrangement.** Percentage-based flexbox math for multi-column layouts is fragile and produces the sub-pixel misalignments that make a layout feel slightly off.
- **`min-height: 100dvh`, never `height: 100vh`.** `vh` does not account for mobile browser chrome, which causes the layout to jump as the address bar hides. `dvh` fixes it. `100vh` on a hero is one of the most common mobile bugs in generated code.
- **Consider not making every section a 12-column grid.** A 12-column grid used for everything produces the three-equal-cards layout by default. An asymmetric split (7/5, 8/4) is often more interesting and just as easy.
- **Let cards have variable height** when their content varies. Forcing equal height with flexbox creates awkward empty space; masonry or `align-items: start` often reads better.

---

## 8. Density

Density is a deliberate setting, not an accident. It should follow the artifact:

| Artifact | Target density |
|---|---|
| Marketing / landing / brand | Low. Generous space, few elements per screen |
| Editorial / long-form | Low to medium. Wide margins, single column |
| Product UI / SaaS app | Medium. Space is expensive but hierarchy must survive |
| Dashboard / data tool | High. But density means tight spacing, *not* small text and not reduced contrast |

The most common mismatch is applying dashboard density to a marketing page, which reads as a control panel and kills the premium signal, or applying marketing generosity to a data tool, which makes it feel slow and requires constant scrolling.

**Density is never an excuse to reduce contrast or type size below readable thresholds.** Dense done well means tighter gaps and a smaller type scale ratio, not 11px gray text.

---

## 9. Breaking symmetry (carefully)

Perfect symmetry is calm and slightly inert. Asymmetry is dynamic and slightly unstable. Premium work is usually *mostly* symmetric with one or two deliberate breaks.

Effective breaks:

- **Offset the content axis.** Left-align a section heading over centered or grid content.
- **Asymmetric column splits.** 7/5 instead of 6/6.
- **Overlap.** Pull an element into the section above with a negative margin so the planes interleave. This creates depth that flat side-by-side placement cannot.
- **Break the container.** Let one image or one element extend past the max-width container to the viewport edge. Used once, this is a strong move.
- **Vary aspect ratios** within a grid rather than making every image 16:9.

Ineffective breaks: rotating things a few degrees for no reason, random size variation with no logic, scattering elements to look "organic." Asymmetry must still be *composed*. The eye should be able to find the structure.

---

## 10. Diagnostics

| Symptom | Cause | Fix |
|---|---|---|
| Layout looks cramped and cheap | Insufficient negative space | Double section padding; remove an element |
| Cannot tell what belongs together | Inside gap ≈ between gap | Enforce 1:2:4 ratio |
| Page feels monotonous when scrolling | Uniform section heights | Vary section padding deliberately |
| Cards look broken next to each other | Unaligned titles or CTAs | `grid-template-rows: auto 1fr auto`, pin CTAs to bottom |
| Corners look slightly wrong on nested elements | Non-concentric radii | `outer = inner + padding` |
| Layout jumps on mobile scroll | `height: 100vh` | `min-height: 100dvh` |
| Feels centered but looks low | Mathematical centering | Shift up 1 to 3% |
| Content stretches uncomfortably wide | No container | Max-width 1200 to 1440px, text at 68ch |
| Design is boring but technically correct | Total symmetry, no break | One deliberate asymmetric move |
| Spacing feels arbitrary | Values not from a scale | Rebuild every value from the token scale |
