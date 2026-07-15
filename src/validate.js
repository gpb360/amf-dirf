// Single validator for amf-dirf. Node built-ins only. Never cut the guards.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { AGENTS_DIR, REGISTRY, SKILLS, PLAYBOOKS, POLICY, WORKFLOW_DIR, loadJson } from "./paths.js";

const FM_RE = /^([A-Za-z0-9_-]+):\s*(.*)$/;

const REQUIRED_PLAN_KEYS = {
  name: "string", task: "string", playbook: "string", playbook_description: "string",
  agents: "object", baseline_skills: "object", questions: "object", policy: "string",
};

function parseFrontmatter(path) {
  const text = readFileSync(path, "utf-8");
  if (!text.startsWith("---\n")) throw new Error("missing opening frontmatter fence");
  const end = text.indexOf("\n---", 4);
  if (end === -1) throw new Error("missing closing frontmatter fence");
  const fields = {};
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    const m = FM_RE.exec(line);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

export function main() {
  const errors = [];
  const warnings = [];

  // --- agents ---
  const agentsReg = loadJson(REGISTRY);
  const seenMd = {};

  let mdFiles = [];
  try { mdFiles = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md")).sort(); } catch { /* none */ }
  for (const md of mdFiles) {
    try {
      const fm = parseFrontmatter(join(AGENTS_DIR, md));
      for (const key of ["name", "description", "tools"]) {
        if (!(key in fm)) errors.push(`${md}: missing frontmatter field ${key}`);
      }
      seenMd[fm.name || md.replace(/\.md$/, "")] = md;
    } catch (exc) {
      errors.push(`${md}: ${exc.message}`);
    }
  }

  const registryNames = new Set();
  for (const a of (agentsReg.agents || [])) {
    registryNames.add(a.name);
    const fp = a.file || "";
    const base = fp.split("/").pop();
    if (!fp || !fp.endsWith(".md")) errors.push(`agent ${a.name}: file must be markdown, got ${JSON.stringify(fp)}`);
    if (!existsSync(join(AGENTS_DIR, base))) errors.push(`agent ${a.name}: markdown missing at ${fp}`);
    if (!("skills" in a)) warnings.push(`agent ${a.name}: no skills field`);
  }

  // --- skills ---
  const skillsReg = loadJson(SKILLS);
  const skillNames = new Set((skillsReg.skills || []).map((s) => s.name));
  for (const s of (skillsReg.skills || [])) {
    for (const key of ["name", "category", "applies_to", "summary"]) {
      if (!(key in s)) warnings.push(`skill ${s.name || "?"}: missing ${key}`);
    }
  }

  // --- playbooks ---
  const playbooks = loadJson(PLAYBOOKS);
  for (const [name, pb] of Object.entries(playbooks)) {
    for (const key of ["description", "keywords", "agents", "workflow"]) {
      if (!pb[key]) errors.push(`playbook ${name}: missing ${key}`);
    }
    if (!("baseline_skills" in pb)) warnings.push(`playbook ${name}: no baseline_skills`);
    for (const an of (pb.agents || [])) {
      if (!registryNames.has(an)) errors.push(`playbook ${name}: references unknown agent ${an}`);
    }
    for (const sn of (pb.baseline_skills || [])) {
      if (!skillNames.has(sn)) warnings.push(`playbook ${name}: baseline skill ${sn} not in registry`);
    }
  }

  // --- workflow JSONs ---
  let wfFiles = [];
  try { wfFiles = readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".json")).sort(); } catch { /* none */ }
  for (const wp of wfFiles) {
    const data = loadJson(join(WORKFLOW_DIR, wp));
    for (const [key, typ] of Object.entries(REQUIRED_PLAN_KEYS)) {
      if (!(key in data)) errors.push(`${wp}: missing required key ${key}`);
      else if (typeof data[key] !== typ || (typ === "object" && !Array.isArray(data[key]))) {
        errors.push(`${wp}: key ${key} must be ${typ}`);
      }
    }
    for (const a of (data.agents || [])) {
      if (typeof a !== "object" || typeof a.name !== "string") errors.push(`${wp}: agent entry malformed`);
      else if (!registryNames.has(a.name) && !a.missing) errors.push(`${wp}: references unknown agent ${a.name}`);
    }
  }

  if (!existsSync(POLICY)) errors.push("policies/workflow-policy.md missing");

  if (errors.length) {
    console.log("Validation failed:");
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }
  if (warnings.length) {
    console.log("Validation warnings:");
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(`Validation passed: ${registryNames.size} agents, ${Object.keys(playbooks).length} playbooks, ${skillNames.size} skills`);
}

// Standalone entry: `node src/validate.js` (cli.js calls main() directly).
import { pathToFileURL } from "node:url";
if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
