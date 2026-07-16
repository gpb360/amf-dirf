// Task -> playbook matching by keyword score. Node built-ins only.
//
// Reuses the proven keyword-substring approach from the parent agents repo
// (the ponytail 'reuse existing' rung): score = matched keywords * 3, ties
// broken by keyword count then insertion order. Score 0 falls back to triage.
import { loadJson, PLAYBOOKS } from "./paths.js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const FALLBACK_PLAYBOOK = "triage";
export const KEYWORD_WEIGHT = 3;
const IMPLEMENTATION_INTENT = /\b(add|build|create|fix|implement)\b/;
const EXPLICIT_SECURITY_AUDIT = /\bsecurity audit\b/;

export function collectRoutingFacts(projectRoot) {
  if (!projectRoot) return [];
  const git = (args) => {
    try {
      return execFileSync("git", ["-C", projectRoot, ...args], { encoding: "utf-8", windowsHide: true }).trimEnd();
    } catch {
      return "";
    }
  };
  const facts = [];
  const branch = git(["branch", "--show-current"]);
  if (branch) facts.push(`branch: ${branch}`);
  for (const line of git(["status", "--short"]).split(/\r?\n/).filter(Boolean)) {
    facts.push(`changed: ${line.slice(3)}`);
  }
  for (const relative of [join(".gsd", "STATE.md"), join(".planning", "STATE.md")]) {
    const path = join(projectRoot, relative);
    if (!existsSync(path)) continue;
    const active = readFileSync(path, "utf-8").slice(0, 4096).split(/\r?\n/)
      .find((line) => /active (milestone|phase)/i.test(line));
    if (active) facts.push(`plan: ${active.replaceAll("**", "").trim()}`);
  }
  return facts;
}

function scorePlaybook(haystack, playbook) {
  const matched = (playbook.keywords || []).filter((kw) => haystack.includes(kw.toLowerCase()));
  return [matched.length * KEYWORD_WEIGHT, matched.length];
}

export function recommend(task, facts, playbooks = loadJson(PLAYBOOKS)) {
  // Pick the best playbook for a task. Returns a recommendation object.
  const taskText = (task || "").toLowerCase();
  let haystack = taskText;
  const taskHasRoutingCue = Object.entries(playbooks).some(([name, playbook]) =>
    name !== FALLBACK_PLAYBOOK && (playbook.keywords || []).some((keyword) => taskText.includes(keyword.toLowerCase())),
  );
  if (!taskHasRoutingCue && facts && facts.length) haystack += " " + facts.join(" ").toLowerCase();
  const isImplementation = IMPLEMENTATION_INTENT.test(taskText);
  const isExplicitSecurityAudit = EXPLICIT_SECURITY_AUDIT.test(taskText);
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
