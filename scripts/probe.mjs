// Dev helper: open an app in Chrome, collect console errors, run a few typed commands, screenshot.
// Usage: node scripts/probe.mjs http://localhost:5173/ out.png "make that bigger" ...
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/', out = '.probe.png', ...commands] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'skipLanding', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
if (!(await page.evaluate(() => !!window.__hocus))) {
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ error: 'runtime not mounted', errors }, null, 1));
  await browser.close();
  process.exit(1);
}
for (const c of commands) {
  if (c.startsWith('point:')) {
    // Real mouse movement onto an object's projected centre -> real 3D hit testing.
    const p = await page.evaluate((id) => window.__hocus.stage.screenOf(id), c.slice(6));
    if (p) {
      await page.mouse.move(p.x, p.y, { steps: 12 });
      await page.waitForTimeout(700);
    }
  } else if (c.startsWith('at:')) {
    const [x, y] = c.slice(3).split(',').map(Number);
    await page.mouse.move(x, y, { steps: 12 });
    await page.waitForTimeout(700);
  } else if (c.startsWith('select:')) {
    await page.evaluate((id) => window.__hocus.select([id]), c.slice(7));
  } else if (c.startsWith('wait:')) {
    await page.waitForTimeout(Number(c.slice(5)));
  } else if (c.startsWith('key:')) {
    await page.keyboard.press(c.slice(4));
  } else {
    await page.fill('#hx-typed', c);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
  }
}
const info = await page.evaluate(() => {
  const rt = window.__hocus;
  if (!rt) return { error: 'no runtime' };
  const d = rt.state.decisions.at(-1);
  return {
    phase: rt.state.phase.kind,
    selectables: rt.engine.selectables(rt.state).length,
    stageIds: rt.stage?.ids().length,
    last: d ? { raw: d.raw, outcome: d.outcome } : null,
    announcement: rt.ui.getState().announcement?.text,
  };
});
await page.screenshot({ path: out });
console.log(JSON.stringify({ info, errors: errors.slice(0, 20) }, null, 1));
await browser.close();
