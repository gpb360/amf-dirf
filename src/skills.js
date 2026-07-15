// Agnostic skill discovery + resolver. Node built-ins only.
//
// The kit never hardcodes skills. This module scans the host environment for
// installed skill folders (there can be several), builds an index of what's
// actually present, and resolves the curated registry references against it.
//
// A referenced skill that isn't installed is flagged "recommended" — never fatal.
//
// Discovery is broadened to fix blind spots from the parent repo:
//   - read SKILL.md first, fall back to skill.json then README.md frontmatter
//     (catches skills like ui-ux-pro-max that ship no SKILL.md)
//   - scan ~/.zcode/.../skills roots too (catches skills like superpowers)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadJson, SKILLS, ROOT } from "./paths.js";

// Home roots (resolved at call time). The zcode cache holds versioned plugin
// dirs whose skills live under nested subfolders, so we recurse into it.
const HOME_ROOT_NAMES = [
  ".agents/skills",
  ".codex/skills",
  ".claude/skills",
  ".zcode/cli/plugins/cache",
];
const PROJECT_ROOT_NAMES = [".agents/skills", ".codex/skills", ".claude/skills", "skills"];

// Candidate files inside a skill folder, in priority order.
const SKILL_FILES = ["SKILL.md", "skill.json", "README.md"];
const FM_RE = /^([A-Za-z0-9_-]+):\s*(.*)$/;

function skillRoots(projectRoot) {
  // Return all skill scan roots that exist on disk.
  // projectRoot null/undefined defaults to ROOT (the kit's own roots).
  if (!projectRoot) projectRoot = ROOT;
  const roots = [];
  const home = homedir();
  for (const name of HOME_ROOT_NAMES) {
    const candidate = join(home, name);
    if (isDir(candidate)) roots.push(candidate);
  }
  for (const name of PROJECT_ROOT_NAMES) {
    const candidate = join(projectRoot, name);
    if (isDir(candidate)) roots.push(candidate);
  }
  return roots;
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function parseFrontmatter(text) {
  // Tolerant YAML-ish frontmatter parser (no dependency).
  const fields = {};
  if (!text.startsWith("---")) return fields;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return fields;
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    const m = FM_RE.exec(line);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

function readSkillFile(path) {
  // Read a skill definition file. Returns [name, fieldsObj].
  let text;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return ["", {}];
  }
  if (path.endsWith(".json")) {
    try {
      const data = JSON.parse(text);
      if (data && typeof data === "object") return [String(data.name || basenameDir(path)), data];
    } catch {
      /* fall through */
    }
    return ["", {}];
  }
  const fm = parseFrontmatter(text);
  return [fm.name || basenameDir(path), fm];
}

function basenameDir(path) {
  // parent folder name fallback for skill identity.
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 2] || "skill";
}

export function discover(projectRoot) {
  // Scan all roots and return an index: { skillName: { path, file, ... } }.
  // projectRoot null/undefined defaults to ROOT. Scans:
  //   1. the standard home + project roots (skillRoots)
  //   2. any directory named `skills` under the project root (auto-detect, so
  //      projects with non-standard layouts like `audit-runtime/skills/` are
  //      found without configuration — the agnostic principle)
  const index = {};
  for (const root of skillRoots(projectRoot)) {
    if (root.includes("cache")) {
      scanRecursive(root, index);
    } else {
      scanFlat(root, index);
    }
  }
  if (projectRoot) {
    for (const root of findSkillFolders(projectRoot)) {
      scanFlat(root, index);
    }
  }
  return index;
}

function findSkillFolders(projectRoot) {
  // Auto-detect any directory named `skills` under the project root (one level
  // of parent nesting: <root>/X/skills and <root>/skills). Returns absolute
  // paths. Skips node_modules, .git, and the standard roots already scanned.
  const out = [];
  const skip = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);
  let top;
  try {
    top = readdirSync(projectRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  // <root>/skills
  if (isDir(join(projectRoot, "skills"))) out.push(join(projectRoot, "skills"));
  // <root>/<dir>/skills
  for (const entry of top) {
    if (!entry.isDirectory() || skip.has(entry.name)) continue;
    const skillsDir = join(projectRoot, entry.name, "skills");
    if (isDir(skillsDir)) out.push(skillsDir);
  }
  return out;
}

function scanFlat(root, index) {
  // non-recursive: each immediate subdir is a skill folder.
  let entries;
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const child of entries.sort()) {
    const dir = join(root, child);
    if (!isDir(dir)) continue;
    for (const fname of SKILL_FILES) {
      const target = join(dir, fname);
      if (existsSync(target)) {
        indexOne(target, index);
        break;
      }
    }
  }
}

function scanRecursive(root, index) {
  // recursive: find any SKILL.md / skill.json / README.md under the cache.
  const seen = new Set();
  const hit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    indexOne(path, index);
  };
  for (const path of walkFiles(root)) {
    const base = path.replace(/\\/g, "/").split("/").pop();
    if (base === "SKILL.md" || base === "skill.json") hit(path);
    else if (base === "README.md") hit(path);
  }
}

function walkFiles(dir, out = []) {
  // recursive file list (built-in readdirSync recursive is {recursive:true} on Node 20+).
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walkFiles(full, out);
      else if (e.isFile()) out.push(full);
    }
  } catch {
    /* permission errors etc — skip */
  }
  return out;
}

function indexOne(path, index) {
  const [name, fm] = readSkillFile(path);
  if (!name) return;
  const desc = typeof fm === "object" ? fm.description || "" : "";
  // First found wins (SKILL.md priority order), but keep richer descriptions.
  const existing = index[name];
  if (existing && !desc) return;
  index[name] = { name, path: path.replace(/\\/g, "/").replace(/\/[^/]+$/, ""), file: path.replace(/\\/g, "/").split("/").pop(), description: desc };
}

export function loadRegistry() {
  return loadJson(SKILLS);
}

export function resolveAgentSkills(agentName, agentSkillRefs, baselineSkillRefs, discovered) {
  // Resolve one agent's skills (its own refs + baseline) against the index.
  // Returns a de-duplicated list (preserving order), each:
  //   { name, status, summary, category, path? }
  // status is "installed" | "recommended".
  if (discovered === undefined) discovered = discover();
  const registry = {};
  for (const s of loadRegistry().skills || []) registry[s.name] = s;

  const seen = new Set();
  const out = [];
  for (const ref of [...(agentSkillRefs || []), ...(baselineSkillRefs || [])]) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const entry = registry[ref] || {};
    const installed = discovered[ref];
    const item = {
      name: ref,
      status: installed ? "installed" : "recommended",
      summary: entry.summary || (installed ? installed.description || "" : ""),
      category: entry.category || "",
    };
    if (installed) item.path = installed.path;
    out.push(item);
  }
  return out;
}
