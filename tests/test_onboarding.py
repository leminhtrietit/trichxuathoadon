"""Thiết lập/điều khoản luôn dùng thư mục tạm, không đụng dữ liệu thật."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import excel_manager as excel
from parser import parse_xml_invoice
from test_startup_performance import SAMPLE_XML
from terms import TERMS_VERSION


class OnboardingTests(unittest.TestCase):
    def setUp(self):
        import app
        self.application = app
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.output = self.root / 'output.xlsx'
        self.settings = self.root / 'settings.json'
        self.context = patch.multiple(app, SETTINGS_FILE=str(self.settings), current_excel_path=str(self.root/'old.xlsx'))
        self.context.start()
        self.addCleanup(self.context.stop)
        self.client = app.app.test_client()

    def payload(self, **changes):
        data = {'excel_path': str(self.output), 'theme': 'teal', 'accepted_terms': True, 'terms_version': TERMS_VERSION}
        data.update(changes)
        return data

    def test_acceptance_path_theme_and_terms_version_are_required(self):
        self.assertTrue(self.client.get('/api/onboarding').json['required'])
        for changes in ({'accepted_terms': False}, {'accepted_terms': 'true'}, {'terms_version': 'old'},
                        {'theme': 'invalid'}, {'excel_path': ''}, {'excel_path': 'relative.xlsx'}, {'excel_path': str(self.root/'a.pdf')}):
            self.assertEqual(self.client.post('/api/onboarding', json=self.payload(**changes)).status_code, 400)
        self.assertFalse(self.output.exists())
        self.assertFalse(self.settings.exists())

    def test_success_persists_and_does_not_reset_on_theme_sidebar_changes(self):
        self.assertTrue(self.client.post('/api/onboarding', json=self.payload()).json['success'])
        data = self.client.get('/api/onboarding').json
        self.assertFalse(data['required'])
        self.assertEqual(data['settings']['theme'], 'teal')
        self.assertEqual(data['settings']['excel_path'], str(self.output))
        self.assertEqual(data['settings']['accepted_terms_version'], TERMS_VERSION)
        self.assertIn('accepted_terms_at', data['settings'])
        self.client.post('/api/settings', json={'theme': 'blue', 'sidebar_collapsed': True})
        data = self.client.get('/api/onboarding').json
        self.assertFalse(data['required'])
        self.assertTrue(data['settings']['sidebar_collapsed'])
        saved = json.loads(self.settings.read_text(encoding='utf-8'))
        saved['accepted_terms_version'] = 'old'
        self.settings.write_text(json.dumps(saved), encoding='utf-8')
        self.assertTrue(self.client.get('/api/onboarding').json['required'])

    def test_existing_workbook_and_legacy_settings_preserved(self):
        excel.init_blank_excel_file(str(self.output))
        excel.save_invoices_to_excel([parse_xml_invoice(SAMPLE_XML)], str(self.output))
        before = self.output.read_bytes()
        self.settings.write_text(json.dumps({'excel_path': str(self.output), 'theme': 'purple'}),encoding='utf-8')
        first = self.client.get('/api/onboarding').json
        self.assertTrue(first['required'])
        self.assertEqual(first['settings']['excel_path'], str(self.output))
        self.assertTrue(self.client.post('/api/onboarding',json=self.payload()).json['success'])
        self.assertEqual(self.output.read_bytes(),before)

    def test_corrupt_workbook_and_failed_settings_save_do_not_complete(self):
        self.output.write_bytes(b'corrupt workbook')
        self.assertFalse(self.client.post('/api/onboarding',json=self.payload()).json['success'])
        self.assertEqual(self.output.read_bytes(),b'corrupt workbook')
        other = str(self.root/'new.xlsx')
        with patch.object(self.application,'save_user_settings',return_value=False):
            self.assertEqual(self.client.post('/api/onboarding',json=self.payload(excel_path=other)).status_code,500)
        self.assertTrue(self.client.get('/api/onboarding').json['required'])
        self.assertEqual(self.application.current_excel_path,str(self.root/'old.xlsx'))

    def test_settings_write_failure_is_reported(self):
        with patch.object(self.application.os,'replace',side_effect=OSError('denied')):
            self.assertFalse(self.application.save_user_settings({'theme':'rose'}))
        self.assertFalse(self.settings.exists())
        self.assertEqual(list(self.root.glob('settings-*.tmp')),[])
