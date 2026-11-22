---
name: soak-report
description: Format the result of a Hocus nightly soak run. Use after running the property and replay suites.
---

Report in this shape, plain text:

```
Hocus soak <date> · commit <short sha> · seed <seed> · FC_RUNS 5000
Properties: <passed>/<total>   Replays: <passed>/<total>   Duration: <s>
```

Then, only if something failed, one block per failure:

```
FAILED P<nn> <title>
Counterexample: <exactly as printed by fast-check>
Suggested regression test: tests/properties/regressions/P<nn>-<seed>.test.ts
```

Never paraphrase a counterexample. Never claim a pass you did not see in the output.
