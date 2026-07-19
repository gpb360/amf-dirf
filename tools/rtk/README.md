---
name: rtk
kind: tool
description: "Optional token-reducing shell command adapter"
uses: []
details: []
inputs: ["shell command"]
outputs: ["filtered command output"]
capabilities: ["token efficient shell"]
approval: none
---

# RTK tool adapter

If RTK is installed, prefix shell commands with `rtk`. If it is absent, use the original command unchanged.

This folder describes invocation only. It does not define task policy or select itself.
