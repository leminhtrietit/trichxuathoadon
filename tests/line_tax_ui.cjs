// Sau ba bộ UI cũ: thêm fixture thuế trong workbook tạm và kiểm tra mọi dòng hóa đơn.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
(async()=>{
    const root=path.resolve(__dirname,'..');
    const info=JSON.parse(fs.readFileSync(path.join(root,'build/scan-regression-info.json'),'utf8'));
    const fixtureRoot=path.dirname(path.resolve(info.folder));
    assert.ok(fixtureRoot.startsWith(path.join(root,'build')+path.sep));
    const browser=await chromium.launch({channel:'msedge',headless:true});
    try{
        const page=await browser.newPage({viewport:{width:1320,height:860}});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        const status=await (await page.request.get(info.url+'/api/status')).json();
        assert.ok(path.resolve(status.excel_path).startsWith(fixtureRoot+path.sep));
        const base=fs.readFileSync(path.join(info.folder,'invoice.xml'),'utf8');
        const cases=[{no:'124',rate:'10%',extra:'<TThue>25</TThue>',tax:25,total:1025},
                     {no:'125',rate:'1,5%',extra:'',tax:15,total:1015},
                     {no:'126',rate:'KHAC',extra:'',tax:null,total:1100}];
        for(const item of cases){
            const xml=base.replace('<SHDon>123</SHDon>',`<SHDon>${item.no}</SHDon>`)
                .replace('<TSuat>10%</TSuat>',`<TSuat>${item.rate}</TSuat>${item.extra}`)
                .replace('<TgTThue>100</TgTThue>',`<TgTThue>${item.tax??100}</TgTThue>`)
                .replace('<TgTTTBSo>1100</TgTTTBSo>',`<TgTTTBSo>${item.total}</TgTTTBSo>`);
            const response=await page.request.post(info.url+'/api/upload',{multipart:{files:{name:`tax-${item.no}.xml`,mimeType:'text/xml',buffer:Buffer.from(xml)}}});
            const data=await response.json();assert.equal(data.success,true);
            assert.equal(data.invoices[0].hang_hoa[0].tien_thue,item.tax);
            const saved=await (await page.request.post(info.url+'/api/save-to-excel',{data:{invoices:data.invoices,overwrite:false}})).json();
            assert.equal(saved.success,true);assert.equal(saved.added,1);
        }
        const hash=()=>crypto.createHash('sha256').update(fs.readFileSync(status.excel_path)).digest('hex');
        const before=hash();const writes=[];
        page.on('request',request=>{if(request.method()!=='GET'&&/save-to-excel|clear|init-excel/.test(request.url()))writes.push(request.url());});
        await page.route('**/api/check-update',route=>route.fulfill({json:{success:true,current_version:info.version,latest_version:info.version,has_update:false}}));
        await page.goto(info.url);await page.locator('#startup-screen').waitFor({state:'detached'});
        await page.locator('[data-tab="tab-excel"]').click();
        await page.locator('#excel-table-body tr[role="button"]').first().waitFor();
        const rows=page.locator('#excel-table-body tr[role="button"]');assert.equal(await rows.count(),4);
        const allCases=[{no:'123',tax:100},...cases];
        for(let index=0;index<allCases.length;index++){
            await rows.nth(index).locator('td').nth(4).click(); // Bấm tên bên bán trong dòng, không cần nút mắt.
            await page.locator('#invoice-modal').waitFor({state:'visible'});
            assert.equal(await page.locator('#modal-inv-no').innerText(),allCases[index].no);
            const tax=await page.locator('#modal-items-body tr').first().locator('td').nth(7).innerText();
            assert.equal(tax,allCases[index].tax===null?'Chưa xác định':`${allCases[index].tax} đ`);
            assert.ok(!/Thông tin sản phẩm|Tính chất/.test(await page.locator('#modal-extra-info').innerText()));
            await page.locator('#btn-close-modal').click();
        }
        await page.locator('[data-tab="tab-items"]').click();
        await page.waitForFunction(()=>document.getElementById('items-table-count').textContent==='4 mặt hàng');
        const itemRows=page.locator('#items-table-body tr');
        for(let index=0;index<allCases.length;index++){
            const tax=await itemRows.nth(index).locator('td').nth(9).innerText();
            assert.equal(tax,allCases[index].tax===null?'Chưa xác định':`${allCases[index].tax} đ`);
        }
        await page.screenshot({path:path.join(root,'build/screens/line-tax-v2.0.5.png')});
        assert.equal(hash(),before);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
        console.log('PASS: every invoice row opens, declared/calculated/unknown tax, clean modal, workbook unchanged');
    }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
