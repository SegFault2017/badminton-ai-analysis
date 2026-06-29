// test_exam_route.js — run with: node test_exam_route.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const html = fs.readFileSync(path.join(__dirname, "lesson.html"), "utf8");

assert.ok(html.indexOf('src="/assets/exam.js"') !== -1, "exam.js script included");
assert.ok(/params\.get\("exam"\)/.test(html), "reads ?exam param");
assert.ok(/params\.has\("exams"\)/.test(html), "handles ?exams index");
assert.ok(/function pathForExamId/.test(html), "pathForExamId helper present");
assert.ok(/function sidecarUrlFor/.test(html), "sidecarUrlFor helper present");
assert.ok(/\.questions\.yaml/.test(html), "derives the sidecar path");
assert.ok(/function renderExam\b/.test(html), "renderExam present");
assert.ok(/Exam\.mount\(/.test(html), "mounts the Exam engine");
assert.ok(/ExamTracker\.init\(/.test(html), "inits ExamTracker");
assert.ok(/function renderExamIndex/.test(html), "renderExamIndex present");
assert.ok(/questions not found/i.test(html), "missing-sidecar banner present");
assert.ok(/md.*startsWith.*exams/s.test(html) || /exams.*startsWith/s.test(html) || /startsWith\("exams\/"\)/.test(html), "?md= branch guards exams/ prefix");
console.log("test_exam_route: OK");
