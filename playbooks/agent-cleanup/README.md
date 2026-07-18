---
name: agent-cleanup
kind: playbook
order: 7
description: "Clean, rename, validate, and reorganize an agent collection."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Clean, rename, validate, and reorganize an agent collection.","keywords":["agent","agents","workflow","orchestrator","subagent","cleanup","rename"],"agents":["agent-organizer","workflow-orchestrator","documentation-engineer","cli-developer","dx-optimizer"],"workflow":{"phases":["inventory","dedupe","normalize","validate"],"output":"curated agent/workflow surface","validation":"run validate and smoke tests","recovery":"preserve raw source files unless deletion is explicit"},"questions":["What agents should be public versus archived?","What host tool should the agents target first?"],"skill_flow":{"label":"agent collection maintenance","steps":[{"stage":"inventory","reason":"Inventory agent roles, overlaps, and host constraints.","capability":"agent orchestration"},{"stage":"simplify","reason":"Delete duplication and keep the smallest useful agent surface.","capability":"minimalism"},{"stage":"verify","reason":"Review registry and agent-definition consistency.","capability":"code review"}]}}
---

# agent-cleanup

Clean, rename, validate, and reorganize an agent collection.

Follow the ordered phases and capability requirements declared above.
