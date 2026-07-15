// Renderer tests via node:test. Run: node --test tests/test-renderer.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAgentMd, renderMarkdownLite, buildInstructions, buildHtml } from "../src/renderer.js";

test("parseAgentMd splits frontmatter and governance block", () => {
  const dir = mkdtempSync(join(tmpdir(), "dirf-rend-"));
  const path = join(dir, "demo.md");
  writeFileSync(path,
    "---\nname: demo\ndescription: x\ntools: A, B\n---\n" +
    "Intro paragraph.\n\n## Section\n- bullet\n\n" +
    "<!-- governance:v1 -->\n## Governance Boundary\n- rule\n", "utf-8");
  const out = parseAgentMd(path);
  assert.equal(out.frontmatter.name, "demo");
  assert.equal(out.frontmatter.tools, "A, B");
  assert.ok(!out.body.includes("Governance Boundary"));
  assert.ok(out.governance.includes("Governance Boundary"));
  assert.ok(out.body.includes("## Section"));
});

test("renderMarkdownLite handles headings and lists", () => {
  const html = renderMarkdownLite("# Title\n\n- one\n- two\n\n1. first\n\n**bold** and `code`");
  assert.ok(html.includes("<h2>Title</h2>"));
  assert.ok(html.includes("<ul>") && html.includes("<li>one</li>"));
  assert.ok(html.includes("<ol>") && html.includes("<li>first</li>"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("<code>code</code>"));
});

test("renderMarkdownLite handles code fence", () => {
  const html = renderMarkdownLite("```js\nconst x = 1;\n```");
  assert.ok(html.includes("<pre><code>"));
  assert.ok(html.includes("const x = 1;"));
  assert.ok(html.includes("</code></pre>"));
});

test("renderMarkdownLite strips html comments", () => {
  const html = renderMarkdownLite("<!-- a comment -->\nvisible");
  assert.ok(!html.includes("a comment"));
  assert.ok(html.includes("visible"));
});

test("buildInstructions writes router + per-agent detail", () => {
  const outDir = mkdtempSync(join(tmpdir(), "dirf-instr-"));
  const workflow = {
    name: "demo", task: "review a pull request", playbook: "landing-page",
    workflow: { phases: ["a", "b"], output: "a page", validation: "v", recovery: "r" },
    agents: [{ name: "frontend-developer", file: "agents/frontend-developer.md", tags: ["frontend"], skills: [{ name: "ponytail", status: "recommended" }] }],
    baseline_skills: [{ name: "ponytail", status: "recommended" }],
    skill_flow: { label: "persisted", branches: [], steps: [{ stage: "build", skill: "persisted-only", reason: "Use the snapshot", status: "recommended" }] },
    policy: "policies/workflow-policy.md", schema_version: 2,
  };
  const written = buildInstructions(workflow, outDir);
  const names = written.map((p) => p.split(/[\\/]/).pop());
  assert.ok(names.includes("README.md"));
  assert.ok(names.includes("policy.md"));
  const readme = readFileSync(join(outDir, "README.md"), "utf-8");
  assert.ok(readme.includes("review a pull request"));
  assert.ok(readme.includes("persisted-only"));
  assert.ok(readme.includes("Definition of Done"));
  assert.ok(readme.includes("agents/frontend-developer.md"));
  const detail = readFileSync(join(outDir, "agents", "frontend-developer.md"), "utf-8");
  assert.ok(detail.includes("# frontend-developer"));
  assert.ok(detail.includes("## Skills"));
  assert.ok(detail.includes("global skill"), "agent should be told it can use global skill discovery");
});

test("buildHtml is self-contained and collapsible", () => {
  const workflow = {
    name: "demo", task: "build a landing page",
    workflow: { phases: ["a"], output: "a page", validation: "v", recovery: "r" },
    agents: [{ name: "frontend-developer", file: "agents/frontend-developer.md", tags: ["frontend"], skills: [{ name: "ponytail", status: "recommended" }] }],
    baseline_skills: [{ name: "ponytail", status: "recommended" }],
    skill_flow: { label: "persisted", branches: [], steps: [{ stage: "verify", skill: "persisted-only", reason: "Use the snapshot", status: "recommended" }] },
    schema_version: 2,
  };
  const html = buildHtml(workflow);
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("<style>")); // inline CSS
  assert.ok(html.includes("<details>") && html.includes("<summary>")); // collapsible
  assert.ok(html.includes("frontend-developer"));
  assert.ok(html.includes("persisted-only"));
  assert.ok(html.includes("Definition of Done"));
  assert.ok(!html.includes("src=") && !html.includes('href="')); // no external assets
});
