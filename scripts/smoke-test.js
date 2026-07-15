#!/usr/bin/env node
// Integration smoke test for amf-dirf. Node built-ins only.
// Run: node scripts/smoke-test.js
// Asserts the full pipeline + unit tests behave correctly.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const CLI = join(ROOT, "src", "cli.js");
const TESTS = join(ROOT, "tests");
const WORKFLOWS = join(ROOT, "workflows", "user");

function run(args, expectFail = false) {
  const res = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf-8" });
  const failed = res.status !== 0;
  if (expectFail && !failed) throw new Error(`expected failure but succeeded: ${args.join(" ")}\n${res.stdout}`);
  if (!expectFail && failed) throw new Error(`expected success but failed: ${args.join(" ")}\n${res.stderr || res.stdout}`);
  return res.stdout;
}

function assertContains(output, needle) {
  if (!output.includes(needle)) throw new Error(`expected ${JSON.stringify(needle)} in output:\n${output}`);
}

// --- unit tests ---
for (const t of ["test-router.js", "test-skills.js", "test-renderer.js"]) {
  const res = spawnSync(process.execPath, ["--test", join(TESTS, t)], { cwd: ROOT, encoding: "utf-8" });
  if (res.status !== 0) throw new Error(`unit test failed: ${t}\n${res.stdout}`);
  assertContains(res.stdout, "# fail 0");
}

// --- validate ---
let out = run(["validate"]);
assertContains(out, "Validation passed");
assertContains(out, "agents");
assertContains(out, "playbooks");

// --- skills scan ---
out = run(["skills", "scan"]);
assertContains(out, "Discovered");
assertContains(out, "resolved");

// --- full build pipeline ---
out = run(["build", "smoke", "build a landing page"]);
assertContains(out, "Workflow saved");
assertContains(out, "Spec kit rendered:");

const wfJson = join(WORKFLOWS, "smoke.json");
const readme = join(WORKFLOWS, "instructions", "README.md");
const html = join(WORKFLOWS, "instructions", "instructions.html");
const detail = join(WORKFLOWS, "instructions", "agents", "frontend-developer.md");
for (const p of [wfJson, readme, html, detail]) {
  if (!existsSync(p)) throw new Error(`missing expected output: ${p}`);
}
const readmeText = readFileSync(readme, "utf-8");
assertContains(readmeText, "Definition of Done");
assertContains(readmeText, "Agent roster");
assertContains(readmeText.toLowerCase(), "baseline skills");
if (readmeText.split("\n").length > 60) throw new Error("router README too long (>60 lines)");

const htmlText = readFileSync(html, "utf-8");
if (!htmlText.startsWith("<!doctype html>")) throw new Error("HTML missing doctype");
if (htmlText.includes("src=") || htmlText.includes('href="')) throw new Error("HTML has external assets");
if (!htmlText.includes("<details>")) throw new Error("HTML not collapsible");

// --- render existing ---
out = run(["render", "smoke"]);
assertContains(out, "Spec kit rendered:");

// --- list ---
out = run(["list"]);
assertContains(out, "smoke");

// --- fail-closed: unknown workflow ---
run(["render", "does-not-exist-xyz"], true);

// cleanup
try { rmSync(wfJson); } catch { /* ok */ }

console.log("Smoke test passed");
