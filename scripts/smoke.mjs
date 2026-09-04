/**
 * End-to-end smoke test against a built, served app.
 *
 * Unit tests cover the domain layer; this covers the things only a real browser
 * can tell you — that the camera starts, that the model loads from the bundled
 * assets, that capture produces a clean image, and that navigating back keeps
 * the user's context. It found several real bugs during development, including
 * asset paths picking up the route hash and replaced elements silently refusing
 * to stretch.
 *
 *   npm run build && npm run preview &
 *   node scripts/smoke.mjs [--out ./shots] [--url http://127.0.0.1:4173/]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const URL_BASE = arg('url', 'http://127.0.0.1:4173/');
const OUT = arg('out', null);
const failures = [];

const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ok   ${label}`);
  else {
    console.log(`  FAIL ${label} ${detail}`);
    failures.push(label);
  }
};

// PLAYWRIGHT_BROWSERS_PATH points at a pre-installed Chromium in some
// environments; fall back to whatever Playwright resolves on its own.
const executablePath =
  process.env.CHROMIUM_PATH ??
  (process.env.PLAYWRIGHT_BROWSERS_PATH
    ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium`
    : undefined);

const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--disable-background-networking',
    '--disable-component-update',
    '--no-first-run',
    '--disable-sync',
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['camera'],
});
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

if (OUT) await mkdir(OUT, { recursive: true });
const shot = async (name) => {
  if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` });
};

console.log('discover');
await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
check('home renders the opening question', await page.getByText('What are you shooting?').isVisible());
await shot('01-home');

console.log('search');
await page.fill('input[aria-label="Describe your shot"]', 'sitting at a cafe beside a window, candid');
await page.click('button[aria-label="Search poses"]');
await page.waitForTimeout(600);
const chips = await page.locator('.setup .chip').allTextContents();
check('interprets the description into visible chips', ['Cafe', 'Sitting', 'Window', 'Candid'].every((c) => chips.includes(c)), JSON.stringify(chips));
await shot('02-search');

console.log('filters');
await page.locator('.chip__x').first().click();
await page.waitForTimeout(300);
await page.click('button.scene-tile:has-text("Beach")');
await page.getByRole('button', { name: '+ Add detail' }).click();
await page.waitForTimeout(400);
await page.locator('.sheet').getByRole('button', { name: 'Standing', exact: true }).click();
await page.locator('.sheet').getByRole('button', { name: 'Individual', exact: true }).click();
await page.locator('.sheet__foot').getByRole('button', { name: 'Apply' }).click();
await page.waitForTimeout(600);
const names = await page.locator('.pose-card__name').allTextContents();
check('beach + standing + individual returns results', names.length >= 4, JSON.stringify(names));
check('results are visibly distinct poses', new Set(names).size === names.length);
await shot('03-results');

console.log('pose detail');
await page.locator('.pose-card__link').first().click();
await page.waitForTimeout(600);
check('detail shows the reference and an instruction', (await page.locator('.detail__lead').innerText()).length > 20);
check('placeholder references are labelled', (await page.locator('.dev-badge').count()) > 0);
await shot('04-detail');

console.log('camera');
await page.getByRole('button', { name: /Use this pose/i }).click();
await page.waitForTimeout(6000);
const cam = await page.evaluate(() => {
  const v = document.querySelector('video');
  return {
    video: v ? { w: v.videoWidth, ready: v.readyState, paused: v.paused } : null,
    guide: !!document.querySelector('.guide svg'),
    grid: !!document.querySelector('.cam__grid'),
    hud: document.querySelector('.hud')?.textContent ?? '',
  };
});
check('camera is live', cam.video?.w > 0 && cam.video.ready >= 2 && !cam.video.paused, JSON.stringify(cam.video));
check('transparent guide is present', cam.guide);
check('grid is present', cam.grid);
check('guidance says something useful', cam.hud.length > 0, cam.hud);
await shot('05-camera');

console.log('guide gestures');
const beforeDrag = await page.locator('.guide').evaluate((el) => el.style.transform);
await page.mouse.move(195, 350);
await page.mouse.down();
await page.mouse.move(245, 410, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(400);
const afterDrag = await page.locator('.guide').evaluate((el) => el.style.transform);
check('the guide can be dragged', beforeDrag !== afterDrag);

console.log('capture');
await page.locator('.shutter').click();
await page.waitForTimeout(1500);
check('review appears', (await page.locator('.review').count()) === 1);
const covered = await page.evaluate(() => {
  const el = document.elementFromPoint(195, 800);
  return el ? el.closest('.review') !== null : false;
});
check('review covers the camera controls', covered);
const dims = await page.locator('.review__count').innerText();
check('captured at source resolution', /\d{3,}×\d{3,}/.test(dims), dims);
await shot('06-review');

console.log('session continues');
await page.getByRole('button', { name: 'Keep', exact: true }).click();
await page.waitForTimeout(500);
check('keep returns to the camera, not home', page.url().includes('/camera'));

console.log('back navigation');
await page.goBack();
await page.waitForTimeout(600);
check('back from camera lands on the pose', page.url().includes('/pose/'));
await page.goBack();
await page.waitForTimeout(600);
check('back again lands on the previous context', !page.url().includes('/pose/'));

check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
console.log(failures.length ? `\n${failures.length} failed` : '\nall checks passed');
process.exit(failures.length ? 1 : 0);
