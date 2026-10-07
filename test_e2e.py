import os
import openpyxl
from parser import parse_invoice_file, scan_folder_for_invoices
from excel_manager import save_invoices_to_excel, read_excel_summary, ensure_excel_file
from app import app

def run_tests():
    client = app.test_client()

    # 1. Test status API
    res = client.get('/api/status')
    assert res.status_code == 200, 'Status API failed'
    print('Test 1: Status API OK')

    # 2. Test Excel Data API
    res = client.get('/api/excel-data')
    assert res.status_code == 200, 'Excel Data API failed'
    data = res.get_json()
    assert 'pivot_by_supplier' in data, 'Missing pivot_by_supplier'
    assert 'pivot_by_month' in data, 'Missing pivot_by_month'
    print('Test 2: Excel Data API with Pivot OK')

    # 3. Test duplicate behavior and Sheet structure
    test_excel = 'data/test_duplicate_check.xlsx'
    if os.path.exists(test_excel):
        os.remove(test_excel)
    ensure_excel_file(test_excel)

    sample_xml = r'C:\Users\minht\Downloads\348826-T01-2026.xml'
    if os.path.exists(sample_xml):
        inv1 = parse_invoice_file(sample_xml)
        inv1['supplier_folder'] = 'NhaCungCap_Aeon'
        
        # Save once
        s1 = save_invoices_to_excel([inv1], test_excel, overwrite=False)
        assert s1['added'] == 1, 'First save should add 1'
        
        # Save duplicate with overwrite=False (Skip)
        s2 = save_invoices_to_excel([inv1], test_excel, overwrite=False)
        assert s2['skipped'] == 1 and s2['added'] == 0, 'Duplicate with skip failed'
        
        # Save duplicate with overwrite=True (Replace in-place)
        s3 = save_invoices_to_excel([inv1], test_excel, overwrite=True)
        assert s3['updated'] == 1 and s3['added'] == 0, 'Duplicate with replace failed'
        
        # Check total rows
        sum_data = read_excel_summary(test_excel)
        tot = sum_data['stats']['total_invoices']
        assert tot == 1, f'Total invoices should be 1, got {tot}'
        
        # Check sheets
        wb = openpyxl.load_workbook(test_excel)
        assert wb.sheetnames[0] == 'TongQuan', f'Sheet 1 should be TongQuan, got {wb.sheetnames[0]}'
        assert 'TongHopHoaDon' in wb.sheetnames, 'TongHopHoaDon missing'
        assert 'ChiTietHangHoa' in wb.sheetnames, 'ChiTietHangHoa missing'
        
        ws_tq = wb['TongQuan']
        assert ws_tq.auto_filter.ref is not None, 'AutoFilter reference on TongQuan should not be None'
        print(f'Test 3: Duplicate logic & Sheet 1 TongQuan with AutoFilter ({ws_tq.auto_filter.ref}) OK')
        wb.close()
        
        if os.path.exists(test_excel):
            os.remove(test_excel)

    # 4. Test Scan folder API
    res = client.post('/api/scan-folder', json={
        'folder_path': r'C:\Users\minht\Downloads',
        'recursive': False,
        'auto_save': False,
        'overwrite': True
    })
    assert res.status_code == 200, f'Scan folder failed: {res.get_json()}'
    scan_json = res.get_json()
    assert 'supplier_folders' in scan_json, 'Missing supplier_folders in scan response'
    print(f'Test 4: Scan folder API OK. Found {scan_json["total_files"]} files, {len(scan_json["supplier_folders"])} folders')

    print('>>> ALL TESTS PASSED SUCCESSFULLY! <<<')

if __name__ == '__main__':
    run_tests()
