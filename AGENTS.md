# AGENTS.md — amf-dirf

Agent Spec Kit. **AMF** = Agent Marketing Factory · **DIRF** = Do It Right First.

## What this is

A zero-dependency Node.js kit that turns a task description into a lean,
token-cheap instruction set (markdown for the AI + an HTML render for humans),
with agents correctly mapped to the host repo's **actual installed skills**.

## Two governing principles

1. **Agnostic skill mapping.** Never hardcode skills. Scan the host repo's skill
   folders, index what's installed, resolve references. Referenced-but-absent =
   flagged "recommended, not installed" — never fatal.
2. **Ponytail-lean output.** Smallest correct artifact first. A small
   always-loaded router + lazy-loaded detail one level deep. Unread files cost
   zero tokens. No monoliths, no prose padding.

## Quick start

```bash
node src/cli.js build demo "build a landing page"
node src/cli.js skills scan     # see installed skills + resolved refs
node src/cli.js validate        # validate registries + workflows
```

## Where things live

- `registry/` — the source of truth: `agents.json` (agents + skill refs),
  `skills.json` (named skill references — editable vocabulary), `playbooks.json`
  (task templates + baseline skills).
- `agents/` — agent markdown definitions.
- `policies/workflow-policy.md` — embedded in every generated instruction set.
- `src/` — `cli.js` (entry), `router.js`, `skills.js`, `renderer.js`, `validate.js`, `paths.js`.
- `workflows/user/` — generated workflow JSONs (committed).

## Conventions

- **Zero dependencies.** Pure Node.js built-ins (no `node_modules`, no install step).
- One entry point: `src/cli.js`.
- Markdown is source; HTML is a regenerable render (gitignored).
- Validate before you commit: `node src/cli.js validate`.
