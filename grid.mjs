import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-GeForc3d/700d5a79-fd03-5a58-9a49-317fe7326bbb/scratchpad/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--disable-background-networking','--disable-component-update','--no-first-run',
    '--disable-sync','--disable-default-apps','--disable-features=OptimizationHints,Translate'] });
const ctx = await browser.newContext({ viewport:{width:390,height:2400}, deviceScaleFactor:2 });
const page = await ctx.newPage();
// Sitting
await page.goto('http://127.0.0.1:4173/#/poses', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(600);
await page.evaluate(() => { localStorage.clear(); });
await page.goto('http://127.0.0.1:4173/#/poses', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(600);
await page.locator('.chip--add').click();
await page.waitForTimeout(500);
await page.locator('.sheet').getByRole('button', { name: 'Sitting', exact: true }).click();
await page.locator('.sheet__foot').getByRole('button', { name: 'Apply' }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/grid-sitting.png` });
console.log('sitting:', await page.locator('.pose-card__name').allTextContents());
// Leaning + lying
for (const pos of ['Leaning','Lying']) {
  await page.locator('.chip--add').click();
  await page.waitForTimeout(400);
  await page.locator('.sheet').getByRole('button', { name: pos, exact: true }).click();
  await page.locator('.sheet__foot').getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/grid-${pos.toLowerCase()}.png` });
  console.log(pos, await page.locator('.pose-card__name').allTextContents());
}
await browser.close();
