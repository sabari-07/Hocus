// Dev helper: screenshot the apps at tablet and phone sizes to review the floating layout.
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-swiftshader'] });
const sizes = [
  ['tablet', 1024, 768],
  ['phone', 390, 844],
];
const errors = [];
for (const [name, width, height] of sizes) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: name === 'phone' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.addInitScript(() => localStorage.setItem('hocus.settings.v1', JSON.stringify({ onboarded: true, sounds: false })));
  await page.goto('http://localhost:5281/?skipLanding&e2e', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `.resp-${name}.png` });
  // How much of the screen does the UI cover?
  const m = await page.evaluate(() => {
    const dock = document.querySelector('.hx-dock')?.getBoundingClientRect();
    const hud = document.querySelector('.hx-hud')?.getBoundingClientRect();
    const overflowX = document.documentElement.scrollWidth > innerWidth;
    return { dockH: Math.round(dock?.height ?? 0), hudH: Math.round(hud?.height ?? 0), overflowX, panels: [...document.querySelectorAll('.hx-float')].map((p) => p.getAttribute('data-open')) };
  });
  console.log(name, JSON.stringify(m));
  await ctx.close();
}
console.log(JSON.stringify({ errors }));
await browser.close();
