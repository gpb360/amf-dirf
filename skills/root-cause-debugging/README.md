---
name: root-cause-debugging
kind: skill
description: "Reproduce, isolate, and fix the source of a defect rather than its symptom"
uses: []
details: []
inputs: ["failure report"]
outputs: ["reproduction, cause, and verified fix"]
capabilities: ["root cause debugging"]
---

# Root cause debugging

First reproduce the failure with an exact command or path. Bisect the surface area until one cause remains, and state why it explains every symptom. Patch the smallest shared source of the defect, then re-run the reproduction to prove it is gone.
