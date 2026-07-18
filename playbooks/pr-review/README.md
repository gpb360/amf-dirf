---
name: pr-review
kind: playbook
order: 1
description: "Review a pull request for bugs, regressions, security, and missing tests."
uses: []
details: []
inputs: ["task"]
outputs: ["workflow"]
capabilities: []
config: {"description":"Review a pull request for bugs, regressions, security, and missing tests.","keywords":["pr","pull request","review","diff","merge","code review"],"agents":["agent-organizer","test-writer-fixer","security-auditor","performance-benchmarker"],"workflow":{"phases":["inspect diff","check behavior risk","check security/test gaps","report findings"],"output":"findings ordered by severity with file references","validation":"use git diff, tests, or static checks as available","recovery":"if no PR is available, ask for branch, diff, or PR URL"},"questions":["What branch or PR should be reviewed?","Should the review include security and performance checks?"],"skill_flow":{"label":"review a pull request","steps":[{"stage":"review","reason":"Review Standards and Spec independently.","capability":"code review"},{"stage":"security","reason":"Check trust boundaries, secrets, injection, and auth gaps.","capability":"security review"},{"stage":"verify","reason":"Check that changed behavior has regression coverage.","capability":"testing"}]}}
---

# pr-review

Review a pull request for bugs, regressions, security, and missing tests.

Follow the ordered phases and capability requirements declared above.
