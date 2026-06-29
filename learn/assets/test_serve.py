# test_serve.py
import json, os, tempfile, threading, time, unittest, urllib.request
from http.client import HTTPConnection
from types import SimpleNamespace

import serve  # module under test


class SaveResultTest(unittest.TestCase):
    def setUp(self):
        self.workdir = tempfile.mkdtemp()
        os.chdir(self.workdir)
        self.httpd = serve.make_server(port=0)  # port 0 = pick a free port
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        time.sleep(0.1)

    def tearDown(self):
        self.httpd.shutdown()

    def _post(self, payload, raw=None):
        conn = HTTPConnection("127.0.0.1", self.port)
        try:
            body = raw if raw is not None else json.dumps(payload).encode()
            conn.request("POST", "/save-result", body,
                         {"Content-Type": "application/json"})
            resp = conn.getresponse()
            status = resp.status
            resp.read()
            return SimpleNamespace(status=status)
        finally:
            conn.close()

    def _results(self):
        with open(os.path.join(self.workdir, "drill-results.json")) as f:
            return json.load(f)

    def test_appends_each_attempt(self):
        r1 = self._post({"lesson": "0001-foo", "score": 1, "total": 2})
        self.assertEqual(r1.status, 200)
        r2 = self._post({"lesson": "0001-foo", "score": 2, "total": 2})
        self.assertEqual(r2.status, 200)

        data = self._results()
        # Richer schema: a dict with an "attempts" list, not a bare array.
        self.assertIn("attempts", data)
        self.assertEqual(len(data["attempts"]), 2)
        self.assertEqual(data["attempts"][0]["score"], 1)
        self.assertEqual(data["attempts"][1]["score"], 2)
        self.assertIn("at", data["attempts"][0])  # server stamps a timestamp

    def test_computes_percent(self):
        self._post({"lesson": "0001-foo", "score": 1, "total": 2})
        self.assertEqual(self._results()["attempts"][0]["percent"], 50)

    def test_results_endpoint(self):
        self._post({"lesson": "0001-foo", "score": 2, "total": 2})
        r = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/results")
        data = json.loads(r.read())
        self.assertEqual(len(data["attempts"]), 1)

    def test_empty_body_rejected(self):
        r = self._post(None, raw=b"")
        self.assertEqual(r.status, 400)

    def test_serves_static_files(self):
        with open(os.path.join(self.workdir, "hello.txt"), "w") as f:
            f.write("hi")
        r = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/hello.txt")
        self.assertEqual(r.read(), b"hi")


class SaveExamTest(unittest.TestCase):
    def setUp(self):
        self.workdir = tempfile.mkdtemp()
        os.chdir(self.workdir)
        self.httpd = serve.make_server(port=0)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        time.sleep(0.1)

    def tearDown(self):
        self.httpd.shutdown()

    def _post_exam(self, payload, raw=None):
        conn = HTTPConnection("127.0.0.1", self.port)
        try:
            body = raw if raw is not None else json.dumps(payload).encode()
            conn.request("POST", "/save-exam", body,
                         {"Content-Type": "application/json"})
            resp = conn.getresponse()
            status = resp.status
            resp.read()
            return SimpleNamespace(status=status)
        finally:
            conn.close()

    def _exam_results(self):
        with open(os.path.join(self.workdir, "exam-results.json")) as f:
            return json.load(f)

    def test_appends_and_stamps_at(self):
        r = self._post_exam({"exam": "E001", "title": "t", "total": 4,
                             "objective_score": 3, "objective_total": 4,
                             "needs_grading": False, "score": 3, "percent": 75,
                             "passed": True, "topics": [], "answers": []})
        self.assertEqual(r.status, 200)
        data = self._exam_results()
        self.assertIn("exams", data)
        self.assertEqual(len(data["exams"]), 1)
        self.assertIn("at", data["exams"][0])

    def test_stores_body_verbatim_no_arithmetic(self):
        # server must NOT recompute fields — it stores exactly what it is sent.
        self._post_exam({"exam": "E001", "title": "t", "total": 4,
                         "objective_score": 3, "objective_total": 4,
                         "needs_grading": False, "score": 999, "percent": 12,
                         "passed": False, "topics": [{"topic": "A", "score": 1, "total": 2}],
                         "answers": [{"n": 1}]})
        a = self._exam_results()["exams"][0]
        self.assertEqual(a["score"], 999)       # not recomputed
        self.assertEqual(a["percent"], 12)      # not recomputed
        self.assertEqual(a["passed"], False)
        self.assertEqual(a["topics"], [{"topic": "A", "score": 1, "total": 2}])

    def test_pending_attempt_keeps_nulls(self):
        self._post_exam({"exam": "E001", "title": "t", "total": 4,
                         "objective_score": 2, "objective_total": 2,
                         "needs_grading": True, "score": None, "percent": None,
                         "passed": None, "topics": [], "answers": []})
        a = self._exam_results()["exams"][0]
        self.assertTrue(a["needs_grading"])
        self.assertIsNone(a["percent"])
        self.assertIsNone(a["passed"])
        self.assertIsNone(a["score"])

    def test_exam_results_endpoint(self):
        self._post_exam({"exam": "E001", "title": "t", "total": 1,
                         "objective_score": 1, "objective_total": 1,
                         "needs_grading": False, "score": 1, "percent": 100,
                         "passed": True, "topics": [], "answers": []})
        r = urllib.request.urlopen(f"http://127.0.0.1:{self.port}/exam-results")
        data = json.loads(r.read())
        self.assertEqual(len(data["exams"]), 1)

    def test_empty_body_rejected(self):
        r = self._post_exam(None, raw=b"")
        self.assertEqual(r.status, 400)

    def test_bad_json_rejected(self):
        r = self._post_exam(None, raw=b"{not json")
        self.assertEqual(r.status, 400)

    def test_independent_from_drill_results(self):
        self._post_exam({"exam": "E001", "title": "t", "total": 1,
                         "objective_score": 1, "objective_total": 1,
                         "needs_grading": False, "score": 1, "percent": 100,
                         "passed": True, "topics": [], "answers": []})
        self.assertFalse(os.path.exists(os.path.join(self.workdir, "drill-results.json")))


if __name__ == "__main__":
    unittest.main()
