# Typography

Type is the highest-leverage decision in any interface. Change nothing but the typography of a generic layout and it will read as substantially more expensive. Nothing else has that ratio of effort to perceived quality.

**Contents:** Selection · Pairing · Scale · Tracking · Leading · Measure · Weight · Case · OpenType · Wrapping and punctuation · Variable fonts · Loading · Diagnostics

---

## 1. Selection: what makes a typeface read expensive

A typeface reads premium or cheap based on properties most people cannot name but everyone perceives.

**Signals of quality:**

- **A large character set with real italics.** A true italic is drawn; an oblique is slanted. Faces with drawn italics, small caps, and multiple numeral sets came from a foundry that invested.
- **Optical size awareness.** A face with an `opsz` axis (or separate Display and Text cuts) thins its strokes and tightens its spacing at large sizes. This is what makes magazine headlines look different from blown-up body text.
- **Considered spacing metrics.** Good faces need almost no manual tracking at body size. If a face looks jittery at 16px, its sidebearings are weak and no amount of CSS will save it.
- **Restrained quirk.** One or two distinctive letterforms (a single-story `a`, an unusual `g`, a flat-topped `t`) give a face memorability. Five quirks make it a novelty face that will exhaust the reader.
- **A working weight range.** At least four usable weights. Faces with only Regular and Bold force you into a two-level hierarchy.

**Signals of cheapness:**

- Geometric sans with perfect circles for `o` and a single-story `a` used for body copy. Geometric faces have poor rhythm at small sizes because circular bowls create uneven spacing. Fine for a logo, bad for a paragraph.
- Faces with extreme stroke contrast used below 24px. The thin strokes disappear and the text looks broken.
- Anything condensed used for body text.
- Free faces with incomplete kerning tables. Symptom: awkward `Ta`, `Vo`, `ry`, `f)` pairs at large sizes.
- Using the same face for absolutely everything with no variation in weight or optical treatment.

### The neutrality trap

The most common failure is choosing a face that is *technically excellent and completely characterless*, then wondering why the design feels generic. Screen-optimized neutral grotesques (Inter being the canonical example) are outstanding for interface body text, and are exactly the wrong choice to carry a brand's voice in a headline. Neutrality means "adds nothing," which is what you want at 14px and not what you want at 72px.

Fix: keep the neutral face for body and UI, introduce a face with a point of view for display. That single change is often the whole job.

### Practical family shortlist by intent

All of these are free unless noted. This is a starting menu, not a mandate. Read the brief first.

| Intended feeling | Display face | Body face |
|---|---|---|
| Editorial, considered, authoritative | Fraunces (variable, with `SOFT`/`WONK` axes), Playfair Display, Instrument Serif, Newsreader | Source Serif 4, Literata, or a neutral sans for contrast |
| Modern tech, engineered | Geist, Space Grotesk, Hubot Sans | Geist Sans, Inter, IBM Plex Sans |
| Warm, human, approachable | Bricolage Grotesque, Hanken Grotesk, Outfit | Hanken Grotesk, Plus Jakarta Sans, Source Sans 3 |
| Premium consumer, quiet luxury | A high-contrast didone or transitional serif for display, set large and tracked tight | A calm humanist sans at generous leading |
| Brutalist, raw, confident | Archivo Expanded, Bricolage Grotesque Condensed, a monospace used at display size | Anything neutral; let the display face do all the work |
| Technical, data-dense | Any grotesque with tabular figures | IBM Plex Sans / Mono, JetBrains Mono for numerics |

Notes: Bricolage Grotesque carries weight, optical-size, width, and grade axes in one file, which makes it unusually capable as a single-family system. Fraunces has variable axes that let you dial softness and quirk, which is rare in a free serif. Where paid foundries still hold a real edge is luxury and fashion display serifs, and top-end neo-grotesques for brand work.

**Do not use more than two families.** A third family should only appear if it is a monospace doing a specific job (code, data, timestamps, labels). Two families with four weights each gives you more expressive range than four families ever will, and it reads as controlled rather than indecisive.

---

## 2. Pairing logic

The rule is not "serif plus sans." The rule is:

> **Contrast on one axis. Agreement on another.**

Contrast on *structure* (serif vs sans, geometric vs humanist, high contrast vs low contrast). Agree on *proportion* (similar x-height, similar width, compatible apertures). Two faces with wildly different x-heights sitting next to each other look like a mistake regardless of how nice each one is alone.

Practical test: set the two faces at the same optical size in the same sentence. If the lowercase letters sit at noticeably different heights, or one looks 20% larger at the same point size, the pairing will fight. Compensate with `font-size-adjust` or by simply sizing them differently in your tokens.

**Three reliable pairing strategies:**

1. **High-contrast display serif + neutral sans body.** The editorial default. Works because the serif carries all the personality and the sans stays out of the way.
2. **One superfamily, two members.** IBM Plex Sans + Plex Serif + Plex Mono. Guaranteed proportional harmony, zero risk, slightly less exciting.
3. **One family, extreme weight and size range.** A single variable grotesque at weight 200 for a huge display line and weight 500 for body. This is the hardest to pull off and the most contemporary when it works. It requires a face with a genuinely usable light weight.

**Avoid:** two sans faces from the same subgenre (two geometrics, two neo-grotesques). The difference is too small to read as intentional and too large to read as consistent. It looks like a font-loading bug.

---

## 3. The type scale

Never pick sizes by feel. Pick a ratio, generate a scale, use only steps from it.

**Ratios and what they are for:**

| Ratio | Name | Character | Best for |
|---|---|---|---|
| 1.125 | Major second | Very tight | Dense product UI, dashboards, data tools |
| 1.200 | Minor third | Restrained | Application UI, documentation |
| 1.250 | Major third | Balanced, safe default | Most websites, marketing, SaaS |
| 1.333 | Perfect fourth | Confident | Marketing pages, editorial |
| 1.414 | Augmented fourth | Dramatic | Landing pages with big hero moments |
| 1.618 | Golden ratio | Very dramatic | Editorial, portfolios, poster-like layouts |

Generate from a 16px base: `size = 16 × ratio^n`. At 1.25 that gives roughly 10.24, 12.8, 16, 20, 25, 31.25, 39, 48.8, 61, 76.3.

**A ratio that works for body does not work for display.** A 1.2 scale is right for the four sizes around body text and produces headings that are too timid. Two solutions:

- **Two-ratio system (recommended):** use a small ratio (1.125 to 1.2) for the UI band (caption, small, body, lead) and a larger ratio (1.333 to 1.5) for the display band (h3 through h1). Most real design systems do this even when they do not say so.
- **Fluid type:** use `clamp()` so display sizes scale with the viewport while body stays fixed.

```css
/* body: fixed, because readability does not want to scale */
--text-body: 1rem;
/* display: fluid, min 2.5rem at 375px, max 5rem at 1440px */
--text-display: clamp(2.5rem, 1.72rem + 3.33vw, 5rem);
```

Fluid type is where AI output most often goes wrong: a headline that is beautiful at 1440px and unreadably enormous at 390px. **Always check the minimum.** A display line on mobile should almost never exceed about 2.5 to 3rem, and should hold to 2 to 4 words per line at that size.

**Cap the scale at 8 steps.** More steps means adjacent sizes differ by too little to read as intentional hierarchy, which defeats the purpose.

---

## 4. Tracking (letter-spacing)

This is the single most neglected typographic control, and correcting it is the fastest way to make type look professionally set.

**The governing principle: tracking is inversely proportional to size.** Small type needs more space between letters because letterforms blur together at small optical sizes. Large type needs less because the gaps that felt right at 16px look like gaps at 72px.

**Working table.** Always in `em` so it scales with size:

| Context | Tracking |
|---|---|
| Display, 48px and up | `-0.03em` to `-0.02em` |
| Headings, 28 to 48px | `-0.02em` to `-0.01em` |
| Subheadings, 20 to 28px | `-0.01em` to `0` |
| Body, 16 to 18px | `0` (leave it alone; the type designer already solved this) |
| Small text, 12 to 14px | `0` to `+0.01em` |
| Caption / legal, under 12px | `+0.01em` to `+0.02em` |
| ALL CAPS at any size | `+0.05em` to `+0.12em` |
| Small caps | `+0.04em` to `+0.08em` |
| Monospace labels | `+0.02em` to `+0.05em` |

Uppercase always needs positive tracking. Capitals were designed with sidebearings intended for use as initials inside lowercase words, not for running in sequence. Untracked all-caps looks cramped and is the most reliable tell of unconsidered typesetting.

**Two caveats:**

- Do not track out lowercase body text. It destroys word shape and slows reading.
- WCAG requires content to remain functional when the user applies at least `0.12em` of additional letter-spacing. Build containers that can absorb this. Use `em` units and avoid fixed-width text containers so nothing breaks at that setting.

**Kerning** (per-pair, not per-run) is handled by the font's own tables. Keep `font-kerning: normal`. Manual kerning is only worth doing in a wordmark or a very large display line, where you close pairs like `To`, `Va`, `We`, `Ye` and open pairs of adjacent round or straight forms. The technique: set it large, blur your vision, and look for spots that read as dark or light. Those are the pairs to fix.

---

## 5. Leading (line-height)

Always **unitless**, so it inherits proportionally.

| Context | line-height |
|---|---|
| Display, 48px+ | 0.95 to 1.1 |
| Headings, 28 to 48px | 1.1 to 1.25 |
| Subheadings | 1.3 to 1.4 |
| Body text | 1.5 to 1.65 |
| Long-form reading | 1.6 to 1.75 |
| Captions and small text | 1.4 to 1.5 |
| Buttons and single-line UI | 1 to 1.2 |

Three interlocking variables: **leading, measure, and size**. Longer measure needs more leading so the eye can find the next line start. Shorter measure can take tighter leading. Larger type needs proportionally less leading.

The most common error: applying body leading (1.5) to a 56px headline, which produces canyon-like gaps between lines and instantly reads as unset type. Big type wants tight leading. This one correction transforms most AI-generated heroes.

Second most common error: using px line-heights that do not scale, so a heading at 32px inherits a 24px line-height and lines collide.

---

## 6. Measure (line length)

**60 to 75 characters** for body copy. This is the range where saccadic eye movement is most efficient. Below about 45 the eye returns too often; above about 85 it loses the line on return.

```css
.prose { max-width: 68ch; }
```

Use `ch` units, not px, because the correct pixel width depends on the font. Full-width body paragraphs on a desktop screen are the single most common readability failure on the web and they immediately read as unconsidered.

Exceptions: short intro or lead paragraphs can run wider at larger size. Captions and sidebars run narrower, 40 to 50ch.

---

## 7. Weight

**Use three to four weights, not two.**

The default two-weight setup (400 regular, 700 bold) gives you exactly one level of emphasis and forces every hierarchy decision onto size alone. Adding 500 and 600 gives you gradation: a subheading can be distinguished by weight rather than size, which keeps the layout calmer.

Typical assignment:

- **300 / 200** display only, and only in faces with a genuinely good light weight, at large sizes. Light weights at small sizes fail contrast and look frail.
- **400** body
- **500** UI labels, emphasized body, nav items, table headers
- **600** subheadings, buttons, card titles
- **700+** display headings, or nothing at all in a low-key design

**Never use `font-weight: bold` on a face whose bold you have not loaded.** The browser will synthesize it by smearing the strokes, and synthetic bold is one of the ugliest things on the web. Same for synthetic italics. Load real cuts or do not use them.

**Weight and color interact.** Reducing weight and increasing color contrast can produce the same perceived emphasis as increasing weight, and usually looks more refined. A 500-weight in near-black often reads stronger and cleaner than a 700-weight in mid-gray.

---

## 8. Case

- **Sentence case** for headings, buttons, labels, and nav. It is contemporary, it is faster to read, and Title Case On Every Heading is a dated tell.
- **ALL CAPS** only for short labels, eyebrows, and small structural elements, never for a sentence, never for more than about three words, always with positive tracking.
- **Small caps** (`font-variant-caps: small-caps`, and only in faces with true small caps) are a refined alternative to all-caps for eyebrows and are underused.
- **lowercase-only** as a stylistic choice is legitimate and strongly branded, but it must be total. Half-lowercase reads as a bug.

---

## 9. OpenType features and numerals

These are free refinement, and almost never used in generated code.

```css
/* Data, tables, prices, timers: digits must not shift width */
.tabular { font-variant-numeric: tabular-nums; }

/* Running prose with numbers: old-style figures sit in the text rhythm */
.prose { font-variant-numeric: oldstyle-nums; }

/* Fractions in recipes, specs */
.frac { font-variant-numeric: diagonal-fractions; }

/* Turn on discretionary alternates deliberately, per face */
.display { font-feature-settings: "ss01" 1, "cv05" 1; }

/* Prevent bad ligatures in all-caps settings */
.caps { font-variant-ligatures: no-common-ligatures; letter-spacing: 0.08em; }
```

**Tabular figures are mandatory** anywhere numbers are compared vertically or update in place: pricing tables, dashboards, timers, statistics, order totals. Proportional digits cause visible jitter on every update, and columns of prices that do not align on the decimal look broken.

---

## 10. Wrapping, orphans, and punctuation

The details below are individually invisible and collectively decisive.

```css
h1, h2, h3 { text-wrap: balance; }   /* even line lengths in short blocks */
p          { text-wrap: pretty; }    /* prevents single-word last lines */
```

`balance` is for headings (limited to a small number of lines by the browser). `pretty` is for paragraphs. Both are widely supported now and neither costs anything.

**Punctuation that separates typeset from typed:**

- Curly quotes and apostrophes, never straight: `"` `"` `'` `'`, not `"` and `'`
- En dash for ranges (2020–2024), em dash or spaced en dash for parenthetical breaks, hyphen only for compounds
- A non-breaking space (`&nbsp;`) before the last word of a heading to prevent an orphan, or between a number and its unit (`10&nbsp;kg`, `Figure&nbsp;3`)
- Ellipsis character `…`, not three periods
- Multiplication sign `×` in dimensions, not the letter x
- Hanging punctuation on pull quotes: pull the opening quote mark outside the text block with a negative margin so the text edge stays optically flush

**Note on em dashes:** heavy em-dash use has become a recognized signal of machine-written copy. In UI and marketing copy, prefer a period, a colon, or a comma. This is a copy rule, not a typographic one, but it matters to perceived authenticity.

---

## 11. Variable fonts

Default to a variable font whenever the family offers one. One file replaces five or more static weights, reduces requests, and unlocks intermediate values.

```css
@font-face {
  font-family: "Brand";
  src: url("brand.woff2") format("woff2-variations");
  font-weight: 100 900;      /* declare the full range */
  font-display: swap;
}
```

What variable fonts buy you beyond file size:

- **Arbitrary weights.** `font-weight: 545` is legal. Useful for making a subheading sit precisely between body and heading.
- **Optical size.** If the face has `opsz`, set `font-optical-sizing: auto` and it will correct itself at display sizes. This is real typographic craft, free.
- **Grade.** An `GRAD` axis changes apparent weight without changing width, which means you can thicken text for dark backgrounds without reflowing the layout. Text on dark backgrounds appears heavier due to halation, so grading it down slightly is a genuine refinement.
- **Width.** A `wdth` axis lets a headline fill its container exactly.

Do not animate weight on every hover. It is expensive to render and gimmicky when overused. One considered use is fine.

---

## 12. Loading and layout stability

Font swap causing a visible reflow is a quality tell and a Core Web Vitals problem.

```css
@font-face {
  font-family: "Brand";
  src: url("brand.woff2") format("woff2");
  font-display: swap;
  /* Metric-match the fallback so the swap does not shift layout */
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
```

Checklist:

- Subset to the characters actually used. Latin subset alone often cuts file size by 70%.
- `woff2` only. Nothing else is needed in any current browser.
- `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the one or two faces in the first viewport. Not for all of them.
- Self-host rather than using a third-party font CDN where possible: fewer connections, no third-party dependency, better privacy.
- Set the fallback stack with intent: `font-family: "Brand", ui-sans-serif, system-ui, sans-serif`.

---

## 13. Fast diagnostic table

| Symptom | Cause | Fix |
|---|---|---|
| Headline looks weak and flabby | Default tracking and body leading applied to display size | `letter-spacing: -0.02em`, `line-height: 1.05` |
| All-caps label looks cramped and cheap | No positive tracking | `letter-spacing: 0.08em` |
| Body text is tiring to read | Measure over 85ch, or leading under 1.4 | `max-width: 68ch`, `line-height: 1.6` |
| Everything looks flat, no hierarchy | Only two weights, hierarchy carried by size alone | Add 500 and 600; use color and weight, not just size |
| Prices or stats jitter and misalign | Proportional figures | `font-variant-numeric: tabular-nums` |
| Heading ends with one word alone on a line | No wrap control | `text-wrap: balance`, or `&nbsp;` before the last word |
| Type "looks off" and nothing specific is wrong | Two faces with mismatched x-heights, or synthetic bold | Check loaded weights; adjust relative sizing |
| Hero is perfect on desktop and enormous on mobile | Unclamped `vw` sizing | `clamp()` with a checked minimum |
| Text on dark background looks fat and glowing | Halation | Reduce weight one step, or reduce `GRAD`, on dark surfaces |
