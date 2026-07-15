# Agent Spec Kit

The kit turns a task into a lean instruction set grounded in the host repository's installed skills.

## Language

**Playbook**:
A named task pattern containing its routing cues, agent roster, workflow contract, and ordered skill flow.
_Avoid_: Template, flow definition

**Reconciliation**:
Validation that each Playbook is one coherent definition across routing cues, workflow contract, agents, and skill flow. It never merges conflicting definitions at runtime.
_Avoid_: Runtime fallback, conflict resolution

**Task Routing**:
The decision that selects a playbook from task intent and assembles that playbook's ordered skill flow. Triage represents an unclassified task; an incomplete playbook definition is invalid.
_Avoid_: Classification, recommendation
