# My Claude Skills

7 skills. Drop them into any project or install them globally.

---

## Install

### Claude Code

Pick a scope:

**Global** (available in every project on this machine):

```bash
mkdir -p ~/.claude/skills
cp -r design-taste-frontend premium-design-craft redesign-existing-projects \
      image-to-code imagegen-frontend-web imagegen-frontend-mobile \
      full-output-enforcement ~/.claude/skills/
```

**Per project** (travels with the repo, commit it to git):

```bash
mkdir -p .claude/skills
cp -r <skill-folder> .claude/skills/
```

Then **restart your Claude Code session.** Skill metadata is read once at startup, so anything copied mid-session stays invisible until you restart.

Verify with: `what skills do you have available?`

### Claude.ai / Claude app

Skills here are not filesystem-based. Zip an individual skill folder, rename it to `<name>.skill`, and upload it in Settings → Capabilities → Skills.

### Other agents

The SKILL.md format is an open standard. Codex CLI reads `.agents/skills/`, Cursor reads `.cursor/skills/`, VS Code Copilot reads both `.claude/skills/` and `.agents/skills/`.

---

## Folder rules

- The folder name is the skill name.
- `SKILL.md` must sit **directly inside** the skill folder, not nested a level deeper. This is the most common install failure.
- Supporting files go in `references/`, `scripts/`, or `assets/` next to `SKILL.md`.

---

## What each one does

| Skill | Lines | Use it for |
|---|---|---|
| **premium-design-craft** | 1,514 | Craft numbers and reasoning. Type scales, tracking, OKLCH color, shadow physics, component anatomy, motion timing, design psychology. Load when you'd otherwise research design fundamentals. |
| **design-taste-frontend** | 1,206 | Direction and page architecture for landing pages and portfolios. Reads the brief, sets variance/motion/density, picks a design system. |
| **image-to-code** | 1,228 | Generate design images first, analyze them deeply, then build the site to match. |
| **imagegen-frontend-mobile** | 1,465 | One image per app screen, in phone mockups. iOS/Android concepts and flows. |
| **imagegen-frontend-web** | 987 | One horizontal image per website section. Landing page and marketing comps. |
| **redesign-existing-projects** | 178 | Auditing an existing codebase for generic patterns and fixing them without a rewrite. |
| **full-output-enforcement** | 49 | Stops truncation and `// rest of code here` placeholders. Not design-specific. |

---

## How they compose

`design-taste-frontend` decides **what** to build and in which aesthetic.
`premium-design-craft` decides **what value to use and why**.
`redesign-existing-projects` handles the **audit** pass on existing code.
The `imagegen-*` and `image-to-code` skills handle the **visual reference** pass before implementation.

They are designed to work together. No conflicts.

---

## A note on scoping

Six of these seven are design skills, and several have deliberately assertive descriptions so they trigger reliably. If two fire on the same request you can load 2,000+ lines of instructions before any work starts.

Suggested split:

- **Global** (`~/.claude/skills/`): `premium-design-craft`, `full-output-enforcement`
- **Per project** (`.claude/skills/`): the rest, added only to projects that need them

`premium-design-craft` is the safest one to keep global because it loads a 127-line SKILL.md and only pulls a reference file when the specific topic comes up.
