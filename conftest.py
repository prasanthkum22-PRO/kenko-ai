import sys
import os

# Add backend directory to sys.path so tests can run from either root or backend/
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
