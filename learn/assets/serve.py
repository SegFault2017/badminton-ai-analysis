#!/usr/bin/env python3
"""
serve.py — tiny local server for a /teach lesson workspace.

Why this exists: a browser page opened as file:// cannot silently write to disk.
Serving the lessons over http://localhost lets each drill POST its result, which
this server appends to drill-results.json — fully automatic, no buttons, no
download dialogs.

Run:    python3 assets/serve.py            (from the workspace root)
Then open:
        http://127.0.0.1:8777/assets/lesson.html?md=lessons/0001-name.md

- Binds to 127.0.0.1 only (never exposed to the network).
- Serves static files from the current working directory (the workspace root).
- POST /save-result  with JSON {lesson,title,drill,score,total,answers}
  -> appends one timestamped attempt to drill-results.json (atomic write).
- GET  /results      -> returns the current drill-results.json (for convenience).
"""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
DEFAULT_PORT = 8777
RESULTS = "drill-results.json"  # relative to the working directory (workspace root)
EXAM_RESULTS = "exam-results.json"  # relative to the working directory


def _empty_results():
    return {"track": "", "attempts": []}


def _load_results():
    try:
        with open(RESULTS, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            return _empty_results()
        data.setdefault("attempts", [])
        return data
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        # Missing or corrupt: start fresh rather than crash a drill.
        return _empty_results()


def _save_results(data):
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    fd, tmp = tempfile.mkstemp(dir=".", prefix=".drill-", suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    os.replace(tmp, RESULTS)  # atomic on POSIX


def _empty_exams():
    return {"track": "", "exams": []}


def _load_exams():
    try:
        with open(EXAM_RESULTS, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            return _empty_exams()
        data.setdefault("exams", [])
        return data
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return _empty_exams()


def _save_exams(data):
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    fd, tmp = tempfile.mkstemp(dir=".", prefix=".exam-", suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    os.replace(tmp, EXAM_RESULTS)  # atomic on POSIX


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass  # quiet

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path.rstrip("/") == "/results":
            return self._send_json(_load_results())
        if self.path.rstrip("/") == "/exam-results":
            return self._send_json(_load_exams())
        return super().do_GET()

    def do_POST(self):
        route = self.path.rstrip("/")
        if route not in ("/save-result", "/save-exam"):
            return self._send_json({"error": "not found"}, status=404)
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        if not raw:
            return self._send_json({"error": "empty body"}, status=400)
        try:
            payload = json.loads(raw)
        except (ValueError, json.JSONDecodeError):
            return self._send_json({"error": "bad json"}, status=400)

        if route == "/save-exam":
            if not isinstance(payload, dict):
                return self._send_json({"error": "bad json"}, status=400)
            data = _load_exams()
            attempt = dict(payload)                       # store verbatim
            attempt["at"] = datetime.now(timezone.utc).isoformat()  # server stamps time
            data.setdefault("exams", []).append(attempt)
            _save_exams(data)
            return self._send_json({"ok": True, "count": len(data["exams"])})

        data = _load_results()
        total = payload.get("total")
        attempt = {
            "lesson": payload.get("lesson", "?"),
            "title": payload.get("title", "?"),
            "drill": payload.get("drill", "main"),
            "at": datetime.now(timezone.utc).isoformat(),
            "score": payload.get("score"),
            "total": total,
            "percent": (round(100 * payload["score"] / total) if total else None),
            "answers": payload.get("answers"),
        }
        data.setdefault("attempts", []).append(attempt)
        _save_results(data)
        return self._send_json({"ok": True, "count": len(data["attempts"])})


def make_server(port=DEFAULT_PORT):
    return ThreadingHTTPServer((HOST, port), Handler)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    httpd = make_server(port)
    actual = httpd.server_address[1]
    print("Teaching workspace server running:")
    print(f"  → http://{HOST}:{actual}/assets/lesson.html?md=lessons/0001-name.md")
    print(f"  results saved to: {os.path.abspath(RESULTS)}")
    print("Press Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
