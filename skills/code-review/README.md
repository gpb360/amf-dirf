---
name: code-review
kind: skill
description: "Review a change for correctness, scope, and regressions with evidence"
uses: []
details: []
inputs: ["diff"]
outputs: ["findings with failure scenarios"]
capabilities: ["code review"]
---

# Code review

Read the change against what it claims to do. For each finding, state the concrete failure scenario — inputs, state, wrong outcome — not a style opinion. Check scope creep, missing tests, and behavior changes the description does not mention. Verify claims by running the code where possible.
