// Router tests via node:test. Run: node --test tests/test-router.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectRoutingFacts, recommend } from "../src/router.js";

test("landing page match", () => {
  const r = recommend("build a landing page");
  assert.equal(r.playbook, "landing-page");
  assert.ok(r.score > 0);
  assert.ok(r.matched_keywords.includes("landing"));
});

test("bug fix match", () => {
  assert.equal(recommend("fix a broken login bug").playbook, "bug-fix");
});

test("security review match", () => {
  assert.equal(recommend("audit security vulnerabilities in auth").playbook, "security-review");
});

test("implementation intent outranks incidental auth terminology", () => {
  assert.equal(
    recommend("Add GitHub repository sync to governance intake with auth, persistence, and tests").playbook,
    "fullstack-feature",
  );
  assert.equal(recommend("Add account settings with auth and permissions").playbook, "fullstack-feature");
  assert.equal(recommend("Create a security feature with auth").playbook, "fullstack-feature");
  assert.equal(recommend("Implement auth vulnerability remediation").playbook, "fullstack-feature");
  assert.equal(recommend("Fix auth vulnerability").playbook, "bug-fix");
  assert.equal(recommend("Create a security audit of auth").playbook, "security-review");
  assert.equal(recommend("Implement a security audit of auth").playbook, "security-review");
});

test("negated implementation language does not override explicit PR review", () => {
  assert.equal(recommend("Review PR #900 and do not add split behavior").playbook, "pr-review");
});

test("implementation intent outranks domain review terminology", () => {
  assert.equal(
    recommend("Add paid-save entitlement checks and creator execution review access with Supabase persistence and tests").playbook,
    "fullstack-feature",
  );
});

test("falls back to triage when nothing matches", () => {
  const r = recommend("xyzzy qwerty nothing matches here");
  assert.equal(r.playbook, "triage");
  assert.equal(r.score, 0);
});

test("triage cues still use the unclassified fallback", () => {
  const r = recommend("help me triage where to start");
  assert.equal(r.playbook, "triage");
  assert.equal(r.score, 0);
  assert.deepEqual(r.matched_keywords, []);
});

test("alternates present on multi-match", () => {
  // "review a pr for security bugs" matches pr-review, security-review, bug-fix
  const r = recommend("review a pr for security bugs");
  assert.ok(["pr-review", "security-review", "bug-fix"].includes(r.playbook));
  assert.ok(r.alternates.length >= 1);
  for (const alt of r.alternates) {
    assert.ok("playbook" in alt && "score" in alt && "description" in alt);
  }
});

test("workflow contract is carried through", () => {
  const r = recommend("build a landing page");
  assert.ok("phases" in r.workflow);
  assert.ok("output" in r.workflow);
  assert.ok(Array.isArray(r.agents) && r.agents.length > 0);
  assert.ok(Array.isArray(r.baseline_skills));
  assert.ok(Array.isArray(r.questions));
});

test("facts augment matching", () => {
  const without = recommend("help me with something");
  const withFacts = recommend("help me", ["build a landing page"]);
  assert.ok(withFacts.score >= without.score);
});

test("frontend design refactor selects the UI playbook", () => {
  assert.equal(recommend("continue frontend design refactor").playbook, "ui-ux-review");
});

test("work-in-progress facts augment routing", () => {
  const r = recommend("continue the current work", ["branch: m024/design-system-foundation"]);
  assert.equal(r.playbook, "ui-ux-review");
  assert.ok(r.matched_keywords.includes("design-system"));
});

test("work-in-progress facts cannot override explicit PR-review intent", () => {
  const r = recommend(
    "Review pull request 23 and determine merge next steps",
    ["changed: flowstack-build-prompt.md", "changed: AGENTS.md", "changed: cleanup-notes.md"],
  );
  assert.equal(r.playbook, "pr-review");
});

test("work-in-progress facts cannot override explicit UI intent", () => {
  const r = recommend(
    "ui ux review, figure out what design piece to work on next",
    ["changed: AGENTS.md", "branch: m024/design-system-foundation"],
  );
  assert.equal(r.playbook, "ui-ux-review");
});

test("collectRoutingFacts reads branch, changed paths, and active plan", () => {
  const root = mkdtempSync(join(tmpdir(), "dirf-facts-"));
  execFileSync("git", ["init", "-b", "design-system-foundation", root]);
  mkdirSync(join(root, ".gsd"));
  writeFileSync(join(root, ".gsd", "STATE.md"), "**Active Milestone:** Frontend refactor\n");
  writeFileSync(join(root, "DesignPanel.tsx"), "export {}\n");
  execFileSync("git", ["-C", root, "add", "DesignPanel.tsx"]);
  execFileSync("git", ["-C", root, "-c", "user.name=DIRF Test", "-c", "user.email=dirf@example.invalid", "commit", "-m", "seed"]);
  writeFileSync(join(root, "DesignPanel.tsx"), "export const changed = true\n");

  const facts = collectRoutingFacts(root);
  assert.ok(facts.includes("branch: design-system-foundation"));
  assert.ok(facts.includes("changed: DesignPanel.tsx"));
  assert.ok(facts.includes("plan: Active Milestone: Frontend refactor"));
});
