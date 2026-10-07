import json
from pathlib import Path
import tempfile
import unittest
import uuid
from unittest.mock import patch, MagicMock
import feedback
from terms import TERMS_VERSION

class FeedbackTests(unittest.TestCase):
    def payload(self, **changes):
        return dict(message='Góp ý thử nghiệm', email='', consent=True, consent_version='feedback-v1', request_id=str(uuid.uuid4()), **changes)

    def test_missing_consent_invalid_email_and_extra_fields_never_connect(self):
        for changes in ({'consent':False}, {'consent_version':'old'}, {'email':'bad'}, {'message':'short'}, {'invoice_xml':'secret'}, {'request_id':'bad'}):
            data=self.payload();data.update(changes)
            with patch('requests.Session') as session:
                with self.assertRaises(feedback.FeedbackError):feedback.send_feedback(data)
                session.assert_not_called()

    def test_sender_only_transmits_allowlist_fixed_https_no_redirect_no_cookies(self):
        with patch('requests.Session') as constructor:
            session=constructor.return_value.__enter__.return_value
            response=session.post.return_value.__enter__.return_value
            data=self.payload()
            response.status_code=201;response.iter_content.return_value=[json.dumps({'success':True,'id':data['request_id']}).encode()]
            self.assertTrue(feedback.send_feedback(data)['success'])
            args,kw=session.post.call_args
            self.assertEqual(args[0],feedback.FEEDBACK_ENDPOINT)
            self.assertFalse(kw['allow_redirects']);self.assertFalse(session.trust_env)
            self.assertEqual(set(kw['json']),{'request_id','app_id','app_version','message','email','consent','consent_version'})
            self.assertNotIn('cookies',kw);self.assertNotIn('files',kw)
            for code in (301,429,503):
                response.status_code=code
                with self.assertRaises(feedback.FeedbackError):feedback.send_feedback(self.payload())
            response.status_code=200;response.iter_content.return_value=[b'x'*17000]
            with self.assertRaises(feedback.FeedbackError):feedback.send_feedback(self.payload())

    def test_local_route_blocks_unaccepted_setup_origin_and_network_without_consent(self):
        import app
        with tempfile.TemporaryDirectory() as folder, patch.object(app,'SETTINGS_FILE',str(Path(folder)/'settings.json')):
            client=app.app.test_client()
            with patch('feedback.send_feedback') as sender:
                self.assertEqual(client.post('/api/feedback',json=self.payload()).status_code,403)
                Path(app.SETTINGS_FILE).write_text(json.dumps({'setup_completed':True,'accepted_terms_version':TERMS_VERSION}),encoding='utf-8')
                self.assertEqual(client.post('/api/feedback',json=self.payload(),headers={'Origin':'https://evil.example'}).status_code,403)
                sender.assert_not_called()
                sender.return_value={'success':True,'id':'receipt'}
                self.assertEqual(client.post('/api/feedback',json=self.payload()).status_code,200)
                self.assertEqual(sender.call_count,1)
                self.assertEqual(client.post('/api/feedback',json=self.payload(),base_url='http://evil.example').status_code,403)
