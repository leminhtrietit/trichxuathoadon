/**
 * app.js - Xử lý logic giao diện ứng dụng trích xuất hóa đơn điện tử XML & PDF sang Excel
 * Hỗ trợ quét hàng loạt từ thư mục, kiểm trùng lặp, bóc tách XML/PDF và cập nhật Excel
 */

// Trạng thái ứng dụng
const state = {
    parsedInvoices: [],
    lastExtractionData: null,
    selectedUploadFiles: [],
    excelRows: [],
    savedInvoices: [],
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
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initThemeSystem();
        initTabs();
        initExtractionModals();
        initFolderScanner();
        initPivotTab();
        initDropzone();
        initActionButtons();
        initSettings();
        initInitExcelModal();
        initClearDataModal();
        initInvoiceModal();
        initAboutModal();
        initUpdateChecker();
        await Promise.allSettled([loadAppStatus(), loadExcelData()]);
    } finally {
        clearTimeout(window.startupFallback);
        const screen = document.getElementById('startup-screen');
        if (screen) {
            screen.classList.add('is-ready');
            setTimeout(() => screen.remove(), 300);
        }
    }
});

// Format tiền tệ VND
const numberFormatter = new Intl.NumberFormat('vi-VN');
function formatCurrency(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '0 đ';
    return numberFormatter.format(amount) + ' đ';
}

function formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return numberFormatter.format(num);
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
            } else if (targetId === 'tab-items') {
                loadSavedInvoiceDetails();
            } else if (targetId === 'tab-pivot') {
                populatePivotFilters();
                renderPivotTab();
            }
        });
    });
}

// ==============================================================
// 🌟 KHỞI TẠO CÁC MODAL TRÍCH XUẤT & ĐỐI CHIẾU
// ==============================================================
function initExtractionModals() {
    // 1. Thẻ mở Modal Quét Thư Mục
    const cardFolder = document.getElementById('card-open-folder-modal');
    const modalFolder = document.getElementById('modal-folder-scan');
    const btnCloseFolder = document.getElementById('btn-close-folder-modal');
    const btnCancelFolder = document.getElementById('btn-cancel-folder-modal');

    if (cardFolder && modalFolder) {
        cardFolder.addEventListener('click', () => {
            modalFolder.classList.remove('hidden');
            modalFolder.classList.add('flex');
        });
    }

    [btnCloseFolder, btnCancelFolder].forEach(btn => {
        if (btn && modalFolder) {
            btn.addEventListener('click', () => {
                modalFolder.classList.add('hidden');
                modalFolder.classList.remove('flex');
            });
        }
    });

    // 2. Thẻ mở Modal Tải File Trực Tiếp
    const cardUpload = document.getElementById('card-open-upload-modal');
    const modalUpload = document.getElementById('modal-file-upload');
    const btnCloseUpload = document.getElementById('btn-close-upload-modal');
    const btnCancelUpload = document.getElementById('btn-cancel-upload-modal');

    if (cardUpload && modalUpload) {
        cardUpload.addEventListener('click', () => {
            modalUpload.classList.remove('hidden');
            modalUpload.classList.add('flex');
        });
    }

    [btnCloseUpload, btnCancelUpload].forEach(btn => {
        if (btn && modalUpload) {
            btn.addEventListener('click', () => {
                modalUpload.classList.add('hidden');
                modalUpload.classList.remove('flex');
            });
        }
    });

    // 3. Modal Kết Quả Trích Xuất & Đối Chiếu Dữ Liệu
    const modalResult = document.getElementById('modal-extraction-result');
    const btnCloseResult = document.getElementById('btn-close-result-modal');
    const btnCancelResult = document.getElementById('btn-cancel-result-modal');
    const btnReopenResult = document.getElementById('btn-reopen-result-modal');

    if (btnReopenResult && modalResult) {
        btnReopenResult.addEventListener('click', () => {
            if (state.lastExtractionData) {
                openExtractionResultModal(state.lastExtractionData);
            } else if (state.parsedInvoices.length > 0) {
                openExtractionResultModal({
                    invoices: state.parsedInvoices,
                    total: state.parsedInvoices.length,
                    valid_count: state.parsedInvoices.length,
                    error_count: 0
                });
            } else {
                showToast('Chưa có kết quả trích xuất nào trong phiên làm việc.', 'warning');
            }
        });
    }

    [btnCloseResult, btnCancelResult].forEach(btn => {
        if (btn && modalResult) {
            btn.addEventListener('click', () => {
                modalResult.classList.add('hidden');
                modalResult.classList.remove('flex');
            });
        }
    });

    // Đóng khi click ra vùng xám mờ backdrop của các modal
    [modalFolder, modalUpload, modalResult].forEach(m => {
        if (m) {
            m.addEventListener('click', (e) => {
                if (e.target === m) {
                    m.classList.add('hidden');
                    m.classList.remove('flex');
                }
            });
        }
    });
}

// ==============================================================
// 🌟 XỬ LÝ QUÉT HÀNG LOẠT TỪ THƯ MỤC CỐ ĐỊNH (BATCH FOLDER SCANNER)
// ==============================================================
function initFolderScanner() {
    const btnBrowseNative = document.getElementById('btn-browse-folder-native');
    const btnScanFolder = document.getElementById('btn-scan-folder');
    const inputFolderPath = document.getElementById('input-folder-path');
    const modalFolder = document.getElementById('modal-folder-scan');
    const loadingBox = document.getElementById('folder-scan-loading');

    // Mở hộp thoại chọn thư mục Windows trực tiếp (Native Folder Dialog)
    if (btnBrowseNative && inputFolderPath) {
        btnBrowseNative.addEventListener('click', async () => {
            btnBrowseNative.disabled = true;
            btnBrowseNative.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-pink-500 mr-1.5"></i><span>Đang mở...</span>`;

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
                btnBrowseNative.innerHTML = `<i class="fa-solid fa-folder-magnifying-glass text-pink-500 mr-1.5"></i><span>Chọn Thư Mục...</span>`;
            }
        });
    }

    // Bắt đầu Quét & Trích xuất (Bóc tách & đối chiếu trước, CHƯA auto_save)
    if (btnScanFolder && inputFolderPath) {
        btnScanFolder.addEventListener('click', async () => {
            const folderPath = inputFolderPath.value.trim();
            if (!folderPath) {
                showToast('Vui lòng nhập hoặc chọn thư mục chứa hóa đơn!', 'warning');
                return;
            }

            const chkRecursive = document.getElementById('chk-scan-recursive');
            const isRecursive = chkRecursive ? chkRecursive.checked : true;

            btnScanFolder.disabled = true;
            btnScanFolder.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Đang bóc tách...</span>`;
            if (loadingBox) loadingBox.classList.remove('hidden');

            try {
                const res = await fetch('/api/scan-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folder_path: folderPath,
                        recursive: isRecursive,
                        auto_save: false,   // Bóc tách & đối chiếu trước, CHƯA ghi Excel ngay!
                        overwrite: false
                    })
                });

                const data = await res.json();

                if (data.success) {
                    // Đóng modal quét thư mục
                    if (modalFolder) {
                        modalFolder.classList.add('hidden');
                        modalFolder.classList.remove('flex');
                    }

                    // Lưu dữ liệu vào state
                    state.lastExtractionData = data;
                    if (data.invoices && data.invoices.length > 0) {
                        processParsedResults(data.invoices);
                    }

                    // Mở popup xem thông tin & đối chiếu trùng lặp
                    openExtractionResultModal(data);
                } else {
                    showToast(data.error || 'Có lỗi khi quét thư mục hóa đơn', 'error');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            } finally {
                btnScanFolder.disabled = false;
                btnScanFolder.innerHTML = `<i class="fa-solid fa-bolt"></i><span>Bắt Đầu Trích Xuất</span>`;
                if (loadingBox) loadingBox.classList.add('hidden');
            }
        });
    }
}

// ==============================================================
// 🌟 XỬ LÝ TẢI LÊN FILE TRỰC TIẾP TRONG MODAL
// ==============================================================
function initDropzone() {
    const dropzone = document.getElementById('modal-dropzone');
    const fileInput = document.getElementById('modal-file-input');
    const btnBrowse = document.getElementById('btn-modal-browse-files');
    const btnSample = document.getElementById('btn-modal-load-sample');
    const btnClearFiles = document.getElementById('btn-clear-selected-files');
    const btnStartUpload = document.getElementById('btn-start-upload-process');
    const loadingBox = document.getElementById('upload-scan-loading');
    const modalUpload = document.getElementById('modal-file-upload');

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
                addFilesToUploadList(files);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                addFilesToUploadList(fileInput.files);
                fileInput.value = '';
            }
        });
    }

    if (btnClearFiles) {
        btnClearFiles.addEventListener('click', () => {
            state.selectedUploadFiles = [];
            renderSelectedUploadFiles();
        });
    }

    if (btnSample) {
        btnSample.addEventListener('click', (e) => {
            e.stopPropagation();
            loadSampleInvoice();
        });
    }

    if (btnStartUpload) {
        btnStartUpload.addEventListener('click', async () => {
            if (!state.selectedUploadFiles || state.selectedUploadFiles.length === 0) {
                showToast('Vui lòng chọn ít nhất 1 file hóa đơn để trích xuất!', 'warning');
                return;
            }

            btnStartUpload.disabled = true;
            btnStartUpload.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Đang xử lý...</span>`;
            if (loadingBox) loadingBox.classList.remove('hidden');

            const formData = new FormData();
            state.selectedUploadFiles.forEach(f => formData.append('files', f));

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    // Đóng modal tải file
                    if (modalUpload) {
                        modalUpload.classList.add('hidden');
                        modalUpload.classList.remove('flex');
                    }

                    // Reset danh sách file đã chọn
                    state.selectedUploadFiles = [];
                    renderSelectedUploadFiles();

                    // Lưu dữ liệu vào state
                    state.lastExtractionData = data;
                    if (data.invoices && data.invoices.length > 0) {
                        processParsedResults(data.invoices);
                    }

                    // Mở popup kết quả đối chiếu
                    openExtractionResultModal(data);
                } else {
                    showToast(data.error || 'Có lỗi xảy ra khi bóc tách hóa đơn', 'error');
                }
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            } finally {
                btnStartUpload.disabled = false;
                btnStartUpload.innerHTML = `<i class="fa-solid fa-bolt"></i><span>Bắt Đầu Trích Xuất</span>`;
                if (loadingBox) loadingBox.classList.add('hidden');
            }
        });
    }
}

function addFilesToUploadList(fileList) {
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        // Tránh trùng lặp tên & kích thước
        const exists = state.selectedUploadFiles.some(f => f.name === file.name && f.size === file.size);
        if (!exists) {
            state.selectedUploadFiles.push(file);
        }
    }
    renderSelectedUploadFiles();
}

function renderSelectedUploadFiles() {
    const box = document.getElementById('modal-selected-files-box');
    const countBadge = document.getElementById('modal-selected-files-count');
    const list = document.getElementById('modal-selected-files-list');
    const btnStart = document.getElementById('btn-start-upload-process');

    if (!box || !list || !btnStart) return;

    const count = state.selectedUploadFiles.length;
    if (count > 0) {
        box.classList.remove('hidden');
        if (countBadge) countBadge.textContent = `${count} tệp`;
        btnStart.disabled = false;
        btnStart.className = 'px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-500/20 transition-all flex items-center space-x-2 cursor-pointer';

        list.innerHTML = state.selectedUploadFiles.map((file, idx) => {
            const sizeStr = file.size > 1024 * 1024
                ? (file.size / (1024 * 1024)).toFixed(2) + ' MB'
                : (file.size / 1024).toFixed(1) + ' KB';

            let icon = 'fa-file-code text-blue-500';
            if (file.name.toLowerCase().endsWith('.pdf')) icon = 'fa-file-pdf text-rose-500';
            else if (file.name.toLowerCase().endsWith('.zip')) icon = 'fa-file-zipper text-amber-500';

            return `
                <div class="flex items-center justify-between p-2 rounded-xl bg-pink-50/50 border border-pink-100 text-xs">
                    <div class="flex items-center space-x-2 truncate">
                        <i class="fa-regular ${icon} text-sm shrink-0"></i>
                        <span class="truncate font-semibold text-slate-800" title="${file.name}">${file.name}</span>
                        <span class="text-[10px] text-slate-400 font-mono">(${sizeStr})</span>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-red-500 ml-2 p-1 cursor-pointer" onclick="removeSelectedUploadFile(${idx})" title="Xóa file này">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join('');
    } else {
        box.classList.add('hidden');
        btnStart.disabled = true;
        btnStart.className = 'px-5 py-2.5 bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-not-allowed';
    }
}

window.removeSelectedUploadFile = function(idx) {
    state.selectedUploadFiles.splice(idx, 1);
    renderSelectedUploadFiles();
};

// Nạp hóa đơn mẫu có sẵn
async function loadSampleInvoice() {
    showToast('Đang nạp file mẫu...', 'info');
    try {
        const res = await fetch('/api/load-sample', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            const modalUpload = document.getElementById('modal-file-upload');
            if (modalUpload) {
                modalUpload.classList.add('hidden');
                modalUpload.classList.remove('flex');
            }

            processParsedResults(data.invoices);
            openExtractionResultModal(data);
            showToast('Đã nạp thành công hóa đơn mẫu!', 'success');
        } else {
            showToast(data.error || 'Không nạp được file mẫu', 'error');
        }
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

// ==============================================================
// 🌟 POPUP XEM KẾT QUẢ TRÍCH XUẤT, ĐỐI CHIẾU TRÙNG LẶP & NÚT LƯU EXCEL
// ==============================================================
function openExtractionResultModal(data) {
    const modal = document.getElementById('modal-extraction-result');
    if (!modal) return;

    state.lastExtractionData = data;
    const invoices = data.invoices || [];
    const validInvoices = invoices.filter(inv => inv.success);
    const duplicates = validInvoices.filter(inv => inv.already_in_excel);
    const newInvoices = validInvoices.filter(inv => !inv.already_in_excel);
    const errors = invoices.filter(inv => !inv.success);

    // 1. Tên file Excel
    const excelNameElem = document.getElementById('result-modal-excel-name');
    if (excelNameElem) {
        const path = data.excel_path || state.excelPath || 'danh_sach_hoa_don.xlsx';
        excelNameElem.textContent = path.split('\\').pop() || 'danh_sach_hoa_don.xlsx';
    }

    // 2. Thẻ KPI
    const kpiTotal = document.getElementById('result-kpi-total');
    const kpiNew = document.getElementById('result-kpi-new');
    const kpiDup = document.getElementById('result-kpi-duplicate');
    const kpiErr = document.getElementById('result-kpi-error');

    if (kpiTotal) kpiTotal.textContent = validInvoices.length;
    if (kpiNew) kpiNew.textContent = newInvoices.length;
    if (kpiDup) kpiDup.textContent = duplicates.length;
    if (kpiErr) kpiErr.textContent = errors.length;

    // 3. Khung cảnh báo trùng lặp & tùy chọn xử lý
    const banner = document.getElementById('result-duplicate-banner');
    const btnConfirm = document.getElementById('btn-confirm-add-to-excel');
    const btnConfirmText = document.getElementById('btn-confirm-add-text');

    if (banner) {
        if (duplicates.length > 0) {
            banner.className = 'p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-xs space-y-2.5 animate-fade-in';
            banner.innerHTML = `
                <div class="flex items-center text-amber-900 font-bold">
                    <i class="fa-solid fa-triangle-exclamation text-amber-600 mr-2 text-sm"></i>
                    <span>Phát hiện <strong class="text-rose-700">${duplicates.length}</strong> hóa đơn đã tồn tại trong file Excel (trùng Ký hiệu + Số HĐ + MST bên bán)</span>
                </div>
                <p class="text-[11px] text-slate-600">Vui lòng chọn cách xử lý khi thêm vào Excel:</p>
                <div class="space-y-1.5 pl-1">
                    <label class="flex items-center space-x-2.5 cursor-pointer select-none">
                        <input type="radio" name="modal-dup-option" value="skip" checked class="text-pink-600 focus:ring-pink-500 w-4 h-4 accent-pink-600 cursor-pointer">
                        <span class="font-bold text-slate-900 text-xs">Chỉ thêm <strong class="text-emerald-700">${newInvoices.length}</strong> hóa đơn MỚI (Bỏ qua ${duplicates.length} hóa đơn đã trùng)</span>
                        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Khuyên dùng</span>
                    </label>
                    <label class="flex items-center space-x-2.5 cursor-pointer select-none">
                        <input type="radio" name="modal-dup-option" value="replace" class="text-pink-600 focus:ring-pink-500 w-4 h-4 accent-pink-600 cursor-pointer">
                        <span class="font-medium text-slate-700 text-xs">Cập nhật / Ghi đè <strong class="text-blue-700">${duplicates.length}</strong> hóa đơn trùng và thêm <strong class="text-emerald-700">${newInvoices.length}</strong> hóa đơn mới</span>
                    </label>
                    <label class="flex items-center space-x-2.5 cursor-pointer select-none">
                        <input type="radio" name="modal-dup-option" value="all" class="text-pink-600 focus:ring-pink-500 w-4 h-4 accent-pink-600 cursor-pointer">
                        <span class="font-medium text-slate-700 text-xs">Thêm tất cả (Bao gồm cả các hóa đơn trùng lặp)</span>
                    </label>
                </div>
            `;
        } else {
            banner.className = 'p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs flex items-center space-x-3 text-emerald-900 animate-fade-in';
            banner.innerHTML = `
                <i class="fa-solid fa-circle-check text-emerald-600 text-xl shrink-0"></i>
                <div>
                    <span class="font-bold">Tuyệt vời! Không phát hiện hóa đơn trùng lặp.</span>
                    <p class="text-[11px] text-emerald-700 mt-0.5">Toàn bộ <strong>${newInvoices.length}</strong> hóa đơn đều là mới và sẵn sàng ghi vào file Excel.</p>
                </div>
            `;
        }
    }

    // Cập nhật text nút bấm theo radio
    function updateConfirmButtonText() {
        if (!btnConfirmText) return;
        const selectedRadio = document.querySelector('input[name="modal-dup-option"]:checked');
        const opt = selectedRadio ? selectedRadio.value : 'skip';

        if (duplicates.length > 0) {
            if (opt === 'skip') {
                btnConfirmText.textContent = `Chỉ Thêm ${newInvoices.length} Hóa Đơn Mới Vào Excel`;
            } else if (opt === 'replace') {
                btnConfirmText.textContent = `Ghi Đè & Thêm ${validInvoices.length} Hóa Đơn Vào Excel`;
            } else {
                btnConfirmText.textContent = `Thêm Tất Cả ${validInvoices.length} Hóa Đơn Vào Excel`;
            }
        } else {
            btnConfirmText.textContent = `Thêm ${validInvoices.length} Hóa Đơn Vào Excel`;
        }
    }

    updateConfirmButtonText();

    const radios = document.querySelectorAll('input[name="modal-dup-option"]');
    radios.forEach(r => r.addEventListener('change', updateConfirmButtonText));

    // 4. Bảng chi tiết hóa đơn trong modal
    const tbody = document.getElementById('result-modal-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        if (validInvoices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-400 italic">Không có hóa đơn hợp lệ nào được bóc tách.</td></tr>`;
        } else {
            validInvoices.forEach((inv, idx) => {
                const tt = inv.thong_tin_chung || {};
                const nb = inv.nguoi_ban || {};
                const toan = inv.thanh_toan || {};

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-pink-50/50 transition-colors';

                const statusBadge = inv.already_in_excel
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                         <i class="fa-solid fa-clone mr-1"></i>Đã có trong Excel
                       </span>`
                    : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                         <i class="fa-solid fa-circle-check mr-1"></i>Mới
                       </span>`;

                tr.innerHTML = `
                    <td class="px-3 py-2.5 text-center text-slate-400 font-semibold">${idx + 1}</td>
                    <td class="px-3 py-2.5 text-center">${statusBadge}</td>
                    <td class="px-3 py-2.5 font-mono font-bold text-rose-600">${tt.so_hd || '---'}</td>
                    <td class="px-3 py-2.5 font-mono text-pink-700 font-semibold">${tt.ky_hieu || '---'}</td>
                    <td class="px-3 py-2.5 text-slate-600">${tt.ngay_lap || '---'}</td>
                    <td class="px-4 py-2.5">
                        <div class="font-bold text-slate-900 line-clamp-1 max-w-[200px]" title="${nb.ten || ''}">${nb.ten || '---'}</div>
                    </td>
                    <td class="px-3 py-2.5 font-mono text-slate-700">${nb.mst || '---'}</td>
                    <td class="px-3 py-2.5 text-right font-mono font-extrabold text-slate-900">${formatCurrency(toan.tong_tien_thanh_toan)}</td>
                    <td class="px-3 py-2.5 text-center">
                        <button type="button" class="w-7 h-7 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-600 transition-colors cursor-pointer" onclick='openInvoiceModalByIndex(${idx})' title="Xem chi tiết hóa đơn">
                            <i class="fa-regular fa-eye"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    }

    // 5. Nút xác nhận Thêm vào Excel
    if (btnConfirm) {
        btnConfirm.onclick = async () => {
            const selectedRadio = document.querySelector('input[name="modal-dup-option"]:checked');
            const opt = selectedRadio ? selectedRadio.value : 'skip';

            let toSave = [];
            let overwrite = false;

            if (duplicates.length > 0) {
                if (opt === 'skip') {
                    toSave = newInvoices;
                    overwrite = false;
                } else if (opt === 'replace') {
                    toSave = validInvoices;
                    overwrite = true;
                } else {
                    toSave = validInvoices;
                    overwrite = false;
                }
            } else {
                toSave = validInvoices;
                overwrite = false;
            }

            if (toSave.length === 0) {
                showToast('Tất cả hóa đơn này đều đã có trong file Excel. Không có hóa đơn mới nào để thêm.', 'warning');
                return;
            }

            btnConfirm.disabled = true;
            btnConfirm.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-sm"></i><span>Đang ghi vào Excel...</span>`;

            try {
                const res = await fetch('/api/save-to-excel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        invoices: toSave,
                        overwrite: overwrite
                    })
                });
                const resData = await res.json();

                if (resData.success) {
                    let msg = `Đã lưu thành công: +${resData.added} hóa đơn mới vào Excel!`;
                    if (resData.updated > 0) msg += ` (${resData.updated} HĐ đã được ghi đè cập nhật)`;
                    showToast(msg, 'success');

                    // Đánh dấu các hóa đơn đã được lưu
                    toSave.forEach(inv => inv.already_in_excel = true);

                    // Đóng modal kết quả
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');

                    // Tải lại dữ liệu Excel để cập nhật toàn bộ hệ thống
                    loadAppStatus();
                    loadExcelData();
                    renderPreviewTable();
                    renderItemsTable();
                    updateBadges();
                } else {
                    showToast(resData.error || 'Có lỗi khi lưu vào file Excel', 'error');
                }
            } catch (err) {
                showToast('Lỗi kết nối: ' + err.message, 'error');
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.innerHTML = `<i class="fa-solid fa-file-excel text-sm"></i><span id="btn-confirm-add-text">Thêm Dữ Liệu Đã Trích Xuất Vào Excel</span>`;
            }
        };
    }

    // Hiển thị modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Mở modal hóa đơn từ danh sách trong result modal
window.openInvoiceModalByIndex = function(idx) {
    if (state.lastExtractionData && state.lastExtractionData.invoices) {
        const valid = state.lastExtractionData.invoices.filter(i => i.success);
        if (valid[idx]) {
            showInvoiceModal(valid[idx]);
        }
    }
};

// ==============================================================
// 🌟 MODAL THÔNG TIN TÁC GIẢ & METADATA TRACKING BẢN QUYỀN
// ==============================================================
function initAboutModal() {
    const btnOpen = document.getElementById('btn-open-about-modal');
    const modal = document.getElementById('modal-about-metadata');
    const btnClose = document.getElementById('btn-close-about-modal');
    const btnAck = document.getElementById('btn-ack-about-modal');

    if (btnOpen && modal) {
        btnOpen.addEventListener('click', () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    }

    [btnClose, btnAck].forEach(btn => {
        if (btn && modal) {
            btn.addEventListener('click', () => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            });
        }
    });

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        });
    }
}

// ==============================================================
// 🌟 TÍNH NĂNG KIỂM TRA CẬP NHẬT PHIÊN BẢN (IN-APP UPDATE CHECKER)
// ==============================================================
let cachedUpdateData = null;

function initUpdateChecker() {
    const btnCheckSettings = document.getElementById('btn-check-update-settings');
    const btnSidebarCheck = document.getElementById('btn-sidebar-check-update');
    const modalUpdate = document.getElementById('modal-update-dialog');
    const btnClose = document.getElementById('btn-close-update-modal');
    const btnDismiss = document.getElementById('btn-dismiss-update-modal');
    const btnOpenGithub = document.getElementById('btn-update-open-github');
    const btnDownload = document.getElementById('btn-download-new-version');

    if (btnCheckSettings) {
        btnCheckSettings.addEventListener('click', () => {
            checkAppUpdate(true);
        });
    }

    if (btnSidebarCheck) {
        btnSidebarCheck.addEventListener('click', () => {
            checkAppUpdate(true);
        });
    }

    function closeUpdateModal() {
        if (modalUpdate) {
            modalUpdate.classList.add('hidden');
            modalUpdate.classList.remove('flex');
        }
    }

    [btnClose, btnDismiss].forEach(btn => {
        if (btn) btn.addEventListener('click', closeUpdateModal);
    });

    if (modalUpdate) {
        modalUpdate.addEventListener('click', (e) => {
            if (e.target === modalUpdate) closeUpdateModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalUpdate && !modalUpdate.classList.contains('hidden')) {
            closeUpdateModal();
        }
    });

    // Mở trang Release trên GitHub
    if (btnOpenGithub) {
        btnOpenGithub.addEventListener('click', async () => {
            const targetUrl = (cachedUpdateData && cachedUpdateData.release_url) 
                ? cachedUpdateData.release_url 
                : 'https://github.com/leminhtrietit/trichxuathoadon/releases';
            await openExternalLink(targetUrl);
        });
    }

    // Tải tệp bản mới (.exe hoặc link release)
    if (btnDownload) {
        btnDownload.addEventListener('click', async () => {
            const targetUrl = (cachedUpdateData && (cachedUpdateData.download_url || cachedUpdateData.release_url))
                ? (cachedUpdateData.download_url || cachedUpdateData.release_url)
                : 'https://github.com/leminhtrietit/trichxuathoadon/releases/latest';
            showToast('Đang mở liên kết tải bản cập nhật...', 'info');
            await openExternalLink(targetUrl);
        });
    }

    // Tự động kiểm tra bản cập nhật ngầm sau 2.5s khi mở app
    setTimeout(() => {
        checkAppUpdate(false);
    }, 2500);
}

// Mở URL ngoại vi an toàn thông qua Backend (hoặc fallback window.open)
async function openExternalLink(url) {
    if (!url) return;
    try {
        const res = await fetch('/api/open-external-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        const data = await res.json();
        if (!data.success) {
            window.open(url, '_blank');
        }
    } catch (e) {
        window.open(url, '_blank');
    }
}

// Kiểm tra bản cập nhật
async function checkAppUpdate(isManual = false) {
    const btnCheckSettings = document.getElementById('btn-check-update-settings');
    const iconCheck = document.getElementById('icon-check-update-settings');
    const textCheck = document.getElementById('text-check-update-settings');
    const sidebarDot = document.getElementById('sidebar-update-dot');
    const settingsBadge = document.getElementById('settings-update-badge');
    const modalUpdate = document.getElementById('modal-update-dialog');

    if (isManual && btnCheckSettings) {
        btnCheckSettings.disabled = true;
        if (iconCheck) {
            iconCheck.className = 'fa-solid fa-spinner fa-spin';
        }
        if (textCheck) {
            textCheck.textContent = 'Đang kiểm tra...';
        }
    }

    try {
        const res = await fetch('/api/check-update');
        const data = await res.json();

        if (data.success) {
            cachedUpdateData = data;

            // Cập nhật số phiên bản hiện tại lên UI settings nếu có
            const curVerDisplay = document.getElementById('settings-current-ver-display');
            const appVerBadge = document.getElementById('settings-app-version-badge');
            if (curVerDisplay) curVerDisplay.textContent = `v${data.current_version}`;
            if (appVerBadge) appVerBadge.textContent = `v${data.current_version}`;

            if (data.has_update) {
                // Hiển thị badge và chấm đỏ thông báo
                if (sidebarDot) sidebarDot.classList.remove('hidden');
                if (settingsBadge) settingsBadge.classList.remove('hidden');

                // Đổ dữ liệu vào Modal Cập Nhật
                const modalTag = document.getElementById('modal-update-tag');
                const modalCurVer = document.getElementById('modal-update-current-ver');
                const modalLatestVer = document.getElementById('modal-update-latest-ver');
                const modalNotes = document.getElementById('modal-update-notes');
                const modalDate = document.getElementById('modal-update-date');

                if (modalTag) modalTag.textContent = data.tag_name || `v${data.latest_version}`;
                if (modalCurVer) modalCurVer.textContent = `v${data.current_version}`;
                if (modalLatestVer) modalLatestVer.textContent = `v${data.latest_version}`;
                if (modalNotes) {
                    modalNotes.textContent = data.release_notes || 'Bản phát hành cập nhật tối ưu hóa hiệu năng, cải tiến giao diện và bổ sung các tính năng mới.';
                }
                if (modalDate) {
                    if (data.published_at) {
                        try {
                            const d = new Date(data.published_at);
                            modalDate.textContent = `Ngày phát hành: ${d.toLocaleDateString('vi-VN')}`;
                        } catch (e) {
                            modalDate.textContent = 'Bản mới nhất';
                        }
                    } else {
                        modalDate.textContent = 'Bản mới nhất';
                    }
                }

                // Mở Modal
                if (modalUpdate) {
                    modalUpdate.classList.remove('hidden');
                    modalUpdate.classList.add('flex');
                }
            } else {
                // Không có bản mới hơn
                if (sidebarDot) sidebarDot.classList.add('hidden');
                if (settingsBadge) settingsBadge.classList.add('hidden');

                if (isManual) {
                    showToast(`Bạn đang sử dụng phiên bản mới nhất (v${data.current_version})!`, 'success');
                }
            }
        } else {
            if (isManual) {
                showToast(data.error || 'Không thể kiểm tra cập nhật từ GitHub', 'warning');
            }
        }
    } catch (err) {
        if (isManual) {
            showToast('Lỗi kết nối khi kiểm tra cập nhật: ' + err.message, 'warning');
        }
    } finally {
        if (btnCheckSettings) {
            btnCheckSettings.disabled = false;
            if (iconCheck) {
                iconCheck.className = 'fa-solid fa-cloud-arrow-down';
            }
            if (textCheck) {
                textCheck.textContent = 'Kiểm Tra Bản Cập Nhật';
            }
        }
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
    const previewContainer = document.getElementById('preview-container');
    const totalItems = getDisplayInvoices().reduce((sum, inv) => sum + (inv.hang_hoa ? inv.hang_hoa.length : 0), 0);
    document.getElementById('items-table-count').textContent = `${totalItems} mặt hàng`;

    if (previewCount > 0) {
        badgeUpload.textContent = previewCount;
        badgeUpload.classList.remove('hidden');
        previewContainer.classList.remove('hidden');
    } else {
        badgeUpload.classList.add('hidden');
        previewContainer.classList.add('hidden');
    }
    badgeItems.textContent = totalItems;
    badgeItems.classList.toggle('hidden', totalItems === 0);
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
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function getDisplayInvoices() {
    const invoices = new Map(state.savedInvoices.map(inv => [inv.invoice_key, inv]));
    state.parsedInvoices.forEach(inv => invoices.set(inv.invoice_key, inv));
    return [...invoices.values()];
}

async function loadSavedInvoiceDetails() {
    try {
        const res = await fetch('/api/invoice-details');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Không thể đọc chi tiết hóa đơn');
        state.savedInvoices = data.invoices;
        renderItemsTable();
        updateBadges();
    } catch (err) {
        showToast(escapeHtml(err.message), 'error');
    }
}

async function openSavedInvoice(row) {
    try {
        const res = await fetch('/api/invoice-details?stt=' + encodeURIComponent(row.stt));
        const data = await res.json();
        if (!res.ok || !data.success || !data.invoices.length) throw new Error(data.error || 'Không tìm thấy hóa đơn');
        showInvoiceModal(data.invoices[0]);
    } catch (err) {
        showToast(escapeHtml(err.message), 'error');
    }
}

function renderItemsTable() {
    const tbody = document.getElementById('items-table-body');
    tbody.innerHTML = '';

    let rowIdx = 1;
    getDisplayInvoices().forEach(inv => {
        const tt = inv.thong_tin_chung;

        (inv.hang_hoa || []).forEach(it => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50';

            tr.innerHTML = `
                <td class="px-4 py-3 text-center text-slate-400 font-medium">${rowIdx++}</td>
                <td class="px-4 py-3 font-bold text-rose-600 font-mono">${escapeHtml(tt.so_hd || '---')}</td>
                <td class="px-4 py-3 font-semibold text-pink-700 font-mono">${escapeHtml(tt.ky_hieu || '---')}</td>
                <td class="px-5 py-3 font-bold text-slate-900">${escapeHtml(it.ten_hang || '---')}</td>
                <td class="px-4 py-3 text-center text-slate-600">${escapeHtml(it.dvt || '---')}</td>
                <td class="px-4 py-3 text-right font-mono font-medium">${formatNumber(it.so_luong)}</td>
                <td class="px-4 py-3 text-right font-mono text-slate-600">${formatCurrency(it.don_gia)}</td>
                <td class="px-4 py-3 text-right font-mono text-slate-900 font-semibold">${formatCurrency(it.thanh_tien)}</td>
                <td class="px-4 py-3 text-center font-mono font-bold text-pink-600">${escapeHtml(it.thue_suat || '---')}</td>
                <td class="px-4 py-3 text-right font-mono text-fuchsia-600">${formatCurrency(it.tien_thue)}</td>
                <td class="px-5 py-3 text-right font-mono font-extrabold text-rose-600">${formatCurrency(it.tong_tien_dong)}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    if (rowIdx === 1) {
        tbody.innerHTML = `<tr><td colspan="11" class="px-4 py-12 text-center text-slate-400 italic">Chưa có dữ liệu hàng hóa nào. Hãy quét thư mục hoặc tải file lên.</td></tr>`;
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

        const curBadge = document.getElementById('current-excel-badge');
        if (curBadge) curBadge.textContent = `${fileName}`;

        const topbarName = document.getElementById('topbar-excel-name');
        if (topbarName) topbarName.textContent = fileName;

        const sidebarCount = document.getElementById('sidebar-invoices-count');
        if (sidebarCount) sidebarCount.textContent = `${formatNumber(totalInvoices)} HĐ`;

        const inputPath = document.getElementById('input-excel-path');
        if (inputPath) inputPath.value = data.excel_path;

        if (data.theme && !localStorage.getItem('mte_theme')) {
            applyTheme(data.theme, false);
        }
    } catch (err) {
        console.error('Lỗi khi tải trạng thái:', err);
    }
}

// Tải danh sách hóa đơn từ file Excel
async function loadExcelData() {
    try {
        const res = await fetch('/api/excel-data');
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || 'Không thể tải dữ liệu Excel');
        }

        state.excelRows = data.rows || [];
        state.pivotBySupplier = data.pivot_by_supplier || [];
        state.pivotByMonth = data.pivot_by_month || [];
        state.excelStats = data.stats || {};

        const badgeSuppliers = document.getElementById('badge-suppliers-count');
        if (badgeSuppliers) {
            badgeSuppliers.textContent = state.excelStats.unique_sellers || 0;
        }

        renderExcelTable(state.excelRows);
        state.savedInvoices = [];
        if (!document.getElementById('tab-items').classList.contains('hidden')) await loadSavedInvoiceDetails();
        populatePivotFilters();
        renderPivotTab();
    } catch (err) {
        console.error('Lỗi khi tải dữ liệu Excel:', err);
        showToast(`Không thể đọc dữ liệu Excel. Vui lòng kiểm tra file trong Cài Đặt.`, 'error');
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
        tr.className = 'hover:bg-pink-50/40 transition-colors border-b border-pink-50 cursor-pointer';
        tr.tabIndex = 0;
        tr.setAttribute('role', 'button');
        tr.setAttribute('aria-label', `Xem hóa đơn ${escapeHtml(r.so_hd)}`);
        tr.addEventListener('click', () => openSavedInvoice(r));
        tr.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openSavedInvoice(r);
            }
        });

        tr.innerHTML = `
            <td class="px-5 py-3.5 text-center text-slate-400 font-medium">${escapeHtml(r.stt)}</td>
            <td class="px-4 py-3.5 font-bold text-rose-600 font-mono">${escapeHtml(r.so_hd)}</td>
            <td class="px-4 py-3.5 font-semibold text-pink-700 font-mono">${escapeHtml(r.ky_hieu)}</td>
            <td class="px-4 py-3.5 text-slate-600">${escapeHtml(r.ngay_lap)}</td>
            <td class="px-5 py-3.5">
                <div class="font-bold text-slate-900 line-clamp-1 max-w-xs" title="${escapeHtml(r.nb_ten)}">${escapeHtml(r.nb_ten)}</div>
            </td>
            <td class="px-4 py-3.5 font-mono text-slate-700 font-medium">${escapeHtml(r.nb_mst)}</td>
            <td class="px-5 py-3.5 text-slate-800 line-clamp-1 max-w-xs" title="${escapeHtml(r.nm_ten)}">${escapeHtml(r.nm_ten)}</td>
            <td class="px-4 py-3.5 text-right font-mono text-slate-700">${formatCurrency(r.tien_chua_thue)}</td>
            <td class="px-4 py-3.5 text-right font-mono text-fuchsia-600">${formatCurrency(r.tien_thue)}</td>
            <td class="px-5 py-3.5 text-right font-extrabold font-mono text-rose-600 text-sm">${formatCurrency(r.tong_tien)}</td>
            <td class="px-4 py-3.5 text-center font-bold text-slate-700">${escapeHtml(r.so_mat_hang)}</td>
            <td class="px-4 py-3.5 text-slate-400 text-[11px] font-mono">${escapeHtml(r.thoi_gian_nhap || '---')}</td>
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

// ==============================================================
// 🌟 HỆ THỐNG TINH CHỈNH GIAO DIỆN & BỘ MÀU MATERIAL DESIGN 3 (GOOGLE M3)
// ==============================================================
const M3_THEMES = [
    {
        id: 'rose',
        name: 'Hồng Thạch Anh',
        subtitle: 'M3 Rose Quartz',
        desc: 'Hiện đại, thanh lịch và ấm áp',
        primaryHex: '#ec4899',
        secondaryHex: '#f43f5e',
        bgHex: '#fff5f7'
    },
    {
        id: 'purple',
        name: 'Tím Thạch Anh',
        subtitle: 'M3 Amethyst (Baseline)',
        desc: 'Bộ màu chuẩn gốc Google Material 3',
        primaryHex: '#7c3aed',
        secondaryHex: '#6750a4',
        bgHex: '#faf5ff'
    },
    {
        id: 'blue',
        name: 'Xanh Dương',
        subtitle: 'M3 Ocean Blue',
        desc: 'Chuyên nghiệp, tin cậy và vững chắc',
        primaryHex: '#2563eb',
        secondaryHex: '#0284c7',
        bgHex: '#f4f8fd'
    },
    {
        id: 'green',
        name: 'Xanh Lục Bảo',
        subtitle: 'M3 Forest Emerald',
        desc: 'Tươi mới, hài hòa và cân bằng sinh thái',
        primaryHex: '#059669',
        secondaryHex: '#0d9488',
        bgHex: '#f3faf6'
    },
    {
        id: 'amber',
        name: 'Hổ Phách Hoàng Kim',
        subtitle: 'M3 Sunset Amber',
        desc: 'Ấm cúng, tràn đầy sinh khí & sáng tạo',
        primaryHex: '#d97706',
        secondaryHex: '#ea580c',
        bgHex: '#fdfbf5'
    },
    {
        id: 'teal',
        name: 'Lam Ngọc Biển Sâu',
        subtitle: 'M3 Ocean Teal',
        desc: 'Dịu mát, sâu lắng và thanh thoát',
        primaryHex: '#0d9488',
        secondaryHex: '#0891b2',
        bgHex: '#f2faf9'
    },
    {
        id: 'red',
        name: 'Đỏ Ruby & Đất Nung',
        subtitle: 'M3 Ruby Carmine',
        desc: 'Nhiệt huyết, nổi bật và quyết đoán',
        primaryHex: '#e11d48',
        secondaryHex: '#dc2626',
        bgHex: '#fff5f5'
    },
    {
        id: 'slate',
        name: 'Than Đen Tối Giản',
        subtitle: 'M3 Charcoal Slate',
        desc: 'Tối giản, trang nhã và tập trung cao độ',
        primaryHex: '#475569',
        secondaryHex: '#334155',
        bgHex: '#f8fafc'
    }
];

function getCurrentThemeId() {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('mte_theme') || 'rose';
}

function applyTheme(themeId, notifyUser = false) {
    const theme = M3_THEMES.find(t => t.id === themeId) || M3_THEMES[0];
    const actualId = theme.id;

    // 1. Áp dụng attribute trên <html> để kích hoạt toàn bộ CSS Variables
    document.documentElement.setAttribute('data-theme', actualId);

    // 2. Ghi nhớ vào localStorage của trình duyệt
    try {
        localStorage.setItem('mte_theme', actualId);
    } catch (e) {}

    // 3. Đồng bộ lưu vào file cấu hình backend qua API
    fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: actualId })
    }).catch(() => {});

    // 4. Cập nhật nhãn và chỉ báo ở Header
    const quickIndicator = document.getElementById('quick-theme-indicator');
    const quickLabel = document.getElementById('quick-theme-label');
    if (quickIndicator) {
        quickIndicator.style.background = `linear-gradient(135deg, ${theme.primaryHex}, ${theme.secondaryHex})`;
    }
    if (quickLabel) {
        quickLabel.textContent = theme.name;
    }

    // 5. Cập nhật nhãn và swatch ở Tab Cài Đặt
    const settingsBadgeText = document.getElementById('current-theme-name-text');
    const settingsSwatch = document.getElementById('current-theme-swatch');
    if (settingsBadgeText) {
        settingsBadgeText.textContent = theme.name;
    }
    if (settingsSwatch) {
        settingsSwatch.style.backgroundColor = theme.primaryHex;
    }

    // 6. Cập nhật trạng thái Active trên lưới thẻ Cài Đặt
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
        const cId = card.getAttribute('data-theme-id');
        const badge = card.querySelector('.theme-active-indicator');
        card.setAttribute('aria-pressed', String(cId === actualId));
        if (cId === actualId) {
            card.classList.add('active-theme-card');
            card.classList.remove('border-pink-100');
            if (badge) {
                badge.classList.remove('hidden');
                badge.classList.add('inline-flex');
            }
        } else {
            card.classList.remove('active-theme-card');
            card.classList.add('border-pink-100');
            if (badge) {
                badge.classList.add('hidden');
                badge.classList.remove('inline-flex');
            }
        }
    });

    // 7. Cập nhật trạng thái Active trên menu nhanh Header
    const quickItems = document.querySelectorAll('.quick-theme-item');
    quickItems.forEach(item => {
        const qId = item.getAttribute('data-theme-id');
        if (qId === actualId) {
            item.classList.add('bg-pink-100/80', 'text-pink-900', 'font-bold');
            item.classList.remove('text-slate-600', 'hover:bg-pink-50');
        } else {
            item.classList.remove('bg-pink-100/80', 'text-pink-900', 'font-bold');
            item.classList.add('text-slate-600', 'hover:bg-pink-50');
        }
    });

    if (notifyUser) {
        showToast(`Đã áp dụng bộ màu: <strong>${theme.name}</strong> (${theme.subtitle})`, 'info');
    }
}

function initThemeSystem() {
    const currentThemeId = getCurrentThemeId();

    // 1. Khởi tạo danh sách thẻ chọn bộ màu trong Tab Cài Đặt
    const container = document.getElementById('theme-cards-container');
    if (container) {
        container.innerHTML = M3_THEMES.map(theme => {
            const isActive = theme.id === currentThemeId;
            return `<button type="button" class="theme-card flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left text-[11px] ${isActive ? 'active-theme-card' : 'border-pink-100 bg-white'} hover:border-pink-300 transition-colors" data-theme-id="${theme.id}" aria-pressed="${isActive}">
                <span class="w-3 h-3 rounded-full shrink-0" style="background:${theme.primaryHex}"></span>
                <span class="flex-1 text-slate-700">${theme.name}</span>
                <span class="theme-active-indicator ${isActive ? 'inline-flex' : 'hidden'} text-pink-600"><i class="fa-solid fa-check"></i></span>
            </button>`;
        }).join('');

        // Bắt sự kiện click vào từng card
        container.querySelectorAll('.theme-card').forEach(card => {
            card.addEventListener('click', () => {
                const tId = card.getAttribute('data-theme-id');
                applyTheme(tId, true);
            });
        });
    }

    // 2. Khởi tạo Menu nhanh trong Header
    const quickMenuContainer = document.getElementById('quick-theme-items-container');
    const quickToggleBtn = document.getElementById('btn-quick-theme-toggle');
    const quickDropdown = document.getElementById('quick-theme-dropdown');

    if (quickMenuContainer) {
        quickMenuContainer.innerHTML = M3_THEMES.map(theme => {
            const isActive = theme.id === currentThemeId;
            return `
                <button type="button" class="quick-theme-item flex items-center space-x-2 px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${isActive ? 'bg-pink-100/80 text-pink-900 font-bold' : 'text-slate-600 hover:bg-pink-50'}" data-theme-id="${theme.id}">
                    <span class="w-3 h-3 rounded-full shrink-0 shadow-sm" style="background-color: ${theme.primaryHex};"></span>
                    <span class="truncate text-[11px]">${theme.name}</span>
                </button>
            `;
        }).join('');

        quickMenuContainer.querySelectorAll('.quick-theme-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const tId = item.getAttribute('data-theme-id');
                applyTheme(tId, true);
                if (quickDropdown) quickDropdown.classList.add('hidden');
            });
        });
    }

    if (quickToggleBtn && quickDropdown) {
        quickToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            quickDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!quickDropdown.contains(e.target) && !quickToggleBtn.contains(e.target)) {
                quickDropdown.classList.add('hidden');
            }
        });
    }

    // 3. Áp dụng theme ban đầu
    applyTheme(currentThemeId, false);
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

function renderInvoiceExtraInfo(inv) {
    const container = document.getElementById('modal-extra-info');
    container.replaceChildren();
    const labels = {
        filename: 'File gốc', file_type: 'Định dạng', supplier_folder: 'Thư mục', thoi_gian_nhap: 'Thời gian lưu',
        phien_ban: 'Phiên bản hóa đơn', ty_gia: 'Tỷ giá', mst_tcgp: 'MST tổ chức giải pháp', nguoi_ky: 'Người ký',
        email: 'Email', sdt: 'Điện thoại', stk: 'Số tài khoản', ngan_hang: 'Ngân hàng',
        ma_cua_hang: 'Mã cửa hàng', ten_cua_hang: 'Tên cửa hàng', ho_ten_nguoi_mua: 'Họ tên người mua',
        ma_hang: 'Mã hàng', tinh_chat: 'Tính chất', tong_tien_dong: 'Tổng dòng',
        thue_suat: 'Thuế suất', thanh_tien: 'Tiền chưa thuế', tien_thue: 'Tiền thuế'
    };
    function section(title, values, keys = Object.keys(values || {})) {
        const entries = keys.filter(key => values[key] !== undefined && values[key] !== null && values[key] !== '');
        if (!entries.length) return;
        const box = document.createElement('section');
        const heading = document.createElement('h4');
        heading.className = 'font-semibold text-slate-700 mb-1';
        heading.textContent = title;
        box.appendChild(heading);
        const list = document.createElement('dl');
        list.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';
        entries.forEach(key => {
            const entry = document.createElement('div');
            const term = document.createElement('dt');
            term.className = 'text-slate-500';
            term.textContent = labels[key] || key;
            const value = document.createElement('dd');
            value.className = 'text-slate-800 break-words';
            value.textContent = typeof values[key] === 'number' ? formatNumber(values[key]) : String(values[key]);
            entry.append(term, value);
            list.appendChild(entry);
        });
        box.appendChild(list);
        container.appendChild(box);
    }
    section('Nguồn hóa đơn', inv, ['filename', 'file_type', 'supplier_folder', 'thoi_gian_nhap']);
    section('Thông tin bổ sung', inv.thong_tin_chung, ['phien_ban', 'ty_gia', 'mst_tcgp', 'nguoi_ky']);
    section('Liên hệ bên bán', inv.nguoi_ban, ['email', 'stk', 'ngan_hang', 'ma_cua_hang', 'ten_cua_hang']);
    section('Liên hệ bên mua', inv.nguoi_mua, ['sdt', 'email', 'stk', 'ngan_hang', 'ho_ten_nguoi_mua']);
    (inv.thanh_toan.chi_tiet_thue || []).forEach((tax, index) => section(`Thuế suất ${index + 1}`, tax));
    (inv.hang_hoa || []).forEach((item, index) => section(`Thông tin sản phẩm ${index + 1}`, item, ['ma_hang', 'tinh_chat', 'tong_tien_dong']));
    if (inv.source === 'excel') {
        const note = document.createElement('p');
        note.className = 'text-slate-400';
        note.textContent = 'Hiển thị thông tin đã lưu trong Excel. Các trường không được lưu trong workbook không có dữ liệu để hiển thị.';
        container.appendChild(note);
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

    document.getElementById('modal-inv-title').textContent = tt.ten_hoa_don || 'HÓA ĐƠN';
    document.getElementById('modal-inv-form').textContent = tt.mau_so || '---';
    document.getElementById('modal-inv-series').textContent = tt.ky_hieu || '---';
    document.getElementById('modal-inv-no').textContent = tt.so_hd || '---';
    document.getElementById('modal-inv-date').textContent = tt.ngay_lap || '---';
    document.getElementById('modal-inv-taxcode-auth').textContent = tt.ma_cqt ? `Mã CQT: ${tt.ma_cqt}` : '';

    document.getElementById('modal-buyer-name').textContent = nm.ten || '---';
    document.getElementById('modal-buyer-mst').textContent = nm.mst || '---';
    document.getElementById('modal-buyer-address').textContent = nm.dia_chi || '---';
    document.getElementById('modal-payment-method').textContent = tt.hinh_thuc_tt || '---';
    document.getElementById('modal-currency').textContent = tt.dong_tien || '---';

    const itemsBody = document.getElementById('modal-items-body');
    itemsBody.innerHTML = '';
    (inv.hang_hoa || []).forEach(it => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-pink-50/40';
        tr.innerHTML = `
            <td class="border border-pink-200 px-2 py-2 text-center text-slate-500">${escapeHtml(it.stt)}</td>
            <td class="border border-pink-200 px-3 py-2 font-medium text-slate-900">${escapeHtml(it.ten_hang)}</td>
            <td class="border border-pink-200 px-2 py-2 text-center text-slate-600">${escapeHtml(it.dvt || '')}</td>
            <td class="border border-pink-200 px-2 py-2 text-right font-mono">${formatNumber(it.so_luong)}</td>
            <td class="border border-pink-200 px-3 py-2 text-right font-mono">${formatCurrency(it.don_gia)}</td>
            <td class="border border-pink-200 px-3 py-2 text-right font-mono font-semibold">${formatCurrency(it.thanh_tien)}</td>
            <td class="border border-pink-200 px-2 py-2 text-center font-mono font-bold text-pink-600">${escapeHtml(it.thue_suat || '')}</td>
            <td class="border border-pink-200 px-3 py-2 text-right font-mono text-fuchsia-600">${formatCurrency(it.tien_thue)}</td>
        `;
        itemsBody.appendChild(tr);
    });

    document.getElementById('modal-total-without-vat').textContent = formatCurrency(toan.tong_tien_chua_thue);
    document.getElementById('modal-total-vat').textContent = formatCurrency(toan.tong_tien_thue);
    document.getElementById('modal-total-amount').textContent = formatCurrency(toan.tong_tien_thanh_toan);
    document.getElementById('modal-total-in-words').textContent = toan.tong_tien_chu || '---';

    document.getElementById('modal-sign-date').textContent = tt.ngay_ky ? `Ngày ký: ${tt.ngay_ky.replace('T', ' ')}` : 'Chưa có thông tin chữ ký';
    renderInvoiceExtraInfo(inv);

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
