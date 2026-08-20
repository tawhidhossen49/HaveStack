# Motion

Motion is the fastest way to make an interface feel expensive and the fastest way to make it feel like a demo reel. The dividing line is whether the motion is **load-bearing**.

**The test:** set every duration in the design to zero. If the interface now feels broken (you lose feedback, hierarchy, or spatial orientation), your motion is doing work and deserves the same rigor as your type system. If nothing meaningful changes, you were decorating.

**Contents:** Durations · Easing · Choreography · Interaction feedback · Entrances · Scroll · Reduced motion · Performance · What not to do

---

## 1. Durations

Motion under about 100ms is not perceived as motion, it reads as an instant change. Motion over about 500ms is perceived as waiting. The usable band is narrow.

```css
:root {
  --dur-instant: 80ms;    /* press feedback, tiny state flips */
  --dur-fast:    150ms;   /* hover, focus, color changes, small fades */
  --dur-base:    250ms;   /* the default: dropdowns, tooltips, accordions */
  --dur-slow:    400ms;   /* modals, page-level transitions, large movement */
  --dur-ambient: 800ms+;  /* background atmosphere, decorative loops only */
}
```

**Duration scales with distance and size.** An element crossing the whole screen needs longer than one moving 4px. A large panel needs longer than a small chip. Applying one duration to everything is a signature of an unconsidered motion system: small things feel sluggish and large things feel abrupt.

**Exits are faster than entrances,** typically 60 to 70% of the entrance duration. Arrival deserves attention; departure should just get out of the way.

**Press feedback must be near-instant.** Any perceptible delay between click and response registers as lag, not as animation.

---

## 2. Easing carries meaning

Easing curves are to motion what weights are to type. Using one curve everywhere is like setting an entire document in a single font weight: it works, and it says nothing.

```css
:root {
  /* Default. Arrives quickly, settles. Use for ~80% of everything. */
  --ease-out:    cubic-bezier(0.2, 0, 0, 1);

  /* Exits. Starts slow (cancellable), accelerates away. */
  --ease-in:     cubic-bezier(0.4, 0, 1, 1);

  /* Both ends. For transitions between two equally important states. */
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);

  /* Slight overshoot. Celebration and confirmation only. Use rarely. */
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
}
```

Semantics:

- **ease-out** is your regular weight. Things entering the screen, hover responses, anything reacting to the user. It feels responsive because it commits immediately.
- **ease-in** is for departure. Elements leaving, dismissals, closes. Starting slowly implies the action is still cancellable.
- **ease-in-out** for symmetric changes: switching views, toggling modes, a panel that slides both ways.
- **spring / overshoot** for reward moments only: a success check, a like, a badge unlock. Overshoot on routine interactions reads as instability, not delight.
- **linear** is for continuous mechanical processes only: progress bars, spinners, marquees. On anything discrete it looks robotic.

**Avoid `ease-in` as a general default.** It makes the entire interface feel slow because nothing responds immediately. Avoid `linear` on discrete transitions for the same category of reason.

**Springs over béziers for gesture-connected motion.** Drag-and-drop settling, sheet dismissal, anything that should respond to velocity. A spring never looks canned because it is not a fixed-duration curve. Note that a spring needs enough time to express itself: a spring at 100ms cannot bounce, so curve and duration are inseparable.

---

## 3. Choreography

Individual animations are cheap. Choreography is what reads as expensive.

- **Stagger reveals** by 40 to 80ms per item. Everything appearing simultaneously reads as a page load, not a composition. More than about 8 staggered items becomes tedious; cap it.
- **Orchestrate one moment rather than scattering many.** A single well-designed page-load sequence lands harder than twelve independent scroll-triggered fades. Scattered effects are one of the strongest signals of generated design.
- **Motion should have a spatial logic.** If a panel opens from the right edge, it slides in from the right and closes to the right. If a dropdown belongs to a button, it should scale from an origin near that button (`transform-origin`), not fade in at the center of the screen.
- **Related elements move together, unrelated elements do not.** Common fate is a Gestalt grouping principle: things that move in unison are perceived as one object.

---

## 4. Interaction feedback

This is the highest-value motion in any interface and it costs nearly nothing.

| Interaction | Property | Duration | Easing |
|---|---|---|---|
| Hover on button/card | background, box-shadow, translateY(-1px) | 150ms | ease-out |
| Press | translateY(+0.5px), inset shadow | 40 to 80ms | ease-out |
| Focus ring appear | outline / box-shadow | 100ms | ease-out |
| Toggle / switch | transform on the knob | 200ms | ease-out or gentle spring |
| Accordion expand | grid-template-rows or height | 250ms | ease-out |
| Tooltip | opacity + 4px translate | 150ms in, 100ms out | ease-out / ease-in |
| Dropdown | opacity + scale 0.96→1 from origin | 180ms | ease-out |
| Modal | opacity + scale 0.97→1 | 250ms in, 150ms out | ease-out / ease-in |
| Toast | slide + fade from edge | 300ms in, 200ms out | ease-out / ease-in |
| Page transition | fade or shared element | 300 to 400ms | ease-in-out |

**Always transition hover states.** An instant background change on hover is the single most common motion omission and it makes an interface feel cheap in a way users notice immediately without being able to say why.

---

## 5. Entrances and scroll

- **Do not fade in everything on scroll.** Content that fades in as you scroll past it is the most overused effect on the web and it actively harms reading: the user arrives at text that is not yet there.
- **The first viewport should never animate in on scroll.** It is already visible. Animate it on load, or not at all.
- **Reveal thresholds should be generous** (trigger when the element is 15 to 25% into the viewport, not when it touches the edge), and **elements should never start fully transparent** if they contain text the user might already be reading. Start at 0.3 opacity rather than 0.
- **Once revealed, stay revealed.** Elements that re-hide and re-animate on scroll-up are disorienting.
- **Scroll-driven animation** (CSS `animation-timeline: view()`) is now native and far cheaper than JS observers for simple reveals.
- **Parallax:** use very sparingly and at low intensity. Aggressive parallax causes motion sickness in a meaningful fraction of users and reads as dated.

---

## 6. Reduced motion is mandatory

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Better than removing motion entirely: **replace movement with fades**. Users with vestibular disorders are affected by movement and scale, not by opacity. So under reduced motion, keep a 150ms opacity transition and drop the translate and scale. The interface still communicates state change without triggering symptoms.

Never gate essential feedback behind motion alone. If the only indication that a button was pressed is an animation, reduced-motion users get no feedback.

---

## 7. Performance

- **Animate only `transform` and `opacity`.** These are composited on the GPU and do not trigger layout or paint. Animating `width`, `height`, `top`, `left`, `margin`, or `box-shadow` forces layout or paint on every frame and produces visible jank on mid-range devices.
- To animate elevation, put the higher shadow on a pseudo-element and animate its `opacity`.
- To animate size, prefer `transform: scale()` where visual fidelity allows, or use the newer `interpolate-size` / `calc-size()` where height animation is genuinely needed.
- `will-change` is a hint, not a fix. Applying it broadly consumes memory and can degrade performance. Apply it immediately before an animation and remove it after, or not at all.
- Budget: 60fps means 16.7ms per frame. If an animation stutters on a mid-range Android device, it is not ready.

---

## 8. What not to do

- **Infinite loops on decorative elements.** A gently pulsing gradient orb, a perpetually floating shape, a bouncing scroll indicator. These draw the eye forever and never resolve. This is a strong generated-design tell.
- **Animating everything.** If every element on the page has motion, none of it means anything and the page feels restless.
- **Long durations to seem "premium."** Slow is not luxurious, slow is slow. Premium motion is *precise*, not sluggish. A confident interface responds fast and settles cleanly.
- **Motion as a substitute for hierarchy.** If you need an animation to draw attention to the primary CTA, the layout is not working.
- **Text animating character by character** on load for body content. Fine as a single deliberate hero moment; unbearable anywhere else.
- **Bounce and elastic curves on routine UI.** Reserve overshoot for genuine reward moments.
- **Hover effects on touch devices.** Hover states persist awkwardly after tap on touch. Use `@media (hover: hover)` to scope them.

```css
@media (hover: hover) and (pointer: fine) {
  .btn:hover { /* hover styles here only */ }
}
```
