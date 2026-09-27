import urllib.request, ssl

ctx = ssl.create_default_context()
for p in ["/health", "/api/health", "/api/google/status", "/api/google/auth"]:
    try:
        url = "https://kenko-ai-1.onrender.com" + p
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10, context=ctx) as r:
            ct = r.headers.get("Content-Type")
            body = r.read().decode()[:120].strip()
            print(p, "->", r.status, f"[{ct}]:", body)
    except urllib.error.HTTPError as e:
        print(p, "-> HTTP", e.code)
    except Exception as e:
        print(p, "-> Error:", e)
