#!/usr/bin/env node
// Integration smoke test for amf-dirf. Node built-ins only.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const CLI = join(ROOT, "src", "cli.js");
const TESTS = join(ROOT, "tests");
const TARGET = mkdtempSync(join(tmpdir(), "dirf-smoke-"));

function run(args, expectFail = false) {
  const res = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf-8" });
  const failed = res.status !== 0;
  if (expectFail && !failed) throw new Error(`expected failure but succeeded: ${args.join(" ")}\n${res.stdout}`);
  if (!expectFail && failed) throw new Error(`expected success but failed: ${args.join(" ")}\n${res.stderr || res.stdout}`);
  return `${res.stdout}${res.stderr}`;
}

function assertContains(output, needle) {
  if (!output.includes(needle)) throw new Error(`expected ${JSON.stringify(needle)} in output:\n${output}`);
}

try {
  for (const t of ["test-router.js", "test-skills.js", "test-renderer.js", "test-project.js"]) {
    const res = spawnSync(process.execPath, ["--test", join(TESTS, t)], { cwd: ROOT, encoding: "utf-8" });
    if (res.status !== 0) throw new Error(`unit test failed: ${t}\n${res.stdout}`);
    assertContains(res.stdout, "# fail 0");
  }

  assertContains(run(["validate"]), "Validation passed");
  assertContains(run(["skills", "scan"]), "Discovered");
  const unconfigured = run(["build", "smoke", "build a landing page", "--path", TARGET], true);
  assertContains(unconfigured, "dirf setup");
  if (/fatal:|\n\s+at /.test(unconfigured)) throw new Error(`unconfigured build did not fail cleanly:\n${unconfigured}`);

  const setup = run(["setup", TARGET]);
  assertContains(setup, "DIRF configured:");
  assertContains(setup, "Capability gaps:");
  assertContains(run(["setup", TARGET]), "Already configured; no files changed.");
  assertContains(readFileSync(join(TARGET, ".gitignore"), "utf8"), ".dirf/attempts/");

  let out = run(["build", "smoke", "build a landing page", "--path", TARGET]);
  assertContains(out, "Attempt saved:");
  assertContains(out, "Spec kit rendered:");
  assertContains(run(["create", "smoke", "build a landing page", "--path", TARGET]), "Attempt saved:");

  const attemptsRoot = join(TARGET, ".dirf", "attempts");
  const smokeAttempts = readdirSync(attemptsRoot).filter((name) => JSON.parse(readFileSync(join(attemptsRoot, name, "attempt.json"), "utf8")).name === "smoke");
  if (smokeAttempts.length !== 2) throw new Error(`expected two isolated smoke attempts, got ${smokeAttempts.length}`);
  const attemptId = smokeAttempts.find((name) => existsSync(join(attemptsRoot, name, "README.md")));
  const attempt = join(attemptsRoot, attemptId);
  const wfJson = join(attempt, "workflow.json");
  const readme = join(attempt, "README.md");
  const html = join(attempt, "instructions.html");
  const detail = join(attempt, "agents", "frontend-developer.md");
  for (const path of [wfJson, readme, html, detail]) if (!existsSync(path)) throw new Error(`missing expected output: ${path}`);

  const readmeText = readFileSync(readme, "utf8");
  for (const text of ["Definition of Done", "Agent roster", "Capabilities", "Idea to ship"]) assertContains(readmeText, text);
  if (/codex|claude/i.test(readmeText)) throw new Error("host-specific agent leaked into operating instructions");

  const snapshotText = readFileSync(wfJson, "utf8");
  const snapshot = JSON.parse(snapshotText);
  if (snapshot.schema_version !== 5) throw new Error("attempt did not use schema version 5");
  if ("path" in snapshot || snapshotText.includes(TARGET)) throw new Error("target path leaked into portable snapshot");
  assertContains(run(["migrate", "smoke", "--path", TARGET]), "portable schema version 5");
  assertContains(run(["validate", attempt]), "Folder validation passed");
  assertContains(run(["graph", attempt]), "[workflow] smoke");

  if (!readFileSync(html, "utf8").startsWith("<!doctype html>")) throw new Error("HTML missing doctype");
  assertContains(run(["render", "smoke", "--path", TARGET]), "Spec kit rendered:");
  assertContains(run(["list", "--path", TARGET]), attemptId);
  run(["render", "does-not-exist-xyz", "--path", TARGET], true);

  console.log("Smoke test passed");
} finally {
  rmSync(TARGET, { recursive: true, force: true });
}
