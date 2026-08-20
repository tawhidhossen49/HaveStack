# Color and Light

Color is where amateur work is most obvious, because color mistakes are perceptual and everyone can feel them even without vocabulary. The two failures are: too much chroma, and no systematic relationship between values.

**Contents:** Color space · Neutral ramp · Accent · Palette shape · Contrast · Shadow physics · Elevation strategy · Gradients · Texture · Dark mode · Diagnostics

---

## 1. Work in OKLCH

Stop building palettes in hex or HSL. HSL's lightness is geometric, not perceptual: `hsl(60 100% 50%)` (yellow) and `hsl(240 100% 50%)` (blue) claim identical lightness and look nothing alike in brightness. This is why HSL-derived ramps always need manual correction, why yellows blow out and blues go muddy, and why a multi-brand theme built in HSL breaks the moment you change the hue.

OKLCH is perceptually uniform. Equal numeric change produces equal perceived change.

```css
oklch(L C H)
/*  L = perceived lightness, 0 to 1 (or 0% to 100%)
    C = chroma (intensity), 0 to about 0.37 within sRGB
    H = hue angle, 0 to 360                          */
```

Supported in all evergreen browsers since 2023 and stable for years now. Practical rules:

- **Keep chroma at or below 0.37** for sRGB safety. Above that you enter Display P3 territory, which looks brilliant on modern screens and clamps on others.
- **Lightness maps predictably to contrast.** As a working heuristic on a white background: `L ≤ 0.55` clears AA for body text (4.5:1); `L ≤ 0.65` clears AA for large text (3:1). On black, invert: `L ≥ 0.55`. These are approximations since chroma and hue shift perceived contrast slightly, but they are far more reliable than guessing in hex.
- **Dark mode becomes arithmetic.** Hold hue and chroma, invert or shift lightness. Your dark blue stays blue instead of drifting purple.
- Keep hex fallbacks only if you must support a locked-down legacy browser.

---

## 2. The neutral ramp (this is 80% of your palette)

Most of any interface is neutral. Get this right and the design is already most of the way to looking professional.

**Never use `#000000` or `#ffffff` as your extremes.** Pure black is a value that does not exist in the physical world and reads as harsh and cheap on a screen. Pure white as a page background is a glare surface. Use near-values.

**Tint your neutrals.** A gray with zero chroma is cold, dead, and disconnected from everything else in the palette. Give every neutral a trace of the brand hue:

```css
:root {
  --hue: 264;              /* the brand hue, used everywhere */
  --neutral-50:  oklch(0.985 0.003 var(--hue));
  --neutral-100: oklch(0.970 0.005 var(--hue));
  --neutral-200: oklch(0.922 0.007 var(--hue));
  --neutral-300: oklch(0.870 0.009 var(--hue));
  --neutral-400: oklch(0.708 0.012 var(--hue));
  --neutral-500: oklch(0.556 0.014 var(--hue));
  --neutral-600: oklch(0.439 0.013 var(--hue));
  --neutral-700: oklch(0.371 0.011 var(--hue));
  --neutral-800: oklch(0.269 0.009 var(--hue));
  --neutral-900: oklch(0.205 0.007 var(--hue));
  --neutral-950: oklch(0.145 0.005 var(--hue));
}
```

Nobody consciously notices the 0.005 chroma. Everybody notices its absence: untinted grays make a palette feel like unrelated parts bolted together.

**Chroma should peak in the middle of the ramp and fall off at both ends.** Very light and very dark colors cannot carry much chroma without looking artificial. A ramp with constant chroma looks synthetic at the extremes. This is why the values above rise from 0.003 to 0.014 and back down.

**Never mix temperature families.** Warm gray (hue ~60 to 90) and cool gray (hue ~250 to 280) in the same interface reads as an accident. Pick one and tint everything from the same hue.

---

## 3. The accent

**One accent. Not two, not three.** A single accent color is what makes the accent mean something. When everything is highlighted, nothing is. The most common palette failure in generated work is three or four "brand colors" applied at equal frequency, which produces a design that looks like a template preview.

Semantic colors (success, warning, danger) are separate from the accent and should be *desaturated toward your palette*, not lifted from a default framework. Framework-default red-green-amber at full saturation is a strong tell.

**Chroma discipline.** For most premium contexts, keep the accent's chroma below roughly 0.20. Fully saturated accents read as loud, cheap, and childlike. The most confident brand palettes in the premium space are dominated by neutrals with a single restrained accent that appears on perhaps 5% of the surface area.

Generate the accent as a full ramp using the same lightness steps as your neutrals so the two systems interlock:

```css
--accent-500: oklch(0.62 0.19 264);           /* the accent itself */
--accent-600: oklch(0.54 0.18 264);           /* hover */
--accent-700: oklch(0.46 0.16 264);           /* active */
--accent-100: oklch(0.95 0.03 264);           /* tinted background */
--accent-fg:  oklch(0.99 0.005 264);          /* text on accent */
```

Note that hover and active steps reduce **lightness and chroma together**. Reducing lightness alone produces a hover state that looks like the same color turned down, which is correct but flat. Slightly reducing chroma alongside it reads as the surface receiving less light, which is what a physical press looks like.

---

## 4. Palette shape: the 60/30/10 discipline

A working proportion for premium work, measured by area:

- **~60%** dominant neutral (background surface)
- **~30%** secondary neutral (text, containers, borders)
- **~10%** accent and semantic color

Luxury and high-end brands typically go further, closer to 90/8/2. The signal is deliberate: restricting the palette makes each chromatic choice feel significant. Premium brands frequently limit themselves to two or three colors in total, which is *less* than most designers are comfortable with, and that discomfort is precisely the point.

**Practical test:** screenshot your design, blur it heavily, and look at the color mass. If you see three or more competing color regions, you have too many accents.

---

## 5. Contrast

Non-negotiable minimums:

- **4.5:1** body text against its background
- **3:1** large text (24px+, or 18.66px+ bold)
- **3:1** for interactive component boundaries and meaningful graphical objects (icons that carry information, chart elements, input borders)
- Focus indicators must be visible against both the component and the adjacent background

Beyond compliance, contrast is your primary hierarchy tool. Most designs are *under*-contrasted between hierarchy levels and *over*-contrasted in decorative elements. The goal is:

- Primary text: high contrast
- Secondary text: reduce contrast noticeably, not slightly. A common error is body at neutral-700 and secondary at neutral-600, a difference too small to register as hierarchy. Go to neutral-500 or 400.
- Borders and dividers: very low contrast, often 1.2:1 to 2:1. Dividers do not need to be seen, they need to be felt. A 1px line at neutral-200 does more work than one at neutral-400.

**Do not communicate meaning through color alone.** Error states need an icon or text, not just red. About 8% of men have some form of color vision deficiency.

---

## 6. Shadow physics

Shadows are where "AI-generated" is most visually detectable, because the default is always a single pure-black shadow, and single pure-black shadows do not exist in reality.

### Three rules

**Rule 1: Layer them.** Real objects cast several overlapping shadows because light comes from multiple directions and scatters. A single shadow always reads as flat and cheap. Use two to four layers:

- A **contact shadow**: tiny offset, small blur, relatively higher opacity. This anchors the object to the surface.
- A **key shadow**: medium offset and blur, medium opacity. This is the shadow the light source casts.
- An **ambient shadow**: large blur, very low opacity, little or no offset. This is scattered environmental light.

```css
--elev-1: 0 1px 2px oklch(var(--shadow-color) / 0.06),
          0 1px 3px oklch(var(--shadow-color) / 0.10);

--elev-2: 0 1px 2px oklch(var(--shadow-color) / 0.05),
          0 4px 8px -2px oklch(var(--shadow-color) / 0.08),
          0 12px 24px -6px oklch(var(--shadow-color) / 0.06);

--elev-3: 0 2px 4px oklch(var(--shadow-color) / 0.05),
          0 8px 16px -4px oklch(var(--shadow-color) / 0.08),
          0 24px 48px -12px oklch(var(--shadow-color) / 0.10);

--elev-4: 0 4px 8px oklch(var(--shadow-color) / 0.06),
          0 16px 32px -8px oklch(var(--shadow-color) / 0.10),
          0 48px 96px -24px oklch(var(--shadow-color) / 0.14);
```

**Rule 2: Tint them.** Never `rgba(0,0,0,x)`. A shadow is the absence of light on a *colored* surface, so it takes on that surface's hue. Set a shadow color derived from your palette: a very dark, slightly chroma-bearing version of your background hue.

```css
--shadow-color: 0.20 0.04 264;   /* dark, faintly hued */
```

On a warm cream background, a cool black shadow looks wrong in a way most people cannot name but can see. Tinting shadows is one of the highest-return small changes available.

**Rule 3: One light source, consistently.** Decide the light comes from above (and usually slightly in front). Then every shadow in the entire interface has a positive Y offset, and X offsets are zero or all the same sign. Mixed shadow directions are subconsciously read as broken. Inset shadows imply the element is *below* the surface, so use them for pressed states, wells, and inputs, and never mix them arbitrarily with drop shadows on peer elements.

### Elevation discipline

**Four levels maximum.** Map them to meaning, not to taste:

| Level | Meaning | Typical use |
|---|---|---|
| 0 | On the surface | Page background, flush sections |
| 1 | Barely raised | Resting cards, table rows, inputs |
| 2 | Deliberately raised | Hovered cards, dropdowns, popovers |
| 3 | Floating | Modals, sheets, command palettes |
| 4 | Above everything | Toasts, drag-in-flight objects |

If everything on the page is at elevation 2, elevation communicates nothing. Most surfaces should be at 0 or 1.

**Performance note:** do not animate `box-shadow` values directly, since each frame forces a repaint. Animate `opacity` on a pseudo-element that holds the higher shadow, or animate `transform` on the element. Static shadows cost essentially nothing.

---

## 7. Elevation strategy: pick one

There are three ways to separate a surface from its background. **Pick one per design and hold it.**

1. **Shadow.** Depth-based. Reads as physical, product-like, friendly. Works with a paper metaphor.
2. **Border.** Flat, precise, technical. Hairline borders at very low contrast. Reads as engineered, dense, editorial. Works well for dark UI and data tools.
3. **Fill.** A slightly different background value with no border and no shadow. Reads as calm, modern, and expensive. This is what most quiet-luxury interfaces use.

The generic card (`white background + 1px gray border + soft gray shadow + 8px radius`) uses all three at once. It is the single most recognizable AI-design artifact in existence. Using all three simultaneously is not "more polished," it is indecisive. Pick one, commit, and let the choice carry brand meaning.

---

## 8. Gradients that do not look generated

Linear gradients from purple to blue at 45 degrees on a hero background are the visual signature of machine-generated design. Alternatives that read as considered:

- **Two stops from the same hue, different lightness.** A gradient within one hue family reads as lighting, not decoration. This is almost always the right answer.
- **Very low-angle or very high-angle** rather than 45 degrees. 45 degrees is the default and looks it.
- **Radial or conic** placed off-center, used as an ambient light source rather than a surface fill.
- **Mesh-like:** two or three large, very low-opacity radial gradients at different positions, blurred, over a solid base.
- **`oklch` interpolation:** `linear-gradient(in oklch, ...)` avoids the gray dead zone that sRGB interpolation produces between complementary hues. Gradients that pass through mud are an sRGB artifact and are fixable in one keyword.

**Banding:** large, subtle gradients band on 8-bit displays. Overlay a 2 to 4% noise texture to break it up. This also solves the sterility problem below.

---

## 9. Texture

Perfectly flat vector surfaces read as digital-sterile. Physical premium goods derive much of their perceived quality from material and tactility, and the digital analogue is subtle texture.

Effective, cheap options:

- **Grain / noise overlay** at 1.5 to 4% opacity across the whole page. An SVG `feTurbulence` filter, a tiny tiled PNG, or a CSS gradient stipple. This alone lifts flat designs noticeably.
- **A hairline top highlight** on raised surfaces: `inset 0 1px 0 oklch(1 0 0 / 0.08)`. Simulates the lit top edge of a physical object. Extremely effective on dark UI.
- **Slight background variation** between adjacent sections: 1 to 2% lightness difference. Enough to register as a distinct plane, not enough to look like a color change.
- **Real photography or material imagery** at low opacity behind text-heavy sections that would otherwise be empty.

Avoid: heavy glassmorphism on every surface, neumorphism (it has near-universal contrast failures), and any texture strong enough to compete with text.

---

## 10. Dark mode

Dark mode is not inverted light mode.

- **Surfaces get lighter as they get closer to the viewer.** In light mode, elevation is communicated by shadow. In dark mode, shadows are nearly invisible, so elevation is communicated by *raising lightness*. Build a separate surface ramp: `--surface-0` through `--surface-3`, each about 0.03 to 0.04 lighter in L.
- **Reduce chroma on every color.** Saturated colors on dark backgrounds vibrate and cause visual fatigue. Drop chroma by roughly 20 to 30% in dark mode. Your accent should be a different token value, not the same one.
- **Reduce text weight or grade.** White text on dark appears heavier than dark text on light (halation). Going one weight lighter, or using a `GRAD` axis, compensates.
- **Never pure black background.** Use `oklch(0.15 0.005 var(--hue))` or similar. Pure black creates maximum contrast with white text, which causes halation and eye strain, and it removes your ability to show anything *below* the base surface.
- **Build a separate shadow token set.** Shadows in dark mode need higher opacity and are often replaced entirely by border highlights.
- **Commit fully.** A single dark section dropped into an otherwise light page reads as a copy-paste accident. If you need sectional contrast in a light design, use a slightly darker shade of the same palette, not a jump to near-black.

---

## 11. Diagnostics

| Symptom | Cause | Fix |
|---|---|---|
| Design looks loud and cheap | Accent chroma too high, or multiple accents | Cut to one accent, drop chroma below 0.20 |
| Palette feels disconnected | Untinted grays, mixed warm and cool | Tint all neutrals from a single hue |
| Cards look flat and generic | Single black shadow, or border+shadow+fill together | Layer and tint the shadow; pick one elevation strategy |
| Everything floats, nothing is grounded | Uniform elevation across the page | Put most surfaces at level 0 or 1 |
| Background is sterile and empty | No texture, flat fill | Add 2% grain, or a very subtle same-hue gradient |
| Gradient looks muddy in the middle | sRGB interpolation between distant hues | `linear-gradient(in oklch, ...)` |
| Dark mode looks murky | Inverted light-mode colors, chroma unchanged | Separate surface ramp, reduce chroma 20 to 30% |
| Secondary text does not read as secondary | Contrast step too small | Skip two steps on the ramp, not one |
| Hover state looks like a bug | Lightness changed but nothing else | Reduce lightness and chroma together, add a transition |
