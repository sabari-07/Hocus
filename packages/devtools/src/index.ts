export { XRay, type XRayProps } from './XRay.tsx';
export { summarize } from './summary.ts';
export { Simulator } from './Simulator.tsx';

/** Vitest snippet that turns a decision into a permanent regression test. */
export function testSnippet(appImport: string, replayPath: string): string {
  return `import { expect, it } from 'vitest';
import { createEngine, parseReplayFile, replay } from '@hocus/core';
import replayJson from '${replayPath}';
import app from '${appImport}';

it('replay ${replayPath} still resolves the same way', () => {
  const file = parseReplayFile(replayJson);
  const engine = createEngine(app);
  const { state } = replay(engine, file.events as never);
  const got = state.decisions.map((d) => ({ raw: d.raw, outcome: d.outcome }));
  expect(got).toEqual(file.expected!.decisions!.map((d) => ({ raw: d.raw, outcome: d.outcome })));
});
`;
}
