---
name: fullstack-feature
kind: playbook
order: 3
description: "Build a user-facing feature across UI, API, data, and tests."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Build a user-facing feature across UI, API, data, and tests.","keywords":["feature","fullstack","full-stack","api","database","login"],"agents":["rapid-prototyper","ux-researcher","ui-designer","frontend-developer","backend-architect","test-writer-fixer"],"workflow":{"phases":["define user outcome","reuse existing patterns","implement vertical slice","verify"],"output":"small working feature slice","validation":"run focused tests or build for touched surface","recovery":"if contracts are unclear, stop after documenting the needed API/data decision"},"questions":["What is the user-visible success criteria?","What existing APIs, routes, or data models should be reused?"],"skill_flow":{"label":"idea → ship (build a feature)","steps":[{"stage":"sharpen","reason":"Resolve the decision tree before building.","capability":"plan interview"},{"stage":"plan","reason":"Reuse existing patterns and choose the smallest correct slice.","capability":"minimalism"},{"stage":"design","reason":"Design the UI structure when the task has a UI surface.","branch":"ui","capability":"frontend design"},{"stage":"build","reason":"Drive each behavior through a red-green slice.","capability":"testing"},{"stage":"build","reason":"Apply React conventions when React is explicit.","branch":"react","capability":"react engineering"},{"stage":"quality","reason":"Apply the product-quality gate.","capability":"product quality"},{"stage":"review","reason":"Review Standards and Spec before committing.","capability":"code review"}]}}
---

# fullstack-feature

Build a user-facing feature across UI, API, data, and tests.

Follow the ordered phases and capability requirements declared above.
