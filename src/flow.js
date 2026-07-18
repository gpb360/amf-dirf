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
      for (const field of ["stage", "reason"]) {
        if (!step[field]) errors.push(`playbook ${name}: step ${index + 1} missing ${field}`);
      }
      if (!step.capability && !step.skill) errors.push(`playbook ${name}: step ${index + 1} missing capability`);
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

const STOP_WORDS = new Set(["and", "the", "for", "with", "from", "into", "before", "after", "when", "this", "that", "task", "skill", "use", "apply"]);

function words(value) {
  return new Set(String(value || "").toLowerCase().replaceAll("-", " ").match(/[a-z0-9]{3,}/g)?.filter((word) => !STOP_WORDS.has(word)) || []);
}

function capabilityType(name, item) {
  if (item.type) return item.type;
  if (/\b(rtk|cli|tool)\b/i.test(name)) return "tool";
  if (/\b(mem|memory|obsidian)\b/i.test(name)) return "memory";
  if (/\b(beads?|tracker|linear)\b/i.test(name)) return "tracker";
  return "skill";
}

function selectCapability(requirement, selection, context, skillIndex) {
  const capabilityWords = words(requirement.capability);
  const ranked = Object.entries(skillIndex).map(([name, item]) => {
    const candidate = words([name, item.description, item.summary, item.category, ...(item.applies_to || []), ...(item.tags || [])].join(" "));
    const declared = Array.isArray(item.capabilities) ? item.capabilities : String(item.capabilities || "").split(",").map((value) => value.trim()).filter(Boolean);
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const normalizedCapability = requirement.capability.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    let score = declared.includes(requirement.capability) ? 100 : normalizedName === normalizedCapability ? 50 : 0;
    let capabilityMatches = score ? 1 : 0;
    for (const word of capabilityWords) if (candidate.has(word)) { score += 5; capabilityMatches += 1; }
    if (!capabilityMatches) return { name, item, score: 0 };
    return { name, item, score };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || String(a.item.path).localeCompare(String(b.item.path)));
  const chosen = ranked[0];
  if (!chosen) return null;
  return {
    stage: requirement.stage,
    capability: requirement.capability || requirement.stage,
    skill: chosen.name,
    type: capabilityType(chosen.name, chosen.item),
    reason: requirement.reason,
    status: "installed",
    provider: chosen.item.provider || "project",
    selection_reason: `best installed match (${chosen.score}) for ${requirement.capability || requirement.stage}`,
    rejected_candidates: ranked.slice(1, 4).map(({ name, score }) => ({ name, score })),
  };
}

export function buildFlow(selection, context = {}, skillIndex = {}) {
  const flow = selection?.skill_flow;
  if (!flow?.steps) throw new Error(`playbook ${selection?.playbook || "?"}: missing skill_flow`);

  const branches = branchesFor(context.task, selection.agents);
  const requirements = flow.steps
    .filter((step) => !step.branch || branches.has(step.branch))
    .map(({ branch: _branch, skill: _legacySkill, ...step }) => ({ ...step, capability: step.capability || step.stage }));
  const steps = [];
  const gaps = [];
  for (const requirement of requirements) {
    const selected = selectCapability(requirement, selection, context, skillIndex);
    if (selected) steps.push(selected);
    else gaps.push({
      stage: requirement.stage,
      capability: requirement.capability,
      question: `No installed capability covers ${requirement.capability}. Would you like DIRF to suggest a trusted skill or derive a repo-local pattern?`,
      reason: requirement.reason,
      requires_approval: true,
      trusted_candidates: (context.trustedSources || []).filter((source) =>
        (source.capabilities || []).includes(requirement.capability)),
    });
  }

  return {
    playbook: selection.playbook,
    label: flow.label,
    steps,
    gaps,
    branches: [...branches],
  };
}
