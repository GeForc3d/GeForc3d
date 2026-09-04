import { chromium } from 'playwright';

const OUT = process.argv[2];
const errors = [];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
    '--disable-background-networking','--disable-component-update','--no-first-run',
    '--disable-sync','--disable-default-apps','--disable-features=OptimizationHints,Translate'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  permissions: ['camera'],
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await shot('01-home');

// Free-text search
await page.fill('input[aria-label="Describe your shot"]', 'sitting at a cafe beside a window, candid');
await page.click('button[aria-label="Search poses"]');
await page.waitForTimeout(500);
await shot('02-search-results');

const chips = await page.locator('.setup .chip').allTextContents();
console.log('INFERRED CHIPS:', JSON.stringify(chips));

// Clear search, use scene tiles instead
await page.locator('.chip__x').first().click();
await page.waitForTimeout(300);
await page.click('button.scene-tile:has-text("Beach")');
await page.waitForTimeout(400);
await shot('03-beach');

// Open filter sheet, pick Standing + Individual
await page.click('.chip--add');
await page.waitForTimeout(400);
await page.locator('.sheet').getByRole('button', { name: 'Standing', exact: true }).click();
await page.locator('.sheet').getByRole('button', { name: 'Individual', exact: true }).click();
await shot('04-setup-sheet');
await page.locator('.sheet__foot').getByRole('button', { name: 'Apply' }).click();
await page.waitForTimeout(500);
await shot('05-filtered');

const cards = await page.locator('.pose-card__name').allTextContents();
console.log('RESULTS:', JSON.stringify(cards));

// Open a pose
await page.locator('.pose-card__link').first().click();
await page.waitForTimeout(600);
await shot('06-detail');
console.log('DETAIL URL:', page.url());

// Enter camera
await page.getByRole('button', { name: /Use this pose/i }).click();
await page.waitForTimeout(3000);
await shot('07-camera');

// Pose tray
await page.locator('.pose-pill').click();
await page.waitForTimeout(600);
await shot('08-tray');
await page.locator('.sheet__head button[aria-label="Close"]').click();
await page.waitForTimeout(300);

// Opacity control
await page.getByRole('button', { name: /Opacity/i }).click();
await page.waitForTimeout(300);
await shot('09-opacity');

// Capture
await page.locator('.shutter').click();
await page.waitForTimeout(1200);
await shot('10-review');

// Keep shooting
await page.getByRole('button', { name: 'Keep shooting' }).click();
await page.waitForTimeout(500);

// Back navigation chain
await page.goBack();
await page.waitForTimeout(600);
console.log('BACK 1:', page.url());
await shot('11-back-detail');
await page.goBack();
await page.waitForTimeout(600);
console.log('BACK 2:', page.url());
await shot('12-back-results');

// Library
await page.goto('http://127.0.0.1:4173/#/poses', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('13-library');

// Saved
await page.goto('http://127.0.0.1:4173/#/saved', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await shot('14-saved');

// Asset report
await page.goto('http://127.0.0.1:4173/#/dev/assets', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await shot('15-assets');

console.log('ERRORS:', JSON.stringify(errors, null, 2));
await browser.close();
