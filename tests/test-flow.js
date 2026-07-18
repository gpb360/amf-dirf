import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, reconcile } from "../src/flow.js";
import { validateSnapshot } from "../src/validate.js";

const WORKFLOW = {
  phases: ["classify"],
  output: "A route",
  validation: "Check the route",
  recovery: "Ask for context",
};

test("Reconciliation rejects a Playbook without an ordered skill flow", () => {
  const errors = reconcile({ triage: { description: "Fallback", keywords: [], agents: [], workflow: WORKFLOW } });

  assert.deepEqual(errors, ["playbook triage: missing skill_flow"]);
});

test("Reconciliation requires the triage Playbook", () => {
  assert.deepEqual(reconcile({}), ["triage: missing coherent playbook definition"]);
});

test("Reconciliation rejects unknown conditional branches", () => {
  const playbooks = {
    triage: {
      description: "Classify an unrecognized task",
      keywords: [],
      agents: [],
      workflow: WORKFLOW,
      skill_flow: {
        label: "triage",
        steps: [{ stage: "classify", skill: "grill-me", reason: "Classify the task", branch: "mobile" }],
      },
    },
  };

  assert.deepEqual(reconcile(playbooks), ["playbook triage: step 1 references unknown branch mobile"]);
});

test("Reconciliation rejects an incomplete Playbook definition", () => {
  const errors = reconcile({ triage: { skill_flow: { label: "triage", steps: [{ stage: "route", skill: "grill-me", reason: "Classify" }] } } });

  assert.deepEqual(errors, [
    "playbook triage: missing description",
    "playbook triage: keywords must be an array",
    "playbook triage: agents must be an array",
    "playbook triage: workflow must be an object",
  ]);
});

test("Reconciliation rejects malformed definitions instead of throwing", () => {
  assert.deepEqual(reconcile({ triage: null }), ["playbook triage: definition must be an object"]);
  assert.ok(reconcile({
    triage: {
      description: "Classify",
      keywords: [],
      agents: [],
      workflow: WORKFLOW,
      skill_flow: { label: "triage", steps: [null] },
    },
  }).includes("playbook triage: step 1 must be an object"));
});

test("Reconciliation requires a complete workflow contract", () => {
  const errors = reconcile({
    triage: {
      description: "Classify",
      keywords: [],
      agents: [],
      workflow: {},
      skill_flow: { label: "triage", steps: [{ stage: "route", skill: "grill-me", reason: "Classify" }] },
    },
  });

  assert.deepEqual(errors, [
    "playbook triage: workflow.phases must be a non-empty array",
    "playbook triage: workflow.output must be a non-empty string",
    "playbook triage: workflow.validation must be a non-empty string",
    "playbook triage: workflow.recovery must be a non-empty string",
  ]);
});

test("buildFlow assembles an existing Selection without classifying again", () => {
  const selection = {
    playbook: "fullstack-feature",
    agents: [],
    skill_flow: {
      label: "build a feature",
      steps: [{ stage: "build", capability: "testing", reason: "Drive one behavior" }],
    },
  };

  assert.deepEqual(buildFlow(selection, { task: "Add review access" }, { tdd: { path: "skills/tdd", description: "testing behavior", provider: "project" } }), {
    playbook: "fullstack-feature",
    label: "build a feature",
    steps: [{
      stage: "build", capability: "testing", skill: "tdd", type: "skill", reason: "Drive one behavior",
      status: "installed", provider: "project", selection_reason: "best installed match (5) for testing", rejected_candidates: [],
    }],
    gaps: [],
    branches: [],
  });
});

test("buildFlow does not infer UI from the word build", () => {
  const selection = {
    playbook: "fullstack-feature",
    agents: [],
    skill_flow: {
      label: "build",
      steps: [
        { stage: "build", capability: "testing", reason: "Drive behavior" },
        { stage: "design", capability: "design", reason: "Design UI", branch: "ui" },
      ],
    },
  };

  const installed = {
    tdd: { path: "skills/tdd", description: "testing behavior" },
    "frontend-design": { path: "skills/frontend-design", description: "design UI" },
  };
  assert.deepEqual(buildFlow(selection, { task: "build an API" }, installed).steps.map((step) => step.skill), ["tdd"]);
  assert.deepEqual(buildFlow(selection, { task: "build a UI component" }, installed).steps.map((step) => step.skill), ["tdd", "frontend-design"]);
});

test("buildFlow selects one deterministic installed match and reports gaps", () => {
  const selection = {
    playbook: "demo", agents: [],
    skill_flow: { label: "demo", steps: [
      { stage: "quality", capability: "quality", reason: "Improve quality" },
      { stage: "memory", capability: "memory", reason: "Recover context" },
    ] },
  };
  const flow = buildFlow(selection, {
    task: "quality pass",
    trustedSources: [{ name: "user-choice", capabilities: ["memory"], url: "https://example.test" }],
  }, {
    zeta: { path: "/z", description: "quality" },
    alpha: { path: "/a", description: "quality" },
  });
  assert.equal(flow.steps.length, 1);
  assert.equal(flow.steps[0].skill, "alpha");
  assert.equal(flow.gaps[0].capability, "memory");
  assert.equal(flow.gaps[0].requires_approval, true);
  assert.equal(flow.gaps[0].trusted_candidates[0].name, "user-choice");
});

test("schema v2 requires resolved skill snapshots", () => {
  const snapshot = {
    schema_version: 2,
    name: "demo",
    task: "build an API",
    playbook: "fullstack-feature",
    playbook_description: "Build",
    agents: [{ name: "backend-developer", skills: ["tdd"] }],
    baseline_skills: ["ponytail"],
    questions: [],
    skill_flow: { label: "build", steps: [{ stage: "build", skill: "tdd", reason: "Test" }] },
    policy: "policies/workflow-policy.md",
  };

  assert.deepEqual(validateSnapshot(snapshot, "demo.json"), [
    "demo.json: baseline skill 1 must be a resolved skill object",
    "demo.json: agent 1 skill 1 must be a resolved skill object",
    "demo.json: skill_flow step 1 status must be installed or recommended",
  ]);
});

test("schema v2 reports malformed collections instead of throwing", () => {
  const errors = validateSnapshot({ schema_version: 2, agents: {}, baseline_skills: {} }, "bad.json");
  assert.ok(errors.includes("bad.json: key agents must be array"));
  assert.ok(errors.includes("bad.json: key baseline_skills must be array"));
});

test("schema v2 requires complete persisted flow fields", () => {
  const errors = validateSnapshot({
    schema_version: 2,
    name: "demo",
    task: "build",
    playbook: "fullstack-feature",
    playbook_description: "Build",
    agents: [],
    baseline_skills: [],
    questions: [],
    skill_flow: { label: "", steps: [{ skill: "tdd", status: "recommended" }] },
    policy: "policies/workflow-policy.md",
  }, "demo.json");

  assert.ok(errors.includes("demo.json: skill_flow.label must be a non-empty string"));
  assert.ok(errors.includes("demo.json: skill_flow step 1 stage must be a non-empty string"));
  assert.ok(errors.includes("demo.json: skill_flow step 1 reason must be a non-empty string"));
});

test("schema v4 rejects persisted runtime paths", () => {
  const errors = validateSnapshot({
    schema_version: 4,
    name: "portable",
    task: "build",
    path: "C:\\repo",
    playbook: "fullstack-feature",
    playbook_description: "Build",
    agents: [{ name: "backend-developer", skills: [{ name: "tdd", status: "installed", provider: "project", path: "C:/skills/tdd" }] }],
    baseline_skills: [],
    questions: [],
    skill_flow: { label: "build", steps: [{ stage: "build", capability: "testing", skill: "tdd", status: "installed", provider: "project", reason: "Test" }], gaps: [] },
    capability_gaps: [],
    policy: "policies/workflow-policy.md",
  }, "portable.json");

  assert.ok(errors.includes("portable.json: must not persist target repository path"));
  assert.ok(errors.includes("portable.json: agent 1 skill 1 must not persist a runtime path"));
});
