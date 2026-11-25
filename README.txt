E-Grievance Redressal Portal — Feature Update

New features:
1. Responsive grievance tables with horizontal scrolling on small screens.
2. Optional supporting document upload on grievance submission (PDF, PNG, JPG/JPEG, DOC/DOCX, TXT; max 5 MB).
3. Student name and email remain blank and must be entered manually on each grievance form.
4. A student-only My Grievances list shows the signed-in student's submitted grievances and their statuses.
5. Uploaded documents can be downloaded by the grievance owner or an administrator.
6. When an administrator marks a grievance Resolved, they must enter resolution remarks. The remarks appear to the student only after resolution.
7. Resolved grievances show “Your problem has been solved! Kindly rate us” at the bottom of the student's My Grievances card, with a 1–5 star rating and optional feedback. Ratings are saved to the database and can be submitted only by the student who owns the resolved grievance.

Setup:
- Copy these files into your existing E:\E-Grievance-Portal folder, replacing matching application files.
- Do NOT replace your .env or grievances.db. Keep them in your existing project folder.
- Install dependencies if required: pip install -r requirements.txt
- Run: python app.py
- Open http://127.0.0.1:5000

The app automatically adds the new database columns (including resolution remarks and student feedback) to an existing grievances.db. Old grievances remain intact, but grievances submitted before this update cannot be linked to a student account automatically, so they won't appear in My Grievances.

Security note: uploaded files are stored in a local uploads folder and are only served through an authenticated route. Do not publicly share .env or grievances.db.
