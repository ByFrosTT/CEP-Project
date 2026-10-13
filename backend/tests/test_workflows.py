import os
import sys
import tempfile
import unittest
from pathlib import Path

_temp = tempfile.TemporaryDirectory()
os.environ['EDUINSIGHT_DB'] = str(Path(_temp.name) / 'test.db')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import app

class Workflows(unittest.TestCase):
    def test_complete_student_lifecycle(self):
        client = app.test_client()
        prof = client.post('/auth/login', json={'username':'professor','password':'prof123'}).get_json()
        ph = {'Authorization':'Bearer '+prof['token']}
        self.assertEqual(client.get('/api/dashboard', headers=ph).get_json()['total_students'], 48)
        data = {'student_id':'SAHIL001','name':'Sahil Todankar','semester':5,'course':'B.Sc. IT','campus':'VSIT Mumbai','username':'sahil','password':'strongpass123','email':'sahil@example.com','attendance':82,'internal_marks':74,'practical_completion':90,'backlogs':0,'lab_hours_weekly':6,'role':'professor'}
        result = client.post('/auth/register', json=data)
        self.assertEqual(result.status_code, 201, result.get_json())
        self.assertEqual(result.get_json()['user']['role'], 'student')
        sh = {'Authorization':'Bearer '+result.get_json()['token']}
        self.assertEqual(client.get('/api/dashboard', headers=ph).get_json()['total_students'], 49)
        own = client.get('/api/student/me', headers=sh).get_json()
        self.assertEqual(own['attendance'],82)
        self.assertEqual(len(own['shap_values']),5)
        self.assertEqual(client.get('/api/students',headers=sh).status_code,403)
        self.assertEqual(client.get('/api/students/VSIT001',headers=sh).status_code,403)
        self.assertEqual(client.put('/api/students/VSIT001',headers=sh,json=data).status_code,403)
        self.assertEqual(client.post('/auth/register',json=data).status_code,400)
        duplicate = dict(data, student_id='OTHER001')
        self.assertEqual(client.post('/auth/register',json=duplicate).status_code,400)
        self.assertEqual(client.get('/api/dashboard',headers=ph).get_json()['total_students'],49)
        changed = dict(data, attendance=60, backlogs=3)
        edit = client.put('/api/students/SAHIL001', headers=sh, json=changed)
        self.assertEqual(edit.status_code,200,edit.get_json())
        self.assertEqual(client.get('/api/student/me',headers=sh).get_json()['attendance'],60)
        check = client.post('/api/risk-check',headers=sh,json=data)
        self.assertEqual(check.status_code,200,check.get_json())
        self.assertEqual(check.get_json()['risk_score'],own['risk_score'])
        self.assertEqual(client.get('/api/student/me',headers=sh).get_json()['attendance'],60)
        for bad in [-1,101,'NaN','Infinity',None]:
            self.assertEqual(client.post('/api/risk-check',headers=sh,json=dict(data,attendance=bad)).status_code,400)
        self.assertEqual(client.post('/api/students/SAHIL001/what-if',headers=sh,json={'backlogs':1.5}).status_code,400)
        self.assertEqual(client.post('/api/students/SAHIL001/what-if',headers=sh,json={'attendance':95,'backlogs':0}).status_code,200)
        added = dict(data, username='newstudent', student_id='NEW001', name='New Student')
        self.assertEqual(client.post('/api/students',headers=ph,json=added).status_code,201)
        self.assertEqual(client.get('/api/dashboard',headers=ph).get_json()['total_students'],50)
        self.assertEqual(client.post('/auth/login',json={'username':'newstudent','password':'strongpass123'}).status_code,200)
        self.assertEqual(client.put('/api/me',headers=sh,json={'display_name':'Sahil T','email':'sahil@example.com','new_password':'changed123','current_password':'bad'}).status_code,400)
        self.assertEqual(client.put('/api/me',headers=sh,json={'display_name':'Sahil T','email':'sahil@example.com','new_password':'changed123','current_password':'strongpass123'}).status_code,200)
        self.assertEqual(client.post('/auth/login',json={'username':'sahil','password':'strongpass123'}).status_code,401)
        self.assertEqual(client.post('/auth/login',json={'username':'sahil','password':'changed123'}).status_code,200)
        self.assertEqual(client.get('/api/student/me',headers=sh).get_json()['name'],'Sahil T')
        self.assertIn('SAHIL001',client.get('/api/reports/students.csv',headers=ph).get_data(as_text=True))
        self.assertEqual(client.get('/api/students',headers=ph).get_json()['count'],50)
        self.assertEqual(client.put('/api/students/SAHIL001',headers=ph,json=data).status_code,200)
        note=client.post('/api/students/SAHIL001/interventions',headers=ph,json={'note':'Follow up attendance'}).get_json()
        self.assertEqual(client.post('/api/interventions/'+str(note['id'])+'/complete',headers=ph).status_code,200)
        self.assertEqual(client.post('/api/support',headers=sh,json={'message':'Need guidance with attendance'}).status_code,201)
        # Seed initialization is idempotent and does not overwrite student edits.
        from app import init_db,raw_df
        init_db(raw_df)
        self.assertEqual(client.get('/api/dashboard',headers=ph).get_json()['total_students'],50)

if __name__=='__main__': unittest.main()
