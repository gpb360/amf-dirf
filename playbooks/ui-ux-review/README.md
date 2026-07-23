---
name: ui-ux-review
kind: playbook
order: 13
description: "Review or plan UI/UX with design-system, accessibility, responsive layout, and polish checks."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Review or plan UI/UX with design-system, accessibility, responsive layout, and polish checks.","keywords":["ui ux review","ui ux","ui/ux","design system","accessibility","responsive","layout","visual polish","interface","frontend design","frontend refactor","design refactor","design-system","frontend","redesign"],"agents":["ui-designer","ux-researcher","brand-guardian","performance-benchmarker","test-engineer"],"workflow":{"phases":["identify product type and audience","select design-system constraints","check accessibility and interaction quality","verify responsive behavior"],"output":"UI/UX plan or review with concrete fixes and verification checks","validation":"inspect small and large viewports, keyboard/touch states, contrast, reduced motion, and layout stability","recovery":"if the target UI is unclear, ask for page/component path and screenshots before edits"},"questions":["What page, component, or flow should be reviewed?","Is this a design plan, implementation, or polish pass?"],"skill_flow":{"label":"UI/UX review","steps":[{"stage":"review","reason":"Review design-system, layout, and interaction quality.","capability":"user experience design"},{"stage":"review","reason":"Review contrast, input, motion, and assistive states.","capability":"accessibility"},{"stage":"verify","reason":"Verify responsive and runtime behavior.","capability":"web quality"},{"stage":"verify","reason":"Verify authentication, privacy, and no-spend boundaries when the UI task is security-sensitive.","capability":"security review","branch":"security"}]}}
---

# ui-ux-review

Review or plan UI/UX with design-system, accessibility, responsive layout, and polish checks.

Follow the ordered phases and capability requirements declared above.
