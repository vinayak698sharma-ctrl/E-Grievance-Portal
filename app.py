from dotenv import load_dotenv
load_dotenv()
import os
import sqlite3
import secrets
from werkzeug.utils import secure_filename
from pathlib import Path
from datetime import datetime
from uuid import uuid4

from flask import (
    Flask, request, jsonify, send_from_directory,
    session, redirect
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "grievances.db"
UPLOAD_DIR = BASE_DIR / "uploads"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "doc", "docx", "txt"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

# Set these environment variables before starting the server.
# Do not use a public or predictable secret key in deployment.
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32)

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    raise RuntimeError(
        "Set ADMIN_PASSWORD in your terminal before starting the server."
    )

ADMIN_PASSWORD_HASH = generate_password_hash(ADMIN_PASSWORD)

ALLOWED_CATEGORIES = [
    "Academic", "Administration", "Fees", "Technical", "Other"
]
ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved"]


def init_database():
    with sqlite3.connect(DATABASE) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS grievances (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                category TEXT NOT NULL,
                subject TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                createdAt TEXT NOT NULL
            )
        """)
        # Safe migrations for databases created by earlier versions.
        existing_columns = {row[1] for row in connection.execute("PRAGMA table_info(grievances)").fetchall()}
        if "student_id" not in existing_columns:
            connection.execute("ALTER TABLE grievances ADD COLUMN student_id TEXT")
        if "attachment_name" not in existing_columns:
            connection.execute("ALTER TABLE grievances ADD COLUMN attachment_name TEXT")
        if "attachment_path" not in existing_columns:
            connection.execute("ALTER TABLE grievances ADD COLUMN attachment_path TEXT")
        if "resolution_remarks" not in existing_columns:
            connection.execute("ALTER TABLE grievances ADD COLUMN resolution_remarks TEXT")
        if "student_rating" not in existing_columns:
            connection.execute("ALTER TABLE grievances ADD COLUMN student_rating INTEGER")
        if "student_feedback" not in existing_columns:
            connection.execute("ALTER TABLE grievances ADD COLUMN student_feedback TEXT")

        connection.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


def row_to_dict(row):
    return {
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "category": row[3],
        "subject": row[4],
        "description": row[5],
        "status": row[6],
        "createdAt": row[7],
        "attachmentName": row[8] if len(row) > 8 else None,
        "attachmentPath": row[9] if len(row) > 9 else None,
        "resolutionRemarks": row[10] if len(row) > 10 else None,
        "studentRating": row[11] if len(row) > 11 else None,
        "studentFeedback": row[12] if len(row) > 12 else None
    }


def admin_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "Administrator login required."}), 401
        return function(*args, **kwargs)
    return wrapper


@app.route("/")
def home():
    # Always show the role-selection page at the single main website URL.
    # Existing login sessions do not force visitors straight into the admin portal.
    return send_from_directory(BASE_DIR, "role_selection.html")


@app.route("/student-login")
def student_login_page():
    if session.get("student_id"):
        return redirect("/portal")
    return send_from_directory(BASE_DIR, "student_login.html")


@app.route("/portal")
def student_portal():
    if not (session.get("student_id") or session.get("is_admin")):
        return redirect("/")
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/admin")
def admin_portal():
    # Always show the administrator login form when this option is selected.
    # The management portal remains protected by the server-side admin session.
    return send_from_directory(BASE_DIR, "admin_login.html")


@app.route("/student-login.css")
def student_login_styles():
    return send_from_directory(BASE_DIR, "student_login.css")


@app.route("/student-auth.js")
def student_auth_javascript():
    return send_from_directory(BASE_DIR, "student_auth.js")


@app.route("/style.css")
def styles():
    return send_from_directory(BASE_DIR, "style.css")


@app.route("/script.js")
def javascript():
    return send_from_directory(BASE_DIR, "script.js")


# Student registration: passwords are stored as secure hashes, never as plain text.
@app.route("/api/student/register", methods=["POST"])
def student_register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Please provide valid registration details."}), 400

    name = data.get("name", "")
    student_id = data.get("student_id", "")
    email = data.get("email", "")
    password = data.get("password", "")

    if not all(isinstance(value, str) for value in [name, student_id, email, password]):
        return jsonify({"error": "Please check the information you entered."}), 400

    name, student_id, email = name.strip(), student_id.strip().upper(), email.strip().lower()
    if not name or not student_id or not email or not password:
        return jsonify({"error": "Please fill in every field."}), 400
    if len(student_id) > 40 or len(name) > 100 or len(email) > 254:
        return jsonify({"error": "One or more fields are too long."}), 400
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        return jsonify({"error": "Please enter a valid email address."}), 400
    if len(password) < 8:
        return jsonify({"error": "Use a password with at least 8 characters."}), 400

    try:
        with sqlite3.connect(DATABASE) as connection:
            connection.execute(
                "INSERT INTO students (student_id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (student_id, name, email, generate_password_hash(password), datetime.now().astimezone().isoformat(timespec="seconds"))
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "That Student ID or email is already registered. Please log in instead."}), 409

    session.clear()
    session["student_id"] = student_id
    session["student_name"] = name
    return jsonify({"message": "Account created successfully."}), 201


@app.route("/api/student/login", methods=["POST"])
def student_login():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Please enter your Student ID and password."}), 400
    student_id = data.get("student_id", "")
    password = data.get("password", "")
    if not isinstance(student_id, str) or not isinstance(password, str):
        return jsonify({"error": "Invalid Student ID or password."}), 400

    with sqlite3.connect(DATABASE) as connection:
        student = connection.execute(
            "SELECT student_id, name, password_hash FROM students WHERE student_id = ?",
            (student_id.strip().upper(),)
        ).fetchone()

    if student is None or not check_password_hash(student[2], password):
        return jsonify({"error": "Incorrect Student ID or password."}), 401

    session.clear()
    session["student_id"] = student[0]
    session["student_name"] = student[1]
    return jsonify({"message": "Login successful."})


@app.route("/api/student/session", methods=["GET"])
def student_session():
    return jsonify({"loggedIn": bool(session.get("student_id")), "name": session.get("student_name", "")})


@app.route("/api/student/logout", methods=["POST"])
def student_logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."})


# Check whether an administrator is signed in
@app.route("/api/admin/session", methods=["GET"])
def admin_session():
    return jsonify({"loggedIn": bool(session.get("is_admin"))})


# Administrator login
@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    username = data.get("username", "")
    password = data.get("password", "")

    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({"error": "Invalid username or password."}), 400

    if (
        secrets.compare_digest(username, ADMIN_USERNAME)
        and check_password_hash(ADMIN_PASSWORD_HASH, password)
    ):
        session.clear()
        session["is_admin"] = True
        return jsonify({"message": "Login successful."})

    return jsonify({"error": "Incorrect username or password."}), 401


# Administrator logout
@app.route("/api/admin/logout", methods=["POST"])
def admin_logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."})


# List grievances: administrator only
@app.route("/api/grievances", methods=["GET"])
@admin_required
def get_grievances():
    with sqlite3.connect(DATABASE) as connection:
        rows = connection.execute("""
            SELECT id, name, email, category, subject,
                   description, status, createdAt, attachment_name, attachment_path,
                   resolution_remarks, student_rating, student_feedback
            FROM grievances
            ORDER BY createdAt DESC
        """).fetchall()

    return jsonify([row_to_dict(row) for row in rows])


# Submit a grievance: signed-in student only. Supports one optional evidence file.
@app.route("/api/grievances", methods=["POST"])
def create_grievance():
    if not session.get("student_id"):
        return jsonify({"error": "Please log in as a student before submitting a grievance."}), 401

    values = {}
    for field in ["name", "email", "category", "subject", "description"]:
        value = request.form.get(field, "")
        if not isinstance(value, str) or not value.strip():
            return jsonify({"error": f"{field} is required."}), 400
        values[field] = value.strip()

    if len(values["name"]) > 100 or len(values["email"]) > 254 or len(values["subject"]) > 200:
        return jsonify({"error": "Please shorten one or more fields."}), 400
    if "@" not in values["email"] or "." not in values["email"].rsplit("@", 1)[-1]:
        return jsonify({"error": "Please enter a valid email address."}), 400
    if values["category"] not in ALLOWED_CATEGORIES:
        return jsonify({"error": "Invalid grievance category."}), 400

    uploaded_file = request.files.get("attachment")
    stored_filename = None
    original_filename = None
    if uploaded_file and uploaded_file.filename:
        safe_name = secure_filename(uploaded_file.filename)
        extension = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else ""
        if extension not in ALLOWED_UPLOAD_EXTENSIONS:
            return jsonify({"error": "Allowed files: PDF, PNG, JPG, DOC, DOCX, or TXT."}), 400
        uploaded_file.stream.seek(0, os.SEEK_END)
        file_size = uploaded_file.stream.tell()
        uploaded_file.stream.seek(0)
        if file_size > MAX_UPLOAD_BYTES:
            return jsonify({"error": "Attachment must be 5 MB or smaller."}), 400
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        stored_filename = f"{uuid4().hex}_{safe_name}"
        original_filename = safe_name[:255]
        uploaded_file.save(UPLOAD_DIR / stored_filename)

    grievance_id = "GRV-" + uuid4().hex[:10].upper()
    created_at = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with sqlite3.connect(DATABASE) as connection:
            connection.execute("""
                INSERT INTO grievances
                (id, name, email, category, subject, description, status, createdAt, student_id, attachment_name, attachment_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (grievance_id, values["name"], values["email"], values["category"], values["subject"],
                  values["description"], "Pending", created_at, session["student_id"], original_filename, stored_filename))
    except Exception:
        if stored_filename and (UPLOAD_DIR / stored_filename).exists():
            (UPLOAD_DIR / stored_filename).unlink()
        raise

    return jsonify({"message": "Grievance submitted successfully.", "grievance": {
        "id": grievance_id, **values, "status": "Pending", "createdAt": created_at,
        "attachmentName": original_filename
    }}), 201


# A student can see only grievances connected to their own signed-in account.
@app.route("/api/student/grievances", methods=["GET"])
def student_grievances():
    student_id = session.get("student_id")
    if not student_id:
        return jsonify({"error": "Student login required."}), 401
    with sqlite3.connect(DATABASE) as connection:
        rows = connection.execute("""
            SELECT id, name, email, category, subject, description, status, createdAt,
                   attachment_name, attachment_path, resolution_remarks, student_rating, student_feedback
            FROM grievances WHERE student_id = ? ORDER BY createdAt DESC
        """, (student_id,)).fetchall()
    return jsonify([row_to_dict(row) for row in rows])


@app.route("/api/grievances/<grievance_id>/attachment", methods=["GET"])
def download_attachment(grievance_id):
    if not (session.get("is_admin") or session.get("student_id")):
        return jsonify({"error": "Please log in first."}), 401
    with sqlite3.connect(DATABASE) as connection:
        row = connection.execute("SELECT student_id, attachment_name, attachment_path FROM grievances WHERE id = ?", (grievance_id,)).fetchone()
    if not row or not row[2]:
        return jsonify({"error": "No attachment found."}), 404
    if not session.get("is_admin") and row[0] != session.get("student_id"):
        return jsonify({"error": "You cannot access this attachment."}), 403
    return send_from_directory(UPLOAD_DIR, row[2], as_attachment=True, download_name=row[1] or row[2])


# Update status: administrator only
@app.route("/api/grievances/<grievance_id>/status", methods=["PATCH"])
@admin_required
def update_status(grievance_id):
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    new_status = data.get("status")

    if new_status not in ALLOWED_STATUSES:
        return jsonify({"error": "Invalid grievance status."}), 400

    remarks = (data.get("remarks") or "").strip()
    if len(remarks) > 1000:
        return jsonify({"error": "Resolution remarks must be 1000 characters or fewer."}), 400
    if new_status == "Resolved" and not remarks:
        return jsonify({"error": "Please enter resolution remarks before marking this grievance as resolved."}), 400

    with sqlite3.connect(DATABASE) as connection:
        if new_status == "Resolved":
            cursor = connection.execute("""
                UPDATE grievances SET status = ?, resolution_remarks = ? WHERE id = ?
            """, (new_status, remarks, grievance_id))
        else:
            cursor = connection.execute("""
                UPDATE grievances SET status = ? WHERE id = ?
            """, (new_status, grievance_id))

    if cursor.rowcount == 0:
        return jsonify({"error": "Grievance not found."}), 404

    return jsonify({
        "message": "Status updated successfully.",
        "id": grievance_id,
        "status": new_status,
        "resolutionRemarks": remarks if new_status == "Resolved" else None
    })


@app.route("/api/grievances/<grievance_id>/feedback", methods=["POST"])
def submit_grievance_feedback(grievance_id):
    student_id = session.get("student_id")
    if not student_id:
        return jsonify({"error": "Please log in with the student account that submitted this grievance."}), 401
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid feedback request."}), 400
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify({"error": "Please choose a rating from 1 to 5 stars."}), 400
    if rating < 1 or rating > 5:
        return jsonify({"error": "Rating must be between 1 and 5 stars."}), 400
    feedback = (data.get("feedback") or "").strip()
    if len(feedback) > 1000:
        return jsonify({"error": "Feedback must be 1000 characters or fewer."}), 400
    with sqlite3.connect(DATABASE) as connection:
        cursor = connection.execute("""
            UPDATE grievances SET student_rating = ?, student_feedback = ?
            WHERE id = ? AND student_id = ? AND status = 'Resolved'
        """, (rating, feedback, grievance_id, student_id))
    if cursor.rowcount == 0:
        return jsonify({"error": "Only the student who submitted a resolved grievance can rate it."}), 403
    return jsonify({"message": "Thank you for rating us!", "rating": rating})


# Public tracking: a person can check a grievance using its ID
@app.route("/api/grievances/<grievance_id>", methods=["GET"])
def track_grievance(grievance_id):
    with sqlite3.connect(DATABASE) as connection:
        row = connection.execute("""
            SELECT id, name, email, category, subject,
                   description, status, createdAt, resolution_remarks, student_rating, student_feedback
            FROM grievances WHERE id = ?
        """, (grievance_id,)).fetchone()

    if row is None:
        return jsonify({"error": "Grievance not found."}), 404

    # Return only the information needed for tracking.
    return jsonify({
        "id": row[0],
        "category": row[3],
        "subject": row[4],
        "status": row[6],
        "createdAt": row[7],
        "resolutionRemarks": row[8],
        "studentRating": row[9],
        "studentFeedback": row[10]
    })


@app.errorhandler(413)
def upload_too_large(_error):
    return jsonify({"error": "Attachment must be 5 MB or smaller."}), 413


if __name__ == "__main__":
    init_database()
    print("E-Grievance Portal server is starting...")
    print("Open http://127.0.0.1:5000 in your browser.")
    app.run(debug=True)
