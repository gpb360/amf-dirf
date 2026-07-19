# amf-dirf — Agent Spec Kit (Do It Right First)

**AMF** = Agent Marketing Factory · **DIRF** = Do It Right First.

A standalone, **zero-dependency Node.js** spec kit. Drop it into any repo; it maps
that repo's **actual installed skills** to agents/playbooks and emits a lean,
token-cheap instruction set — markdown for the AI, plus an HTML render for humans.

> Requires Node.js ≥ 18.17. No `npm install` — uses only Node built-ins.

## Why

AI agents drift. They lose track of which skills apply to their role, skip
verification, bleed scope across agents, and forget the objective. This kit
produces a structured instruction artifact engineered against those failure
modes — and it does the skill→agent mapping **correctly** (curated data), not
with a token-overlap heuristic that guesses wrong.

## Two governing principles

1. **Agnostic skill mapping.** The kit never hardcodes skills. It scans the host
   repo's skill folders (there can be several), indexes what's installed, and
   resolves references. A referenced skill that isn't installed is flagged
   "recommended, not installed" — never fatal.
2. **Ponytail-lean output.** Smallest correct artifact first. A small
   always-loaded router + lazy-loaded detail one level deep. Unread files cost
   zero tokens. No monoliths, no prose padding.

## Quick start

```bash
# Full pipeline: task -> workflow JSON -> lean instruction set + HTML
node src/cli.js build demo "build a landing page"

# See what skills are installed on this host and which refs resolve
node src/cli.js skills scan

# Validate all registries + workflows
node src/cli.js validate

# List saved workflows
node src/cli.js list
```

## The pipeline

```
task description
  │
  ▼  router (keywords + what-the-playbook-does content match)
workflow JSON
  │   agents[]         each: {name, file, tags, skills[]}
  │   baseline_skills[]   cross-cutting skills for the whole workflow
  │
  ▼  renderer (reads each agent .md + resolves skills against the live index + policy)
  │
  ├─► lean MARKDOWN instruction set  (what the AI consumes — token-cheap)
  │     one router README + one lazy-loaded detail file per agent + policy
  │
  └─► HTML render of the SAME structure  (human-browsable, expand-on-demand)
        summary index + collapsible per-agent sections
```

**Markdown is source; HTML is the render** of the same lean structure.

## Output structure (lean, progressive disclosure)

```
workflows/user/<name>.json              # the workflow definition (committed)
workflows/user/instructions/
├── README.md                           # ALWAYS-LOADED ROUTER (~35 lines)
├── policy.md                           # the workflow policy (one level deep)
├── agents/
│   ├── frontend-developer.md           # lazy-loaded detail per agent
│   └── ...
└── instructions.html                   # self-contained human render (gitignored)
```

The AI loads `README.md` first, then only the per-agent file it's acting as.
Unread files cost zero tokens.

Each per-agent detail file is self-contained: role, **USE THESE SKILLS**
(resolved live from the host index, with installed/recommended status),
**YOUR JOB** (from the agent markdown), **NOT YOUR JOB** (boundary), and a
done-when checklist.

## CLI reference

```
dirf build  <name> "<task>" [--path DIR] [--open]   full pipeline: route -> JSON -> md + html
dirf create <name> "<task>" [--path DIR]             route -> workflow JSON only
dirf render <name> [--open]                          existing JSON -> md + html
dirf list                                            list saved workflows
dirf validate                                        validate registries + workflows
dirf skills scan [--path DIR]                        scan host, show installed skills + resolved refs
```

Run `node src/cli.js` with no arguments for help.

## How skill mapping works (the heart of "right")

The kit ships a small editable vocabulary in `registry/skills.json` — named
skill **references** it knows how to recommend, each with a purpose and category
but **no definition** (the definition lives in the host repo):

```json
{"name": "impeccable", "category": "quality",
 "applies_to": ["frontend-developer", "ui-designer"],
 "summary": "quality gate against AI slop; YAGNI/DRY/KISS"}
```

At build time, `discover()` scans the host environment and resolves each
reference:

- **installed** — found in a scanned root (path included)
- **recommended** — in the registry but not on disk (flagged, never fatal)

**Scan roots** (all optional): `~/.agents/skills/`, `~/.codex/skills/`,
`~/.claude/skills/`, `~/.zcode/.../skills/`, plus project-local equivalents.
Discovery reads `SKILL.md` first, falling back to `skill.json` then `README.md`
— so skills like `ui-ux-pro-max` (no `SKILL.md`) and `superpowers` (under a
plugin cache) are still found.

**Scoping with `--path`:** pass `--path <project>` to scan *that* project's
local skill folders in addition to the global roots, so the instruction set
reflects the target project's skills (e.g. a repo's own `.agents/skills/`).

## Making it yours

- **Add an agent**: drop a markdown file in `agents/` (frontmatter: `name`,
  `description`, `tools`), add an entry to `registry/agents.json` with its
  `skills` refs.
- **Add a skill to the vocabulary**: add an entry to `registry/skills.json`.
  The kit resolves it against whatever's installed on each host.
- **Add a playbook**: add an entry to `registry/playbooks.json` with `agents`,
  `baseline_skills`, `keywords`, `workflow`, `questions`.
- Then run `node src/cli.js validate`.

## Project layout

```
src/             cli.js (entry), router.js, skills.js, renderer.js, validate.js, paths.js
registry/        source of truth: agents.json, skills.json, playbooks.json
agents/          agent markdown definitions (21 curated)
policies/        workflow-policy.md (embedded in every instruction set)
tests/           test-router.js, test-skills.js, test-renderer.js (node:test)
scripts/         smoke-test.js
workflows/user/  generated workflow JSONs (committed) + renders (gitignored)
```

## Conventions

- **Zero dependencies.** Pure Node.js built-ins (no `node_modules`).
- **One entry point:** `src/cli.js`.
- **Markdown is source; HTML is a regenerable render** (gitignored).
- **Validate before you commit:** `node src/cli.js validate`.

## Running the tests

```bash
npm test                                   # all unit tests (node:test)
node --test tests/test-router.js           # router matching
node --test tests/test-skills.js           # discovery + resolver
node --test tests/test-renderer.js         # markdown + HTML rendering
node scripts/smoke-test.js                 # full pipeline integration
```

No test runner to install — Node's built-in `node:test` is used. CI runs the
suite on every push (`.github/workflows/ci.yml`).

## License

MIT — see [LICENSE](LICENSE).
