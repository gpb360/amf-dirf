import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAttempt, findAttempt, listAttempts, loadProjectConfig, setupProject } from "../src/project.js";

function project() {
  return mkdtempSync(join(tmpdir(), "dirf-project-"));
}

const TIMEOUT_MS = 30_000;

test("setup creates the minimum tracked contract and is idempotent", () => {
  const root = project();
  const first = setupProject(root);
  const before = readFileSync(join(root, ".dirf", "config.json"), "utf8");
  const second = setupProject(root);

  assert.equal(first.created.length, 6);
  assert.deepEqual(second.created, []);
  assert.equal(readFileSync(join(root, ".dirf", "config.json"), "utf8"), before);
  assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^\.dirf\/attempts\/$/m);
  assert.ok(existsSync(join(root, "docs", "agents", "domain", "CONTEXT.md")));
  assert.ok(existsSync(join(root, "docs", "agents", "issues", "tickets.md")));

  const config = loadProjectConfig(root);
  assert.equal(config.tracker.provider, "local");
  assert.equal(config.context.mode, "single");
  assert.equal(config.attempt_root, ".dirf/attempts");
});

test("setup reuses existing context and ADR locations without overwriting", () => {
  const root = project();
  mkdirSync(join(root, "docs", "adr"), { recursive: true });
  writeFileSync(join(root, "docs", "CONTEXT.md"), "existing context\n");

  setupProject(root, { context: "multi" });
  const config = loadProjectConfig(root);

  assert.equal(config.context.path, "docs/CONTEXT.md");
  assert.equal(config.context.mode, "multi");
  assert.equal(config.adr_path, "docs/adr");
  assert.equal(readFileSync(join(root, "docs", "CONTEXT.md"), "utf8"), "existing context\n");
});

test("attempts are timestamped, portable, and resolved by id or latest name", () => {
  const root = project();
  setupProject(root);
  const first = createAttempt(root, "Demo Run", new Date("2026-07-18T10:00:00.000Z"));
  const second = createAttempt(root, "Demo Run", new Date("2026-07-18T11:00:00.000Z"));

  assert.equal(first.id, "20260718T100000000Z-demo-run");
  assert.equal(second.relativePath, ".dirf/attempts/20260718T110000000Z-demo-run");
  assert.equal(findAttempt(root, first.id).id, first.id);
  assert.equal(findAttempt(root, "Demo Run").id, second.id);
  assert.deepEqual(listAttempts(root).map((attempt) => attempt.id), [first.id, second.id]);
  assert.equal(readFileSync(join(second.folder, "attempt.json"), "utf8").includes(root), false);
});

test("same-millisecond attempts receive deterministic collision suffixes", () => {
  const root = project();
  setupProject(root);
  const now = new Date("2026-07-18T10:00:00.000Z");

  const first = createAttempt(root, "demo", now);
  const second = createAttempt(root, "demo", now);

  assert.equal(first.id, "20260718T100000000Z-demo");
  assert.equal(second.id, "20260718T100000000Z-demo-02");
});

test("setup rejects configured write paths outside the target", () => {
  const root = project();
  setupProject(root);
  const configPath = join(root, ".dirf", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.tracker.tickets_path = "../../outside.md";
  writeFileSync(configPath, JSON.stringify(config));

  assert.throws(() => setupProject(root), /tickets path must stay inside/);
});

test("setup accepts names beginning with two dots when they remain inside", () => {
  const root = project();
  setupProject(root);
  const configPath = join(root, ".dirf", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.tracker.tickets_path = "..tickets.md";
  writeFileSync(configPath, JSON.stringify(config));

  assert.equal(loadProjectConfig(root).tracker.tickets_path, "..tickets.md");
});

test("Git sees setup docs but ignores attempts and renders", () => {
  const root = project();
  execFileSync("git", ["init", "-q"], { cwd: root, timeout: TIMEOUT_MS });
  setupProject(root);
  const attempt = createAttempt(root, "demo");
  writeFileSync(join(attempt.folder, "render.mp4"), "render");

  const status = execFileSync("git", ["status", "--short", "--untracked-files=all"], { cwd: root, encoding: "utf8", timeout: TIMEOUT_MS });
  assert.match(status, /\.dirf\/config\.json/);
  assert.match(status, /docs\/agents\/domain\/CONTEXT\.md/);
  assert.doesNotMatch(status, /\.dirf\/attempts/);
  assert.match(execFileSync("git", ["check-ignore", "-q", ".dirf/attempts/"], { cwd: root, encoding: "utf8", timeout: TIMEOUT_MS }), /^$/);
});

test("attempt creation fails before setup", () => {
  assert.throws(() => createAttempt(project(), "demo"), /dirf setup/);
});
