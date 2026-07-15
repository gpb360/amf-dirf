// Skills discovery + resolver tests via node:test. Run: node --test tests/test-skills.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as skills from "../src/skills.js";

function makeRoot() {
  // Fresh temp project root with a skills/ folder.
  const root = mkdtempSync(join(tmpdir(), "dirf-test-"));
  mkdirSync(join(root, "skills"), { recursive: true });
  return root;
}

function write(folder, name, content) {
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, name), content, "utf-8");
}

test("discover finds local SKILL.md skills", () => {
  const root = makeRoot();
  write(join(root, "skills", "demo-skill"), "SKILL.md",
    "---\nname: demo-skill\ndescription: a demo\n---\nbody");
  const idx = skills.discover(root);
  assert.ok("demo-skill" in idx);
  assert.equal(idx["demo-skill"].description, "a demo");
});

test("discover reads skill.json when no SKILL.md (ui-ux-pro-max case)", () => {
  const root = makeRoot();
  write(join(root, "skills", "ui-ux-pro-max"), "skill.json",
    '{"name": "ui-ux-pro-max", "description": "design intelligence"}');
  const idx = skills.discover(root);
  assert.ok("ui-ux-pro-max" in idx);
});

test("discover reads README.md as last resort", () => {
  const root = makeRoot();
  write(join(root, "skills", "readme-only"), "README.md",
    "---\nname: readme-only\ndescription: readme skill\n---\nbody");
  const idx = skills.discover(root);
  assert.ok("readme-only" in idx);
});

test("discover handles null projectRoot (defaults to kit ROOT)", () => {
  // Should not throw; finds global skills on the real host.
  const idx = skills.discover(null);
  assert.ok(typeof idx === "object");
});

test("resolve marks installed vs recommended", () => {
  const discovered = { ponytail: { name: "ponytail", path: "/x", file: "SKILL.md", description: "" } };
  const resolved = skills.resolveAgentSkills("frontend-developer", ["ponytail", "impeccable"], [], discovered);
  const byName = Object.fromEntries(resolved.map((s) => [s.name, s]));
  assert.equal(byName.ponytail.status, "installed");
  assert.equal(byName.ponytail.path, "/x");
  assert.equal(byName.impeccable.status, "recommended");
  assert.equal(byName.impeccable.path, undefined);
});

test("resolve dedupes baseline and agent-specific", () => {
  const discovered = {};
  const resolved = skills.resolveAgentSkills("ui-designer", ["ponytail", "impeccable"], ["ponytail", "ui-ux-pro-max"], discovered);
  const names = resolved.map((s) => s.name);
  assert.equal(names.filter((n) => n === "ponytail").length, 1);
  assert.deepEqual(new Set(names), new Set(["ponytail", "impeccable", "ui-ux-pro-max"]));
});

test("resolve never fails on missing skill", () => {
  const resolved = skills.resolveAgentSkills("x", ["totally-unknown-skill"], [], {});
  assert.equal(resolved[0].status, "recommended");
  assert.equal(resolved[0].name, "totally-unknown-skill");
});
