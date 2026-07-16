// Shared path + constants for amf-dirf. Node built-ins only.
// All other modules import ROOT and the registry/policy paths from here so the
// 'repo root' computation lives in exactly one place.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// src/ -> repo root is one level up.
const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..");

export const AGENTS_DIR = join(ROOT, "agents");
export const REGISTRY = join(ROOT, "registry", "agents.json");
export const SKILLS = join(ROOT, "registry", "skills.json");
export const PLAYBOOKS = join(ROOT, "registry", "playbooks.json");
export const POLICY = join(ROOT, "policies", "workflow-policy.md");
export const WORKFLOW_DIR = join(ROOT, "workflows", "user");

export function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function fileHash(path) {
  // First 16 hex chars of the SHA-256 of raw file bytes (drift guard).
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
}

export function workflowPath(name) {
  // Slug a workflow name into its JSON path. Throws on empty.
  const safe = name.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "");
  if (!safe) throw new Error("workflow name must contain alphanumeric characters");
  return join(WORKFLOW_DIR, `${safe}.json`);
}

export function workflowOutputDir(name) {
  return join(WORKFLOW_DIR, "instructions", basename(workflowPath(name), ".json"));
}
