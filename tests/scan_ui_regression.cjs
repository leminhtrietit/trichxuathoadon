// Chạy sau tests/ui_fixture_server.py; yêu cầu Playwright và Edge.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
    const root = path.resolve(__dirname, '..');
    const info = JSON.parse(fs.readFileSync(path.join(root, 'build/scan-regression-info.json'), 'utf8'));
    const fixtureRoot = path.dirname(path.resolve(info.folder));
    assert.ok(fixtureRoot.startsWith(path.join(root, 'build') + path.sep), 'Fixture phải nằm trong thư mục build');
    assert.equal(path.dirname(path.resolve(info.empty)), fixtureRoot);
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1320, height: 860 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const status = await (await page.request.get(info.url + '/api/status')).json();
        assert.ok(path.resolve(status.excel_path).startsWith(fixtureRoot + path.sep), 'Không chạy UI test trên workbook thật');
        await page.route('**/api/check-update', route => route.fulfill({
            json: { success: true, current_version: info.version, latest_version: info.version, has_update: false }
        }));
        await page.goto(info.url);
        await page.locator('#startup-screen').waitFor({ state: 'detached' });

        async function scan(folder) {
            await page.locator('#card-open-folder-modal').click();
            await page.locator('#input-folder-path').fill(folder);
            await page.locator('#btn-scan-folder').click();
            await page.locator('#modal-extraction-result').waitFor({ state: 'visible' });
            assert.equal(await page.getByText(/Cannot read properties of null/).count(), 0);
            assert.equal(await page.locator('#btn-scan-folder').isEnabled(), true);
        }

        // Thành công: mở popup, đúng số tiền, badge và chi tiết hàng hóa.
        await scan(info.folder);
        assert.equal(await page.locator('#result-kpi-new').innerText(), '1');
        assert.equal(await page.locator('#result-modal-table-body tr').count(), 1);
        assert.match(await page.locator('#result-modal-table-body').innerText(), /1\.100/);
        assert.equal(await page.locator('#badge-upload-count').innerText(), '1');
        assert.equal(await page.locator('#items-table-body tr').count(), 1);

        // Lưu qua giao diện; workbook kiểm thử có đúng một hóa đơn.
        const saved = page.waitForResponse(response => response.url().endsWith('/api/save-to-excel'));
        await page.locator('#btn-confirm-add-to-excel').click();
        assert.equal((await (await saved).json()).success, true);
        await page.locator('#modal-extraction-result').waitFor({ state: 'hidden' });
        const summary = await (await page.request.get(info.url + '/api/excel-data')).json();
        assert.equal(summary.stats.total_invoices, 1);
        assert.equal(summary.stats.total_amount, 1100);

        // Quét lại hóa đơn đã có và ghi đè vẫn giữ đúng một hóa đơn.
        await scan(info.folder);
        assert.equal(await page.locator('#result-kpi-duplicate').innerText(), '1');
        await page.locator('input[name="modal-dup-option"][value="replace"]').check();
        const replaced = page.waitForResponse(response => response.url().endsWith('/api/save-to-excel'));
        await page.locator('#btn-confirm-add-to-excel').click();
        const replacement = await (await replaced).json();
        assert.equal(replacement.updated, 1);
        assert.equal(replacement.added, 0);
        await page.locator('#modal-extraction-result').waitFor({ state: 'hidden' });

        // Upload dùng cùng luồng cập nhật badge: vẫn mở được kết quả.
        await page.locator('#card-open-upload-modal').click();
        await page.locator('#modal-file-input').setInputFiles(path.join(info.folder, 'invoice.xml'));
        await page.locator('#btn-start-upload-process').click();
        await page.locator('#modal-extraction-result').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#result-kpi-duplicate').innerText(), '1');
        await page.locator('#btn-close-result-modal').click();

        // Bỏ hóa đơn khỏi preview: không lỗi, đếm mặt hàng trở về 0.
        await page.locator('#preview-table-body .btn-remove-invoice').click();
        assert.equal(await page.locator('#preview-container').isVisible(), false);
        assert.equal(await page.locator('#badge-upload-count').isVisible(), false);
        assert.equal(await page.locator('#items-table-count').innerText(), '0 mặt hàng');

        // Thư mục trống vẫn mở kết quả và không phát sinh lỗi classList.
        await scan(info.empty);
        assert.equal(await page.locator('#result-kpi-total').innerText(), '0');
        assert.equal(await page.getByText(/Cannot read properties of null/).count(), 0);
        assert.deepEqual(errors, []);
        console.log('PASS: scan, totals, save, duplicate replace, upload, clear preview, empty folder');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
