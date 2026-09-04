import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-GeForc3d/700d5a79-fd03-5a58-9a49-317fe7326bbb/scratchpad/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
    '--disable-background-networking','--disable-component-update','--no-first-run',
    '--disable-sync','--disable-default-apps','--disable-features=OptimizationHints,Translate'] });
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, permissions:['camera'] });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4173/#/pose/weight-shift', { waitUntil:'networkidle' });
await page.getByRole('button', { name:/Use this pose/i }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/cam-1.png` });
// drag the guide
await page.mouse.move(195, 350); await page.mouse.down();
await page.mouse.move(240, 400, { steps: 8 }); await page.mouse.up();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/cam-2-dragged.png` });
// tray
await page.locator('.pose-pill').click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/cam-3-tray.png` });
await page.locator('.sheet__head button[aria-label="Close"]').click();
await page.waitForTimeout(300);
// edit shot -> change Standing to Sitting (the incompatible-setup flow)
await page.getByRole('button', { name: /^Setup$/i }).first().click();
await page.waitForTimeout(600);
await page.locator('.sheet').getByRole('button', { name: 'Sitting', exact: true }).click();
await page.locator('.sheet__foot').getByRole('button', { name: 'Apply' }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/cam-4-incompatible.png` });
console.log('SHEET TITLE:', await page.locator('.sheet__title').innerText().catch(()=>'(none)'));
console.log('OPTIONS:', await page.locator('.sheet .pose-card__name').allTextContents());
// Choose one of the offered replacements and confirm we land straight back in camera.
await page.locator('.sheet .pose-card__link').first().click();
await page.waitForTimeout(800);
console.log('AFTER PICK URL:', page.url());
console.log('ACTIVE POSE:', await page.locator('.pose-pill span').innerText());
await page.screenshot({ path: `${OUT}/cam-5-after-pick.png` });
// Capture and review
await page.locator('.shutter').click();
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/cam-6-review.png` });
console.log('REVIEW VISIBLE:', await page.locator('.review').count());
console.log('CONTROLS COVERED:', await page.evaluate(() => {
  const el = document.elementFromPoint(195, 800);
  return el ? el.className : 'none';
}));
await browser.close();
