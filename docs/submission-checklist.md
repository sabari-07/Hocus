# Submission checklist (deadline Fri 4 Dec 2026, 2:00 PM PT = Sat 5 Dec, 3:30 AM IST)

## Repository

- [ ] Push to a **public GitHub** repo (not GitLab/Bitbucket). `git remote add origin … && git push -u origin main`
- [ ] LICENSE (MIT) shows in the repo's About box
- [ ] `/.kiro` is committed (it is; `.gitignore` explicitly does not ignore it)
- [ ] Two separate app folders: `apps/room-designer`, `apps/planet-explorer` (plus `examples/kitchen-board`)
- [ ] Copy `docs/mcp.example.json` to `.kiro/settings/mcp.json` if you want the MCP config in the repo
- [ ] `npm run check` and `npm run test:e2e` green; CI badge green

## Live apps

- [ ] Deploy all three on HTTPS (AWS Amplify: `amplify.yml`; one Amplify app per `appRoot`)
- [ ] Set `VITE_ROOM_URL`, `VITE_PLANETS_URL`, `VITE_KITCHEN_URL` so the landing cards link to each other
- [ ] Test in a clean Chrome profile: camera prompt, speech, Judge Mode, mouse-only path
- [ ] Check the Content-Security-Policy in `amplify.yml` does not block MediaPipe (if the camera fails only in
      production, add `'unsafe-eval'` to `script-src` and re-test)

## Form

- [ ] Category: **Skeleton Crew**
- [ ] Description, Kiro write-up (`docs/writeup.md`, edited in your own words)
- [ ] YouTube video under 3 minutes, public (`docs/video-script.md`)
- [ ] Credentials: none needed (no login)
- [ ] Bonus: blog post that says it was written for Kiroween 2026; social post starting with #KiroweenHackathon26
- [ ] Bonus: Crew app repo (publish `crew/hocus-soak-tester` separately)
- [ ] Student / startup / Ghost of Kiroween Past only if you qualify

## Before recording

- [ ] Native-speaker review of Hindi and Tamil, or leave them out of the video
- [ ] Record at least a few real sessions with the X-ray Recorder and add them to `tests/replays/`
- [ ] Request and redeem the 4,000 hackathon credits (form closes Dec 1, 12:00 PM PT)
