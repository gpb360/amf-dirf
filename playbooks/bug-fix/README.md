---
name: bug-fix
kind: playbook
order: 2
description: "Reproduce, isolate, fix, and verify a bug."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Reproduce, isolate, fix, and verify a bug.","keywords":["bug","fix","broken","error","failing","regression","debug"],"agents":["agent-organizer","frontend-developer","backend-architect","error-coordinator","test-engineer"],"workflow":{"phases":["reproduce","isolate cause","patch smallest source","verify"],"output":"fix with reproduction and verification evidence","validation":"run the failing command or narrow regression test","recovery":"if reproduction is missing, gather exact error and command first"},"questions":["What is the exact failure or error?","What command or user path reproduces it?"],"skill_flow":{"label":"something's broken → fix it","steps":[{"stage":"diagnose","reason":"Build a tight feedback loop before theorizing.","capability":"root cause debugging"},{"stage":"diagnose","reason":"Patch the smallest shared source of the bug.","capability":"minimalism"},{"stage":"fix","reason":"Lock the bug down with a red-green regression test.","capability":"testing"},{"stage":"review","reason":"Review the fix for regressions and scope.","capability":"code review"}]}}
---

# bug-fix

Reproduce, isolate, fix, and verify a bug.

Follow the ordered phases and capability requirements declared above.
