# EduInsight XAI — registration and live student records

Open this whole folder in VS Code. The React/Figma interface connects to Flask, a Random Forest and SHAP.

## Run on Windows (PowerShell)

Use Python 3.12 and Node.js **22.12 or newer** (Node 24 LTS is also suitable). The backend was tested with Python 3.12. The included Vite frontend requires modern Node.

Terminal 1, from the project folder:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Activation is unnecessary, so PowerShell's script execution policy will not block these commands. If you have multiple Python versions, use `py -3.12 -m venv .venv` instead of the second command. Keep this terminal open.

Terminal 2, from the project folder:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Do not open index.html directly. The first backend launch trains the model and creates the database. Two launch scripts are also included; they install dependencies and start their respective services without PowerShell activation.

## Accounts

| Role | Username | Password |
|---|---|---|
| Professor | professor | prof123 |
| Student demo | student | student123 |
| Student demo | meera | student123 |
| Student demo | rohan | student123 |

New students: select **New student? Create your account** on the login page. Enter a unique student ID, username, password (at least 8 characters), personal information and five academic inputs. Registration signs the student in automatically. Public registration creates student accounts only; professor access cannot be selected through registration.

## The six requested changes

1. **Self-registration:** real student login and persistent academic record.
2. **Manual information:** students edit their own record through **Update my academic information** or **My Academics → Edit academic details**. Professors use **Add student** to create a student plus login credentials, or open a student profile and select **Edit details**. Give the created credentials to that student yourself.
3. **Check Risk:** a separate section in both portals accepts all five academic inputs and returns model risk class, score, probabilities, confidence and SHAP explanation. This check does not save or overwrite academic data. To change the dashboard, save the academic form.
4. **Profile editing:** click the profile area in the upper right to update your name/email or password. Changing a password requires the current password. Username, student ID and role remain stable identifiers. Student name changes appear in the professor directory.
5. **Readable typography:** larger headings, labels, tables, cards and form inputs. Sidebar navigation retains its earlier size. Layouts wrap on smaller displays.
6. **48 initial students:** a fresh database contains 48 sample student records. New registration increases this count (49, 50, etc.); 48 is the initial sample count, not a registration limit. Directory rows distinguish sample and saved student data. Dashboard, risk distribution, averages, profiles and CSV exports use current SQLite records, including registrations and saved edits. Use **Refresh data** in the professor portal after somebody registers in another browser.

Extra fixes: server-side validation; hashed passwords; persistent sessions with a locally generated secret; student access restrictions; current-password check for password changes; duplicate ID/username protection; intervention history in the student portal; real resource links instead of pretend progress buttons; and a type-checked frontend build.

## Updating an existing installation

The easiest way to demonstrate exactly 48 initial samples is to extract this ZIP into a **new folder** and start there. Your old project remains available. A new folder creates a new database; old notes or users are not automatically copied.

If you need to keep an existing database, stop both servers, back up your project folder, then replace the application source files while retaining `backend/eduinsight.db`. On startup, the schema upgrade seeds active academics for the first 48 sample IDs once; old account/profile/note/support tables are preserved. The old metadata for the other CSV IDs may still exist internally, but it is not part of the active directory or dashboard. The previous app had no registration feature; if your database has custom changes beyond that original schema, keep your backup and review their migration before relying on it.

Do not delete the database to update the UI. Deleting it removes registrations, edits, notes and support requests. The ZIP deliberately contains no database, virtual environment, passwords saved from tests or generated session secret.

## Training data versus application data

- `backend/synthetic_student_data.csv`: the original **1,000-row synthetic training dataset**, unchanged. The model uses the original five features, three risk classes and stratified 80/20 training/test split. The verified hold-out accuracy here was **88.5%**, on synthetic data.
- `backend/eduinsight.db`: 48 initial sample students plus newly added students, users, current academic values, interventions and support requests. Edits survive backend/browser restarts.
- Manual student records are used for inference, not automatic model retraining. Registering a student does not alter hold-out model accuracy.
- Risk score = `50 × P(Medium) + 100 × P(High)`. Class = the class with largest probability. Confidence means that model probability, not guaranteed correctness.
- SHAP values explain the probability of the predicted class; they are not points added to the 0–100 risk score. What-if recalculates the same model with changed inputs.
- Assignment counts are only estimates derived from practical completion, as in the original project. This build does not contain actual subject marks, official timetable or real learning progress data.
- Students may self-report academic metrics in this prototype. It does not authenticate college attendance or independently verify those numbers.

Describe this as a functioning prototype trained on synthetic academic data. Predictions about manually entered real students are demonstrations, not a validated academic assessment.

## Useful routes

```text
POST /auth/register                  public, students only
POST /auth/login
GET  /api/me
PUT  /api/me                          name/email/password
POST /api/risk-check                  authenticated, non-saving check
GET  /api/dashboard                  professor
GET  /api/students                   professor
POST /api/students                   professor, student plus account
GET  /api/students/<id>               professor or matching student
PUT  /api/students/<id>               professor or matching student
GET  /api/student/me                 matching student's live record
POST /api/students/<id>/what-if       professor or matching student
GET  /api/interventions              professor
POST /api/students/<id>/interventions professor
POST /api/interventions/<id>/complete professor
POST /api/support                    student
GET  /api/reports/students.csv        professor
POST /predict                       original compatibility endpoint
GET  /health                         model status and training row count
```

## Validation and troubleshooting

```powershell
# From project root; uses an isolated temporary test database
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v

# From frontend
npm run build
```

If loading fails, make sure the Flask terminal is still running at http://127.0.0.1:5000 and Vite is running on port 5173. Restart both after changing application files. If needed, set `VITE_API_URL` in `frontend/.env` and restart Vite. Login errors are shown in the form. Registration duplicates must be resolved by signing in with the existing account or updating that student through the professor portal; registration will not overwrite another student.

SQLite and the Flask development server are sufficient for a local college demonstration. The bundled demo accounts are for this local prototype.
