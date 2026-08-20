# Component Craft

Page-level direction gets you 60% of perceived quality. The remaining 40% is here: the parts people actually put their cursor on. A single button, executed to this standard, will look better than an entire page executed without it.

**Contents:** Buttons · Cards · Inputs · Badges · Navigation · Tables · Modals · Icons · Empty and loading states

---

## 1. Buttons

The most-touched component and the most reliably mediocre one in generated code.

### Why most generated buttons look cheap

Five causes, in order of frequency:

1. **Symmetric padding.** Text does not sit in the optical center of its own line box.
2. **A single flat background with no lighting.** Real controls have an edge.
3. **Hover changes background only.** No transition, no depth change, no movement.
4. **No press state.** Nothing happens on click, so the button never feels physical.
5. **Label is a noun.** "Submit," "Learn More." A button label should say what happens.

### Sizing and optical padding

Horizontal padding should be roughly **2 to 2.5×** vertical padding. Anything closer to 1:1 looks like a chunky tile; anything wider looks like a bar.

**Vertical padding is asymmetric.** A text run's visual center sits slightly above its box center because of descender space. Reduce the bottom padding by about 1px at typical sizes:

```css
.btn-md { padding: 11px 20px 10px; }
```

This is a one-pixel change that is individually invisible and cumulatively the difference between "fine" and "made by someone who looked at it."

| Size | Padding | Font size | Min height |
|---|---|---|---|
| sm | `7px 12px 6px` | 13px / 500 | 32px |
| md | `11px 20px 10px` | 14px / 500 | 40px |
| lg | `15px 28px 14px` | 16px / 500 | 48px |

Minimum touch target is **44×44px** on touch devices. If the visual button is smaller, extend the hit area with padding or a pseudo-element rather than inflating the visual.

Set `line-height: 1` on button labels so padding fully controls height. Inherited body line-height makes buttons unpredictably tall.

### Radius

Button radius should relate to height, not be a fixed global. A useful heuristic: radius ≈ height ÷ 5 for a soft-rectangular look, or `--radius-full` for a pill. Do not mix pills and rounded rectangles in the same interface.

### Elevation and lighting

A primary button on a solid fill benefits from a lit top edge, which is what makes it read as a physical object rather than a colored rectangle:

```css
.btn-primary {
  background: var(--accent-500);
  box-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.15),          /* lit top edge */
    0 1px 2px oklch(var(--shadow-color) / 0.10), /* contact */
    0 2px 6px -1px oklch(var(--shadow-color) / 0.12); /* key */
}
```

The inset highlight line is the detail that most distinguishes premium button work. On dark UI it is essential.

### State choreography

Every button needs six states. Missing states are the most common accessibility and quality failure at once.

```css
.btn {
  transition:
    background-color 150ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow      150ms cubic-bezier(0.2, 0, 0, 1),
    transform        80ms cubic-bezier(0.2, 0, 0, 1);
}

/* hover: lighter/darker AND lifted */
.btn:hover {
  background: var(--accent-600);
  box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.15),
              0 2px 4px oklch(var(--shadow-color) / 0.10),
              0 6px 14px -2px oklch(var(--shadow-color) / 0.14);
  transform: translateY(-1px);
}

/* active: press through the surface, faster than the hover */
.btn:active {
  background: var(--accent-700);
  box-shadow: inset 0 1px 2px oklch(var(--shadow-color) / 0.20);
  transform: translateY(0.5px);
  transition-duration: 40ms;
}

/* focus: visible, offset, never removed */
.btn:focus-visible {
  outline: 2px solid var(--accent-500);
  outline-offset: 2px;
}

/* disabled: reduced, not invisible; no pointer affordance */
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
```

Key points most implementations miss:

- **The press must be faster than the hover.** Physical response to input is immediate; recovery is slower. A press that takes 200ms feels laggy. 40 to 80ms.
- **Hover lifts (translateY -1px), press sinks.** The pair creates a coherent physical model. One without the other feels incomplete.
- **`:focus-visible`, not `:focus`.** `:focus` shows the ring on mouse click too, which designers then delete entirely, which breaks keyboard access. `:focus-visible` shows it only for keyboard users.
- **Never `outline: none` without a replacement.** This is the single most common accessibility failure on the web.

### Hierarchy

Three levels, and a fourth if needed. The common pattern of exactly one filled button plus one outlined ghost button on every page is itself a tell.

- **Primary:** filled accent. **One per view.** If you have two primaries, you have not decided what you want the user to do.
- **Secondary:** subtle fill (`--neutral-100`) or a low-contrast border. Not an outlined version of the primary in the accent color, which competes.
- **Tertiary:** plain text with a hover background, or an underlined text link.
- **Destructive:** its own treatment, usually a text or ghost button in the danger color, promoted to filled only in a confirmation dialog.

### Labels

- Verb + object: "Create account," "Save changes," "Download report." Not "Submit," not "Learn more," not "Get started" if something more specific is true.
- Sentence case.
- The label must persist through the flow: a button that says "Publish" produces a toast that says "Published."
- No exclamation marks.
- If the button opens something rather than committing something, say so: "Choose a plan," not "Continue."

### Loading state

Do not swap the label for a spinner, which changes the button width and shifts the layout. Keep the width fixed, dim the label, and overlay the spinner. Or place the spinner inline before the label with a reserved slot.

### Icons in buttons

- Icon size ≈ label cap height, not label font size. Usually 16px icon with 14px text.
- Gap of `--space-2` (8px).
- Optical alignment: most icon sets need 0.5 to 1px vertical adjustment to sit right against text. Check it.
- Leading icon = category or object. Trailing icon = direction or result (arrow, external link, chevron). Do not put a decorative arrow on every button.

---

## 2. Cards

### The generic card problem

`white background + 1px light gray border + soft gray shadow + 8px radius + centered icon + title + two lines of text`, repeated three times across. This is the most recognizable AI-generated layout in existence.

The structural fixes:

- **Pick one separation strategy** (shadow OR border OR fill), per `color-and-light.md`. Not all three.
- **Question whether it should be a card at all.** A card is a container that signals "this is a discrete, self-contained, probably clickable object." If the content is not discrete or clickable, it does not need a box. Much stronger layouts come from removing the boxes and using space and alignment to group instead.
- **Break the three-equal-columns habit.** A 2-column zigzag, an asymmetric grid where one item is larger, a horizontal scroll rail, or a plain list with strong typography all read as more considered.

### Internal craft

- **Padding at `--space-5` (24px) or `--space-6` (32px)** for content cards. 16px reads cramped on anything larger than a compact list row.
- **Nested radius must be concentric:** an image inside a 16px-radius card with 12px padding gets 4px radius.
- **Pin the CTA to the bottom.** `display: grid; grid-template-rows: auto 1fr auto;` so buttons form one line across a row regardless of body length.
- **Give the title a consistent block height** if titles wrap inconsistently, or use `text-wrap: balance` and accept variable height everywhere consistently.
- **Whole-card hit area** if the card is a link. Use a stretched pseudo-element on the title link rather than wrapping the entire card in an `<a>`, so text inside stays selectable:

```css
.card { position: relative; }
.card__title-link::after { content: ""; position: absolute; inset: 0; }
```

### Card hover

If a card is interactive, the hover must say so. If it is not interactive, it must have no hover, because a hover state on a non-clickable card is a lie and users will click it.

Good interactive hover: elevation increase plus a 1 to 2px lift plus a border color shift. All three at 200ms. Not a scale transform on the whole card, which blurs the text during the transition on many displays.

---

## 3. Inputs and forms

- **Label above the field**, always. Placeholder-as-label disappears on focus, fails accessibility, and destroys the user's ability to check their own work. Floating labels are acceptable but strictly worse than static ones.
- **Placeholder is an example, not an instruction.** "jane@company.com," not "Enter your email."
- **Input height should match button height** exactly at the same size step, so a field and its submit button form a clean line.
- **Inputs read as recessed.** A subtle inset shadow (`inset 0 1px 2px` at very low opacity) plus a border sells "you can put something here." A flat rectangle with a border does not.
- **Focus state must be unmistakable:** border color change plus a soft ring (`box-shadow: 0 0 0 3px accent/0.15`). The ring is what makes it feel modern.
- **Error state:** border color, a message *below* the field, and an icon. Never color alone. Never `window.alert()`.
- **Validate on blur, not on keystroke.** Validating while typing tells the user their half-finished email is invalid, which is hostile.
- **Help text below the label, above the field** if it is needed to fill the field correctly. Below the field if it is a note about consequences.
- **Required vs optional:** mark whichever is rarer. If most fields are required, mark the optional ones.
- Set `autocomplete`, `inputmode`, and `type` correctly. `inputmode="numeric"` on a code field is the difference between a good and a bad mobile experience.

---

## 4. Badges, chips, tags

Small, frequently ugly, easy to fix.

- **Do not default to pills for everything.** Full-round "New" and "Beta" badges everywhere is a tell. A square-cornered badge, a flag shape, or plain colored text is often better and more distinctive.
- **Tiny text needs positive tracking.** An 11px badge label at `letter-spacing: 0.02em` reads dramatically better.
- **Use a tinted background from the accent ramp**, not a saturated fill. `--accent-100` background with `--accent-700` text is calm and reads as designed. Full-saturation badges scream.
- **Padding is asymmetric and tight:** roughly `3px 8px 2px` at 11 to 12px text.
- **Uppercase badges need `+0.06em` tracking minimum.**
- Status dots (a 6px circle) are often better than a full badge for binary states.

---

## 5. Navigation

- **Indicate the current page.** A nav with no active state is a basic failure. Use weight or color, plus a subtle indicator (underline, background, side bar). Not color alone.
- **Nav items at weight 500**, not 400. They are labels, not prose.
- **Sticky nav needs a state change on scroll:** a background appearing, a border materializing, a height reduction, or a shadow. A nav that is transparent over a hero and stays transparent over white content is a common bug.
- **Do not center the logo** unless you have committed to a symmetrical navigation structure.
- **Mobile:** a full-screen overlay menu almost always beats a cramped dropdown. Animate the open state; an instant appearance feels broken.
- **Footer:** the four-column link farm is a default. If the site does not have forty pages, do not build a footer that implies it does. A single row with the essentials often reads better and more confidently.

---

## 6. Tables

- **Tabular figures, always.** `font-variant-numeric: tabular-nums`.
- **Right-align numbers, left-align text.** Center only single characters and icons.
- **Align on the decimal** for currency columns.
- **Row separation by hairline border or subtle background alternation, not both.** Zebra striping plus borders is noisy. In most cases a single 1px border at very low contrast is enough.
- **Header row:** weight 500, smaller size, secondary color, often uppercase with tracking. Do not make headers bolder and larger than the data; they are labels.
- **Row hover** is expected in any table with actions. Subtle background shift only.
- **Sticky header** for anything over about 15 rows.
- **Give numeric columns room.** Cramped numeric columns are the fastest way to make data look untrustworthy.

---

## 7. Modals and overlays

- **The scrim carries the mood.** Not `rgba(0,0,0,0.5)`. Use a tinted, slightly lower-opacity scrim (`oklch(0.2 0.02 var(--hue) / 0.4)`) optionally with a small backdrop blur. This one change lifts the whole interaction.
- **Enter and exit are not the same.** Enter: 200 to 250ms with a decelerating curve, scale from about 0.97 with fade. Exit: faster, 120 to 150ms, accelerating. Users want confirmation on the way in and want the thing gone on the way out.
- **Trap focus** inside the modal and return focus to the trigger on close. Support Escape.
- **Prevent background scroll**, but preserve scroll position on close.
- **Reconsider whether you need a modal at all.** Modals interrupt. Inline editing, a slide-over panel, or an expandable section is usually better for anything that is not a genuine confirmation or a genuinely focused task.

---

## 8. Icons

- **One set, one stroke weight, one grid size.** Mixed sets are immediately visible because their optical weights and corner treatments differ.
- **Stroke width should relate to your type weight.** A 1.5px stroke pairs with body weights; 2px reads heavier and pairs with bolder type.
- **Avoid the cliché mappings:** rocket for launch, shield for security, lightbulb for ideas, puzzle piece for integrations, gear for settings-that-are-not-settings. These are exhausted. Reach for something specific to the actual subject.
- **Icons should be optically the same size, not mathematically.** A circle icon and a square icon at the same box size look different. Good sets already correct this.
- **Do not use emoji as icons** in anything that is meant to read as professional. They render differently on every platform and they carry a tone you did not choose.
- **Always include a favicon.** Missing favicon is a small, visible signal of an unfinished project.
- Decorative icons get `aria-hidden="true"`. Meaningful icons need an accessible label.

---

## 9. Empty, loading, and error states

These are where the impression of care is either made or lost, and they are almost always skipped.

**Empty states.** An empty screen showing nothing is a wasted moment and reads as broken. An empty state should have: a short statement of what goes here, one primary action, and optionally a small piece of illustrative structure. Do not apologize. Do not use a sad face.

**Loading states.** Skeleton screens that mirror the shape of the incoming content beat generic spinners, because they set an expectation of layout and reduce perceived wait. Rules:

- Skeletons must match the real layout's dimensions, or the content will jump on arrival.
- Use a subtle shimmer or pulse, not a fast one. 1.5 to 2s cycle.
- For actions under about 300ms, show nothing. A flash of loading state is worse than no loading state.
- Reserve space for anything async so nothing shifts. Cumulative layout shift is both a metric and a quality signal.

**Error states.** State what happened and what to do about it, in the interface's voice. "We couldn't save your changes. Check your connection and try again." Not "Oops! Something went wrong!" Errors do not apologize effusively, do not use exclamation marks, and are never vague about what failed.

---

## 10. Component checklist

Before considering any interactive component done:

- [ ] Rest, hover, active, focus-visible, disabled, and loading states all defined
- [ ] Focus ring visible and offset, never removed
- [ ] Transition on state change, press faster than hover
- [ ] Touch target at least 44×44px
- [ ] Optical padding checked, not just mathematical
- [ ] Nested radii concentric
- [ ] Text contrast passes 4.5:1 (3:1 for large)
- [ ] Works at 200% browser zoom
- [ ] Works with `prefers-reduced-motion: reduce`
- [ ] Labels are verbs, sentence case, and consistent across the flow
- [ ] No layout shift when state changes (loading, error, expanded)
