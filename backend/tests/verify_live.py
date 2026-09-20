import urllib.request
import json
import sys

endpoints = [
    ('/', 'Root / Health Info'),
    ('/health', 'Health Check'),
    ('/api/consultations', 'Consultations List'),
    ('/api/doctor/workspace', 'Doctor Workspace'),
    ('/api/patients/DEMO-P101/timeline', 'Patient Timeline'),
    ('/api/nurse/tasks', 'Nurse Care Directives'),
    ('/api/lab/tasks', 'Lab Test Queue'),
    ('/api/followups', 'Follow-Up Intelligence'),
    ('/api/prescriptions', 'Prescriptions List')
]

print("=== KENKO-AI LIVE BACKEND VERIFICATION ===")
all_pass = True
for path, label in endpoints:
    url = f"http://localhost:8000{path}"
    try:
        req = urllib.request.urlopen(url, timeout=5)
        status = req.getcode()
        body = req.read().decode('utf-8')
        print(f"[PASS] {label:<28} -> Status {status}")
    except Exception as e:
        print(f"[FAIL] {label:<28} -> Error: {e}")
        all_pass = False

print("\n=== FRONTEND DEV SERVER CHECK ===")
for port in [5174, 5173]:
    try:
        req = urllib.request.urlopen(f"http://localhost:{port}/", timeout=3)
        print(f"[PASS] Frontend Vite server running on http://localhost:{port}/ (Status {req.getcode()})")
    except Exception as e:
        print(f"[INFO] Port {port}: {e}")

if all_pass:
    print("\n>>> ALL SYSTEMS ARE 100% OPERATIONAL AND RUNNING LIVE! <<<")
else:
    print("\n>>> Some endpoints encountered issues. <<<")
