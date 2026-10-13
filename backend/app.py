from __future__ import annotations

import csv
import io
import math
import re
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import shap
from flask import Flask, Response, g, jsonify, request
from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "synthetic_student_data.csv"
DB_PATH = Path(os.environ.get("EDUINSIGHT_DB", str(BASE_DIR / "eduinsight.db")))
FEATURES = [
    "Attendance_Pct",
    "Internal_Marks",
    "Practical_Completion_Pct",
    "Previous_Backlogs",
    "Lab_Hours_Weekly",
]
FEATURE_LABELS = {
    "Attendance_Pct": "Attendance",
    "Internal_Marks": "Internal marks",
    "Practical_Completion_Pct": "Practical completion",
    "Previous_Backlogs": "Previous backlogs",
    "Lab_Hours_Weekly": "Weekly lab hours",
}
RISK_LABELS = {0: "Low", 1: "Medium", 2: "High"}

app = Flask(__name__)
secret_path = BASE_DIR / ".session-secret"
if not secret_path.exists():
    import secrets
    secret_path.write_text(secrets.token_hex(32))
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or secret_path.read_text().strip()
CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}})
serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"], salt="eduinsight-auth")


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.before_request
def require_json_object():
    if request.method in {'POST', 'PUT', 'PATCH'}:
        body = request.get_json(silent=True)
        if body is not None and not isinstance(body, dict):
            return jsonify({'error': 'Request body must be a JSON object'}), 400


@app.teardown_appcontext
def close_db(_: BaseException | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def initials(name: str) -> str:
    return "".join(part[0] for part in name.split()[:2]).upper()


FIRST_NAMES = [
    "Aarav", "Meera", "Rohan", "Sana", "Dev", "Ishita", "Kabir", "Ananya", "Arjun", "Nisha",
    "Vihaan", "Aditi", "Reyansh", "Diya", "Aditya", "Sara", "Neil", "Riya", "Ved", "Kavya",
]
LAST_NAMES = [
    "Sharma", "Iyer", "Patil", "Khan", "Desai", "Joshi", "Mehta", "Kulkarni", "Nair", "Shah",
    "Singh", "Rao", "Gupta", "Pillai", "Jadhav", "Menon", "Kapoor", "Sawant", "Mishra", "More",
]


def build_student_meta(df: pd.DataFrame) -> list[tuple[Any, ...]]:
    rows = []
    for i, row in df.iterrows():
        sid = str(row["StudentID"])
        name = ["Aarav Sharma", "Meera Iyer", "Rohan Patil"][i] if i < 3 else f"{FIRST_NAMES[i % len(FIRST_NAMES)]} {LAST_NAMES[(i * 7) % len(LAST_NAMES)]}"
        semester = int((i % 6) + 1)
        assignments_total = 10
        assignments_done = max(0, min(10, int(round(float(row["Practical_Completion_Pct"]) / 10))))
        rows.append((
            sid, name, initials(name), semester, "B.Sc. Information Technology", "VSIT Mumbai",
            assignments_done, assignments_total,
        ))
    return rows


def init_db(df: pd.DataFrame) -> None:
    db = sqlite3.connect(DB_PATH)
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student','professor')),
            display_name TEXT NOT NULL,
            student_id TEXT
        );
        CREATE TABLE IF NOT EXISTS student_meta (
            student_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            initials TEXT NOT NULL,
            semester INTEGER NOT NULL,
            course TEXT NOT NULL,
            campus TEXT NOT NULL,
            assignments_done INTEGER NOT NULL,
            assignments_total INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS interventions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            professor_name TEXT NOT NULL,
            note TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            follow_up_date TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS support_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            created_at TEXT NOT NULL
        );
        """
    )
    count = db.execute("SELECT COUNT(*) FROM student_meta").fetchone()[0]
    if count == 0:
        db.executemany(
            "INSERT INTO student_meta(student_id,name,initials,semester,course,campus,assignments_done,assignments_total) VALUES(?,?,?,?,?,?,?,?)",
            build_student_meta(df.head(48)),
        )
    users_count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if users_count == 0:
        demo_students = [str(df.iloc[i]["StudentID"]) for i in range(3)]
        users = [
            ("professor", generate_password_hash("prof123"), "professor", "Prof. Chitra More", None),
            ("student", generate_password_hash("student123"), "student", "Aarav Sharma", demo_students[0]),
            ("meera", generate_password_hash("student123"), "student", "Meera Iyer", demo_students[1]),
            ("rohan", generate_password_hash("student123"), "student", "Rohan Patil", demo_students[2]),
        ]
        db.executemany("INSERT INTO users(username,password_hash,role,display_name,student_id) VALUES(?,?,?,?,?)", users)
    notes_count = db.execute("SELECT COUNT(*) FROM interventions").fetchone()[0]
    if notes_count == 0:
        now = datetime.now().isoformat(timespec="seconds")
        seed_notes = [
            (str(df.iloc[1]["StudentID"]), "Prof. Chitra More", "Discussed attendance and backlog plan.", "open", (datetime.now() + timedelta(days=5)).date().isoformat(), now),
            (str(df.iloc[3]["StudentID"]), "Prof. Chitra More", "Recommended additional practical sessions.", "open", (datetime.now() + timedelta(days=7)).date().isoformat(), now),
        ]
        db.executemany("INSERT INTO interventions(student_id,professor_name,note,status,follow_up_date,created_at) VALUES(?,?,?,?,?,?)", seed_notes)
    db.execute("CREATE TABLE IF NOT EXISTS academics (student_id TEXT PRIMARY KEY, Attendance_Pct REAL NOT NULL, Internal_Marks REAL NOT NULL, Practical_Completion_Pct REAL NOT NULL, Previous_Backlogs INTEGER NOT NULL, Lab_Hours_Weekly REAL NOT NULL, source TEXT NOT NULL DEFAULT 'sample', updated_at TEXT NOT NULL)")
    db.execute("CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY)")
    if not db.execute("SELECT 1 FROM schema_versions WHERE version=2").fetchone():
        for _, row in df.head(48).iterrows():
            db.execute("INSERT OR IGNORE INTO academics VALUES(?,?,?,?,?,?,?,?)", (str(row['StudentID']), *[float(row[f]) for f in FEATURES], 'sample', datetime.now().isoformat()))
        db.execute("INSERT INTO schema_versions VALUES(2)")
    columns = {r[1] for r in db.execute("PRAGMA table_info(users)")}
    if 'email' not in columns:
        db.execute("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''")
    db.commit()
    db.close()


print("Training EduInsight Random Forest model...")
raw_df = pd.read_csv(DATA_PATH)
X = raw_df[FEATURES]
y = raw_df["Academic_Risk_Class"].astype(int)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42, stratify=y)
model = RandomForestClassifier(n_estimators=220, max_depth=8, min_samples_leaf=2, class_weight="balanced", random_state=42)
model.fit(X_train, y_train)
model_accuracy = float(accuracy_score(y_test, model.predict(X_test)))
explainer = shap.TreeExplainer(model)
init_db(raw_df)
print(f"Model ready. Hold-out accuracy: {model_accuracy:.3f}")


def token_for(user: sqlite3.Row) -> str:
    return serializer.dumps({"user_id": user["id"], "role": user["role"], "student_id": user["student_id"]})


def auth_required(role: str | None = None):
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            auth = request.headers.get("Authorization", "")
            if not auth.startswith("Bearer "):
                return jsonify({"error": "Authentication required"}), 401
            try:
                payload = serializer.loads(auth[7:], max_age=60 * 60 * 12)
            except SignatureExpired:
                return jsonify({"error": "Session expired"}), 401
            except BadSignature:
                return jsonify({"error": "Invalid session"}), 401
            user = get_db().execute("SELECT * FROM users WHERE id=?", (payload["user_id"],)).fetchone()
            if not user:
                return jsonify({"error": "User not found"}), 401
            if role and user["role"] != role:
                return jsonify({"error": "Not authorized for this area"}), 403
            g.user = user
            return fn(*args, **kwargs)
        return wrapper
    return deco


def frame_for_student(student_id: str) -> pd.DataFrame | None:
    row = get_db().execute("SELECT * FROM academics WHERE student_id=?", (student_id,)).fetchone()
    return pd.DataFrame([{f: row[f] for f in FEATURES}])[FEATURES] if row else None


def active_frame():
    return pd.read_sql_query("SELECT student_id AS StudentID, * FROM academics ORDER BY rowid", get_db())


def shap_vector(input_df: pd.DataFrame, pred: int) -> np.ndarray:
    values = explainer.shap_values(input_df)
    if isinstance(values, list):
        arr = np.asarray(values[pred])
        return arr[0]
    arr = np.asarray(values)
    # SHAP versions differ: (samples, features, classes) or (samples, features)
    if arr.ndim == 3:
        return arr[0, :, pred]
    if arr.ndim == 2:
        return arr[0]
    return arr.reshape(-1)[: len(FEATURES)]


def predict_frame(input_df: pd.DataFrame, include_shap: bool = True) -> dict[str, Any]:
    pred = int(model.predict(input_df)[0])
    proba = model.predict_proba(input_df)[0]
    risk_score = int(round((float(proba[1]) * 50 + float(proba[2]) * 100)))
    result: dict[str, Any] = {
        "prediction": pred,
        "risk": RISK_LABELS[pred],
        "risk_score": risk_score,
        "confidence": round(float(proba[pred]) * 100, 1),
        "probabilities": {RISK_LABELS[i]: round(float(p) * 100, 1) for i, p in enumerate(proba)},
    }
    if include_shap:
        vector = shap_vector(input_df, pred)
        impacts = []
        for i, feature in enumerate(FEATURES):
            value = float(input_df.iloc[0][feature])
            impact = float(vector[i]) if i < len(vector) else 0.0
            impacts.append({
                "feature": feature,
                "name": FEATURE_LABELS[feature],
                "value": round(value, 1),
                "impact": round(impact, 4),
                "direction": "raises" if impact > 0 else "lowers",
            })
        impacts.sort(key=lambda x: abs(x["impact"]), reverse=True)
        result["shap_values"] = impacts
    return result


def student_payload(student_id: str, include_shap: bool = True) -> dict[str, Any] | None:
    input_df = frame_for_student(student_id)
    if input_df is None:
        return None
    meta = get_db().execute("SELECT * FROM student_meta WHERE student_id=?", (student_id,)).fetchone()
    if not meta:
        return None
    pred = predict_frame(input_df, include_shap=include_shap)
    row = input_df.iloc[0]
    intervention_count = get_db().execute("SELECT COUNT(*) FROM interventions WHERE student_id=? AND status='open'", (student_id,)).fetchone()[0]
    return {
        "id": student_id,
        "name": meta["name"],
        "initials": meta["initials"],
        "semester": meta["semester"],
        "course": meta["course"],
        "campus": meta["campus"],
        "source": get_db().execute("SELECT source FROM academics WHERE student_id=?", (student_id,)).fetchone()[0],
        "attendance": round(float(row["Attendance_Pct"]), 1),
        "internal_marks": round(float(row["Internal_Marks"]), 1),
        "practical_completion": round(float(row["Practical_Completion_Pct"]), 1),
        "backlogs": int(row["Previous_Backlogs"]),
        "lab_hours_weekly": round(float(row["Lab_Hours_Weekly"]), 1),
        "assignments_done": meta["assignments_done"],
        "assignments_total": meta["assignments_total"],
        "open_interventions": intervention_count,
        **pred,
    }


def can_access_student(student_id: str) -> bool:
    return g.user["role"] == "professor" or g.user["student_id"] == student_id


@app.get("/health")
def health():
    return jsonify({"status": "ok", "model": "RandomForestClassifier", "accuracy": round(model_accuracy, 4), "training_rows": int(len(raw_df))})


@app.post("/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    username = str(body.get("username", "")).strip().lower()
    password = str(body.get("password", ""))
    user = get_db().execute("SELECT * FROM users WHERE lower(username)=?", (username,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Incorrect username or password"}), 401
    return jsonify({
        "token": token_for(user),
        "user": {"id": user["id"], "username": user["username"], "role": user["role"], "display_name": user["display_name"], "student_id": user["student_id"], "email": user["email"]},
    })


@app.get("/api/me")
@auth_required()
def me():
    return jsonify({"username": g.user["username"], "role": g.user["role"], "display_name": g.user["display_name"], "student_id": g.user["student_id"], "email": g.user["email"]})


@app.get("/api/dashboard")
@auth_required("professor")
def dashboard():
    records = active_frame()
    predictions = model.predict(records[FEATURES])
    probs = model.predict_proba(records[FEATURES])
    scores = probs[:, 1] * 50 + probs[:, 2] * 100
    counts = {RISK_LABELS[i]: int(np.sum(predictions == i)) for i in range(3)}
    open_interventions = get_db().execute("SELECT COUNT(*) FROM interventions WHERE status='open'").fetchone()[0]
    improving = int(np.sum((records["Attendance_Pct"] >= 75) & (records["Previous_Backlogs"] <= 1) & (scores < 50)))
    feature_importance = sorted(
        [{"name": FEATURE_LABELS[f], "value": round(float(v) * 100, 1)} for f, v in zip(FEATURES, model.feature_importances_)],
        key=lambda x: x["value"], reverse=True,
    )
    return jsonify({
        "total_students": int(len(records)),
        "sample_students": int((records["source"] == "sample").sum()),
        "registered_students": int((records["source"] != "sample").sum()),
        "risk_counts": counts,
        "average_attendance": round(float(records["Attendance_Pct"].mean()), 1),
        "improving_students": improving,
        "open_interventions": open_interventions,
        "model_accuracy": round(model_accuracy * 100, 1),
        "feature_importance": feature_importance,
        "updated_at": datetime.now().isoformat(timespec="minutes"),
    })


@app.get("/api/students")
@auth_required("professor")
def students_list():
    search = request.args.get("search", "").strip().lower()
    risk_filter = request.args.get("risk", "").strip().title()
    semester = request.args.get("semester", "").strip()
    limit = min(max(int(request.args.get("limit", 10000)), 1), 10000)
    results = []
    # Predict all once, then enrich only rows that survive filters.
    records = active_frame()
    preds = model.predict(records[FEATURES])
    for idx, source in records.iterrows():
        sid = str(source["StudentID"])
        meta = get_db().execute("SELECT * FROM student_meta WHERE student_id=?", (sid,)).fetchone()
        risk = RISK_LABELS[int(preds[idx])]
        if search and search not in f"{meta['name']} {sid}".lower():
            continue
        if risk_filter and risk != risk_filter:
            continue
        if semester and str(meta["semester"]) != semester:
            continue
        payload = student_payload(sid, include_shap=False)
        results.append(payload)
        if len(results) >= limit:
            break
    return jsonify({"students": results, "count": len(results)})


@app.get("/api/students/<student_id>")
@auth_required()
def student_detail(student_id: str):
    if not can_access_student(student_id):
        return jsonify({"error": "You can only view your own student profile"}), 403
    payload = student_payload(student_id, include_shap=True)
    if not payload:
        return jsonify({"error": "Student not found"}), 404
    notes = get_db().execute("SELECT * FROM interventions WHERE student_id=? ORDER BY id DESC LIMIT 20", (student_id,)).fetchall()
    payload["interventions"] = [dict(n) for n in notes]
    return jsonify(payload)


@app.get("/api/student/me")
@auth_required("student")
def student_me():
    payload = student_payload(g.user["student_id"], include_shap=True)
    if not payload:
        return jsonify({"error": "Student profile not found"}), 404
    payload["interventions"] = [dict(n) for n in get_db().execute("SELECT * FROM interventions WHERE student_id=? ORDER BY id DESC", (g.user["student_id"],)).fetchall()]
    return jsonify(payload)


@app.post("/api/students/<student_id>/what-if")
@auth_required()
def what_if(student_id: str):
    if not can_access_student(student_id):
        return jsonify({"error": "Not authorized"}), 403
    input_df = frame_for_student(student_id)
    if input_df is None:
        return jsonify({"error": "Student not found"}), 404
    body = request.get_json(silent=True) or {}
    values = academic_values(body, {public: float(input_df.iloc[0][feature]) for public, feature in INPUT_MAP.items()})
    input_df = pd.DataFrame([{INPUT_MAP[k]: v for k, v in values.items()}])[FEATURES]
    before = predict_frame(frame_for_student(student_id), include_shap=False)
    after = predict_frame(input_df, include_shap=True)
    return jsonify({"before": before, "after": after, "score_change": after["risk_score"] - before["risk_score"]})


@app.get("/api/interventions")
@auth_required("professor")
def interventions_list():
    rows = get_db().execute("SELECT * FROM interventions ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC").fetchall()
    out = []
    for r in rows:
        meta = get_db().execute("SELECT name, initials FROM student_meta WHERE student_id=?", (r["student_id"],)).fetchone()
        item = dict(r)
        item["student_name"] = meta["name"] if meta else r["student_id"]
        item["initials"] = meta["initials"] if meta else "ST"
        out.append(item)
    return jsonify({"interventions": out})


@app.post("/api/students/<student_id>/interventions")
@auth_required("professor")
def add_intervention(student_id: str):
    if frame_for_student(student_id) is None:
        return jsonify({"error": "Student not found"}), 404
    body = request.get_json(silent=True) or {}
    note = str(body.get("note", "")).strip()
    if len(note) < 3:
        return jsonify({"error": "Please enter a meaningful note"}), 400
    follow_up = body.get("follow_up_date") or (datetime.now() + timedelta(days=7)).date().isoformat()
    now = datetime.now().isoformat(timespec="seconds")
    cur = get_db().execute(
        "INSERT INTO interventions(student_id,professor_name,note,status,follow_up_date,created_at) VALUES(?,?,?,?,?,?)",
        (student_id, g.user["display_name"], note, "open", follow_up, now),
    )
    get_db().commit()
    return jsonify({"id": cur.lastrowid, "status": "created"}), 201


@app.post("/api/interventions/<int:intervention_id>/complete")
@auth_required("professor")
def complete_intervention(intervention_id: int):
    completed_at = datetime.now().isoformat(timespec="seconds")
    cur = get_db().execute("UPDATE interventions SET status='completed', completed_at=? WHERE id=?", (completed_at, intervention_id))
    get_db().commit()
    if cur.rowcount == 0:
        return jsonify({"error": "Intervention not found"}), 404
    return jsonify({"status": "completed"})


@app.post("/api/support")
@auth_required("student")
def support_request():
    body = request.get_json(silent=True) or {}
    category = str(body.get("category", "Academic support")).strip()
    message = str(body.get("message", "")).strip()
    if len(message) < 5:
        return jsonify({"error": "Please describe what support you need"}), 400
    now = datetime.now().isoformat(timespec="seconds")
    cur = get_db().execute(
        "INSERT INTO support_requests(student_id,category,message,status,created_at) VALUES(?,?,?,?,?)",
        (g.user["student_id"], category, message, "open", now),
    )
    get_db().commit()
    return jsonify({"id": cur.lastrowid, "status": "submitted"}), 201


@app.get("/api/reports/students.csv")
@auth_required("professor")
def export_report():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Student ID", "Name", "Semester", "Attendance %", "Internal Marks", "Practicals %", "Backlogs", "Lab Hours/Week", "Predicted Risk", "Risk Score", "Confidence %"])
    for sid in active_frame()["StudentID"].astype(str):
        s = student_payload(sid, include_shap=False)
        writer.writerow([s["id"], s["name"], s["semester"], s["attendance"], s["internal_marks"], s["practical_completion"], s["backlogs"], s["lab_hours_weekly"], s["risk"], s["risk_score"], s["confidence"]])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=eduinsight_student_risk_report.csv"})


@app.post("/predict")
def legacy_predict():
    """Backward-compatible endpoint from the original project."""
    body = request.get_json(silent=True) or {}
    try:
        values = academic_values({public: body[feature] for public, feature in INPUT_MAP.items()})
        input_df = pd.DataFrame([{INPUT_MAP[k]: v for k,v in values.items()}])[FEATURES]
    except (KeyError, TypeError):
        return jsonify({"error": f"Provide numeric values for: {', '.join(FEATURES)}"}), 400
    return jsonify(predict_frame(input_df, include_shap=True))



INPUT_MAP = {"attendance": "Attendance_Pct", "internal_marks": "Internal_Marks", "practical_completion": "Practical_Completion_Pct", "backlogs": "Previous_Backlogs", "lab_hours_weekly": "Lab_Hours_Weekly"}

@app.errorhandler(ValueError)
def validation_error(err):
    return jsonify({"error": str(err)}), 400


def academic_values(body, defaults=None):
    values = {}
    for key in INPUT_MAP:
        value = body.get(key, (defaults or {}).get(key))
        try:
            if isinstance(value, bool): raise TypeError()
            number = float(value)
        except (ValueError, TypeError):
            raise ValueError(f"{key.replace('_', ' ').title()} must be a number")
        maximum = 20 if key == 'backlogs' else 168 if key == 'lab_hours_weekly' else 100
        if not math.isfinite(number) or not 0 <= number <= maximum or (key == 'backlogs' and not number.is_integer()):
            raise ValueError(f"{key.replace('_', ' ').title()} must be {'a whole number ' if key == 'backlogs' else ''}between 0 and {maximum}")
        values[key] = number
    return values


def profile_values(body):
    name = str(body.get('name', '')).strip()
    course = str(body.get('course', 'B.Sc. Information Technology')).strip()
    campus = str(body.get('campus', 'VSIT Mumbai')).strip()
    try:
        semester_value = float(body.get('semester', 1))
        if not semester_value.is_integer(): raise ValueError()
        semester = int(semester_value)
    except (ValueError, TypeError): raise ValueError('Semester must be 1–6')
    if not 2 <= len(name) <= 100 or not 1 <= semester <= 6 or not 1 <= len(course) <= 120 or not 1 <= len(campus) <= 120:
        raise ValueError('Enter a name (2–100 characters), course, campus and semester 1–6')
    return name, semester, course, campus


def save_student(body, sid, create=False):
    name, semester, course, campus = profile_values(body)
    values = academic_values(body)
    db = get_db()
    done = round(values['practical_completion'] / 10)
    if create:
        db.execute(
            """
            INSERT INTO student_meta (
                student_id, name, initials, semester, course, campus,
                assignments_done, assignments_total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                name = excluded.name,
                initials = excluded.initials,
                semester = excluded.semester,
                course = excluded.course,
                campus = excluded.campus,
                assignments_done = excluded.assignments_done,
                assignments_total = excluded.assignments_total
            """,
            (sid, name, initials(name), semester, course, campus, done, 10)
        )
        db.execute('INSERT INTO academics VALUES(?,?,?,?,?,?,?,?)', (sid, *values.values(), 'registered', datetime.now().isoformat()))
    else:
        db.execute('UPDATE student_meta SET name=?, initials=?, semester=?, course=?, campus=?, assignments_done=? WHERE student_id=?', (name, initials(name), semester, course, campus, done, sid))
        db.execute('UPDATE academics SET Attendance_Pct=?, Internal_Marks=?, Practical_Completion_Pct=?, Previous_Backlogs=?, Lab_Hours_Weekly=?, source=?, updated_at=? WHERE student_id=?', (*values.values(), 'manual', datetime.now().isoformat(), sid))
        db.execute("UPDATE users SET display_name=? WHERE student_id=?", (name, sid))


def credentials(body):
    username = str(body.get('username', '')).strip().lower()
    password = str(body.get('password', ''))
    email = str(body.get('email', '')).strip()
    if not re.fullmatch(r'[a-z0-9_.-]{3,50}', username): raise ValueError('Username: use 3–50 letters, numbers, dots, underscores or hyphens')
    if not 8 <= len(password) <= 128: raise ValueError('Password must be 8–128 characters')
    if len(email) > 150 or (email and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email)): raise ValueError('Enter a valid email address')
    return username, password, email


def create_registered(body, account=True):
    sid = str(body.get('student_id', '')).strip().upper()
    if not re.fullmatch(r'[A-Z0-9_-]{3,40}', sid): raise ValueError('Student ID: use 3–40 letters, numbers, hyphens or underscores')
    db = get_db()
    for table in ("academics", "users", "interventions", "support_requests"):
        existing = db.execute(
            f"SELECT 1 FROM {table} WHERE student_id=?",
            (sid,)
        ).fetchone()

        if existing:
            raise ValueError(
                "Student ID already has an academic record, login account "
                "or history. Open that student's profile to edit it."
            )

    login = credentials(body) if account else None
    try:
        save_student(body, sid, create=True)
        if login:
            username, password, email = login
            db.execute('INSERT INTO users(username,password_hash,role,display_name,student_id,email) VALUES(?,?,?,?,?,?)', (username, generate_password_hash(password), 'student', body['name'].strip(), sid, email))
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        raise ValueError('Username or student ID is already registered')
    except Exception:
        db.rollback()
        raise
    return sid

@app.post('/auth/register')
def register():
    body = request.get_json(silent=True) or {}
    sid = create_registered(body)
    user = get_db().execute('SELECT * FROM users WHERE student_id=?', (sid,)).fetchone()
    return jsonify({'token': token_for(user), 'user': {k: user[k] for k in ['username','role','display_name','student_id','email']}}), 201

@app.post('/api/students')
@auth_required('professor')
def add_student():
    body = request.get_json(silent=True) or {}
    sid = create_registered(body, account=True)
    return jsonify(student_payload(sid)), 201

@app.put('/api/students/<student_id>')
@auth_required()
def update_student(student_id):
    if not can_access_student(student_id): return jsonify({'error':'Not authorized'}), 403
    if frame_for_student(student_id) is None: return jsonify({'error':'Student not found'}), 404
    save_student(request.get_json(silent=True) or {}, student_id)
    get_db().commit()
    return jsonify(student_payload(student_id))

@app.put('/api/me')
@auth_required()
def update_me():
    body = request.get_json(silent=True) or {}
    name = str(body.get('display_name', '')).strip()
    email = str(body.get('email', '')).strip()
    if not 2 <= len(name) <= 100: raise ValueError('Name must be 2–100 characters')
    if len(email) > 150 or (email and not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email)): raise ValueError('Enter a valid email address')
    password = str(body.get('new_password', ''))
    if password:
        if not check_password_hash(g.user['password_hash'], str(body.get('current_password', ''))): return jsonify({'error':'Current password is incorrect'}), 400
        if not 8 <= len(password) <= 128: raise ValueError('New password must be 8–128 characters')
        get_db().execute('UPDATE users SET password_hash=? WHERE id=?', (generate_password_hash(password), g.user['id']))
    get_db().execute('UPDATE users SET display_name=?,email=? WHERE id=?', (name, email, g.user['id']))
    if g.user['student_id']:
        get_db().execute('UPDATE student_meta SET name=?,initials=? WHERE student_id=?', (name, initials(name), g.user['student_id']))
    get_db().commit()
    return jsonify({'status':'saved'})

@app.post('/api/risk-check')
@auth_required()
def risk_check():
    values = academic_values(request.get_json(silent=True) or {})
    return jsonify(predict_frame(pd.DataFrame([{INPUT_MAP[k]:v for k,v in values.items()}])[FEATURES]))

@app.route('/api/students/<student_id>/profile', methods=['GET', 'PUT'])
@auth_required('professor')
def professor_student_profile(student_id):
    db = get_db()

    existing = db.execute(
        'SELECT 1 FROM academics WHERE student_id=?',
        (student_id,)
    ).fetchone()

    if not existing:
        return jsonify({'error': 'Student not found'}), 404

    if request.method == 'PUT':
        body = request.get_json(silent=True) or {}
        name, semester, course, campus = profile_values(body)
        email = str(body.get('email', '')).strip()

        if len(email) > 150 or (
            email and not re.fullmatch(
                r'[^@\s]+@[^@\s]+\.[^@\s]+',
                email
            )
        ):
            raise ValueError('Enter a valid email address')

        db.execute(
            '''
            UPDATE student_meta
            SET name=?, initials=?, semester=?, course=?, campus=?
            WHERE student_id=?
            ''',
            (name, initials(name), semester, course, campus, student_id)
        )

        # Update the displayed full name, not the login username.
        db.execute(
            '''
            UPDATE users
            SET display_name=?, email=?
            WHERE student_id=? AND role='student'
            ''',
            (name, email, student_id)
        )

        db.commit()

    profile = db.execute(
        '''
        SELECT m.name, m.semester, m.course, m.campus,
               COALESCE(u.email, '') AS email
        FROM student_meta m
        LEFT JOIN users u
            ON u.student_id=m.student_id AND u.role='student'
        WHERE m.student_id=?
        ''',
        (student_id,)
    ).fetchone()

    if not profile:
        return jsonify({'error': 'Student profile not found'}), 404

    return jsonify(dict(profile))

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
