// Assemble an already-selected Playbook's ordered skill flow.
// Selection happens in router.js; this module never classifies a task.

export const KNOWN_BRANCHES = new Set(["ui", "react"]);

export function reconcile(playbooks, knownBranches = KNOWN_BRANCHES) {
  const errors = [];
  if (!Object.hasOwn(playbooks || {}, "triage")) errors.push("triage: missing coherent playbook definition");
  for (const [name, playbook] of Object.entries(playbooks || {})) {
    if (!playbook || typeof playbook !== "object" || Array.isArray(playbook)) {
      errors.push(`playbook ${name}: definition must be an object`);
      continue;
    }
    if (typeof playbook.description !== "string" || !playbook.description) errors.push(`playbook ${name}: missing description`);
    if (!Array.isArray(playbook.keywords)) errors.push(`playbook ${name}: keywords must be an array`);
    if (!Array.isArray(playbook.agents)) errors.push(`playbook ${name}: agents must be an array`);
    if (!playbook.workflow || typeof playbook.workflow !== "object" || Array.isArray(playbook.workflow)) {
      errors.push(`playbook ${name}: workflow must be an object`);
    } else {
      if (!Array.isArray(playbook.workflow.phases) || playbook.workflow.phases.length === 0) {
        errors.push(`playbook ${name}: workflow.phases must be a non-empty array`);
      }
      for (const field of ["output", "validation", "recovery"]) {
        if (typeof playbook.workflow[field] !== "string" || !playbook.workflow[field]) {
          errors.push(`playbook ${name}: workflow.${field} must be a non-empty string`);
        }
      }
    }
    const flow = playbook.skill_flow;
    if (!flow) {
      errors.push(`playbook ${name}: missing skill_flow`);
      continue;
    }
    if (typeof flow.label !== "string" || !flow.label) errors.push(`playbook ${name}: skill_flow.label must be a non-empty string`);
    if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
      errors.push(`playbook ${name}: skill_flow.steps must be a non-empty array`);
      continue;
    }
    flow.steps.forEach((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) {
        errors.push(`playbook ${name}: step ${index + 1} must be an object`);
        return;
      }
      for (const field of ["stage", "skill", "reason"]) {
        if (!step[field]) errors.push(`playbook ${name}: step ${index + 1} missing ${field}`);
      }
      if (step.branch && !knownBranches.has(step.branch)) {
        errors.push(`playbook ${name}: step ${index + 1} references unknown branch ${step.branch}`);
      }
    });
  }
  return errors;
}

function branchesFor(task, playbookAgents) {
  const branches = new Set();
  const text = (task || "").toLowerCase();
  if (/\b(ui|page|component|landing|frontend|interface|button|form|screen)\b/.test(text)) branches.add("ui");
  if (/\b(react|hook|jsx|component)\b/.test(text)) branches.add("react");
  if (playbookAgents?.some((agent) => ["frontend-developer", "ui-designer", "ux-researcher"].includes(agent))) {
    branches.add("ui");
  }
  return branches;
}

export function buildFlow(selection, context = {}, skillIndex = {}) {
  const flow = selection?.skill_flow;
  if (!flow?.steps) throw new Error(`playbook ${selection?.playbook || "?"}: missing skill_flow`);

  const branches = branchesFor(context.task, selection.agents);
  const steps = flow.steps
    .filter((step) => !step.branch || branches.has(step.branch))
    .map(({ branch: _branch, ...step }) => {
      const installed = skillIndex[step.skill];
      return {
        ...step,
        status: installed ? "installed" : "recommended",
        ...(installed ? { path: installed.path } : {}),
      };
    });

  return {
    playbook: selection.playbook,
    label: flow.label,
    steps,
    branches: [...branches],
  };
}
