import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-GeForc3d/700d5a79-fd03-5a58-9a49-317fe7326bbb/scratchpad/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',
    '--disable-background-networking','--disable-component-update','--no-first-run',
    '--disable-sync','--disable-default-apps','--disable-features=OptimizationHints,Translate'] });
const sizes = [
  { name: 'w375', w: 375, h: 667 },
  { name: 'w390', w: 390, h: 844 },
  { name: 'w430', w: 430, h: 932 },
  { name: 'desktop', w: 1440, h: 900 },
];
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport:{width:s.w,height:s.h}, isMobile: s.w < 600, hasTouch: s.w < 600, permissions:['camera'] });
  const page = await ctx.newPage();
  const overflow = [];
  await page.goto('http://127.0.0.1:4173/#/poses', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/resp-${s.name}-library.png`, fullPage: false });
  const bodyOverflow = await page.evaluate(() => {
    const app = document.querySelector('.app');
    return app ? { scrollW: app.scrollWidth, clientW: app.clientWidth } : null;
  });
  // Check tap target sizes
  const small = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button, a')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 32 || r.width < 32) bad.push(`${el.tagName}.${typeof el.className==='string'?el.className:''} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return bad;
  });
  console.log(s.name, 'overflow:', JSON.stringify(bodyOverflow), 'small targets:', JSON.stringify(small));
  await ctx.close();
}
await browser.close();
