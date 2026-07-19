---
name: fullstack-feature
kind: workflow
description: "Example implementation workflow spanning every DIRF folder unit"
uses: ["../../playbooks/fullstack-feature"]
details: []
inputs: ["task", "target repository"]
outputs: ["verified feature"]
capabilities: ["minimalism", "token efficient shell"]
---

# Fullstack feature workflow

Resolve the playbook DAG, execute it in order, and verify the requested feature.
