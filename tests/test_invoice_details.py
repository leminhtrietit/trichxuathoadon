"""Chỉ sử dụng workbook tạm; kiểm tra đọc chi tiết không ghi dữ liệu."""
import copy
from pathlib import Path
import tempfile
import unittest
import openpyxl
import excel_manager as excel
from parser import parse_xml_invoice
from test_startup_performance import SAMPLE_XML


class InvoiceDetailsTests(unittest.TestCase):
    def test_read_is_byte_identical_and_matches_invoice_key(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.xlsx'
            excel.init_blank_excel_file(str(path))
            first = parse_xml_invoice(SAMPLE_XML, filename='invoice.xml')
            second = copy.deepcopy(first)
            second['nguoi_ban']['mst'] = '9999999999'
            second['invoice_key'] = 'C26TAA_123_9999999999'
            second['hang_hoa'][0]['ten_hang'] = 'Sản phẩm khác'
            excel.save_invoices_to_excel([first, second], str(path))
            before = path.read_bytes()
            result = excel.read_excel_invoice_details(str(path), '1')
            self.assertTrue(result['success'])
            self.assertEqual(len(result['invoices']), 1)
            invoice = result['invoices'][0]
            self.assertEqual(invoice['hang_hoa'][0]['ten_hang'], 'Sản phẩm mẫu')
            self.assertEqual(invoice['nguoi_ban']['mst'], '0123456789')
            self.assertEqual(invoice['thanh_toan']['tong_tien_thanh_toan'], 1100)
            self.assertEqual(len(excel.read_excel_invoice_details(str(path))['invoices']), 2)
            self.assertFalse(excel.read_excel_invoice_details(str(path), '99')['success'])
            self.assertEqual(path.read_bytes(), before)

    def test_missing_or_corrupt_workbook_is_not_created_or_changed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing.xlsx'
            self.assertEqual(excel.read_excel_invoice_details(str(path))['invoices'], [])
            self.assertFalse(path.exists())
            path.write_bytes(b'corrupt workbook')
            self.assertFalse(excel.read_excel_invoice_details(str(path))['success'])
            self.assertEqual(path.read_bytes(), b'corrupt workbook')

    def test_detail_headers_can_be_reordered(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'reordered.xlsx'
            excel.init_blank_excel_file(str(path))
            invoice = parse_xml_invoice(SAMPLE_XML)
            excel.save_invoices_to_excel([invoice], str(path))
            wb = openpyxl.load_workbook(path)
            ws = wb['ChiTietHangHoa']
            values = list(ws.values)
            ws.delete_rows(1, ws.max_row)
            for row in values:
                ws.append(list(reversed(row)))
            wb.save(path)
            wb.close()
            before = path.read_bytes()
            result = excel.read_excel_invoice_details(str(path))
            self.assertEqual(result['invoices'][0]['hang_hoa'][0]['ten_hang'], 'Sản phẩm mẫu')
            self.assertEqual(path.read_bytes(), before)
