const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const info=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../build/scan-regression-info.json'),'utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();const checks=[],external=[],errors=[];
  page.on('request',r=>{if(r.url().endsWith('/api/check-update'))checks.push(r.url());if(!r.url().startsWith(info.url))external.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/check-update',r=>r.fulfill({json:{success:true,current_version:info.version,latest_version:info.version,has_update:false}}));
  const getSettings=async()=> (await (await page.request.get(info.url+'/api/settings')).json()).settings;
  assert.equal((await getSettings()).auto_check_updates,false);
  await page.goto(info.url);await page.locator('#startup-screen').waitFor({state:'detached'});await page.waitForTimeout(3000);
  assert.equal(checks.length,0,'Default/legacy launch must not start an update request');assert.deepEqual(external,[]);
  await page.locator('[data-tab="tab-settings"]').click();const automatic=page.locator('#auto-check-updates');assert.equal(await automatic.isChecked(),false);
  await page.route('**/api/settings',async r=>{if(r.request().method()==='POST' && 'auto_check_updates' in r.request().postDataJSON())await r.fulfill({status:500,json:{success:false,error:'Fixture write failure'}});else await r.continue();});
  await automatic.check();await page.waitForFunction(()=>!document.querySelector('#auto-check-updates').disabled && !document.querySelector('#auto-check-updates').checked);
  assert.equal((await getSettings()).auto_check_updates,false);assert.equal(checks.length,0);
  await page.unroute('**/api/settings');
  await page.locator('#btn-check-update-settings').click();await page.waitForFunction(()=>!document.querySelector('#btn-check-update-settings').disabled);assert.equal(checks.length,1);
  await automatic.check();await page.waitForFunction(()=>!document.querySelector('#auto-check-updates').disabled);assert.equal((await getSettings()).auto_check_updates,true);assert.equal(checks.length,1,'Enabling schedules next launch, no immediate call');
  await page.reload();await page.locator('#startup-screen').waitFor({state:'detached'});await page.waitForFunction(()=>document.querySelector('#auto-check-updates').checked);assert.equal(checks.length,2);
  await page.locator('[data-tab="tab-settings"]').click();await automatic.uncheck();await page.waitForFunction(()=>!document.querySelector('#auto-check-updates').disabled);assert.equal((await getSettings()).auto_check_updates,false);
  await page.reload();await page.locator('#startup-screen').waitFor({state:'detached'});await page.waitForTimeout(3000);assert.equal(checks.length,2);assert.equal(await automatic.isChecked(),false);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS: default no network/update, manual update, save failure rollback, optional opt-in next launch, persistent opt-out');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
