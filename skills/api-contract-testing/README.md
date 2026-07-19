---
name: api-contract-testing
kind: skill
description: "Validate API contracts, error paths, and failure handling against their spec"
uses: []
details: []
inputs: ["endpoint or contract"]
outputs: ["contract verification results"]
capabilities: ["api testing"]
---

# Api contract testing

Exercise each endpoint against its declared contract: shapes, status codes, required fields. Test the unhappy paths — invalid input, missing auth, conflicts, timeouts — not just the success case. Verify idempotency and pagination where declared, and record actual responses as evidence.
