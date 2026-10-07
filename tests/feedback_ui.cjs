const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
(async () => {
 const info = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../build/scan-regression-info.json'),'utf8'));
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage(); const errors=[]; const sends=[];let fail=true;
  page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/api/feedback',async route=>{
   sends.push(route.request().postDataJSON());
   await route.fulfill({status:fail?503:200,json:fail?{success:false,error:'Website chưa thể nhận góp ý.'}:{success:true,id:'receipt'}});
  });
  await page.route('**/api/check-update',r=>r.fulfill({json:{success:true,has_update:false}}));
  await page.goto(info.url); await page.locator('#startup-screen').waitFor({state:'detached'});
  const feedback = page.locator('#btn-open-feedback'),send=page.locator('#btn-send-feedback');
  const settings = page.locator('[data-tab="tab-settings"]');
  assert.ok((await feedback.boundingBox()).y < (await settings.boundingBox()).y);
  await feedback.click();await page.locator('#feedback-message').fill('Góp ý thử nghiệm');
  assert.equal(await page.locator('#app-sidebar').evaluate(e=>e.inert),true);
  assert.equal(await send.isDisabled(),true);assert.equal(sends.length,0);
  await page.locator('#feedback-consent').check();assert.equal(await send.isEnabled(),true);assert.equal(sends.length,0);
  await page.locator('#feedback-email').fill('invalid');assert.equal(await send.isDisabled(),true);
  await page.locator('#feedback-email').fill('');await send.click();
  await page.waitForFunction(()=>document.querySelector('#feedback-status').textContent.includes('chưa thể nhận'));
  assert.equal(await page.locator('#feedback-message').inputValue(),'Góp ý thử nghiệm');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#app-sidebar').evaluate(e=>e.inert),false);
  await page.locator('#btn-toggle-sidebar').click();await feedback.click();
  assert.equal(await page.locator('#feedback-consent').isChecked(),false);assert.equal(await send.isDisabled(),true);
  await page.locator('#feedback-consent').check();
  await page.screenshot({path:path.resolve(__dirname,'../docs/feedback-preview.png')});
  fail=false;await send.click();
  await page.waitForFunction(()=>document.querySelector('#feedback-status').textContent.includes('Đã gửi góp ý'));
  assert.equal(sends.length,2);assert.equal(sends[0].request_id,sends[1].request_id);
  assert.equal(sends[0].consent,true);assert.equal(sends[0].consent_version,'feedback-v1');
  assert.deepEqual(Object.keys(sends[0]).sort(),['consent','consent_version','email','message','request_id']);
  assert.equal(await page.locator('#feedback-message').inputValue(),'');
  assert.equal(await page.locator('#feedback-consent').isChecked(),false);
  await page.locator('#btn-close-feedback').click();await page.locator('#btn-toggle-sidebar').click();
  assert.deepEqual(errors,[]);
  console.log('PASS: feedback opt-in, no send on open/check, draft on failure, idempotent explicit retry, successful receipt, collapsed access');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
