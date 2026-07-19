import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parseUnitReadme, resolveGraph, renderFolderHtml } from "../src/folders.js";

function unit(root, name, kind, uses = [], details = []) {
  const folder = join(root, name);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "README.md"), [
    "---", `name: ${name}`, `kind: ${kind}`, `description: "${name}"`,
    `uses: ${JSON.stringify(uses)}`, `details: ${JSON.stringify(details)}`,
    "inputs: []", "outputs: []", "capabilities: []", "---", "", `# ${name}`,
  ].join("\n"));
  return folder;
}

test("README frontmatter is the folder interface", () => {
  const parsed = parseUnitReadme("---\nname: demo\nkind: skill\nuses: []\ndetails: []\ninputs: []\noutputs: []\ncapabilities: []\n---\nDo it");
  assert.equal(parsed.meta.kind, "skill");
  assert.equal(parsed.body, "Do it");
});

test("ordered DAG composes playbooks, workflows, skills, and isolated tools once", () => {
  const root = mkdtempSync(join(tmpdir(), "dirf-folders-"));
  const tool = unit(root, "tool", "tool");
  const skill = unit(root, "skill", "skill", [relative(join(root, "skill"), tool)]);
  const shared = unit(root, "shared", "playbook", [relative(join(root, "shared"), skill)]);
  const child = unit(root, "child", "workflow", [relative(join(root, "child"), shared)]);
  const entry = unit(root, "entry", "playbook", [relative(join(root, "entry"), shared), relative(join(root, "entry"), child)]);
  const graph = resolveGraph(entry, { allowedRoots: [root] });
  assert.deepEqual(graph.map((item) => item.meta.name), ["tool", "skill", "shared", "child", "entry"]);
  assert.equal(graph.filter((item) => item.meta.name === "shared").length, 1);
  assert.ok(renderFolderHtml(graph).startsWith("<!doctype html>"));
});

test("folder resolver rejects cycles and tool control of workflows", () => {
  const root = mkdtempSync(join(tmpdir(), "dirf-folders-"));
  const a = unit(root, "a", "playbook", ["../b"]);
  unit(root, "b", "workflow", ["../a"]);
  assert.throws(() => resolveGraph(a, { allowedRoots: [root] }), /folder cycle/);

  const workflow = unit(root, "work", "workflow");
  const tool = unit(root, "bad-tool", "tool", [relative(join(root, "bad-tool"), workflow)]);
  assert.throws(() => resolveGraph(tool, { allowedRoots: [root] }), /tool bad-tool cannot use workflow work/);
});

test("details are validated but remain outside the execution DAG", () => {
  const root = mkdtempSync(join(tmpdir(), "dirf-folders-"));
  const folder = unit(root, "skill", "skill", [], ["README-a.md"]);
  assert.throws(() => resolveGraph(folder, { allowedRoots: [root] }), /missing detail/);
  writeFileSync(join(folder, "README-a.md"), "lazy detail");
  assert.equal(resolveGraph(folder, { allowedRoots: [root] }).length, 1);
});

test("uses cannot escape the allowed roots", () => {
  const root = mkdtempSync(join(tmpdir(), "dirf-folders-"));
  const outside = mkdtempSync(join(tmpdir(), "dirf-outside-"));
  const external = unit(outside, "external", "skill");
  const entry = unit(root, "entry", "workflow", [relative(join(root, "entry"), external)]);
  assert.throws(() => resolveGraph(entry, { allowedRoots: [root] }), /reference escapes allowed roots/);
});
