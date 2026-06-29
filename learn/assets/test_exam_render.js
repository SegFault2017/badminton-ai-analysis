// test_exam_render.js — run with: node test_exam_render.js
const fs = require("fs"), path = require("path"), assert = require("assert");
(0, eval)(fs.readFileSync(path.join(__dirname, "exam.js"), "utf8"));
const E = globalThis.Exam;

const qs = [
  {type:"choice", topic:"Tenses", q:"q1", options:["a","b"], answer:1},
  {type:"multi", topic:"Tenses", q:"q2", options:["a","b","c"], answer:[0,2]},
  {type:"open", topic:"Reported", q:"q3", model:"was"},
  {type:"open", multiline:true, topic:"Reported", q:"q4", model:"the model"},
  {type:"bogus", topic:"Reported", q:"q5"},
];
const html = E.renderQuestionsHTML(qs);
// one topic heading per distinct topic, in order
assert.ok(html.indexOf('<h2 class="exam-topic">Tenses</h2>') !== -1);
assert.ok(html.indexOf('<h2 class="exam-topic">Reported</h2>') !== -1);
// objective buttons carry data-q and data-i
assert.ok(html.indexOf('data-q="0"') !== -1 && html.indexOf('data-i="1"') !== -1);
// open types: a one-line input (q3) and a textarea (q4), tagged by index
assert.ok(html.indexOf('<input class="fillin" data-q="2"') !== -1);
assert.ok(html.indexOf('<textarea class="fillin" data-q="3"') !== -1);
// unknown type renders a visible error block, not an input
assert.ok(/exam-error/.test(html));
assert.ok(html.indexOf('data-q="4"') === -1);

// results: pending (an open answer deferred) -> tally + teacher note, NO verdict
const pending = E.scoreSubmission(qs, [1, [0,2], "was", "guess", null]);
const rp = E.renderResultsHTML(pending, 70);
assert.ok(/teacher/i.test(rp));
assert.ok(rp.indexOf("PASS") === -1 && rp.indexOf("FAIL") === -1, "no verdict while pending");
assert.ok(rp.indexOf('id="retake"') === -1, "no retake button");

// results: fully objective, all correct -> PASS verdict shown
const objQs = [{type:"choice", topic:"T", q:"q", options:["a","b"], answer:0}];
const done = E.scoreSubmission(objQs, [0]);
const rd = E.renderResultsHTML(done, 70);
assert.ok(rd.indexOf("PASS") !== -1);
assert.ok(rd.indexOf('id="retake"') === -1, "no retake button");

// results: fully objective, below pass mark -> FAIL
const fail = E.scoreSubmission(
  [{type:"choice", topic:"T", q:"a", options:["x","y"], answer:0},
   {type:"choice", topic:"T", q:"b", options:["x","y"], answer:0}], [1, 1]);
assert.ok(E.renderResultsHTML(fail, 70).indexOf("FAIL") !== -1);

console.log("test_exam_render: OK");
