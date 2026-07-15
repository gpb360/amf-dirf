#!/usr/bin/env node
// amf-dirf — Agent Spec Kit (Do It Right First). Unified CLI. Node built-ins only.
//
//   dirf build  <name> "<task>" [--path DIR] [--open]   full pipeline: route -> JSON -> lean md + html
//   dirf create <name> "<task>" [--path DIR]             route -> workflow JSON only
//   dirf render <name> [--open]                          existing JSON -> lean md + html
//   dirf list                                            list saved workflows
//   dirf validate                                        validate registries + workflows
//   dirf skills scan                                     scan host, print installed skills + resolved refs
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { REGISTRY, SKILLS, PLAYBOOKS, POLICY, WORKFLOW_DIR, fileHash, loadJson, workflowPath } from "./paths.js";
import { recommend } from "./router.js";
import { discover, loadRegistry } from "./skills.js";
import { buildInstructions, buildHtml } from "./renderer.js";
import { main as validateMain } from "./validate.js";
import { inspect } from "./inspect.js";
import { buildFlow } from "./flow.js";

function enrichAgents(agentNames) {
  // Resolve playbook agent names into full entries (file, tags, skills) from the registry.
  const registry = {};
  for (const a of loadJson(REGISTRY).agents) registry[a.name] = a;
  return agentNames.map((name) => {
    const a = registry[name];
    return a || { name, file: `agents/${name}.md`, tags: [], skills: [], missing: true };
  });
}

function buildPlan(name, task, path) {
  // Route + assemble the full workflow JSON (the schema source of truth).
  const rec = recommend(task);
  const agents = enrichAgents(rec.agents);
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    name,
    task,
    path: path || null,
    playbook: rec.playbook,
    playbook_description: rec.playbook_description,
    score: rec.score,
    matched_keywords: rec.matched_keywords,
    alternates: rec.alternates,
    workflow: rec.workflow,
    agents,
    baseline_skills: rec.baseline_skills,
    questions: rec.questions,
    policy: "policies/workflow-policy.md",
    state: { status: "created", starts: 0 },
    created_at: now,
    source_hashes: {
      agents_registry: fileHash(REGISTRY),
      skills: fileHash(SKILLS),
      playbooks: fileHash(PLAYBOOKS),
      policy: fileHash(POLICY),
    },
  };
}

function savePlan(plan) {
  const path = workflowPath(plan.name);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf-8");
  return path;
}

function renderPlan(planPath, openBrowser = false) {
  const plan = JSON.parse(readFileSync(planPath, "utf-8"));
  const outDir = join(dirname(planPath), "instructions");
  const written = buildInstructions(plan, outDir);
  const htmlPath = join(outDir, "instructions.html");
  writeFileSync(htmlPath, buildHtml(plan), "utf-8");
  written.push(htmlPath);
  console.log(`Spec kit rendered: ${htmlPath}`);
  if (openBrowser) openBrowserAt(htmlPath);
  return htmlPath;
}

function openBrowserAt(filePath) {
  // Zero-dep cross-platform open. Uses the platform's native handler.
  const url = `file://${filePath.replace(/\\/g, "/")}`;
  const cmd = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  console.log(`Opened: ${url}`);
}

function cmdBuild(args) {
  const plan = buildPlan(args.name, args.task, args.path);
  const planPath = savePlan(plan);
  console.log(`Workflow saved: ${planPath}`);
  renderPlan(planPath, args.open);
}

function cmdCreate(args) {
  const plan = buildPlan(args.name, args.task, args.path);
  const planPath = savePlan(plan);
  console.log(`Workflow saved: ${planPath}`);
  console.log(`Routed to playbook: ${plan.playbook} (score ${plan.score})`);
}

function cmdRender(args) {
  const planPath = workflowPath(args.name);
  if (!existsSync(planPath)) {
    console.error(`No workflow named ${JSON.stringify(args.name)} (looked for ${planPath})`);
    process.exit(2);
  }
  renderPlan(planPath, args.open);
}

function cmdList() {
  let names = [];
  try { names = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort(); } catch { /* none */ }
  if (!names.length) { console.log("(no workflows saved)"); return; }
  console.log("Saved workflows:");
  for (const n of names) console.log(`  - ${n}`);
}

function cmdValidate() {
  validateMain();
}

function cmdSkillsScan() {
  const idx = discover();
  console.log(`Discovered ${Object.keys(idx).length} installed skills across scanned roots.`);
  console.log("\nRegistry references resolved:");
  for (const ref of loadRegistry().skills || []) {
    const hit = idx[ref.name];
    const status = hit ? "installed" : "recommended (not installed)";
    const loc = hit ? ` -> ${hit.path}` : "";
    console.log(`  ${ref.name.padEnd(24)} ${status}${loc}`);
  }
}

// --- minimal arg parser (no dep) ---
function parse(argv) {
  const [cmd, ...rest] = argv;
  const out = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--path") { out.path = rest[++i]; continue; }
    if (a === "--open") { out.open = true; continue; }
    if (a === "--help" || a === "-h") { out.help = true; continue; }
    out._.push(a);
  }
  return { cmd, args: out };
}

const HELP = `amf-dirf — Agent Spec Kit (Do It Right First)

Usage:
  dirf build  <name> "<task>" [--path DIR] [--open]   full pipeline
  dirf create <name> "<task>" [--path DIR]             JSON only
  dirf render <name> [--open]                          re-render existing
  dirf list                                            list saved workflows
  dirf validate                                        validate registries
  dirf skills scan                                     show installed skills
  dirf inspect [<path>]                                detect a project's optimization stack + suggest gaps
  dirf flow "<task>" [--path DIR]                      show the ordered skill flow for a task (ask-matt style)
`;

function cmdFlow(args) {
  const task = args._.join(" ");
  if (!task) { console.error("usage: dirf flow \"<task>\" [--path DIR]"); process.exit(2); }
  const flow = buildFlow(task, args.path || null);
  console.log(`Flow: ${flow.label}`);
  console.log(`Playbook: ${flow.playbook}${flow.branches.length ? ` (branches: ${flow.branches.join(", ")})` : ""}\n`);
  let lastStage = "";
  for (const s of flow.steps) {
    if (s.stage !== lastStage) { console.log(`\n[${s.stage}]`); lastStage = s.stage; }
    const mark = s.status === "installed" ? "✅" : "⚠️";
    const note = s.status === "installed" ? "" : " (recommended — not installed)";
    console.log(`  ${mark} ${s.skill}${note}`);
    console.log(`      ${s.reason}`);
  }
}

function cmdInspect(args) {
  const target = args._[0] || args.path || ".";
  const { findings, suggestions, summary } = inspect(target);
  console.log(`Inspected: ${target}`);
  console.log(`Summary: ${summary}\n`);

  // group findings by category
  const byCat = {};
  for (const f of findings) (byCat[f.category] ||= []).push(f);
  for (const [cat, items] of Object.entries(byCat)) {
    console.log(`[${cat}]`);
    for (const f of items) console.log(`  ✅ ${f.item} — ${f.path}`);
    console.log("");
  }

  if (suggestions.length) {
    console.log("Suggestions (deterministic — based on detected gaps):");
    for (const s of suggestions) {
      console.log(`\n  [${s.priority}] ${s.gap}`);
      console.log(`      → ${s.suggestion}`);
    }
  } else {
    console.log("No gaps detected — the optimization stack looks complete.");
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "--help" || argv[0] === "-h") { console.log(HELP); return; }
  const { cmd, args } = parse(argv);
  if (args.help) { console.log(HELP); return; }

  if (cmd === "build") { args.name = args._[0]; args.task = args._.slice(1).join(" "); cmdBuild(args); }
  else if (cmd === "create") { args.name = args._[0]; args.task = args._.slice(1).join(" "); cmdCreate(args); }
  else if (cmd === "render") { args.name = args._[0]; cmdRender(args); }
  else if (cmd === "list") cmdList();
  else if (cmd === "validate") cmdValidate();
  else if (cmd === "skills") {
    const sub = args._[0];
    if (sub === "scan") cmdSkillsScan();
    else { console.log("usage: dirf skills scan"); process.exit(2); }
  }
  else if (cmd === "inspect") { args._ = args._.length ? args._ : [args.path]; cmdInspect(args); }
  else if (cmd === "flow") { cmdFlow(args); }
  else { console.error(`unknown command: ${cmd}\n\n${HELP}`); process.exit(2); }
}

main();
