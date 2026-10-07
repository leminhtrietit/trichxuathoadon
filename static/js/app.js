/**
 * app.js - Xử lý logic giao diện ứng dụng trích xuất hóa đơn điện tử XML & PDF sang Excel
 * Hỗ trợ quét hàng loạt từ thư mục, kiểm trùng lặp, bóc tách XML/PDF và cập nhật Excel
 */

// Trạng thái ứng dụng
const state = {
    parsedInvoices: [],
    excelRows: [],
    pivotBySupplier: [],
    pivotByMonth: [],
    excelStats: {},
    excelPath: '',
    pivotFilters: {
        supplier: '',
        folder: '',
        month: ''
    }
};

// Khởi chạy khi tài liệu sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFolderScanner();
    initPivotTab();
    initDropzone();
    initActionButtons();
    initSettings();
    initInitExcelModal();
    initClearDataModal();
    initInvoiceModal();
    loadAppStatus();
    loadExcelData();
});

// Format tiền tệ VND
function formatCurrency(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
}

function formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return new Intl.NumberFormat('vi-VN').format(num);
}

// Hiển thị Toast thông báo hiện đại
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let icon = 'fa-circle-info';
    let gradient = 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-pink-500/25';
    
    if (type === 'success') {
        icon = 'fa-circle-check';
        gradient = 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/25';
    } else if (type === 'error') {
        icon = 'fa-circle-exclamation';
        gradient = 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-rose-500/25';
    } else if (type === 'warning') {
        icon = 'fa-triangle-exclamation';
        gradient = 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/25';
    }

    toast.className = `${gradient} px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 text-xs font-semibold pointer-events-auto transform transition-all duration-300 translate-y-3 opacity-0 ring-1 ring-white/20`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-base"></i>
        <span>${message}</span>
        <button class="ml-2 hover:opacity-75 focus:outline-none cursor-pointer" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-xmark text-sm"></i>
        </button>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-3', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-y-3', 'opacity-0');
        setTimeout(() => toast.remove(), 4000);
    }, 4500);
}

// Chuyển đổi Tab trong Sidebar dọc bên trái
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');

            tabs.forEach(t => {
                t.classList.remove('active-tab');
                t.classList.add('text-slate-600');
            });

            tab.classList.add('active-tab');
            tab.classList.remove('text-slate-600');

            panes.forEach(pane => {
                if (pane.id === targetId) {
                    pane.classList.remove('hidden');
                    pane.classList.add('block');
                } else {
                    pane.classList.remove('block');
                    pane.classList.add('hidden');
                }
            });

            if (targetId === 'tab-excel') {
                loadExcelData();
            } else if (targetId === 'tab-pivot') {
                populatePivotFilters();
                renderPivotTab();
            }
        });
    });
}

// ==============================================================
// 🌟 XỬ LÝ QUÉT HÀNG LOẠT TỪ THƯ MỤC CỐ ĐỊNH (BATCH FOLDER SCANNER)
// ==============================================================
function initFolderScanner() {
    const btnBrowseNative = document.getElementById('btn-browse-folder-native');
    const btnScanFolder = document.getElementById('btn-scan-folder');
    const inputFolderPath = document.getElementById('input-folder-path');

    // Mở hộp thoại chọn thư mục Windows trực tiếp
    if (btnBrowseNative) {
        btnBrowseNative.addEventListener('click', async () => {
            btnBrowseNative.disabled = true;
            btnBrowseNative.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-pink-500"></i><span>Đang mở...</span>`;

            try {
                const res = await fetch('/api/select-folder-dialog', { method: 'POST' });
                const data = await res.json();
                if (data.success && data.folder_path) {
                    inputFolderPath.value = data.folder_path;
                    showToast(`Đã chọn thư mục: ${data.folder_path}`, 'info');
                } else if (!data.cancelled) {
                    showToast(data.error || 'Không thể chọn thư mục', 'error');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            } finally {
                btnBrowseNative.disabled = false;
                btnBrowseNative.innerHTML = `<i class="fa-solid fa-folder-magnifying-glass text-pink-500"></i><span>Chọn Thư Mục...</span>`;
            }
        });
    }

    // Bắt đầu Quét & Trích xuất
    if (btnScanFolder) {
        btnScanFolder.addEventListener('click', async () => {
            const folderPath = inputFolderPath.value.trim();
            if (!folderPath) {
                showToast('Vui lòng nhập hoặc chọn thư mục chứa hóa đơn!', 'warning');
                return;
            }

            // Lấy chế độ trùng lặp
            const duplicateModeRadio = document.querySelector('input[name="duplicate-mode"]:checked');
            const duplicateMode = duplicateModeRadio ? duplicateModeRadio.value : 'replace';
            const isOverwrite = (duplicateMode === 'replace');

            const isRecursive = document.getElementById('chk-scan-recursive').checked;
            const isAutoSave = document.getElementById('chk-scan-auto-save').checked;

            btnScanFolder.disabled = true;
            btnScanFolder.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Đang quét thư mục...</span>`;
            showToast(`Đang quét hóa đơn XML & PDF trong: ${folderPath}`, 'info');

            try {
                const res = await fetch('/api/scan-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder_path: folderPath,
                        recursive: isRecursive,
                        auto_save: isAutoSave,
                        overwrite: isOverwrite
                    })
                });

                const data = await res.json();

                if (data.success) {
                    // Cập nhật thẻ kết quả quét
                    const summaryCard = document.getElementById('scan-summary-card');
                    summaryCard.classList.remove('hidden');

                    document.getElementById('scan-folder-display').textContent = data.folder_path;
                    document.getElementById('scan-total-files').textContent = data.total_files;
                    document.getElementById('scan-valid-files').textContent = data.valid_count;

                    if (data.save_info) {
                        document.getElementById('scan-added-count').textContent = data.save_info.added || 0;
                        document.getElementById('scan-updated-count').textContent = data.save_info.updated || 0;
                        document.getElementById('scan-skipped-count').textContent = data.save_info.skipped || 0;

                        let msg = `Đã quét ${data.total_files} file! Kết quả Excel: +${data.save_info.added} mới`;
                        if (data.save_info.updated > 0) msg += `, ${data.save_info.updated} đã thay thế`;
                        if (data.save_info.skipped > 0) msg += `, ${data.save_info.skipped} bỏ qua`;
                        showToast(msg, 'success');
                    } else {
                        document.getElementById('scan-added-count').textContent = 'Chưa lưu';
                        document.getElementById('scan-updated-count').textContent = '-';
                        document.getElementById('scan-skipped-count').textContent = '-';
                        showToast(`Đã tìm thấy & bóc tách ${data.valid_count} hóa đơn!`, 'success');
                    }

                    // Hiển thị danh sách các thư mục nhà cung cấp được phát hiện
                    const foldersBox = document.getElementById('scan-supplier-folders-box');
                    const foldersList = document.getElementById('scan-supplier-folders-list');
                    const foldersCount = document.getElementById('scan-supplier-folders-count');

                    if (foldersBox && foldersList) {
                        if (data.supplier_folders && data.supplier_folders.length > 0) {
                            foldersBox.classList.remove('hidden');
                            if (foldersCount) foldersCount.textContent = `${data.supplier_folders.length} thư mục NCC`;
                            foldersList.innerHTML = data.supplier_folders.map(f => `
                                <span class="inline-flex items-center px-3 py-1 rounded-xl bg-pink-50 border border-pink-200 text-pink-900 font-medium text-xs">
                                    <i class="fa-solid fa-folder-open text-pink-500 mr-1.5 text-xs"></i>
                                    <span class="font-bold mr-1.5">${f.name}</span>
                                    <span class="bg-pink-200/80 text-pink-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">(${f.count} file)</span>
                                </span>
                            `).join('');
                        } else {
                            foldersBox.classList.add('hidden');
                        }
                    }

                    // Đưa vào danh sách xem trước
                    if (data.invoices && data.invoices.length > 0) {
                        processParsedResults(data.invoices);
                    }

                    // Tải lại thống kê Excel
                    loadAppStatus();
                    loadExcelData();
                } else {
                    showToast(data.error || 'Có lỗi khi quét thư mục', 'error');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            } finally {
                btnScanFolder.disabled = false;
                btnScanFolder.innerHTML = `<i class="fa-solid fa-bolt"></i><span>Quét & Trích Xuất Ngay</span>`;
            }
        });
    }
}

// Xử lý kéo thả và tải file trực tiếp
function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');
    const btnSample = document.getElementById('btn-load-sample');

    if (btnBrowse && fileInput) {
        btnBrowse.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('border-pink-500', 'bg-pink-50/60');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-pink-500', 'bg-pink-50/60');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                handleUploadFiles(files);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                handleUploadFiles(fileInput.files);
                fileInput.value = '';
            }
        });
    }

    if (btnSample) {
        btnSample.addEventListener('click', (e) => {
            e.stopPropagation();
            loadSampleInvoice();
        });
    }
}

// Gọi API tải file lên server
async function handleUploadFiles(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    showToast(`Đang bóc tách ${files.length} tệp hóa đơn...`, 'info');

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            processParsedResults(data.invoices);
            showToast(`Đã đọc thành công ${data.valid_count} hóa đơn!`, 'success');
        } else {
            showToast(data.error || 'Có lỗi xảy ra khi tải file', 'error');
        }
    } catch (err) {
        showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
    }
}

// Nạp hóa đơn mẫu có sẵn
async function loadSampleInvoice() {
    showToast('Đang nạp file mẫu...', 'info');
    try {
        const res = await fetch('/api/load-sample', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            processParsedResults(data.invoices);
            showToast('Đã nạp thành công hóa đơn mẫu!', 'success');
        } else {
            showToast(data.error || 'Không nạp được file mẫu', 'error');
        }
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

// Xử lý kết quả trả về từ parser
function processParsedResults(newInvoices) {
    newInvoices.forEach(inv => {
        if (inv.success) {
            const exists = state.parsedInvoices.some(existing => existing.invoice_key === inv.invoice_key);
            if (!exists) {
                state.parsedInvoices.push(inv);
            }
        }
    });

    renderPreviewTable();
    renderItemsTable();
    updateBadges();
}

// Cập nhật các badge số lượng trên Sidebar và bảng
function updateBadges() {
    const previewCount = state.parsedInvoices.length;
    const badgeUpload = document.getElementById('badge-upload-count');
    const badgeItems = document.getElementById('badge-items-count');
    const actionsBar = document.getElementById('upload-actions');
    const saveCount = document.getElementById('save-count-badge');
    const previewContainer = document.getElementById('preview-container');

    if (previewCount > 0) {
        badgeUpload.textContent = previewCount;
        badgeUpload.classList.remove('hidden');
        actionsBar.classList.remove('hidden');
        previewContainer.classList.remove('hidden');
        saveCount.textContent = previewCount;

        const totalItems = state.parsedInvoices.reduce((sum, inv) => sum + (inv.hang_hoa ? inv.hang_hoa.length : 0), 0);
        badgeItems.textContent = totalItems;
        badgeItems.classList.remove('hidden');
        document.getElementById('items-table-count').textContent = `${totalItems} mặt hàng`;
    } else {
        badgeUpload.classList.add('hidden');
        badgeItems.classList.add('hidden');
        actionsBar.classList.add('hidden');
        previewContainer.classList.add('hidden');
    }
}

// Hiển thị danh sách hóa đơn trong bảng Preview
function renderPreviewTable() {
    const tbody = document.getElementById('preview-table-body');
    const countLabel = document.getElementById('preview-count');
    tbody.innerHTML = '';
    countLabel.textContent = `${state.parsedInvoices.length} hóa đơn`;

    if (state.parsedInvoices.length === 0) {
        return;
    }

    state.parsedInvoices.forEach((inv, index) => {
        const tt = inv.thong_tin_chung;
        const nb = inv.nguoi_ban;
        const nm = inv.nguoi_mua;
        const toan = inv.thanh_toan;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50';

        const fileTypeBadge = inv.file_type && inv.file_type.includes('PDF')
            ? `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"><i class="fa-solid fa-file-pdf mr-1"></i>PDF</span>`
            : `<span class="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-pink-100 text-pink-700 border border-pink-200"><i class="fa-solid fa-file-code mr-1"></i>XML</span>`;

        const statusBadge = inv.already_in_excel
            ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="Đã có trong file Excel"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Đã có trong Excel</span>`
            : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fa-solid fa-sparkles mr-1 text-emerald-500"></i>Mới</span>`;

        tr.innerHTML = `
            <td class="px-4 py-3.5 text-center text-slate-400 font-medium">${index + 1}</td>
            <td class="px-3 py-3.5 text-center">${fileTypeBadge}</td>
            <td class="px-4 py-3.5 font-bold text-rose-600 font-mono">${tt.so_hd || '---'}</td>
            <td class="px-4 py-3.5 font-semibold text-pink-700 font-mono">${tt.ky_hieu || '---'}</td>
            <td class="px-4 py-3.5 text-slate-600">${tt.ngay_lap || '---'}</td>
            <td class="px-5 py-3.5">
                <div class="font-bold text-slate-900 line-clamp-1 max-w-xs" title="${nb.ten}">${nb.ten || '---'}</div>
                <div class="text-[11px] text-pink-500">${nb.ma_cua_hang ? 'CH: ' + (nb.ten_cua_hang || nb.ma_cua_hang) : ''}</div>
            </td>
            <td class="px-4 py-3.5 font-mono text-slate-700 font-medium">${nb.mst || '---'}</td>
            <td class="px-5 py-3.5">
                <div class="text-slate-800 line-clamp-1 max-w-xs" title="${nm.ten}">${nm.ten || 'Khách hàng lẻ'}</div>
            </td>
            <td class="px-4 py-3.5 text-right font-mono text-slate-700">${formatCurrency(toan.tong_tien_chua_thue)}</td>
            <td class="px-4 py-3.5 text-right font-mono text-fuchsia-600">${formatCurrency(toan.tong_tien_thue)}</td>
            <td class="px-5 py-3.5 text-right font-extrabold font-mono text-rose-600 text-sm">${formatCurrency(toan.tong_tien_thanh_toan)}</td>
            <td class="px-4 py-3.5 text-center">${statusBadge}</td>
            <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center space-x-1.5">
                    <button class="btn-view-invoice p-2 text-pink-600 hover:text-pink-800 hover:bg-pink-100/70 rounded-xl transition-colors cursor-pointer" title="Xem chi tiết hóa đơn">
                        <i class="fa-regular fa-eye text-sm"></i>
                    </button>
                    <button class="btn-remove-invoice p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer" title="Xóa khỏi danh sách">
                        <i class="fa-regular fa-trash-can text-sm"></i>
                    </button>
                </div>
            </td>
        `;

        tr.querySelector('.btn-view-invoice').addEventListener('click', () => {
            showInvoiceModal(inv);
        });

        tr.querySelector('.btn-remove-invoice').addEventListener('click', () => {
            state.parsedInvoices.splice(index, 1);
            renderPreviewTable();
            renderItemsTable();
            updateBadges();
        });

        tbody.appendChild(tr);
    });
}

// Hiển thị chi tiết hàng hóa ở Tab 2
function renderItemsTable() {
    const tbody = document.getElementById('items-table-body');
    tbody.innerHTML = '';

    let rowIdx = 1;
    state.parsedInvoices.forEach(inv => {
        const tt = inv.thong_tin_chung;
        const nb = inv.nguoi_ban;

        (inv.hang_hoa || []).forEach(it => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50';

            tr.innerHTML = `
                <td class="px-4 py-3 text-center text-slate-400 font-medium">${rowIdx++}</td>
                <td class="px-4 py-3 font-bold text-rose-600 font-mono">${tt.so_hd || '---'}</td>
                <td class="px-4 py-3 font-semibold text-pink-700 font-mono">${tt.ky_hieu || '---'}</td>
                <td class="px-5 py-3 text-slate-700 max-w-[170px] truncate" title="${nb.ten}">${nb.ten || '---'}</td>
                <td class="px-4 py-3 font-mono text-slate-500">${it.ma_hang || '---'}</td>
                <td class="px-5 py-3 font-bold text-slate-900">${it.ten_hang || '---'}</td>
                <td class="px-4 py-3 text-center text-slate-600">${it.dvt || '---'}</td>
                <td class="px-4 py-3 text-right font-mono font-medium">${formatNumber(it.so_luong)}</td>
                <td class="px-4 py-3 text-right font-mono text-slate-600">${formatCurrency(it.don_gia)}</td>
                <td class="px-4 py-3 text-right font-mono text-slate-900 font-semibold">${formatCurrency(it.thanh_tien)}</td>
                <td class="px-4 py-3 text-center font-mono font-bold text-pink-600">${it.thue_suat || '---'}</td>
                <td class="px-4 py-3 text-right font-mono text-fuchsia-600">${formatCurrency(it.tien_thue)}</td>
                <td class="px-5 py-3 text-right font-mono font-extrabold text-rose-600">${formatCurrency(it.tong_tien_dong)}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    if (rowIdx === 1) {
        tbody.innerHTML = `<tr><td colspan="13" class="px-4 py-12 text-center text-slate-400 italic">Chưa có dữ liệu hàng hóa nào. Hãy quét thư mục hoặc tải file lên.</td></tr>`;
    }
}

// Xử lý các nút tác vụ (Lưu Excel, Mở Excel, Mở Thư Mục)
function initActionButtons() {
    const btnSave = document.getElementById('btn-save-to-excel');
    const btnClear = document.getElementById('btn-clear-preview');
    const btnOpenExcel = document.getElementById('btn-open-excel');
    const btnOpenExcelTab = document.getElementById('btn-open-excel-tab');
    const btnOpenFolder = document.getElementById('btn-open-folder');
    const btnRefreshExcel = document.getElementById('btn-refresh-excel');
    const searchInput = document.getElementById('excel-search-input');

    if (btnSave) {
        btnSave.addEventListener('click', saveParsedToExcel);
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (confirm('Bạn có chắc muốn xóa danh sách vừa tải lên khỏi màn hình xem trước?')) {
                state.parsedInvoices = [];
                renderPreviewTable();
                renderItemsTable();
                updateBadges();
                showToast('Đã dọn dẹp danh sách xem trước', 'info');
            }
        });
    }

    [btnOpenExcel, btnOpenExcelTab].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async () => {
                showToast('Đang mở file Excel trên máy...', 'info');
                try {
                    const res = await fetch('/api/open-excel', { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        showToast(data.message, 'success');
                    } else {
                        showToast(data.error, 'error');
                    }
                } catch (err) {
                    showToast('Lỗi: ' + err.message, 'error');
                }
            });
        }
    });

    if (btnOpenFolder) {
        btnOpenFolder.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/open-folder', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                } else {
                    showToast(data.error, 'error');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            }
        });
    }

    if (btnRefreshExcel) {
        btnRefreshExcel.addEventListener('click', () => {
            loadExcelData();
            loadAppStatus();
            showToast('Đã làm mới dữ liệu từ Excel', 'info');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterExcelTable(e.target.value);
        });
    }
}

// Lưu dữ liệu vào file Excel
async function saveParsedToExcel() {
    if (state.parsedInvoices.length === 0) {
        showToast('Chưa có hóa đơn nào để ghi vào Excel', 'warning');
        return;
    }

    const duplicateModeRadio = document.querySelector('input[name="duplicate-mode"]:checked');
    const duplicateMode = duplicateModeRadio ? duplicateModeRadio.value : 'replace';
    const overwrite = (duplicateMode === 'replace');

    showToast('Đang ghi dữ liệu vào file Excel...', 'info');

    try {
        const res = await fetch('/api/save-to-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoices: state.parsedInvoices,
                overwrite: overwrite
            })
        });
        const data = await res.json();

        if (data.success) {
            let msg = `Đã lưu thành công: +${data.added} hóa đơn mới`;
            if (data.updated > 0) msg += `, ${data.updated} HĐ đã thay thế`;
            if (data.skipped > 0) msg += `, ${data.skipped} HĐ bỏ qua`;

            showToast(msg, 'success');

            loadAppStatus();
            loadExcelData();

            state.parsedInvoices.forEach(inv => inv.already_in_excel = true);
            renderPreviewTable();
        } else {
            showToast(data.error || 'Có lỗi khi lưu vào Excel', 'error');
        }
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

// Tải trạng thái và số liệu thống kê KPI
async function loadAppStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        state.excelPath = data.excel_path;
        state.excelStats = data.stats || {};

        const totalInvoices = state.excelStats.total_invoices || 0;
        document.getElementById('stat-total-invoices').textContent = formatNumber(totalInvoices);
        document.getElementById('stat-total-amount').textContent = formatCurrency(state.excelStats.total_amount || 0);
        document.getElementById('stat-total-vat').textContent = formatCurrency(state.excelStats.total_vat || 0);
        document.getElementById('stat-total-sellers').textContent = formatNumber(state.excelStats.unique_sellers || 0);

        const badgeSuppliers = document.getElementById('badge-suppliers-count');
        if (badgeSuppliers) {
            badgeSuppliers.textContent = state.excelStats.unique_sellers || 0;
        }

        const fileName = data.excel_path ? data.excel_path.split(/[\\/]/).pop() : 'danh_sach_hoa_don.xlsx';
        const fileBadge = document.getElementById('excel-file-badge');
        if (fileBadge) fileBadge.textContent = `${fileName}`;

        const topbarName = document.getElementById('topbar-excel-name');
        if (topbarName) topbarName.textContent = fileName;

        const sidebarCount = document.getElementById('sidebar-invoices-count');
        if (sidebarCount) sidebarCount.textContent = `${formatNumber(totalInvoices)} HĐ`;

        const inputPath = document.getElementById('input-excel-path');
        if (inputPath) inputPath.value = data.excel_path;
    } catch (err) {
        console.error('Lỗi khi tải trạng thái:', err);
    }
}

// Tải danh sách hóa đơn từ file Excel
async function loadExcelData() {
    try {
        const res = await fetch('/api/excel-data');
        const data = await res.json();

        state.excelRows = data.rows || [];
        state.pivotBySupplier = data.pivot_by_supplier || [];
        state.pivotByMonth = data.pivot_by_month || [];
        state.excelStats = data.stats || {};

        const badgeSuppliers = document.getElementById('badge-suppliers-count');
        if (badgeSuppliers) {
            badgeSuppliers.textContent = state.excelStats.unique_sellers || 0;
        }

        renderExcelTable(state.excelRows);
        populatePivotFilters();
        renderPivotTab();
    } catch (err) {
        console.error('Lỗi khi tải dữ liệu Excel:', err);
    }
}

// Hiển thị bảng dữ liệu Excel ở Tab 3
function renderExcelTable(rows) {
    const tbody = document.getElementById('excel-table-body');
    tbody.innerHTML = '';

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="px-4 py-12 text-center text-slate-400 italic">File Excel hiện chưa có dữ liệu. Hãy quét thư mục để bắt đầu lưu trữ.</td></tr>`;
        return;
    }

    rows.forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50';

        tr.innerHTML = `
            <td class="px-5 py-3.5 text-center text-slate-400 font-medium">${r.stt}</td>
            <td class="px-4 py-3.5 font-bold text-rose-600 font-mono">${r.so_hd}</td>
            <td class="px-4 py-3.5 font-semibold text-pink-700 font-mono">${r.ky_hieu}</td>
            <td class="px-4 py-3.5 text-slate-600">${r.ngay_lap}</td>
            <td class="px-5 py-3.5">
                <div class="font-bold text-slate-900 line-clamp-1 max-w-xs" title="${r.nb_ten}">${r.nb_ten}</div>
            </td>
            <td class="px-4 py-3.5 font-mono text-slate-700 font-medium">${r.nb_mst}</td>
            <td class="px-5 py-3.5 text-slate-800 line-clamp-1 max-w-xs" title="${r.nm_ten}">${r.nm_ten}</td>
            <td class="px-4 py-3.5 text-right font-mono text-slate-700">${formatCurrency(r.tien_chua_thue)}</td>
            <td class="px-4 py-3.5 text-right font-mono text-fuchsia-600">${formatCurrency(r.tien_thue)}</td>
            <td class="px-5 py-3.5 text-right font-extrabold font-mono text-rose-600 text-sm">${formatCurrency(r.tong_tien)}</td>
            <td class="px-4 py-3.5 text-center font-bold text-slate-700">${r.so_mat_hang}</td>
            <td class="px-4 py-3.5 text-slate-400 text-[11px] font-mono">${r.thoi_gian_nhap || '---'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Bộ lọc tìm kiếm trên bảng Excel
function filterExcelTable(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
        renderExcelTable(state.excelRows);
        return;
    }

    const filtered = state.excelRows.filter(r => {
        return (
            (r.so_hd && r.so_hd.toLowerCase().includes(term)) ||
            (r.ky_hieu && r.ky_hieu.toLowerCase().includes(term)) ||
            (r.nb_ten && r.nb_ten.toLowerCase().includes(term)) ||
            (r.nb_mst && r.nb_mst.toLowerCase().includes(term)) ||
            (r.nm_ten && r.nm_ten.toLowerCase().includes(term)) ||
            (r.ngay_lap && r.ngay_lap.toLowerCase().includes(term))
        );
    });

    renderExcelTable(filtered);
}

// Cấu hình cài đặt & khởi tạo file Excel
function initSettings() {
    const btnSaveConfig = document.getElementById('btn-save-config');
    const btnResetConfig = document.getElementById('btn-reset-config');
    const btnBrowseExcel = document.getElementById('btn-browse-excel-save');
    const btnInitExcel = document.getElementById('btn-init-new-excel');
    const inputPath = document.getElementById('input-excel-path');

    // 1. Duyệt chọn vị trí và đặt tên file Excel bằng hộp thoại Windows
    if (btnBrowseExcel) {
        btnBrowseExcel.addEventListener('click', async () => {
            btnBrowseExcel.disabled = true;
            btnBrowseExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-pink-500 mr-1.5"></i> Đang chọn...';
            try {
                const res = await fetch('/api/select-excel-save-dialog', { method: 'POST' });
                const data = await res.json();
                if (data.success && data.filepath) {
                    if (inputPath) inputPath.value = data.filepath;
                    showToast(`Đã chọn đường dẫn: ${data.filepath}`, 'info');
                } else if (!data.cancelled) {
                    showToast(data.error || 'Không thể chọn vị trí lưu', 'warning');
                }
            } catch (err) {
                showToast('Lỗi khi mở hộp thoại chọn file: ' + err.message, 'error');
            } finally {
                btnBrowseExcel.disabled = false;
                btnBrowseExcel.innerHTML = '<i class="fa-solid fa-folder-magnifying-glass text-pink-500 mr-1.5"></i><span>Chọn Vị Trí Lưu...</span>';
            }
        });
    }

    // 2. Cập nhật liên kết file sẵn có
    if (btnSaveConfig) {
        btnSaveConfig.addEventListener('click', async () => {
            const newPath = inputPath ? inputPath.value.trim() : '';
            if (!newPath) {
                showToast('Đường dẫn không được để trống', 'warning');
                return;
            }

            try {
                const res = await fetch('/api/update-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ excel_path: newPath })
                });
                const data = await res.json();
                if (data.success) {
                    showToast('Đã cập nhật đường dẫn lưu file Excel!', 'success');
                    await loadAppStatus();
                    await loadExcelData();
                } else {
                    showToast(data.error, 'error');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            }
        });
    }

    // 3. Khôi phục hiển thị đường dẫn hiện tại
    if (btnResetConfig) {
        btnResetConfig.addEventListener('click', () => {
            if (inputPath) inputPath.value = state.excelPath;
            showToast('Đã khôi phục đường dẫn đang sử dụng', 'info');
        });
    }
}

// ==============================================================
// 🌟 MODAL KHỞI TẠO FILE LƯU TRỮ EXCEL MỚI
// ==============================================================
function initInitExcelModal() {
    const modal = document.getElementById('modal-init-excel');
    const btnSettingsInit = document.getElementById('btn-init-new-excel');
    const btnClose = document.getElementById('btn-close-init-modal');
    const btnCancel = document.getElementById('btn-cancel-init-modal');
    const btnBrowse = document.getElementById('btn-modal-browse-init');
    const btnDoInit = document.getElementById('btn-modal-do-init');
    const inputPath = document.getElementById('input-modal-init-path');

    function openInitModal() {
        if (!modal) return;
        if (inputPath) {
            inputPath.value = state.excelPath || 'C:\\Users\\minht\\OneDrive\\Documents\\trichxuathoadon\\danh_sach_hoa_don.xlsx';
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            if (inputPath) inputPath.focus();
        }, 120);
    }

    function closeInitModal() {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    if (btnSettingsInit) {
        btnSettingsInit.addEventListener('click', openInitModal);
    }

    [btnClose, btnCancel].forEach(btn => {
        if (btn) btn.addEventListener('click', closeInitModal);
    });

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeInitModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeInitModal();
        }
    });

    // Mở hộp thoại chọn vị trí lưu của Windows
    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            btnBrowse.disabled = true;
            btnBrowse.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-pink-500 mr-1.5"></i> Đang mở...';
            try {
                const res = await fetch('/api/select-excel-save-dialog', { method: 'POST' });
                const data = await res.json();
                if (data.success && data.filepath) {
                    if (inputPath) inputPath.value = data.filepath;
                    showToast(`Đã chọn: ${data.filepath}`, 'info');
                } else if (!data.cancelled) {
                    showToast(data.error || 'Không thể chọn vị trí lưu', 'warning');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            } finally {
                btnBrowse.disabled = false;
                btnBrowse.innerHTML = '<i class="fa-solid fa-folder-magnifying-glass text-pink-500 mr-1.5"></i><span>Chọn...</span>';
            }
        });
    }

    // Thực hiện khởi tạo file Excel mới
    if (btnDoInit) {
        btnDoInit.addEventListener('click', async () => {
            const targetPath = inputPath ? inputPath.value.trim() : '';
            if (!targetPath) {
                showToast('Vui lòng chọn hoặc nhập đường dẫn file Excel!', 'warning');
                return;
            }

            btnDoInit.disabled = true;
            btnDoInit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Đang khởi tạo...';

            try {
                const res = await fetch('/api/init-excel-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ excel_path: targetPath })
                });
                const data = await res.json();
                if (data.success) {
                    closeInitModal();
                    showToast('Đã khởi tạo thành công file lưu trữ Excel mới!', 'success');
                    state.excelPath = data.excel_path;
                    await loadAppStatus();
                    await loadExcelData();
                } else {
                    showToast(data.error || 'Khởi tạo file Excel thất bại', 'error');
                }
            } catch (err) {
                showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
            } finally {
                btnDoInit.disabled = false;
                btnDoInit.innerHTML = '<i class="fa-solid fa-check mr-1.5"></i><span>Khởi Tạo & Sử Dụng</span>';
            }
        });
    }
}

// Modal Xóa Toàn Bộ Dữ Liệu Excel có ràng buộc chuỗi nghiêm ngặt
function initClearDataModal() {
    const modal = document.getElementById('modal-clear-data');
    const btnOpenFromSettings = document.getElementById('btn-open-clear-modal');
    const btnClose = document.getElementById('btn-close-clear-modal');
    const btnCancel = document.getElementById('btn-cancel-clear-modal');
    const inputConfirm = document.getElementById('input-confirm-clear');
    const matchStatus = document.getElementById('clear-match-status');
    const btnExecute = document.getElementById('btn-execute-clear');
    const modalFilePath = document.getElementById('clear-modal-filepath');
    const modalCount = document.getElementById('clear-modal-count');

    const REQUIRED_CONFIRMATION = "XÓA TOÀN BỘ DỮ LIỆU";

    function openClearModal() {
        if (!modal) return;
        if (modalFilePath) modalFilePath.textContent = state.excelPath || 'danh_sach_hoa_don.xlsx';
        if (modalCount) modalCount.textContent = formatNumber(state.excelStats.total_invoices || 0);

        if (inputConfirm) {
            inputConfirm.value = '';
            inputConfirm.classList.remove('border-emerald-500', 'bg-emerald-50/20');
            inputConfirm.classList.add('border-slate-300');
        }
        if (matchStatus) {
            matchStatus.textContent = 'Chưa nhập đúng chuỗi xác nhận';
            matchStatus.className = 'text-[11px] text-center font-medium text-slate-400';
        }
        if (btnExecute) {
            btnExecute.disabled = true;
            btnExecute.className = 'px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-300 cursor-not-allowed transition-all flex items-center space-x-2';
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            if (inputConfirm) inputConfirm.focus();
        }, 120);
    }

    function closeClearModal() {
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (inputConfirm) inputConfirm.value = '';
    }

    if (btnOpenFromSettings) {
        btnOpenFromSettings.addEventListener('click', openClearModal);
    }

    [btnClose, btnCancel].forEach(btn => {
        if (btn) btn.addEventListener('click', closeClearModal);
    });

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeClearModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeClearModal();
        }
    });

    // Kiểm tra ràng buộc ký tự thời gian thực
    if (inputConfirm) {
        inputConfirm.addEventListener('input', () => {
            const val = inputConfirm.value.trim();
            if (val === REQUIRED_CONFIRMATION) {
                // Khớp chuẩn 100%
                matchStatus.textContent = '✓ Đã khớp chuỗi xác nhận! Bạn có thể thực hiện xóa.';
                matchStatus.className = 'text-[11px] text-center font-bold text-emerald-600 animate-pulse';
                inputConfirm.classList.remove('border-slate-300');
                inputConfirm.classList.add('border-emerald-500', 'bg-emerald-50/20');

                btnExecute.disabled = false;
                btnExecute.className = 'px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 shadow-lg shadow-red-600/30 cursor-pointer transition-all flex items-center space-x-2';
            } else {
                // Chưa khớp
                matchStatus.textContent = 'Chưa khớp chuỗi xác nhận (yêu cầu gõ đúng từng chữ HOA)';
                matchStatus.className = 'text-[11px] text-center font-medium text-slate-400';
                inputConfirm.classList.remove('border-emerald-500', 'bg-emerald-50/20');
                inputConfirm.classList.add('border-slate-300');

                btnExecute.disabled = true;
                btnExecute.className = 'px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-300 cursor-not-allowed transition-all flex items-center space-x-2';
            }
        });
    }

    // Gọi API xóa vĩnh viễn khi nhấn nút
    if (btnExecute) {
        btnExecute.addEventListener('click', async () => {
            const val = inputConfirm ? inputConfirm.value.trim() : '';
            if (val !== REQUIRED_CONFIRMATION) {
                showToast(`Bạn phải nhập chính xác: '${REQUIRED_CONFIRMATION}'`, 'error');
                return;
            }

            btnExecute.disabled = true;
            btnExecute.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Đang xóa toàn bộ dữ liệu...';

            try {
                const res = await fetch('/api/clear-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ confirmation: val })
                });
                const data = await res.json();
                if (data.success) {
                    closeClearModal();
                    showToast('Đã xóa sạch toàn bộ dữ liệu và reset sổ Excel về 0!', 'success');
                    await loadAppStatus();
                    await loadExcelData();
                } else {
                    showToast(data.error || 'Không thể xóa dữ liệu', 'error');
                    btnExecute.disabled = false;
                    btnExecute.innerHTML = '<i class="fa-solid fa-trash-can mr-1.5"></i><span>Xác Nhận Xóa Vĩnh Viễn</span>';
                }
            } catch (err) {
                showToast('Lỗi máy chủ: ' + err.message, 'error');
                btnExecute.disabled = false;
                btnExecute.innerHTML = '<i class="fa-solid fa-trash-can mr-1.5"></i><span>Xác Nhận Xóa Vĩnh Viễn</span>';
            }
        });
    }
}

// Modal xem bản thể hiện hóa đơn điện tử trực quan
function initInvoiceModal() {
    const modal = document.getElementById('invoice-modal');
    const btnClose = document.getElementById('btn-close-modal');
    const btnPrint = document.getElementById('btn-print-modal');

    if (btnClose) {
        btnClose.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    });

    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }
}

function showInvoiceModal(inv) {
    const modal = document.getElementById('invoice-modal');
    const tt = inv.thong_tin_chung;
    const nb = inv.nguoi_ban;
    const nm = inv.nguoi_mua;
    const toan = inv.thanh_toan;

    document.getElementById('modal-seller-name').textContent = nb.ten || '---';
    document.getElementById('modal-seller-mst').textContent = nb.mst || '---';
    document.getElementById('modal-seller-address').textContent = nb.dia_chi || '---';
    document.getElementById('modal-seller-phone').textContent = nb.sdt || '---';

    document.getElementById('modal-inv-title').textContent = tt.ten_hoa_don || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG';
    document.getElementById('modal-inv-form').textContent = tt.mau_so || '---';
    document.getElementById('modal-inv-series').textContent = tt.ky_hieu || '---';
    document.getElementById('modal-inv-no').textContent = tt.so_hd || '---';
    document.getElementById('modal-inv-date').textContent = tt.ngay_lap || '---';
    document.getElementById('modal-inv-taxcode-auth').innerHTML = tt.ma_cqt 
        ? `Mã CQT: <span class="font-mono font-semibold text-slate-700">${tt.ma_cqt}</span>` 
        : '';

    document.getElementById('modal-buyer-name').textContent = nm.ten || '---';
    document.getElementById('modal-buyer-mst').textContent = nm.mst || '---';
    document.getElementById('modal-buyer-address').textContent = nm.dia_chi || '---';
    document.getElementById('modal-payment-method').textContent = tt.hinh_thuc_tt || 'TM/CK';
    document.getElementById('modal-currency').textContent = tt.dong_tien || 'VND';

    const itemsBody = document.getElementById('modal-items-body');
    itemsBody.innerHTML = '';
    (inv.hang_hoa || []).forEach(it => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-pink-50/40';
        tr.innerHTML = `
            <td class="border border-pink-200 px-2 py-2 text-center text-slate-500">${it.stt}</td>
            <td class="border border-pink-200 px-3 py-2 font-medium text-slate-900">${it.ten_hang}</td>
            <td class="border border-pink-200 px-2 py-2 text-center text-slate-600">${it.dvt || ''}</td>
            <td class="border border-pink-200 px-2 py-2 text-right font-mono">${formatNumber(it.so_luong)}</td>
            <td class="border border-pink-200 px-3 py-2 text-right font-mono">${formatCurrency(it.don_gia)}</td>
            <td class="border border-pink-200 px-3 py-2 text-right font-mono font-semibold">${formatCurrency(it.thanh_tien)}</td>
            <td class="border border-pink-200 px-2 py-2 text-center font-mono font-bold text-pink-600">${it.thue_suat || ''}</td>
            <td class="border border-pink-200 px-3 py-2 text-right font-mono text-fuchsia-600">${formatCurrency(it.tien_thue)}</td>
        `;
        itemsBody.appendChild(tr);
    });

    document.getElementById('modal-total-without-vat').textContent = formatCurrency(toan.tong_tien_chua_thue);
    document.getElementById('modal-total-vat').textContent = formatCurrency(toan.tong_tien_thue);
    document.getElementById('modal-total-amount').textContent = formatCurrency(toan.tong_tien_thanh_toan);
    document.getElementById('modal-total-in-words').textContent = toan.tong_tien_chu || '---';

    const signDate = tt.ngay_ky ? tt.ngay_ky.replace('T', ' ') : 'Hợp lệ';
    document.getElementById('modal-sign-date').textContent = `Ngày ký: ${signDate}`;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ==============================================================
// 🌟 XỬ LÝ TAB TỔNG QUAN & BỘ LỌC PIVOT (SHEET 1: TONGQUAN)
// ==============================================================
function initPivotTab() {
    const selSupplier = document.getElementById('pivot-filter-supplier');
    const selFolder = document.getElementById('pivot-filter-folder');
    const selMonth = document.getElementById('pivot-filter-month');
    const btnReset = document.getElementById('btn-reset-pivot-filters');
    const btnOpenExcel = document.getElementById('btn-open-excel-pivot');

    if (selSupplier) {
        selSupplier.addEventListener('change', (e) => {
            state.pivotFilters.supplier = e.target.value;
            renderPivotTab();
        });
    }

    if (selFolder) {
        selFolder.addEventListener('change', (e) => {
            state.pivotFilters.folder = e.target.value;
            renderPivotTab();
        });
    }

    if (selMonth) {
        selMonth.addEventListener('change', (e) => {
            state.pivotFilters.month = e.target.value;
            renderPivotTab();
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => {
            state.pivotFilters.supplier = '';
            state.pivotFilters.folder = '';
            state.pivotFilters.month = '';
            if (selSupplier) selSupplier.value = '';
            if (selFolder) selFolder.value = '';
            if (selMonth) selMonth.value = '';
            renderPivotTab();
            showToast('Đã đặt lại tất cả bộ lọc', 'info');
        });
    }

    if (btnOpenExcel) {
        btnOpenExcel.addEventListener('click', async () => {
            showToast('Đang mở file Excel (Sheet TongQuan)...', 'info');
            try {
                const res = await fetch('/api/open-excel', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast(data.message, 'success');
                } else {
                    showToast(data.error, 'error');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            }
        });
    }
}

// Điền các lựa chọn vào các bộ lọc Dropdown (Slicers)
function populatePivotFilters() {
    const selSupplier = document.getElementById('pivot-filter-supplier');
    const selFolder = document.getElementById('pivot-filter-folder');
    const selMonth = document.getElementById('pivot-filter-month');

    if (!selSupplier || !selFolder || !selMonth) return;

    const currentSupplier = state.pivotFilters.supplier || selSupplier.value;
    const currentFolder = state.pivotFilters.folder || selFolder.value;
    const currentMonth = state.pivotFilters.month || selMonth.value;

    const suppliersMap = new Map();
    const foldersSet = new Set();
    const monthsSet = new Set();

    (state.excelRows || []).forEach(r => {
        if (r.nb_mst) {
            suppliersMap.set(r.nb_mst, r.nb_ten || r.nb_mst);
        }
        if (r.supplier_folder) {
            foldersSet.add(r.supplier_folder);
        }
        if (r.ngay_lap && r.ngay_lap.length >= 7) {
            monthsSet.add(r.ngay_lap.substring(0, 7));
        }
    });

    selSupplier.innerHTML = '<option value="">-- Tất cả nhà cung cấp --</option>';
    Array.from(suppliersMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
        .forEach(([mst, name]) => {
            const opt = document.createElement('option');
            opt.value = mst;
            opt.textContent = `[${mst}] ${name}`;
            if (mst === currentSupplier) opt.selected = true;
            selSupplier.appendChild(opt);
        });

    selFolder.innerHTML = '<option value="">-- Tất cả thư mục NCC --</option>';
    Array.from(foldersSet)
        .sort((a, b) => a.localeCompare(b, 'vi'))
        .forEach(folder => {
            const opt = document.createElement('option');
            opt.value = folder;
            opt.textContent = folder;
            if (folder === currentFolder) opt.selected = true;
            selFolder.appendChild(opt);
        });

    selMonth.innerHTML = '<option value="">-- Tất cả các tháng --</option>';
    Array.from(monthsSet)
        .sort()
        .reverse()
        .forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = `Tháng ${m}`;
            if (m === currentMonth) opt.selected = true;
            selMonth.appendChild(opt);
        });
}

// Render dữ liệu phân tích và các bảng Pivot
function renderPivotTab() {
    const fSupplier = state.pivotFilters.supplier;
    const fFolder = state.pivotFilters.folder;
    const fMonth = state.pivotFilters.month;

    // Lọc danh sách hóa đơn theo 3 bộ lọc (Slicers)
    const filteredRows = (state.excelRows || []).filter(r => {
        if (fSupplier && r.nb_mst !== fSupplier) return false;
        if (fFolder && r.supplier_folder !== fFolder) return false;
        if (fMonth && (!r.ngay_lap || !r.ngay_lap.startsWith(fMonth))) return false;
        return true;
    });

    // Tính toán KPI theo dữ liệu sau lọc
    let totalInvoices = filteredRows.length;
    let totalChuaThue = 0;
    let totalThue = 0;
    let totalThanhToan = 0;

    filteredRows.forEach(r => {
        totalChuaThue += (r.tien_chua_thue || 0);
        totalThue += (r.tien_thue || 0);
        totalThanhToan += (r.tong_tien || 0);
    });

    // Cập nhật 4 thẻ KPI lớn hiển thị live theo dữ liệu sau bộ lọc
    const statInvoices = document.getElementById('stat-total-invoices');
    const statAmount = document.getElementById('stat-total-amount');
    const statVat = document.getElementById('stat-total-vat');
    const statSellers = document.getElementById('stat-total-sellers');

    const distinctSellers = new Set(filteredRows.map(r => r.nb_mst).filter(Boolean)).size;

    if (statInvoices) statInvoices.textContent = formatNumber(totalInvoices);
    if (statAmount) statAmount.textContent = formatCurrency(totalThanhToan);
    if (statVat) statVat.textContent = formatCurrency(totalThue);
    if (statSellers) statSellers.textContent = formatNumber(distinctSellers);

    // ==========================================
    // 1. RENDER BẢNG 1: PIVOT THEO NHÀ CUNG CẤP & THƯ MỤC
    // ==========================================
    const supplierAgg = new Map();
    filteredRows.forEach(r => {
        const key = `${r.nb_mst || ''}___${r.nb_ten || ''}___${r.supplier_folder || 'Thư mục gốc'}`;
        if (!supplierAgg.has(key)) {
            supplierAgg.set(key, {
                mst: r.nb_mst || '---',
                name: r.nb_ten || '---',
                folder: r.supplier_folder || 'Thư mục gốc',
                count: 0,
                chua_thue: 0,
                thue: 0,
                tong: 0
            });
        }
        const item = supplierAgg.get(key);
        item.count += 1;
        item.chua_thue += (r.tien_chua_thue || 0);
        item.thue += (r.tien_thue || 0);
        item.tong += (r.tong_tien || 0);
    });

    const supplierList = Array.from(supplierAgg.values()).sort((a, b) => b.tong - a.tong);
    const tbody1 = document.getElementById('pivot-supplier-table-body');
    const tfoot1 = document.getElementById('pivot-supplier-table-foot');
    const badgeSupplierCount = document.getElementById('pivot-supplier-count-badge');

    if (badgeSupplierCount) {
        badgeSupplierCount.textContent = `${supplierList.length} NCC`;
    }

    if (tbody1) {
        tbody1.innerHTML = '';
        if (supplierList.length === 0) {
            tbody1.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-400 italic">Không tìm thấy dữ liệu nhà cung cấp phù hợp với bộ lọc.</td></tr>`;
        } else {
            supplierList.forEach((s, idx) => {
                const ratio = totalThanhToan > 0 ? (s.tong / totalThanhToan) * 100 : 0;
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50 cursor-pointer';
                tr.title = 'Nhấp để lọc chỉ nhà cung cấp này';
                tr.addEventListener('click', () => {
                    const sel = document.getElementById('pivot-filter-supplier');
                    if (sel && s.mst !== '---') {
                        sel.value = s.mst;
                        state.pivotFilters.supplier = s.mst;
                        renderPivotTab();
                    }
                });

                tr.innerHTML = `
                    <td class="px-4 py-3 text-center text-slate-400 font-semibold">${idx + 1}</td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-slate-700">${s.mst}</td>
                    <td class="px-5 py-3">
                        <div class="font-bold text-slate-900 line-clamp-1 max-w-xs hover:text-pink-600 transition-colors" title="${s.name}">
                            ${s.name}
                        </div>
                    </td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-pink-50 border border-pink-200 text-pink-800 text-[11px] font-semibold">
                            <i class="fa-solid fa-folder text-pink-500 mr-1 text-[10px]"></i>
                            ${s.folder}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">${s.count}</td>
                    <td class="px-4 py-3 text-right font-mono text-slate-700">${formatCurrency(s.chua_thue)}</td>
                    <td class="px-4 py-3 text-right font-mono text-fuchsia-600">${formatCurrency(s.thue)}</td>
                    <td class="px-5 py-3 text-right font-extrabold font-mono text-rose-600">${formatCurrency(s.tong)}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="text-[11px] font-bold text-slate-700">${ratio.toFixed(1)}%</div>
                        <div class="w-full bg-pink-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div class="bg-gradient-to-r from-pink-500 to-rose-500 h-1.5 rounded-full" style="width: ${Math.min(ratio, 100)}%"></div>
                        </div>
                    </td>
                `;
                tbody1.appendChild(tr);
            });
        }
    }

    if (tfoot1) {
        tfoot1.innerHTML = `
            <tr class="text-slate-800">
                <td class="px-4 py-3 text-center">#</td>
                <td colspan="3" class="px-5 py-3 font-extrabold text-left uppercase tracking-wider text-pink-700">
                    TỔNG CỘNG (${supplierList.length} Nhà cung cấp)
                </td>
                <td class="px-4 py-3 text-center font-extrabold text-slate-900">${totalInvoices}</td>
                <td class="px-4 py-3 text-right font-mono font-extrabold text-slate-900">${formatCurrency(totalChuaThue)}</td>
                <td class="px-4 py-3 text-right font-mono font-extrabold text-fuchsia-700">${formatCurrency(totalThue)}</td>
                <td class="px-5 py-3 text-right font-mono font-black text-rose-600 text-sm">${formatCurrency(totalThanhToan)}</td>
                <td class="px-4 py-3 text-center font-bold text-pink-700">100.0%</td>
            </tr>
        `;
    }

    // ==========================================
    // 2. RENDER BẢNG 2: PIVOT THEO THÁNG / KỲ KÊ KHAI
    // ==========================================
    const monthAgg = new Map();
    filteredRows.forEach(r => {
        const mKey = (r.ngay_lap && r.ngay_lap.length >= 7) ? r.ngay_lap.substring(0, 7) : 'Chưa rõ';
        if (!monthAgg.has(mKey)) {
            monthAgg.set(mKey, {
                month: mKey,
                count: 0,
                chua_thue: 0,
                thue: 0,
                tong: 0
            });
        }
        const item = monthAgg.get(mKey);
        item.count += 1;
        item.chua_thue += (r.tien_chua_thue || 0);
        item.thue += (r.tien_thue || 0);
        item.tong += (r.tong_tien || 0);
    });

    const monthList = Array.from(monthAgg.values()).sort((a, b) => a.month.localeCompare(b.month));
    const tbody2 = document.getElementById('pivot-month-table-body');
    const tfoot2 = document.getElementById('pivot-month-table-foot');

    if (tbody2) {
        tbody2.innerHTML = '';
        if (monthList.length === 0) {
            tbody2.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400 italic">Không có dữ liệu theo kỳ kê khai.</td></tr>`;
        } else {
            monthList.forEach((m, idx) => {
                const ratio = totalThanhToan > 0 ? (m.tong / totalThanhToan) * 100 : 0;
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50 cursor-pointer';
                tr.title = 'Nhấp để lọc chỉ tháng này';
                tr.addEventListener('click', () => {
                    const sel = document.getElementById('pivot-filter-month');
                    if (sel && m.month !== 'Chưa rõ') {
                        sel.value = m.month;
                        state.pivotFilters.month = m.month;
                        renderPivotTab();
                    }
                });

                tr.innerHTML = `
                    <td class="px-4 py-3 text-center text-slate-400 font-semibold">${idx + 1}</td>
                    <td class="px-4 py-3 text-center font-mono font-bold text-pink-700">${m.month}</td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">${m.count}</td>
                    <td class="px-4 py-3 text-right font-mono text-slate-700">${formatCurrency(m.chua_thue)}</td>
                    <td class="px-4 py-3 text-right font-mono text-fuchsia-600">${formatCurrency(m.thue)}</td>
                    <td class="px-5 py-3 text-right font-extrabold font-mono text-rose-600">${formatCurrency(m.tong)}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="text-[11px] font-bold text-slate-700">${ratio.toFixed(1)}%</div>
                        <div class="w-full bg-pink-100 rounded-full h-1.5 mt-1 overflow-hidden">
                            <div class="bg-gradient-to-r from-pink-500 to-rose-500 h-1.5 rounded-full" style="width: ${Math.min(ratio, 100)}%"></div>
                        </div>
                    </td>
                `;
                tbody2.appendChild(tr);
            });
        }
    }

    if (tfoot2) {
        tfoot2.innerHTML = `
            <tr class="text-slate-800">
                <td class="px-4 py-3 text-center">#</td>
                <td class="px-4 py-3 font-extrabold text-left uppercase tracking-wider text-pink-700">TỔNG CỘNG</td>
                <td class="px-4 py-3 text-center font-extrabold text-slate-900">${totalInvoices}</td>
                <td class="px-4 py-3 text-right font-mono font-extrabold text-slate-900">${formatCurrency(totalChuaThue)}</td>
                <td class="px-4 py-3 text-right font-mono font-extrabold text-fuchsia-700">${formatCurrency(totalThue)}</td>
                <td class="px-5 py-3 text-right font-mono font-black text-rose-600 text-sm">${formatCurrency(totalThanhToan)}</td>
                <td class="px-4 py-3 text-center font-bold text-pink-700">100.0%</td>
            </tr>
        `;
    }

    // ==========================================
    // 3. RENDER BẢNG 3: DANH SÁCH HÓA ĐƠN CHI TIẾT (DRILL-DOWN)
    // ==========================================
    const tbody3 = document.getElementById('pivot-drilldown-table-body');
    const badgeDrilldown = document.getElementById('pivot-drilldown-count-badge');

    if (badgeDrilldown) {
        badgeDrilldown.textContent = `${filteredRows.length} hóa đơn`;
    }

    if (tbody3) {
        tbody3.innerHTML = '';
        if (filteredRows.length === 0) {
            tbody3.innerHTML = `<tr><td colspan="10" class="px-4 py-8 text-center text-slate-400 italic">Không có hóa đơn nào khớp với tiêu chí lọc đang chọn.</td></tr>`;
        } else {
            filteredRows.forEach((r, idx) => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50';

                tr.innerHTML = `
                    <td class="px-4 py-3 text-center text-slate-400 font-medium">${idx + 1}</td>
                    <td class="px-4 py-3 font-bold text-rose-600 font-mono">${r.so_hd || '---'}</td>
                    <td class="px-4 py-3 font-semibold text-pink-700 font-mono">${r.ky_hieu || '---'}</td>
                    <td class="px-4 py-3 text-slate-600">${r.ngay_lap || '---'}</td>
                    <td class="px-5 py-3">
                        <div class="font-bold text-slate-900 line-clamp-1 max-w-xs" title="${r.nb_ten}">${r.nb_ten}</div>
                    </td>
                    <td class="px-4 py-3 font-mono text-slate-700">${r.nb_mst}</td>
                    <td class="px-4 py-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-lg bg-pink-50 border border-pink-200 text-pink-800 text-[10px] font-semibold">
                            ${r.supplier_folder || 'Gốc'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-slate-700">${formatCurrency(r.tien_chua_thue)}</td>
                    <td class="px-4 py-3 text-right font-mono text-fuchsia-600">${formatCurrency(r.tien_thue)}</td>
                    <td class="px-5 py-3 text-right font-extrabold font-mono text-rose-600">${formatCurrency(r.tong_tien)}</td>
                `;
                tbody3.appendChild(tr);
            });
        }
    }
}
