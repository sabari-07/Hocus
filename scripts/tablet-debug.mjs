// Dev helper: is the tablet render broken, and is it related to size, timing or the software GL flag?
import { chromium } from '@playwright/test';

for (const flags of [[], ['--enable-unsafe-swiftshader']]) {
  const browser = await chromium.launch({ channel: 'chrome', args: flags });
  for (const [w, h] of [
    [1024, 768],
    [1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript(() => localStorage.setItem('hocus.settings.v1', JSON.stringify({ onboarded: true, sounds: false })));
    await page.goto('http://localhost:5281/?skipLanding&e2e', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const info = await page.evaluate(() => {
      const s = window.__hocus.stage;
      const c = s.camera;
      return { aspect: +c.aspect.toFixed(3), pos: c.position.toArray().map((v) => +v.toFixed(2)), canvas: [s.renderer.domElement.width, s.renderer.domElement.height], dpr: devicePixelRatio, scale: +s.object('pumpkin-1').scale.x.toFixed(2) };
    });
    console.log(flags.length ? 'swiftshader' : 'default', w, h, JSON.stringify(info));
    await page.screenshot({ path: `.tab-${flags.length ? 'sw' : 'def'}-${w}.png` });
    await page.close();
  }
  await browser.close();
}
