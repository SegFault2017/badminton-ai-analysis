// test_exam_core.js — run with: node test_exam_core.js
const fs = require("fs"), path = require("path"), assert = require("assert");
(0, eval)(fs.readFileSync(path.join(__dirname, "exam.js"), "utf8")); // attaches Exam to globalThis
const E = globalThis.Exam;

// normalize
assert.strictEqual(E.normalize("  Foo   Bar "), "foo bar");

// isKnown
assert.strictEqual(E.isKnown("choice"), true);
assert.strictEqual(E.isKnown("open"), true);
assert.strictEqual(E.isKnown("transform"), false);

// grade: choice
assert.deepStrictEqual(E.grade({type:"choice", answer:1}, 1), {resolved:true, correct:true});
assert.deepStrictEqual(E.grade({type:"choice", answer:1}, 0), {resolved:true, correct:false});
assert.deepStrictEqual(E.grade({type:"choice", answer:1}, null), {resolved:true, correct:false});

// grade: multi (exact set, order-independent)
assert.deepStrictEqual(E.grade({type:"multi", answer:[0,2]}, [2,0]), {resolved:true, correct:true});
assert.deepStrictEqual(E.grade({type:"multi", answer:[0,2]}, [0]), {resolved:true, correct:false});

// grade: open with explicit accept-list auto-pass
assert.deepStrictEqual(E.grade({type:"open", accept:["was"]}, "  Was "), {resolved:true, correct:true});
// grade: open with NO accept falls back to model
assert.deepStrictEqual(E.grade({type:"open", model:"was"}, "WAS"), {resolved:true, correct:true});
// grade: open non-match DEFERS (never auto-fails)
assert.deepStrictEqual(E.grade({type:"open", model:"was"}, "were"), {resolved:false, correct:null});
// grade: open with empty accept+no model defers
assert.deepStrictEqual(E.grade({type:"open"}, "anything"), {resolved:false, correct:null});

// scoreSubmission: mixed exam (choice + auto-pass open + deferring open)
const qs = [
  {type:"choice", topic:"A", q:"q1", options:["x","y"], answer:1},
  {type:"open", topic:"A", q:"q2", model:"yes"},
  {type:"open", multiline:true, topic:"B", q:"q3", model:"the model"},
];
const s = E.scoreSubmission(qs, [1, "YES", "my attempt"]);
assert.strictEqual(s.total, 3);
assert.strictEqual(s.objective_total, 2);   // choice + auto-passed open
assert.strictEqual(s.objective_score, 2);
assert.strictEqual(s.needs_grading, true);  // the second open deferred
assert.strictEqual(s.answers.length, 3);
assert.deepStrictEqual(s.answers[0], {n:1, type:"choice", topic:"A", q:"q1", picked:"y", answer:"y", correct:true});
assert.strictEqual(s.answers[1].type, "open");
assert.strictEqual(s.answers[1].correct, true);     // auto-passed
assert.ok(!("graded" in s.answers[1]));             // no graded field
assert.strictEqual(s.answers[2].correct, null);     // deferred -> ungraded
assert.strictEqual(s.answers[2].response, "my attempt");
assert.strictEqual(s.answers[2].model, "the model");
assert.strictEqual(s.answers[2].multiline, true);
// topic tally counts only resolved questions
assert.deepStrictEqual(s.topics, [{topic:"A", score:2, total:2}]);

// scoreSubmission: unknown type is excluded from every count, marked error
const uq = [
  {type:"choice", topic:"A", q:"ok", options:["x","y"], answer:0},
  {type:"bogus", topic:"A", q:"broken"},
];
const su = E.scoreSubmission(uq, [0, "x"]);
assert.strictEqual(su.total, 1);            // unknown excluded from total
assert.strictEqual(su.objective_total, 1);
assert.strictEqual(su.answers.length, 2);
assert.strictEqual(su.answers[1].error, true);
assert.strictEqual(su.answers[1].correct, null);
assert.strictEqual(su.needs_grading, false); // unknown does NOT force grading

// all-objective fast path: nothing defers
const fast = E.scoreSubmission(
  [{type:"choice", topic:"T", q:"q", options:["a","b"], answer:0}], [0]);
assert.strictEqual(fast.needs_grading, false);

// pct helper
assert.strictEqual(E.pct(3, 4), 75);
assert.strictEqual(E.pct(0, 0), null);

console.log("test_exam_core: OK");
