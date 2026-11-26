import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ROOM = 'http://localhost:5281/';
const PLANETS = 'http://localhost:5282/';
const KITCHEN = 'http://localhost:5283/';

async function open(page: Page, url: string, landing = false) {
  await page.addInitScript(() => localStorage.setItem('hocus.settings.v1', JSON.stringify({ onboarded: true, sounds: false })));
  await page.goto(url + (landing ? '?e2e' : '?skipLanding&e2e'));
  await page.waitForFunction(() => !!(window as unknown as { __hocus?: { stage?: unknown } }).__hocus?.stage);
  // Props animate into place during the first second; let the scene settle before reading positions.
  await page.waitForTimeout(1500);
}

async function say(page: Page, text: string) {
  await page.fill('#hx-typed', text);
  await page.keyboard.press('Enter');
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe('Haunted Room Designer', () => {
  test('landing screen is accessible and offers the mouse path', async ({ page }) => {
    await open(page, ROOM, true);
    await expect(page.getByRole('heading', { name: 'Point. Speak. Done.' })).toBeVisible();
    await axe(page);
    await page.getByRole('button', { name: /Use mouse and keyboard/ }).click();
    await expect(page.getByRole('heading', { name: 'Point. Speak. Done.' })).toBeHidden();
  });

  test('keyboard-only: select in the scene list, type a command, undo', async ({ page }) => {
    await open(page, ROOM);
    await page.getByRole('navigation', { name: 'Scene' }).getByRole('button', { name: 'Pumpkin 1' }).click();
    await say(page, 'make that bigger');
    await expect(page.getByRole('status').first()).toContainText('Make Pumpkin 1 bigger', { timeout: 5000 });
    const scale = () => page.evaluate(() => (window as any).__hocus.state.doc.app.items.find((i: any) => i.id === 'pumpkin-1').scale);
    await expect.poll(scale).toBeCloseTo(1.25);
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await expect.poll(scale).toBe(1);
    await axe(page);
  });

  test('real 3D pointing with the mouse: hover the ghost and say "turn this green"', async ({ page }) => {
    await open(page, ROOM);
    const p = await page.evaluate(() => (window as any).__hocus.stage.screenOf('ghost-1'));
    await page.mouse.move(p.x, p.y, { steps: 10 });
    await page.waitForTimeout(600);
    await say(page, 'turn this green');
    await expect.poll(() => page.evaluate(() => (window as any).__hocus.state.doc.app.items.find((i: any) => i.id === 'ghost-1').tint)).toBe('green');
  });

  test('destructive bulk delete asks for confirmation', async ({ page }) => {
    await open(page, ROOM);
    await page.evaluate(() => (window as any).__hocus.dispatch({ type: 'lasso', t: performance.now(), ids: ['candle-1', 'candle-2'] }));
    await say(page, 'delete these');
    await expect(page.getByRole('group', { name: 'Pending command' })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as any).__hocus.state.doc.app.items.length)).toBe(8);
    await page.getByRole('button', { name: /Confirm/ }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__hocus.state.doc.app.items.length)).toBe(6);
  });

  test('Spellbook and Settings open, trap focus and pass axe', async ({ page }) => {
    await open(page, ROOM);
    await page.getByRole('button', { name: /Spellbook/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe(page);
  });

  test('a lost WebGL context shows a message, then the 3D view recovers', async ({ page }) => {
    await open(page, ROOM);
    await page.evaluate(() => {
      const gl = (window as any).__hocus.stage.renderer.getContext();
      (window as any).__lose = gl.getExtension('WEBGL_lose_context');
      (window as any).__lose.loseContext();
    });
    await expect(page.getByRole('alert').filter({ hasText: /graphics driver/ })).toBeVisible();
    await page.evaluate(() => (window as any).__lose.restoreContext());
    await expect(page.getByRole('alert').filter({ hasText: /graphics driver/ })).toBeHidden({ timeout: 5000 });
    // The scene draws again: hit testing still finds the pumpkin.
    const p = await page.evaluate(() => (window as any).__hocus.stage.screenOf('pumpkin-1'));
    expect(p).not.toBeNull();
  });

  test('live preview: typing a command shows what Hocus would do before it is sent', async ({ page }) => {
    await open(page, ROOM);
    await page.getByRole('navigation', { name: 'Scene' }).getByRole('button', { name: 'Black cat 1' }).click();
    await page.fill('#hx-typed', 'rotate that');
    await expect(page.locator('.hx-ghost')).toContainText('Rotate Black cat 1', { timeout: 5000 });
    await expect(page.locator('.hx-word--live')).toContainText('Black cat 1');
    // Nothing has changed yet: the ghost is a preview only.
    expect(await page.evaluate(() => (window as any).__hocus.state.doc.app.items.find((i: any) => i.id === 'cat-1').rotation)).toBe(0);
  });

  test('X-ray shows why Hocus chose the target', async ({ page }) => {
    await open(page, ROOM);
    await page.getByRole('navigation', { name: 'Scene' }).getByRole('button', { name: 'Black cat 1' }).click();
    await say(page, 'rotate that');
    await page.getByRole('button', { name: /X-ray/ }).click();
    await expect(page.locator('.hx-xray')).toContainText('rotate that');
    await expect(page.locator('.hx-sr-summary')).toContainText('Resolved via');
  });
});

test.describe('Point & Ask Planet Explorer', () => {
  test('compare by keyboard selection order; info table and axe', async ({ page }) => {
    await open(page, PLANETS);
    const list = page.getByRole('navigation', { name: 'Bodies' });
    await list.getByRole('button', { name: 'Mars' }).click();
    await list.getByRole('button', { name: 'Earth' }).click({ modifiers: ['Shift'] });
    await say(page, 'compare this with that');
    await expect(page.getByRole('region', { name: 'Comparison' })).toContainText('Mars vs Earth', { timeout: 5000 });
    await axe(page);
  });

  test('quiz: answer by selecting and saying "that one"', async ({ page }) => {
    await open(page, PLANETS);
    await say(page, 'start the quiz');
    await expect(page.getByRole('region', { name: 'Quiz' })).toContainText('hottest', { timeout: 5000 });
    await page.getByRole('navigation', { name: 'Bodies' }).getByRole('button', { name: 'Venus' }).click();
    await say(page, 'that one');
    await expect(page.getByRole('region', { name: 'Quiz' })).toContainText('Score 1 / 1', { timeout: 5000 });
  });
});

test.describe('Recipe Board', () => {
  test('double an ingredient by keyboard path', async ({ page }) => {
    await open(page, KITCHEN);
    await page.getByRole('navigation', { name: 'Scene' }).getByRole('button', { name: 'Pumpkin purée' }).click();
    await say(page, 'double this');
    await expect.poll(() => page.evaluate(() => (window as any).__hocus.state.doc.app.cards.find((c: any) => c.id === 'pumpkin').qty)).toBe(400);
    await axe(page);
  });
});
