---
name: test-first
kind: skill
description: "Lock behavior with a failing test before and a passing test after every change"
uses: []
details: []
inputs: ["change under test"]
outputs: ["red-green regression evidence"]
capabilities: ["testing"]
---

# Test first

Before changing behavior, write the smallest test that fails for the right reason. Make it pass with the smallest change. Keep the test focused on observable behavior, not implementation, and run the full affected suite before calling the change done.
