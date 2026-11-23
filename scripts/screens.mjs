// Dev helper: capture key screens for visual review (landing, X-ray, Judge Mode mid-run, Hindi UI).
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('hocus.settings.v1', JSON.stringify({ onboarded: true, sounds: false })));

await page.goto('http://localhost:5281/?e2e', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '.screen-landing.png' });

await page.getByRole('button', { name: /Use mouse and keyboard/ }).click();
const p = await page.evaluate(() => window.__hocus.stage.screenOf('pumpkin-1'));
await page.mouse.move(p.x, p.y, { steps: 10 });
await page.waitForTimeout(700);
await page.fill('#hx-typed', 'make that bigger');
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /X-ray/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: '.screen-xray.png' });
await page.getByRole('button', { name: /X-ray/ }).click();

await page.getByRole('button', { name: /Judge Mode/ }).click();
await page.waitForTimeout(9000);
await page.screenshot({ path: '.screen-judge.png' });
await page.keyboard.press('Escape');

await page.goto('http://localhost:5282/?skipLanding&e2e', { waitUntil: 'networkidle' });
await page.evaluate(() => window.__hocus.updateSettings({ lang: 'hi' }));
await page.waitForTimeout(1500);
const j = await page.evaluate(() => window.__hocus.stage.screenOf('jupiter'));
await page.mouse.move(j.x, j.y, { steps: 10 });
await page.waitForTimeout(700);
await page.fill('#hx-typed', 'यह क्या है');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.screenshot({ path: '.screen-hindi.png' });
console.log(JSON.stringify({ errors, judgeDecisions: 'see screenshots' }));
await page.evaluate(() => window.__hocus.updateSettings({ lang: 'en' }));
await browser.close();
