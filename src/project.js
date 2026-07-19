import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const CONFIG_PATH = join(".dirf", "config.json");
const ATTEMPT_IGNORE = ".dirf/attempts/";

function portable(path) {
  return path.replaceAll("\\", "/");
}

function writeMissing(root, relativePath, content, created) {
  const path = join(root, relativePath);
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  created.push(portable(relativePath));
}

export function projectRoot(path = process.cwd()) {
  return resolve(path || process.cwd());
}

function containedPath(root, value, label) {
  if (typeof value !== "string" || !value || isAbsolute(value)) throw new Error(`${label} must be target-relative`);
  const path = resolve(root, value);
  const escapes = (from, to) => {
    const rel = relative(from, to);
    return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  };
  if (escapes(root, path)) throw new Error(`${label} must stay inside the target repository`);
  let ancestor = path;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (escapes(realpathSync(root), realpathSync(ancestor))) throw new Error(`${label} must not traverse a link outside the target repository`);
  return path;
}

function existingDirectory(root, candidates) {
  return candidates.find((candidate) => {
    try { return statSync(join(root, candidate)).isDirectory(); } catch { return false; }
  });
}

function existingFile(root, candidates) {
  return candidates.find((candidate) => {
    try { return statSync(join(root, candidate)).isFile(); } catch { return false; }
  });
}

export function loadProjectConfig(root = process.cwd()) {
  const path = join(projectRoot(root), CONFIG_PATH);
  if (!existsSync(path)) throw new Error(`DIRF is not configured here. Run: dirf setup "${projectRoot(root)}"`);
  const config = JSON.parse(readFileSync(path, "utf8"));
  if (config.schema_version !== 1) throw new Error(`Unsupported DIRF config schema ${config.schema_version}`);
  const reservePercent = config.context?.reserve_percent ?? 5;
  if (!Number.isInteger(reservePercent) || reservePercent < 1 || reservePercent > 50) {
    throw new Error("DIRF context reserve_percent must be an integer from 1 to 50");
  }
  config.context.reserve_percent = reservePercent;
  containedPath(projectRoot(root), config.attempt_root, "DIRF attempt_root");
  containedPath(projectRoot(root), config.context?.path, "DIRF context path");
  containedPath(projectRoot(root), config.adr_path, "DIRF ADR path");
  containedPath(projectRoot(root), config.tracker?.specs_path, "DIRF specs path");
  containedPath(projectRoot(root), config.tracker?.tickets_path, "DIRF tickets path");
  return config;
}

export function setupProject(root = process.cwd(), options = {}) {
  root = projectRoot(root);
  const tracker = options.tracker || "local";
  const contextMode = options.context || "single";
  const reservePercent = options.reservePercent ?? 5;
  if (tracker !== "local") throw new Error(`Unsupported tracker ${tracker}; installed tracker adapters are not configured yet`);
  if (!new Set(["single", "multi"]).has(contextMode)) throw new Error("context must be single or multi");
  if (!Number.isInteger(reservePercent) || reservePercent < 1 || reservePercent > 50) throw new Error("reserve-percent must be an integer from 1 to 50");

  const created = [];
  const existingConfig = existsSync(join(root, CONFIG_PATH)) ? loadProjectConfig(root) : null;
  const contextPath = existingConfig?.context.path || existingFile(root, ["CONTEXT.md", "docs/CONTEXT.md", "docs/context.md"]) || "docs/agents/domain/CONTEXT.md";
  const adrPath = existingConfig?.adr_path || existingDirectory(root, ["docs/adr", "adr", "docs/architecture/decisions", "docs/decisions"]) || "docs/agents/domain/adr";
  const config = existingConfig || {
    schema_version: 1,
    tracker: {
      provider: tracker,
      specs_path: "docs/agents/issues/specs",
      tickets_path: "docs/agents/issues/tickets.md",
    },
    context: { mode: contextMode, path: contextPath, reserve_percent: reservePercent },
    adr_path: adrPath,
    attempt_root: ATTEMPT_IGNORE.slice(0, -1),
  };

  writeMissing(root, CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", created);
  const gitignore = join(root, ".gitignore");
  const ignored = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  if (!ignored.split(/\r?\n/).includes(ATTEMPT_IGNORE)) {
    writeFileSync(gitignore, `${ignored}${ignored && !ignored.endsWith("\n") ? "\n" : ""}${ATTEMPT_IGNORE}\n`, "utf8");
    created.push(".gitignore");
  }
  writeMissing(root, contextPath, "# Project Context\n\nRecord stable domain language and constraints here.\n", created);
  writeMissing(root, join(adrPath, "README.md"), "# Architecture Decisions\n\nRecord hard-to-reverse decisions as numbered Markdown files.\n", created);
  writeMissing(root, join(config.tracker.specs_path, "README.md"), "# Specifications\n\nDurable destination documents for multi-session work.\n", created);
  writeMissing(root, config.tracker.tickets_path, "# Tickets\n\nDependency-ordered implementation slices.\n", created);
  return { root, config: loadProjectConfig(root), created };
}

function slug(value) {
  const result = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "");
  if (!result) throw new Error("attempt name must contain alphanumeric characters");
  return result;
}

function timestamp(now) {
  return now.toISOString().replace(/[-:]/g, "").replace(".", "");
}

export function createAttempt(root, name, now = new Date()) {
  root = projectRoot(root);
  const config = loadProjectConfig(root);
  const baseId = `${timestamp(now)}-${slug(name)}`;
  const attemptsRoot = join(root, config.attempt_root);
  mkdirSync(attemptsRoot, { recursive: true });
  let id;
  let relativePath;
  let folder;
  for (let collision = 1; ; collision += 1) {
    id = collision === 1 ? baseId : `${baseId}-${String(collision).padStart(2, "0")}`;
    relativePath = portable(join(config.attempt_root, id));
    folder = join(root, relativePath);
    try { mkdirSync(folder); break; }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
  const attempt = { schema_version: 1, id, name, relativePath, created_at: now.toISOString() };
  writeFileSync(join(folder, "attempt.json"), JSON.stringify(attempt, null, 2) + "\n", "utf8");
  return { ...attempt, folder };
}

export function listAttempts(root = process.cwd()) {
  root = projectRoot(root);
  const config = loadProjectConfig(root);
  const base = join(root, config.attempt_root);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const folder = join(base, entry.name);
    const metadata = join(folder, "attempt.json");
    if (!existsSync(metadata)) return [];
    return [{ ...JSON.parse(readFileSync(metadata, "utf8")), folder }];
  });
}

export function findAttempt(root, nameOrId) {
  const attempts = listAttempts(root);
  const exact = attempts.find((attempt) => attempt.id === nameOrId);
  if (exact) return exact;
  const wanted = slug(nameOrId);
  const matches = attempts.filter((attempt) => slug(attempt.name) === wanted);
  if (!matches.length) throw new Error(`No DIRF attempt named ${JSON.stringify(nameOrId)}`);
  return matches.at(-1);
}
