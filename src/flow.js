// Skill-flow router — the ask-matt model applied to amf-dirf.
// Node built-ins only.
//
// Instead of a flat list of skills per agent, this maps a SITUATION to an
// ordered FLOW through skills: "given what you're doing, reach for this skill
// first, then that one, branching on your situation." A flow is a sequence of
// steps, each naming a skill and WHY it matters at that point.
//
// The flow is grounded in the playbooks we already have. The main flow is
// idea→ship (build something). On-ramps are situations that merge onto it.
import { recommend } from "./router.js";
import { resolveAgentSkills, discover } from "./skills.js";
import { resolve } from "node:path";
import { isAbsolute } from "node:path";

// A flow step: a skill to reach for, at a given stage, with a reason.
// { stage, skill, reason, branch? }
// `branch` marks conditional steps (only if a condition holds).

// The flow graph. Each playbook maps to an ordered skill sequence.
// Skills are resolved at runtime (installed/recommended), so the flow adapts
// to what's actually on the host.
const FLOWS = {
  // === MAIN FLOW: idea → ship ===
  "fullstack-feature": {
    label: "idea → ship (build a feature)",
    steps: [
      { stage: "sharpen", skill: "grill-me", reason: "Stress-test the plan before building — resolve the decision tree so you don't build on hand-wavy assumptions." },
      { stage: "plan", skill: "ponytail", reason: "Before writing code: does this need to exist? Reuse existing patterns first, stdlib before deps, one line before fifty." },
      { stage: "design", skill: "frontend-design", reason: "If there's a UI surface: lay out the component composition and responsive structure before implementing.", branch: "ui" },
      { stage: "build", skill: "tdd", reason: "Drive each slice red-green-refactor — one behaviour at a time, with a failing test locking it before the fix." },
      { stage: "build", skill: "react-best-practices", reason: "Follow framework conventions for state, hooks, and component patterns.", branch: "react" },
      { stage: "quality", skill: "impeccable", reason: "After the slice works: no AI slop. Clean reusable components, YAGNI/DRY/KISS. This is the gate before review." },
      { stage: "review", skill: "code-review", reason: "Two-axis review of the diff: does it meet standards AND match the spec? Before committing." },
    ],
  },
  "landing-page": {
    label: "idea → ship (build a landing page)",
    steps: [
      { stage: "sharpen", skill: "grill-me", reason: "Sharpen the offer, audience, and CTA before designing. What's the one conversion goal?" },
      { stage: "design", skill: "ui-ux-pro-max", reason: "Visual hierarchy, typography, layout quality, interaction polish — this is the primary differentiator for a landing page." },
      { stage: "design", skill: "accessibility", reason: "Semantic HTML, contrast, keyboard nav — catch a11y issues in design, not after." },
      { stage: "build", skill: "ponytail", reason: "Smallest correct implementation. Reuse existing components; native platform features before libraries." },
      { stage: "quality", skill: "impeccable", reason: "Final polish gate: professional fit and finish, consistency, no rough edges." },
      { stage: "verify", skill: "web-quality-audit", reason: "Runtime check: performance, Core Web Vitals, responsive behavior across viewports." },
    ],
  },

  // === ON-RAMP: something's broken ===
  "bug-fix": {
    label: "something's broken → fix it",
    steps: [
      { stage: "diagnose", skill: "systematic-debugging", reason: "Don't theorize before you have a tight feedback loop. Reproduce with one command that goes red on THIS bug." },
      { stage: "diagnose", skill: "ponytail", reason: "Patch the smallest source of the bug — not a refactor. The ladder: is the fix already in the codebase? One line?" },
      { stage: "fix", skill: "tdd", reason: "Write the regression test that reproduces the bug, watch it go red, fix, watch it go green." },
      { stage: "review", skill: "code-review", reason: "Confirm the fix doesn't regress elsewhere — review the diff." },
    ],
  },

  // === ON-RAMP: review a PR ===
  "pr-review": {
    label: "review a pull request",
    steps: [
      { stage: "review", skill: "code-review", reason: "Two-axis review: Standards (does it follow conventions?) + Spec (does it match intent?)." },
      { stage: "security", skill: "security-review", reason: "Check the diff for trust-boundary issues, secrets, injection, auth gaps." },
      { stage: "verify", skill: "tdd", reason: "Are there tests for the changed behavior? If not, that's a finding." },
    ],
  },

  // === ON-RAMP: foggy/huge effort → plan first ===
  "research": {
    label: "foggy effort → research before building",
    steps: [
      { stage: "research", skill: "grill-me", reason: "Before researching: grill the decision. What are you actually deciding? Kill the foggy framing first." },
      { stage: "synthesize", skill: "ponytail", reason: "Smallest useful recommendation. Don't over-research — cite concrete sources and stop." },
    ],
  },
  "improve-plan": {
    label: "plan before implementation",
    steps: [
      { stage: "plan", skill: "grill-me", reason: "Stress-test the plan: every decision branch resolved, no 'probably' on load-bearing choices." },
      { stage: "plan", skill: "ponytail", reason: "Cost-aware: cheapest sufficient approach. Only split into parallel agents on disjoint scopes." },
    ],
  },

  // === QUALITY ON-RAMP: polish ===
  "impeccable-polish": {
    label: "polish pass",
    steps: [
      { stage: "scan", skill: "ui-ux-pro-max", reason: "Visual hierarchy, spacing, typography, interaction polish — identify the rough edges." },
      { stage: "polish", skill: "impeccable", reason: "Apply the smallest polish fixes: consistency, professional fit, no AI slop." },
      { stage: "verify", skill: "web-quality-audit", reason: "Runtime verification: performance, responsive, a11y states." },
    ],
  },
  "ui-ux-review": {
    label: "UI/UX review",
    steps: [
      { stage: "review", skill: "ui-ux-pro-max", reason: "Design-system compliance, layout, interaction quality." },
      { stage: "review", skill: "accessibility", reason: "Contrast, keyboard/touch, screen-reader, reduced motion." },
      { stage: "verify", skill: "web-quality-audit", reason: "Responsive across viewports, loading/error states." },
    ],
  },

  // === SECURITY ON-RAMP ===
  "security-review": {
    label: "security review",
    steps: [
      { stage: "map", skill: "security-review", reason: "Map the trust boundary first. What's the asset? Who's the attacker?" },
      { stage: "inspect", skill: "systematic-debugging", reason: "Trace the control flow methodically — don't guess at vulnerabilities." },
      { stage: "verify", skill: "tdd", reason: "Prove findings with code references or a test that demonstrates the vulnerability." },
    ],
  },

  // === PERFORMANCE ON-RAMP ===
  "performance-pass": {
    label: "performance pass",
    steps: [
      { stage: "measure", skill: "web-quality-audit", reason: "Establish the baseline metric before changing anything. What's slow?" },
      { stage: "fix", skill: "ponytail", reason: "Patch the smallest cause — not a speculative optimization." },
      { stage: "remeasure", skill: "web-quality-audit", reason: "Rerun the same benchmark. Before/after evidence." },
    ],
  },

  // === TRIAGE (fallback) ===
  "triage": {
    label: "triage — classify and route",
    steps: [
      { stage: "classify", skill: "grill-me", reason: "Ask one question at a time to classify the task. What are you trying to produce or fix?" },
    ],
  },
};

// Which branches apply for a given task? (e.g. "ui" if there's a UI surface, "react" if React detected)
function branchesFor(task, playbookAgents) {
  const out = new Set();
  const text = (task || "").toLowerCase();
  if (/ui|page|component|landing|frontend|interface|button|form|screen/.test(text)) out.add("ui");
  if (/react|hook|jsx|component/.test(text)) out.add("react");
  // if the playbook includes frontend/ui agents, there's a UI surface
  if (playbookAgents && playbookAgents.some((a) => ["frontend-developer", "ui-designer", "ux-researcher"].includes(a)))
    out.add("ui");
  return out;
}

export function buildFlow(task, projectRoot) {
  // Route the task to a playbook, then return its ordered skill flow with
  // each step resolved (installed/recommended) against the host's skills.
  const rec = recommend(task);
  const flowDef = FLOWS[rec.playbook] || FLOWS.triage;
  const branches = branchesFor(task, rec.agents);
  const discovered = discover(projectRoot);

  const steps = flowDef.steps
    .filter((s) => !s.branch || branches.has(s.branch))
    .map((s) => {
      const hit = discovered[s.skill];
      return {
        stage: s.stage,
        skill: s.skill,
        reason: s.reason,
        status: hit ? "installed" : "recommended",
        path: hit ? hit.path : undefined,
      };
    });

  return {
    playbook: rec.playbook,
    label: flowDef.label,
    steps,
    branches: [...branches],
  };
}
