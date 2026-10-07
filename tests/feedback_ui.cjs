const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
(async () => {
 const info = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../build/scan-regression-info.json'),'utf8'));
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage(); const errors=[]; const sends=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('request', r=>{if (/feedback/.test(r.url())) sends.push(r.url());});
  await page.route('**/api/check-update',r=>r.fulfill({json:{success:true,has_update:false}}));
  await page.goto(info.url); await page.locator('#startup-screen').waitFor({state:'detached'});
  const feedback = page.locator('#btn-open-feedback');
  const settings = page.locator('[data-tab="tab-settings"]');
  assert.ok((await feedback.boundingBox()).y < (await settings.boundingBox()).y);
  await feedback.click(); await page.locator('#feedback-message').fill('Góp ý thử nghiệm');
  assert.equal(await page.locator('#app-sidebar').evaluate(e=>e.inert),true);
  assert.equal(await page.locator('#btn-copy-feedback').isEnabled(),true);
  await page.screenshot({path:path.resolve(__dirname,'../docs/feedback-preview.png')});
  await page.locator('#feedback-consent').check();
  assert.equal(await page.locator('#btn-send-feedback').isDisabled(),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#app-sidebar').evaluate(e=>e.inert),false);
  await page.locator('#btn-toggle-sidebar').click();
  await feedback.click();
  assert.equal(await page.locator('#feedback-message').inputValue(),'Góp ý thử nghiệm');
  assert.equal(await page.locator('#feedback-consent').isChecked(),false);
  await page.locator('#btn-close-feedback').click();
  await page.locator('#btn-toggle-sidebar').click();
  assert.deepEqual(sends,[]); assert.deepEqual(errors,[]);
  console.log('PASS: feedback above settings, collapsed access, focus/inert, draft, consent reset, no network send');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
