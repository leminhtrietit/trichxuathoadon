import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

class UpdatePreferenceTests(unittest.TestCase):
    def setUp(self):
        import app
        self.application=app;self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.settings=self.root/'settings.json';self.workbook=self.root/'untouched.xlsx';self.workbook.write_bytes(b'untouched workbook')
        context=patch.multiple(app,SETTINGS_FILE=str(self.settings),current_excel_path=str(self.workbook));context.start();self.addCleanup(context.stop);self.client=app.app.test_client()

    def test_fresh_legacy_and_invalid_preferences_default_off_without_writes(self):
        self.assertFalse(self.client.get('/api/settings').json['settings']['auto_check_updates']);self.assertFalse(self.settings.exists())
        for value in ({'theme':'teal'},{'auto_check_updates':'true'},{'auto_check_updates':1}):
            self.settings.write_text(json.dumps(value),encoding='utf-8');before=self.settings.read_bytes()
            self.assertFalse(self.client.get('/api/settings').json['settings']['auto_check_updates']);self.assertEqual(self.settings.read_bytes(),before)

    def test_boolean_persists_across_other_preferences_and_preserves_workbook(self):
        before=self.workbook.read_bytes()
        self.assertTrue(self.client.post('/api/settings',json={'auto_check_updates':True}).json['settings']['auto_check_updates'])
        self.client.post('/api/settings',json={'theme':'blue','sidebar_collapsed':True})
        self.assertTrue(self.client.get('/api/settings').json['settings']['auto_check_updates'])
        self.assertFalse(self.client.post('/api/settings',json={'auto_check_updates':False}).json['settings']['auto_check_updates'])
        self.assertEqual(self.workbook.read_bytes(),before)

    def test_non_booleans_rejected_and_write_failure_not_reported_success(self):
        self.settings.write_text('{}',encoding='utf-8');before=self.settings.read_bytes()
        for value in ('true',1,None,[]):
            self.assertEqual(self.client.post('/api/settings',json={'auto_check_updates':value,'theme':'teal'}).status_code,400)
            self.assertEqual(self.settings.read_bytes(),before)
        with patch.object(self.application,'save_user_settings',return_value=False):
            self.assertEqual(self.client.post('/api/settings',json={'auto_check_updates':True}).status_code,500)
        self.assertFalse(self.client.get('/api/settings').json['settings']['auto_check_updates'])
