#!/usr/bin/env node
// amf-dirf — Agent Spec Kit (Do It Right First). Unified CLI. Node built-ins only.
//
//   dirf build  <name> "<task>" [--path DIR] [--open]   full pipeline: route -> JSON -> lean md + html
//   dirf create <name> "<task>" [--path DIR]             route -> workflow JSON only
//   dirf render <name> [--open]                          existing JSON -> lean md + html
//   dirf list                                            list saved workflows
//   dirf validate                                        validate registries + workflows
//   dirf skills scan                                     scan host, print installed skills + resolved refs
//   dirf validate|graph|run|render <folder>               operate an Eve-style folder DAG
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join, isAbsolute, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { ROOT, REGISTRY, SKILLS, PLAYBOOKS, POLICY, WORKFLOW_DIR, fileHash, loadJson, workflowOutputDir, workflowPath } from "./paths.js";
import { collectRoutingFacts, loadPlaybooks, recommend } from "./router.js";
import { discover, enrichDiscovered, loadRegistry, loadTrustedSources, providerForPath, resolveAgentSkills } from "./skills.js";
import { buildInstructions, buildHtml } from "./renderer.js";
import { main as validateMain } from "./validate.js";
import { inspect } from "./inspect.js";
import { buildFlow, reconcile } from "./flow.js";
import { graphLines, renderFolderHtml, resolveGraph } from "./folders.js";

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
  const { selection, skillFlow, discovered, facts } = assembleTaskRouting(task, path);
  const agents = enrichAgents(selection.agents).map((agent) => ({
    ...agent,
    skills: resolveAgentSkills(agent.name, agent.skills, [], discovered).filter((skill) => skill.status === "installed"),
  }));
  const now = new Date().toISOString();
  return {
    schema_version: 4,
    name,
    task,
    playbook: selection.playbook,
    playbook_description: selection.playbook_description,
    score: selection.score,
    matched_keywords: selection.matched_keywords,
    alternates: selection.alternates,
    workflow: selection.workflow,
    routing_facts: facts,
    skill_flow: skillFlow,
    capability_gaps: skillFlow.gaps,
    agents,
    baseline_skills: [],
    questions: selection.questions,
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

function portableReference(value) {
  if (!value || typeof value !== "object") return value;
  const out = { ...value };
  if (!out.provider && (out.path || out.configured_in)) out.provider = providerForPath(out.path || out.configured_in);
  delete out.path;
  delete out.configured_in;
  return out;
}

function portablePlan(plan) {
  const out = structuredClone(plan);
  out.schema_version = 4;
  delete out.path;
  out.baseline_skills = (out.baseline_skills || []).map(portableReference);
  out.agents = (out.agents || []).map((agent) => ({ ...agent, skills: (agent.skills || []).map(portableReference) }));
  out.skill_flow.steps = (out.skill_flow.steps || []).map(portableReference);
  out.skill_flow.gaps = (out.skill_flow.gaps || []).map((gap) => ({
    ...gap,
    trusted_candidates: (gap.trusted_candidates || []).map(portableReference),
  }));
  out.capability_gaps = out.skill_flow.gaps;
  return out;
}

function assembleTaskRouting(task, path) {
  const playbooks = loadPlaybooks();
  const errors = reconcile(playbooks);
  if (errors.length) throw new Error(`Task Routing reconciliation failed:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
  const projectRoot = path ? (isAbsolute(path) ? path : resolve(ROOT, path)) : null;
  const facts = collectRoutingFacts(projectRoot);
  const selection = recommend(task, facts, playbooks);
  const discovered = enrichDiscovered(discover(projectRoot));
  const trustedSources = loadTrustedSources(projectRoot);
  return { selection, discovered, facts, skillFlow: buildFlow(selection, { task, trustedSources }, discovered) };
}

function savePlan(plan) {
  const path = workflowPath(plan.name);
  writeFileSync(path, JSON.stringify(portablePlan(plan), null, 2), "utf-8");
  return path;
}

function renderPlan(planPath, openBrowser = false) {
  const plan = JSON.parse(readFileSync(planPath, "utf-8"));
  const outDir = workflowOutputDir(plan.name);
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

function cmdMigrate(name) {
  const paths = name
    ? [workflowPath(name)]
    : readdirSync(WORKFLOW_DIR).filter((file) => file.endsWith(".json")).map((file) => join(WORKFLOW_DIR, file));
  for (const path of paths) {
    if (!existsSync(path)) throw new Error(`No workflow named ${JSON.stringify(name)}`);
    const plan = portablePlan(JSON.parse(readFileSync(path, "utf-8")));
    writeFileSync(path, JSON.stringify(plan, null, 2), "utf-8");
    if (existsSync(workflowOutputDir(plan.name))) renderPlan(path);
  }
  console.log(`Migrated ${paths.length} workflow snapshot(s) to portable schema version 4.`);
}

function cmdValidate() {
  validateMain();
}

function folderGraph(target) {
  const absolute = resolve(target);
  return resolveGraph(absolute, { allowedRoots: [ROOT, dirname(absolute)] });
}

function cmdFolderValidate(target) {
  const units = folderGraph(target);
  console.log(`Folder validation passed: ${units.length} unit(s)`);
}

function cmdGraph(target) {
  console.log(graphLines(folderGraph(target)).join("\n"));
}

function cmdRun(target) {
  const units = folderGraph(target);
  console.log("Execution order:");
  console.log(graphLines(units).join("\n"));
  console.log("\nExecution handoff:");
  for (const unit of units) console.log(`Read ${join(unit.folder, "README.md")}.`);
  console.log(`Execute ${join(resolve(target), "README.md")} as the root operating workflow.`);
}

function cmdFolderRender(target) {
  const units = folderGraph(target);
  const output = join(resolve(target), "instructions.html");
  writeFileSync(output, renderFolderHtml(units), "utf-8");
  console.log(`Folder rendered: ${output}`);
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

function cmdExportPlaybooks() {
  writeFileSync(PLAYBOOKS, JSON.stringify(loadPlaybooks(), null, 2) + "\n", "utf-8");
  console.log(`Compatibility playbook JSON exported: ${PLAYBOOKS}`);
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
  dirf validate <folder>                              validate a folder DAG
  dirf graph <folder>                                 print ordered folder DAG
  dirf run <folder>                                   print deterministic execution handoff
  dirf list                                            list saved workflows
  dirf migrate [<name>]                                remove runtime paths from saved snapshots
  dirf validate                                        validate registries
  dirf skills scan                                     show installed skills
  dirf export playbooks                                regenerate legacy playbooks JSON
  dirf inspect [<path>]                                detect a project's optimization stack + suggest gaps
  dirf flow "<task>" [--path DIR]                      show the ordered skill flow for a task (ask-matt style)
`;

function cmdFlow(args) {
  const task = args._.join(" ");
  if (!task) { console.error("usage: dirf flow \"<task>\" [--path DIR]"); process.exit(2); }
  const { skillFlow: flow } = assembleTaskRouting(task, args.path || null);
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
  else if (cmd === "render") {
    const target = args._[0];
    if (target && existsSync(resolve(target)) && !existsSync(workflowPath(target))) cmdFolderRender(target);
    else { args.name = target; cmdRender(args); }
  }
  else if (cmd === "list") cmdList();
  else if (cmd === "migrate") cmdMigrate(args._[0]);
  else if (cmd === "validate") args._[0] ? cmdFolderValidate(args._[0]) : cmdValidate();
  else if (cmd === "graph") cmdGraph(args._[0]);
  else if (cmd === "run") cmdRun(args._[0]);
  else if (cmd === "skills") {
    const sub = args._[0];
    if (sub === "scan") cmdSkillsScan();
    else { console.log("usage: dirf skills scan"); process.exit(2); }
  }
  else if (cmd === "export" && args._[0] === "playbooks") cmdExportPlaybooks();
  else if (cmd === "inspect") { args._ = args._.length ? args._ : [args.path]; cmdInspect(args); }
  else if (cmd === "flow") { cmdFlow(args); }
  else { console.error(`unknown command: ${cmd}\n\n${HELP}`); process.exit(2); }
}

main();
