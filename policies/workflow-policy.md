# Workflow Policy

Use this policy in every generated workflow prompt.

## Build Bias
- Start with the smallest useful workflow.
- Prefer standard library and native platform features.
- Do not add dependencies unless the task clearly needs them.
- Skip speculative scaffolding.
- If a shortcut has a ceiling, name the ceiling and the upgrade path.

## Communication
- Keep output terse and technical.
- Lead with changed, verified, blocked, or risk.
- Use concrete files, commands, diffs, tests, and errors as proof.
- Do not add AI attribution footers or generated-by boilerplate.

## Workflow Audit
- Name the selected playbook.
- List selected agents and skipped obvious agents with reasons.
- State assumptions before edits.
- Report files read or changed when relevant.
- Include the verification command and result.
- Leave open risks or blockers explicit.

## Governance Boundary
- Agents advise, implement, review, and produce evidence; they do not grant their own execution authority.
- State-changing actions require a mandate, bounded scope, evidence, and named authority.
- Missing authority, conflicting scope, or under-specified risk means stop or require human approval.
- Keep credentials out of prompts, saved workflows, registry files, and agent Markdown.
- If a future gateway is present, route writes, deploys, merges, API calls, database mutations, and external messages through it.

## Cost-Aware Planning
- Use the cheapest agent/model that can answer the question safely.
- Use expensive/frontier reasoning only for unclear architecture, repeated failures, or high-risk root cause work.
- Split parallel agents only when scopes are disjoint and file/module ownership is explicit.
- Do not spawn agents only to look busy.
- Define verification gates before merge or release.

## UI/UX Quality
- Use UI/UX design-system guidance for visible interface work.
- Check accessibility, touch targets, responsive layout, typography, color contrast, loading/error states, and reduced motion.
- Prefer concrete viewport/runtime evidence over subjective polish claims.
- Treat "impeccable" as a final quality pass, not permission to overbuild.

## Commands
- If `rtk` is installed, prefer `rtk <command>` for shell commands.
- If `rtk` is missing, run the normal command.
- Never make `rtk` a hard requirement for the workflow.
