// Shared path + constants for amf-dirf. Node built-ins only.
// All other modules import ROOT and the registry/policy paths from here so the
// 'repo root' computation lives in exactly one place.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// src/ -> repo root is one level up.
const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..");

export const AGENTS_DIR = join(ROOT, "agents");
export const REGISTRY = join(ROOT, "registry", "agents.json");
export const SKILLS = join(ROOT, "registry", "skills.json");
export const PLAYBOOKS = join(ROOT, "registry", "playbooks.json");
export const PLAYBOOK_DIR = join(ROOT, "playbooks");
export const POLICY = join(ROOT, "policies", "workflow-policy.md");

export function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function fileHash(path) {
  // First 16 hex chars of the SHA-256 of raw file bytes (drift guard).
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

export function folderHash(path) {
  const hash = createHash("sha256");
  for (const entry of readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${entry.name}/README.md`;
    hash.update(relative).update("\0").update(readFileSync(join(path, relative))).update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}
