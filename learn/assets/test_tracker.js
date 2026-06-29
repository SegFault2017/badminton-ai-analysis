// test_tracker.js — run with: node test_tracker.js
const fs = require("fs"), path = require("path"), assert = require("assert");

// Minimal browser stubs BEFORE loading the module.
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};
globalThis.location = { protocol: "http:" };
globalThis.document = { // toast() touches the DOM; give it just enough
  getElementById: () => null,
  createElement: () => ({ style: {}, id: "" }),
  body: { appendChild: () => {} },
};
let lastFetch = null;
let failNext = false;
globalThis.fetch = (url, opts) => {
  lastFetch = { url, opts };
  return failNext ? Promise.reject(new Error("down")) : Promise.resolve({ ok: true, status: 200 });
};
globalThis.setTimeout = (fn) => { if (fn) fn(); return 0; }; // toast timer no-op

(0, eval)(fs.readFileSync(path.join(__dirname, "drill-tracker.js"), "utf8"));
const { ExamTracker, DrillTracker } = globalThis;

(async function () {
  assert.ok(ExamTracker && DrillTracker, "both trackers exported");

  // record posts to /save-exam with merged exam/title
  ExamTracker.init({ exam: "E001", title: "Tenses" });
  await ExamTracker.record({ total: 3, objective_score: 2, needs_grading: true });
  assert.strictEqual(lastFetch.url, "/save-exam");
  const body = JSON.parse(lastFetch.opts.body);
  assert.strictEqual(body.exam, "E001");
  assert.strictEqual(body.title, "Tenses");
  assert.strictEqual(body.objective_score, 2);

  // DrillTracker still posts to /save-result (unchanged)
  DrillTracker.init({ lesson: "0001", title: "t" });
  await DrillTracker.record({ drill: "main", score: 1, total: 2, answers: [] });
  assert.strictEqual(lastFetch.url, "/save-result");

  // on failure the exam attempt is queued under the exam key
  failNext = true;
  await ExamTracker.record({ total: 1, objective_score: 0, needs_grading: false });
  const q = JSON.parse(store["teach.pendingExams.v1"] || "[]");
  assert.strictEqual(q.length, 1, "failed exam attempt queued under exam key");

  console.log("test_tracker: OK");
})().catch((e) => { console.error(e); process.exit(1); });
