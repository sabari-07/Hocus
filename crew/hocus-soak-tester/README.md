# Hocus Soak Tester (Kiro Crew app)

A small Kiro Crew app: every night at 02:00 it runs the Hocus property tests with 5,000 cases per property and a
date-based seed, runs the replay corpus, and posts a report with any shrunk counterexample.

The rules for the Best Kiro Crew App bonus ask for its own GitHub repository. Publish this folder as a separate
public repo (for example `hocus-soak-tester`) and link it in the submission form.

Install locally (Crew running on port 5476):

```bash
curl -X POST http://localhost:5476/api/apps/install -H "content-type: application/json" -d '{"source": "./crew/hocus-soak-tester"}'
```

Then enable it from the App Store screen. Files: `app.json` (manifest and cron), `agents/soak-runner.json`
(read-only except `npx vitest run`), `skills/soak-report/SKILL.md` (report format).

`FC_RUNS` is read by `numRuns()` in `@hocus/testkit`; `FC_SEED` is applied globally by `tests/properties/setup.ts`.
