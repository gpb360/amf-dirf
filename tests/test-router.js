// Router tests via node:test. Run: node --test tests/test-router.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { recommend } from "../src/router.js";

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
