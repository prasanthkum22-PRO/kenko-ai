import urllib.request, urllib.error, json

base = "http://127.0.0.1:8000"

print("--- Testing /health ---")
try:
    with urllib.request.urlopen(f"{base}/health") as r:
        print("Status:", r.status, "Content-Type:", r.headers.get("Content-Type"), "Body:", r.read().decode())
except Exception as e:
    print("Error:", e)

print("\n--- Testing /api/health ---")
try:
    with urllib.request.urlopen(f"{base}/api/health") as r:
        print("Status:", r.status, "Content-Type:", r.headers.get("Content-Type"), "Body:", r.read().decode())
except Exception as e:
    print("Error:", e)

print("\n--- Testing /api/google/status without token (expect 401 JSON) ---")
try:
    urllib.request.urlopen(f"{base}/api/google/status")
except urllib.error.HTTPError as e:
    print("HTTP Code:", e.code, "Content-Type:", e.headers.get("Content-Type"), "Body:", e.read().decode())
except Exception as e:
    print("Error:", e)
