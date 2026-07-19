---
name: security-review
kind: skill
description: "Check trust boundaries, secrets, injection, and authorization on changed surfaces"
uses: []
details: []
inputs: ["diff or architecture"]
outputs: ["security findings with impact"]
capabilities: ["security review"]
---

# Security review

Trace every input from an untrusted source to where it is used: injection, path traversal, deserialization. Check that secrets stay out of code and logs, that authorization is enforced server-side on every changed endpoint, and that errors do not leak internals. Report each finding with its concrete impact.
