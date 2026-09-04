import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-GeForc3d/700d5a79-fd03-5a58-9a49-317fe7326bbb/scratchpad/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
    '--disable-background-networking','--disable-component-update','--no-first-run',
    '--disable-sync','--disable-default-apps','--disable-features=OptimizationHints,Translate'] });
for (const [name,w,h] of [['w375',375,667],['desktop',1440,900]]) {
  const ctx = await browser.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:w<600, hasTouch:w<600, permissions:['camera'] });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4173/#/pose/weight-shift', { waitUntil:'domcontentloaded' });
  await page.getByRole('button', { name:/Use this pose/i }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/resp-${name}-camera.png` });
  const tools = await page.evaluate(() => {
    const row = document.querySelector('.cam__tools');
    return row ? { scrollW: row.scrollWidth, clientW: row.clientWidth,
      labels: [...row.querySelectorAll('.tool')].map(t => t.textContent) } : null;
  });
  console.log(name, JSON.stringify(tools));
  await ctx.close();
}
await browser.close();
