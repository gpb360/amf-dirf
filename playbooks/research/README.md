---
name: research
kind: playbook
order: 4
description: "Research a topic, competitor, technology, or market and synthesize recommendations."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Research a topic, competitor, technology, or market and synthesize recommendations.","keywords":["research","competitor","market","compare","evaluate","trend"],"agents":["research-analyst","competitive-analyst","content-marketer","knowledge-synthesizer"],"workflow":{"phases":["define decision","collect sources","compare","synthesize"],"output":"evidence-backed recommendation","validation":"cite concrete sources or repo evidence","recovery":"if sources are unavailable, mark claims as unverified"},"questions":["What decision should the research support?","Are web sources required or should this be repo-only?"],"skill_flow":{"label":"foggy effort → research before building","steps":[{"stage":"research","reason":"Define the decision the research must support.","capability":"plan interview"},{"stage":"synthesize","reason":"Stop at the smallest evidence-backed recommendation.","capability":"minimalism"}]}}
---

# research

Research a topic, competitor, technology, or market and synthesize recommendations.

Follow the ordered phases and capability requirements declared above.
