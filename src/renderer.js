// Lean instruction-set renderer. Node built-ins only.
//
// Ponytail principle: smallest correct artifact, progressive disclosure.
//   - parseAgentMd: tolerant frontmatter + separates the governance boilerplate
//   - renderMarkdownLite: only what agent markdowns contain (no general md engine)
//   - buildInstructions: lean router + one lazy-loaded detail file per agent
//   - buildHtml: same structure, collapsible <details> for humans
//
// Markdown is source; HTML is the render of the same lean structure.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, isAbsolute, resolve } from "node:path";
import { AGENTS_DIR, ROOT } from "./paths.js";
import { resolveAgentSkills, discover } from "./skills.js";
import { buildFlow } from "./flow.js";

const GOVERNANCE_MARKER = "<!-- governance:v1 -->";
const FM_RE = /^([A-Za-z0-9_-]+):\s*(.*)$/;

// --------------------------------------------------------------------------- //
// Agent markdown parsing
// --------------------------------------------------------------------------- //
export function parseAgentMd(path) {
  // Parse an agent .md into { frontmatter, body, governance }.
  // Tolerant: the frontmatter field set varies across agents. Separates the
  // trailing governance boilerplate block so it can be rendered once.
  const text = readFileSync(path, "utf-8");
  const frontmatter = {};
  let body = text;
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---", 4);
    if (end !== -1) {
      for (const line of text.slice(4, end).split(/\r?\n/)) {
        const m = FM_RE.exec(line);
        if (m) frontmatter[m[1]] = m[2].trim();
      }
      body = text.slice(end + 4).replace(/^\r?\n/, "");
    }
  }

  let governance = "";
  const marker = body.indexOf(GOVERNANCE_MARKER);
  if (marker !== -1) {
    governance = body.slice(marker).trim();
    body = body.slice(0, marker).replace(/\s+$/, "");
  }

  return { frontmatter, body: body.trim(), governance: governance.trim() };
}

// --------------------------------------------------------------------------- //
// Markdown-lite -> HTML (only what agent markdowns contain)
// --------------------------------------------------------------------------- //
export function renderMarkdownLite(text) {
  // Focused line-based HTML for the subset agent markdowns actually use.
  // Supports: ATX headings, bold, inline code, ordered/unordered lists, fenced
  // code blocks, paragraphs. Strips HTML comments. ~deliberately small.
  const lines = (text || "").split(/\r?\n/);
  const out = [];
  let inCode = false;
  let listOpen = null;

  const closeList = () => {
    if (listOpen) {
      out.push(`</${listOpen}>`);
      listOpen = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        closeList();
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }

    const stripped = line.trim();
    if (stripped.startsWith("<!--") && stripped.endsWith("-->")) continue;
    if (!stripped) {
      closeList();
      continue;
    }

    const hm = /^(#{1,4})\s+(.*)$/.exec(stripped);
    if (hm) {
      closeList();
      const level = hm[1].length + 1;
      out.push(`<h${level}>${inline(hm[2])}</h${level}>`);
      continue;
    }
    const om = /^(\d+)\.\s+(.*)$/.exec(stripped);
    if (om) {
      if (listOpen !== "ol") {
        closeList();
        out.push("<ol>");
        listOpen = "ol";
      }
      out.push(`<li>${inline(om[2])}</li>`);
      continue;
    }
    const um = /^[-*]\s+(.*)$/.exec(stripped);
    if (um) {
      if (listOpen !== "ul") {
        closeList();
        out.push("<ul>");
        listOpen = "ul";
      }
      out.push(`<li>${inline(um[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(stripped)}</p>`);
  }

  if (inCode) out.push("</code></pre>");
  closeList();
  return out.join("\n");
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text) {
  // Inline formatting: bold, inline code. Escapes everything else.
  const placeholders = [];
  const stash = (_m, g1) => {
    placeholders.push(`<code>${escapeHtml(g1)}</code>`);
    return `\x00${placeholders.length - 1}\x00`;
  };
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`]+)`/g, stash);
  safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\x00(\d+)\x00/g, (_m, i) => placeholders[Number(i)]);
  return safe;
}

// --------------------------------------------------------------------------- //
// Lean markdown instruction set (router + per-agent detail)
// --------------------------------------------------------------------------- //
export function buildInstructions(workflow, outDir) {
  // Write a lean instruction set: README.md router + per-agent detail files.
  // Returns the list of written file paths. Discovery is scoped to the
  // workflow's --path target if set, so skill mapping reflects the target project.
  const agentsSub = join(outDir, "agents");
  mkdirSync(agentsSub, { recursive: true });

  const task = workflow.task || "";
  const playbook = workflow.playbook || "";
  const wf = workflow.workflow || {};
  const agents = workflow.agents || [];
  const baseline = workflow.baseline_skills || [];
  const written = [];
  const target = workflow.path;
  const projectRoot = target ? (isAbsolute(target) ? target : resolve(ROOT, target)) : null;

  const lines = [
    `# Instruction Set — ${workflow.name || playbook}`,
    "",
    "## Objective",
    task,
    "",
    "## Definition of Done",
    wf.output || "_(no output contract declared)_",
    "",
    "## Phases",
    "",
  ];
  let i = 0;
  for (const phase of wf.phases || []) {
    i += 1;
    lines.push(`${i}. ${phase}`);
  }
  lines.push(
    "",
    `> Do not start the next phase until the current one is verifiably done. Validation: ${wf.validation || "_(none declared)_"}`,
    "",
    "## Agent roster (load a detail file only when you act as that agent)",
    "",
  );
  for (const a of agents) {
    const slug = a.name || "agent";
    lines.push(`- [${slug}](agents/${slug}.md) — ${(a.tags || []).join(", ")}`);
  }
  lines.push(
    "",
    "## Skills",
    "Every agent can discover and invoke any installed skill via the host's global skill lookup. Baseline skills relevant to this workflow: " + (baseline.length ? baseline.join(", ") : "_(none)_") + ". See each agent detail file for role-specific hints.",
    "",
    "## Skill flow",
    "Reach for skills in this order — each has a reason for its place in the sequence:",
    "",
  );
  // embed the flow so agents get the ordered path, not a flat menu
  const flow = buildFlow(task, target);
  let lastStage = "";
  for (const s of flow.steps) {
    if (s.stage !== lastStage) { lines.push(`**${s.stage}**`); lastStage = s.stage; }
    const mark = s.status === "installed" ? "✅" : "⚠️";
    lines.push(`- ${mark} \`${s.skill}\` — ${s.reason}`);
  }
  lines.push(
    "",
    "## Policy",
    "Read [policy.md](policy.md) before editing.",
    "",
    "## If blocked",
    wf.recovery || "_(no recovery contract declared)_",
    "",
    `_Generated by amf-dirf. schema_version ${workflow.schema_version || 1}. Re-render: \`node src/cli.js render ${workflow.name || playbook}\`_`,
  );
  const readme = join(outDir, "README.md");
  writeFileSync(readme, lines.join("\n"), "utf-8");
  written.push(readme);

  const policySrc = resolve(ROOT, workflow.policy || "policies/workflow-policy.md");
  const policyDst = join(outDir, "policy.md");
  try {
    writeFileSync(policyDst, readFileSync(policySrc, "utf-8"), "utf-8");
    written.push(policyDst);
  } catch { /* policy missing — non-fatal */ }

  for (const a of agents) {
    written.push(writeAgentDetail(a, baseline, agentsSub, projectRoot));
  }
  return written;
}

function writeAgentDetail(agentRef, baseline, agentsSub, projectRoot) {
  const name = agentRef.name || "agent";
  const path = join(agentsSub, `${name}.md`);
  const agentMdPath = join(AGENTS_DIR, `${name}.md`);
  let parsed;
  try {
    parsed = parseAgentMd(agentMdPath);
  } catch {
    parsed = { body: "_(agent markdown missing)_", frontmatter: {} };
  }
  const fm = parsed.frontmatter;
  const tags = agentRef.tags || [];
  const discovered = discover(projectRoot);
  const resolved = resolveAgentSkills(name, agentRef.skills || [], baseline, discovered);

  const lines = [`# ${name}`, ""];
  if (tags.length) lines.push(`**Tags:** ${tags.join(", ")}`, "");
  if (fm.tools) lines.push(`**Tools:** ${fm.tools}`, "");

  lines.push("## Skills", "");
  lines.push("You can discover and invoke any installed skill (the host provides global skill lookup). These are relevance hints for your role — a starting point, not a limit:");
  lines.push("");
  if (resolved.length) {
    for (const s of resolved) {
      const mark = s.status === "installed" ? "✅" : "⚠️";
      const note = s.status === "installed" ? "" : " (recommended — not installed)";
      const summ = s.summary ? ` — ${s.summary}` : "";
      lines.push(`- ${mark} \`${s.name}\`${summ}${note}`);
    }
  } else {
    lines.push("_(no role-specific hints — use global skill discovery as needed)_");
  }
  lines.push("", "## Your job", "", parsed.body.trim() || "_(empty)_", "");

  lines.push(
    "## Not your job",
    "",
    "Hand off to the matching agent rather than expanding scope. See the roster in [README.md](../README.md).",
    "",
  );
  lines.push(
    "## Done when",
    "",
    "- [ ] Your phase output is produced",
    "- [ ] Validation command passes",
    "- [ ] No scope creep into another agent's lane",
    "",
  );
  writeFileSync(path, lines.join("\n"), "utf-8");
  return path;
}

// --------------------------------------------------------------------------- //
// HTML render (same lean structure, collapsible for humans)
// --------------------------------------------------------------------------- //
const CSS = `
:root{--bg:#0f1115;--card:#171a21;--ink:#e6e8eb;--mute:#8b94a1;--accent:#7c5cff;--ok:#3fb950;--warn:#d29922;--line:#2a2f3a}
*{box-sizing:border-box}body{font:15px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink);margin:0;padding:32px 20px}
.wrap{max-width:920px;margin:0 auto}h1{font-size:26px;font-weight:600;margin:0 0 4px}
h2{font-size:18px;font-weight:600;margin:28px 0 10px;border-bottom:1px solid var(--line);padding-bottom:4px}
h3{font-size:15px;font-weight:600;color:var(--accent);margin:18px 0 6px}
p,li{color:#cdd2da}code{background:#0b0d12;border:1px solid var(--line);padding:1px 5px;border-radius:4px;font-size:13px}
pre{background:#0b0d12;border:1px solid var(--line);border-radius:6px;padding:12px;overflow:auto}
pre code{background:none;border:0;padding:0}.mute{color:var(--mute)}
.gate{border-left:3px solid var(--warn);background:rgba(210,153,34,.08);padding:8px 12px;margin:10px 0;border-radius:0 4px 4px 0}
.chip{display:inline-block;font-size:12px;padding:2px 8px;border-radius:10px;margin:0 4px 4px 0;border:1px solid var(--line)}
.chip.installed{color:var(--ok);border-color:rgba(63,185,80,.4)}.chip.recommended{color:var(--warn);border-color:rgba(210,153,34,.4)}
.chip.design{color:#a371f7}.chip.quality{color:#3fb950}.chip.security{color:#f85149}.chip.minimalism{color:#58a6ff}
details{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:12px 16px;margin:8px 0}
summary{cursor:pointer;font-weight:600;font-size:16px}summary h3{display:inline;margin:0;color:var(--ink)}
.roster{list-style:none;padding:0}.roster li{padding:6px 0;border-bottom:1px solid var(--line)}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);font-size:13px;color:var(--mute)}
`;

function chip(skill) {
  const status = skill.status || "recommended";
  const cat = skill.category || "";
  const classes = ["chip", status, cat].filter(Boolean).join(" ");
  const note = status === "installed" ? "" : " ⚠";
  return `<span class="${classes}">${escapeHtml(skill.name)}${note}</span>`;
}

export function buildHtml(workflow) {
  const wf = workflow.workflow || {};
  const agents = workflow.agents || [];
  const baseline = workflow.baseline_skills || [];
  const target = workflow.path;
  const projectRoot = target ? (isAbsolute(target) ? target : resolve(ROOT, target)) : null;
  const discovered = discover(projectRoot);

  const parts = [
    "<!doctype html><html><head><meta charset='utf-8'>",
    `<title>${escapeHtml(workflow.name || "")} — instruction set</title>`,
    `<style>${CSS}</style></head><body><div class='wrap'>`,
  ];

  parts.push(`<h1>${escapeHtml(workflow.name || "")}</h1>`);
  parts.push(`<p class='mute'>${escapeHtml(workflow.task || "")}</p>`);

  parts.push("<h2>Objective &amp; Definition of Done</h2>");
  parts.push(`<p>${escapeHtml(workflow.task || "")}</p>`);
  parts.push(`<p><strong>Done looks like:</strong> ${escapeHtml(wf.output || "—")}</p>`);

  parts.push("<h2>Phases</h2><ol>");
  for (const phase of wf.phases || []) parts.push(`<li>${escapeHtml(phase)}</li>`);
  parts.push("</ol>");
  parts.push(`<div class='gate'>⛔ Do not start the next phase until the current is verifiably done. Validation: ${escapeHtml(wf.validation || "—")}</div>`);

  parts.push("<h2>Baseline skills (every agent)</h2><p>");
  if (baseline.length) {
    const resolvedBase = resolveAgentSkills("*", [], baseline, discovered);
    parts.push(resolvedBase.map(chip).join(""));
  } else {
    parts.push("<span class='mute'>none</span>");
  }
  parts.push("</p>");

  parts.push("<h2>Agent roster</h2>");
  parts.push("<p class='mute'>Click an agent to expand its detail, skills, and boundary.</p>");
  for (const a of agents) {
    const name = a.name || "agent";
    let parsed;
    try {
      parsed = parseAgentMd(join(AGENTS_DIR, `${name}.md`));
    } catch {
      parsed = { body: "_(missing)_", frontmatter: {} };
    }
    const resolved = resolveAgentSkills(name, a.skills || [], baseline, discovered);
    const tags = (a.tags || []).join(", ");
    parts.push("<details><summary>");
    parts.push(`${escapeHtml(name)} <span class='mute'>— ${escapeHtml(tags)}</span>`);
    parts.push("</summary>");
    parts.push("<h3>Skills</h3>");
    parts.push("<p class='mute'>Global skill discovery is available — these are relevance hints for this role, not a limit.</p><p>");
    parts.push(resolved.length ? resolved.map(chip).join("") : "<span class='mute'>no role-specific hints — use global discovery</span>");
    parts.push("</p>");
    parts.push("<h3>Your job</h3>");
    parts.push(renderMarkdownLite(parsed.body));
    parts.push("<h3>Not your job</h3><p>Hand off to the matching agent rather than expanding scope.</p>");
    parts.push("</details>");
  }

  parts.push("<h2>If blocked</h2>");
  parts.push(`<div class='gate'>${escapeHtml(wf.recovery || "—")}</div>`);

  const sh = workflow.source_hashes || {};
  parts.push("<footer>");
  parts.push(`<p>schema_version ${workflow.schema_version || 1} · generated ${workflow.created_at || ""}</p>`);
  if (Object.keys(sh).length) {
    parts.push("<p><strong>Drift guard.</strong> If these no longer match the registries, re-render:</p>");
    parts.push("<pre><code>" + escapeHtml(Object.entries(sh).map(([k, v]) => `${k}: ${v}`).join("\n")) + "</code></pre>");
    parts.push(`<p><code>node src/cli.js render ${workflow.name || ""}</code></p>`);
  }
  parts.push("</footer></div></body></html>");
  return parts.join("");
}
