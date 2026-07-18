---
name: api-test
kind: playbook
order: 8
description: "Validate API contracts, behavior, security, and failure handling."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Validate API contracts, behavior, security, and failure handling.","keywords":["api contract","api test","api testing","endpoint","contract","openapi","swagger","webhook"],"agents":["api-tester","backend-architect","security-auditor","test-writer-fixer"],"workflow":{"phases":["identify contract","test happy/error paths","check security","report gaps"],"output":"API test plan or fixes with evidence","validation":"run focused API tests or documented request checks","recovery":"if no contract exists, derive expected behavior from routes and docs"},"questions":["Which endpoint, contract, or webhook should be tested?","Should this create tests or only review behavior?"],"skill_flow":{"label":"API contract verification","steps":[{"stage":"map","reason":"Identify the contract and observable behavior.","capability":"api testing"},{"stage":"security","reason":"Check trust-boundary and failure-path behavior.","capability":"security review"},{"stage":"verify","reason":"Exercise happy paths and failure paths through the contract.","capability":"testing"}]}}
---

# api-test

Validate API contracts, behavior, security, and failure handling.

Follow the ordered phases and capability requirements declared above.
