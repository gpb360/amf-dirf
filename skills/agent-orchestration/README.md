---
name: agent-orchestration
kind: skill
description: "Keep multi-agent work bounded: clear roles, scoped handoffs, verified results"
uses: []
details: []
inputs: ["agent collection or workflow"]
outputs: ["clean roles and handoffs"]
capabilities: ["agent orchestration"]
---

# Agent orchestration

Give each agent one role, an explicit boundary, and a done-when check. Hand off with context — what was done, what was decided, what is next — never by assumption. Remove or merge agents whose roles overlap, and verify results at each boundary instead of trusting the chain.
