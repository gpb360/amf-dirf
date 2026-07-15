# Graph Report - E:\s7s-projects\amf-dirf  (2026-07-15)

## Corpus Check
- Corpus is ~35,421 words - fits in a single context window. You may not need a graph.

## Summary
- 151 nodes · 303 edges · 12 communities
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.82)
- Token cost: 20,503 input · 4,810 output

## Community Hubs (Navigation)
- Skill Discovery
- Project Inspection
- Package Metadata
- Delivery Agent Roles
- CLI Workflow Assembly
- Smoke Validation
- Repository Paths
- Instruction Rendering
- Task Routing
- Engineering Agent Roles
- Kit Principles
- Marketing Agent Roles

## God Nodes (most connected - your core abstractions)
1. `inspect()` - 16 edges
2. `discover()` - 13 edges
3. `main()` - 10 edges
4. `isDir()` - 10 edges
5. `buildHtml()` - 10 edges
6. `loadJson()` - 9 edges
7. `scripts` - 8 edges
8. `buildFlow()` - 8 edges
9. `recommend()` - 8 edges
10. `isFile()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Agent Spec Kit Documentation` --semantically_similar_to--> `Agent Spec Kit Principles`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `Performance Benchmarker` --conceptually_related_to--> `Workflow Audit`  [INFERRED]
  agents/performance-benchmarker.md → policies/workflow-policy.md
- `Test Writer Fixer` --conceptually_related_to--> `Workflow Audit`  [INFERRED]
  agents/test-writer-fixer.md → policies/workflow-policy.md
- `Agent Organizer` --conceptually_related_to--> `Agent Spec Kit Documentation`  [INFERRED]
  agents/agent-organizer.md → README.md
- `Error Coordinator` --conceptually_related_to--> `Governance Boundary`  [INFERRED]
  agents/error-coordinator.md → policies/workflow-policy.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared Governance Boundary** — agents_agent_organizer_agent_organizer, agents_api_tester_api_tester, agents_backend_architect_backend_architect, agents_brand_guardian_brand_guardian, agents_cli_developer_cli_developer, agents_competitive_analyst_competitive_analyst, agents_content_marketer_content_marketer, agents_devops_automator_devops_automator, agents_documentation_engineer_documentation_engineer, agents_dx_optimizer_dx_optimizer [EXTRACTED 1.00]
- **UI Delivery Collaboration** — agents_ui_designer_ui_designer, agents_ux_researcher_ux_researcher, agents_frontend_developer_frontend_developer [INFERRED 0.85]
- **Evidence-Backed Quality** — agents_knowledge_synthesizer_knowledge_synthesizer, agents_research_analyst_research_analyst, agents_security_auditor_security_auditor, agents_test_writer_fixer_test_writer_fixer, policies_workflow_policy_workflow_audit [INFERRED 0.85]
- **Resilient Workflow Operations** — agents_error_coordinator_error_coordinator, agents_workflow_orchestrator_workflow_orchestrator, agents_performance_benchmarker_performance_benchmarker [INFERRED 0.75]

## Communities (12 total, 0 thin omitted)

### Community 0 - "Skill Discovery"
Cohesion: 0.17
Nodes (16): cmdSkillsScan(), basenameDir(), discover(), findSkillFolders(), HOME_ROOT_NAMES, indexOne(), isDir(), loadRegistry() (+8 more)

### Community 1 - "Project Inspection"
Cohesion: 0.29
Nodes (17): detectDeployment(), detectGraph(), detectHosts(), detectMcp(), detectMemory(), detectPlanning(), detectStack(), detectTracking() (+9 more)

### Community 2 - "Package Metadata"
Cohesion: 0.11
Nodes (17): bin, dirf, description, engines, node, license, name, scripts (+9 more)

### Community 3 - "Delivery Agent Roles"
Cohesion: 0.20
Nodes (17): Error Coordinator, Frontend Developer, Knowledge Synthesizer, Performance Benchmarker, Rapid Prototyper, Research Analyst, Security Auditor, Test Writer Fixer (+9 more)

### Community 4 - "CLI Workflow Assembly"
Cohesion: 0.28
Nodes (15): buildPlan(), cmdBuild(), cmdCreate(), cmdInspect(), cmdList(), cmdRender(), cmdValidate(), enrichAgents() (+7 more)

### Community 5 - "Smoke Validation"
Cohesion: 0.14
Nodes (11): CLI, detail, html, htmlText, out, readme, readmeText, ROOT (+3 more)

### Community 6 - "Repository Paths"
Cohesion: 0.24
Nodes (11): AGENTS_DIR, HERE, PLAYBOOKS, POLICY, REGISTRY, ROOT, SKILLS, WORKFLOW_DIR (+3 more)

### Community 7 - "Instruction Rendering"
Cohesion: 0.47
Nodes (9): buildHtml(), buildInstructions(), chip(), escapeHtml(), inline(), parseAgentMd(), renderMarkdownLite(), writeAgentDetail() (+1 more)

### Community 8 - "Task Routing"
Cohesion: 0.33
Nodes (7): cmdFlow(), branchesFor(), buildFlow(), FLOWS, loadJson(), recommend(), scorePlaybook()

### Community 9 - "Engineering Agent Roles"
Cohesion: 0.33
Nodes (6): API Tester, Backend Architect, CLI Developer, DevOps Automator, Documentation Engineer, DX Optimizer

### Community 10 - "Kit Principles"
Cohesion: 0.50
Nodes (4): Continuous Integration Pipeline, Agent Organizer, Agent Spec Kit Principles, Agent Spec Kit Documentation

### Community 11 - "Marketing Agent Roles"
Cohesion: 0.67
Nodes (3): Brand Guardian, Competitive Analyst, Content Marketer

## Knowledge Gaps
- **37 isolated node(s):** `name`, `version`, `description`, `type`, `dirf` (+32 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `inspect()` connect `Project Inspection` to `CLI Workflow Assembly`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `discover()` connect `Skill Discovery` to `Task Routing`, `CLI Workflow Assembly`, `Instruction Rendering`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `buildHtml()` connect `Instruction Rendering` to `Skill Discovery`, `CLI Workflow Assembly`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _37 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Package Metadata` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Smoke Validation` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._