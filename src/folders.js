// Eve-style filesystem units: README source, ordered DAG composition, HTML view.
import { existsSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const KINDS = new Set(["skill", "tool", "playbook", "workflow"]);
const ALLOWED_USES = {
  tool: new Set(["tool"]),
  skill: new Set(["skill", "tool"]),
  playbook: new Set(["skill", "playbook", "workflow"]),
  workflow: KINDS,
};

function value(text) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try { return JSON.parse(trimmed); } catch { /* keep scalar */ }
  }
  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
}

export function parseUnitReadme(text, path = "README.md") {
  if (!text.startsWith("---")) throw new Error(`${path}: missing frontmatter`);
  const end = text.indexOf("\n---", 3);
  if (end < 0) throw new Error(`${path}: missing closing frontmatter fence`);
  const meta = {};
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) meta[match[1]] = value(match[2]);
  }
  if (!meta.name) throw new Error(`${path}: missing name`);
  if (!KINDS.has(meta.kind)) throw new Error(`${path}: kind must be skill, tool, playbook, or workflow`);
  for (const field of ["uses", "details", "inputs", "outputs", "capabilities"]) {
    if (meta[field] === undefined) meta[field] = [];
    if (!Array.isArray(meta[field])) throw new Error(`${path}: ${field} must be a JSON array`);
  }
  return { meta, body: text.slice(end + 4).trim(), path };
}

export function loadUnit(folder) {
  const absolute = resolve(folder);
  const readme = join(absolute, "README.md");
  if (!existsSync(readme)) throw new Error(`${absolute}: missing README.md`);
  return { ...parseUnitReadme(readFileSync(readme, "utf-8"), readme), folder: realpathSync(absolute) };
}

function inside(path, roots) {
  const target = path.toLowerCase();
  return roots.some((root) => target === root.toLowerCase() || target.startsWith(root.toLowerCase() + "\\") || target.startsWith(root.toLowerCase() + "/"));
}

export function resolveGraph(entryFolder, options = {}) {
  const entry = realpathSync(resolve(entryFolder));
  const roots = (options.allowedRoots || [entry]).map((root) => realpathSync(resolve(root)));
  const visiting = new Set(), visited = new Set(), ordered = [];
  function visit(folder, chain) {
    const canonical = realpathSync(resolve(folder));
    if (!inside(canonical, roots)) throw new Error(`reference escapes allowed roots: ${canonical}`);
    if (visiting.has(canonical)) throw new Error(`folder cycle: ${[...chain, canonical].join(" -> ")}`);
    if (visited.has(canonical)) return;
    visiting.add(canonical);
    const unit = loadUnit(canonical);
    for (const detail of unit.meta.details) {
      const detailPath = resolve(canonical, detail);
      if (!inside(detailPath, roots)) throw new Error(`${unit.meta.name}: detail escapes allowed roots: ${detail}`);
      if (!existsSync(detailPath)) throw new Error(`${unit.meta.name}: missing detail ${detail}`);
    }
    for (const reference of unit.meta.uses) {
      const child = isAbsolute(reference) ? reference : resolve(canonical, reference);
      const childUnit = loadUnit(child);
      if (!ALLOWED_USES[unit.meta.kind].has(childUnit.meta.kind)) {
        throw new Error(`${unit.meta.kind} ${unit.meta.name} cannot use ${childUnit.meta.kind} ${childUnit.meta.name}`);
      }
      visit(child, [...chain, canonical]);
    }
    visiting.delete(canonical);
    visited.add(canonical);
    ordered.push(unit);
  }
  visit(entry, []);
  return ordered;
}

export function graphLines(units) {
  return units.map((unit, index) => `${index + 1}. [${unit.meta.kind}] ${unit.meta.name} -> ${unit.folder}`);
}

export function renderFolderHtml(units) {
  const escape = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const sections = units.map((unit) => `<details open><summary>${escape(unit.meta.kind)}: ${escape(unit.meta.name)}</summary><pre>${escape(unit.body)}</pre></details>`).join("\n");
  return `<!doctype html><meta charset="utf-8"><title>DIRF folder graph</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;background:#0a0213;color:#cbd5e1}details{margin:12px 0;padding:12px;border:1px solid #2e1065}summary{color:#f1f5f9}pre{white-space:pre-wrap}</style><h1>DIRF folder graph</h1>${sections}`;
}

export function loadPlaybookFolders(root) {
  if (!existsSync(root)) return {};
  const playbooks = {};
  const units = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const unit = loadUnit(join(root, entry.name));
    if (unit.meta.kind !== "playbook") throw new Error(`${unit.path}: expected kind playbook`);
    const config = unit.meta.config;
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error(`${unit.path}: playbook requires JSON object config`);
    units.push({ unit, config });
  }
  units.sort((a, b) => Number(a.unit.meta.order ?? Number.MAX_SAFE_INTEGER) - Number(b.unit.meta.order ?? Number.MAX_SAFE_INTEGER) || a.unit.meta.name.localeCompare(b.unit.meta.name));
  for (const { unit, config } of units) playbooks[unit.meta.name] = config;
  return playbooks;
}
