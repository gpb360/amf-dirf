---
name: landing-page
kind: playbook
order: 0
description: "Plan, design, build, and verify a landing page."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Plan, design, build, and verify a landing page.","keywords":["landing","homepage","marketing page","sales page","hero","cta","website"],"agents":["ui-designer","frontend-developer","content-marketer","brand-guardian","performance-benchmarker","test-writer-fixer"],"workflow":{"phases":["clarify offer","design page","implement","verify performance and tests"],"output":"working page plus verification notes","validation":"run the project's narrowest build/test or page check","recovery":"if scope is unclear, emit the agent list and ask the missing context questions before edits"},"questions":["What framework is the project using?","What is the offer, audience, and primary CTA?","Is this a new page or an edit to an existing page?"],"skill_flow":{"label":"idea → ship (build a landing page)","steps":[{"stage":"sharpen","reason":"Sharpen the offer, audience, and CTA before designing.","capability":"plan interview"},{"stage":"design","reason":"Set visual hierarchy, typography, layout, and interaction quality.","capability":"user experience design"},{"stage":"design","reason":"Catch semantic, contrast, and keyboard issues during design.","capability":"accessibility"},{"stage":"build","reason":"Build the smallest correct implementation with existing patterns.","capability":"minimalism"},{"stage":"quality","reason":"Apply the final product-quality pass.","capability":"product quality"},{"stage":"verify","reason":"Verify performance, responsiveness, and accessibility at runtime.","capability":"web quality"}]}}
---

# landing-page

Plan, design, build, and verify a landing page.

Follow the ordered phases and capability requirements declared above.
