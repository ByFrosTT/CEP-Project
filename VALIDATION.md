# Validation

- Backend lifecycle test passes against a separate temporary SQLite database.
- Verified 48 initial records; registration and professor-created students update counts, directory and export.
- Verified duplicate registration rolls back without creating an extra student.
- Verified model/SHAP output, saved academic edits, non-saving risk checks and bounded numeric validation.
- Verified student access restrictions, password changes, professor edits, support and interventions.
- Verified database initialization is idempotent and preserves edits.
- TypeScript checking and Vite production build pass.
- Original synthetic training CSV is byte-for-byte unchanged.
- Tested backend: Python 3.12, Flask 3.1.3, pandas 2.2.3, NumPy 2.3.5, scikit-learn 1.8.0, SHAP 0.52.0.
- Browser visual/interaction verification was blocked by a failed browser executable download. No complete browser test is claimed.
