// Task -> playbook matching by keyword score. Node built-ins only.
//
// Reuses the proven keyword-substring approach from the parent agents repo
// (the ponytail 'reuse existing' rung): score = matched keywords * 3, ties
// broken by keyword count then insertion order. Score 0 falls back to triage.
import { loadJson, PLAYBOOKS } from "./paths.js";

export const FALLBACK_PLAYBOOK = "triage";
export const KEYWORD_WEIGHT = 3;
const IMPLEMENTATION_INTENT = /\b(add|build|create|fix|implement)\b/;
const EXPLICIT_SECURITY_AUDIT = /\bsecurity audit\b/;

function scorePlaybook(haystack, playbook) {
  const matched = (playbook.keywords || []).filter((kw) => haystack.includes(kw.toLowerCase()));
  return [matched.length * KEYWORD_WEIGHT, matched.length];
}

export function recommend(task, facts, playbooks = loadJson(PLAYBOOKS)) {
  // Pick the best playbook for a task. Returns a recommendation object.
  let haystack = (task || "").toLowerCase();
  if (facts && facts.length) haystack += " " + facts.join(" ").toLowerCase();
  const isImplementation = IMPLEMENTATION_INTENT.test(haystack);
  const isExplicitSecurityAudit = EXPLICIT_SECURITY_AUDIT.test(haystack);
  if (isImplementation) haystack += " feature";

  const ranked = [];
  let index = 0;
  for (const [name, pb] of Object.entries(playbooks)) {
    if (name === FALLBACK_PLAYBOOK) continue;
    const reviewConflictsWithImplementation = isImplementation && (
      name === "pr-review" || (name === "security-review" && !isExplicitSecurityAudit)
    );
    const [score, count] = reviewConflictsWithImplementation
      ? [0, 0]
      : scorePlaybook(haystack, pb);
    ranked.push({ score, count, index: -index, name, pb });
    index += 1;
  }

  // stable: highest score, then most matched keywords, then earliest playbook
  ranked.sort((a, b) => b.score - a.score || b.count - a.count || b.index - a.index);

  let name, pb, score;
  if (!ranked.length || ranked[0].score === 0) {
    name = FALLBACK_PLAYBOOK;
    pb = playbooks[FALLBACK_PLAYBOOK];
    score = 0;
  } else {
    name = ranked[0].name;
    pb = ranked[0].pb;
    score = ranked[0].score;
  }

  const matched = score === 0 ? [] : (pb.keywords || []).filter((kw) => haystack.includes(kw.toLowerCase()));
  const alternates = ranked.slice(1, 3)
    .filter((r) => r.score > 0)
    .map((r) => ({ playbook: r.name, score: r.score, description: (r.pb.description || "") }));

  return {
    playbook: name,
    playbook_description: pb.description || "",
    score,
    matched_keywords: matched,
    alternates,
    workflow: pb.workflow || {},
    skill_flow: pb.skill_flow,
    agents: pb.agents || [],
    questions: pb.questions || [],
    baseline_skills: pb.baseline_skills || [],
  };
}
