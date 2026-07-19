import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "../src/inspect.js";

test("Graphify suppresses the missing context-persistence suggestion", () => {
  const root = mkdtempSync(join(tmpdir(), "dirf-inspect-"));
  try {
    mkdirSync(join(root, "graphify-out"));
    writeFileSync(join(root, "graphify-out", "GRAPH_REPORT.md"), "# Graph");

    const result = inspect(root);

    assert.equal(result.suggestions.some((item) => item.gap.includes("memory / context-persistence")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
