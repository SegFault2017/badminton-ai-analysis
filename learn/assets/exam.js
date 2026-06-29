/* ============================================================================
 * exam.js — test-conditions exam engine for /teach (self-contained).
 * ----------------------------------------------------------------------------
 * Differs from drills.js: no per-question feedback. All questions render on one
 * page; the learner answers freely, then Submits once. Objective types (choice,
 * multi) are graded here; open types collect typed text and either auto-pass
 * (normalized match against `accept`, or `model` when there is no `accept`) or
 * DEFER to agent+learner grading (see SKILL.md) — a non-match is never
 * auto-failed. If nothing defers (all-objective fast path), the result is final
 * PASS/FAIL in-browser; otherwise it shows an objective tally and asks the
 * learner to return to their teacher. There is no Retake button.
 *
 * Question shape (exam sidecar `questions:`):
 *   { type, topic, q, options?, answer?, model?, accept?, multiline?, ctx?, why }
 *   - type: "choice" | "multi" | "open"
 *   - choice: answer is an index. multi: answer is an array of indices.
 *   - open: model is the reference answer; accept is an optional auto-pass list;
 *     multiline:true renders a textarea instead of a one-line input.
 * ========================================================================== */
(function (global) {
  const KNOWN = { choice: true, multi: true, open: true };

  function isKnown(type) { return !!KNOWN[type]; }

  function normalize(s) {
    return String(s == null ? "" : s).toLowerCase().trim().replace(/\s+/g, " ");
  }

  function pct(score, total) { return total ? Math.round(100 * score / total) : null; }

  function setEq(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const s = new Set(a);
    return b.every((x) => s.has(x));
  }

  // The auto-pass list for an open item: explicit accept, else the model.
  function acceptList(item) {
    if (Array.isArray(item.accept) && item.accept.length) return item.accept;
    if (item.model != null && String(item.model).length) return [item.model];
    return [];
  }

  // Grade one answer. choice/multi resolve here. open resolves only on an
  // auto-pass match; otherwise it defers (resolved:false) for agent grading.
  function grade(item, value) {
    if (item.type === "choice") return { resolved: true, correct: value === item.answer };
    if (item.type === "multi") return { resolved: true, correct: setEq(value, item.answer) };
    // open
    const accept = acceptList(item).map(normalize);
    const norm = normalize(value);
    if (norm && accept.indexOf(norm) !== -1) return { resolved: true, correct: true };
    return { resolved: false, correct: null };
  }

  function scoreSubmission(questions, values) {
    const answers = [];
    const topicMap = new Map();
    let total = 0, objScore = 0, objTotal = 0, needs = false;
    questions.forEach((item, i) => {
      const base = { n: i + 1, type: item.type, topic: item.topic, q: item.q };
      if (!isKnown(item.type)) {                 // unknown -> error, excluded
        answers.push(Object.assign(base, { error: true, correct: null }));
        return;
      }
      total++;
      const v = values[i];
      const g = grade(item, v);
      if (item.type === "choice" || item.type === "multi") {
        const picked = item.type === "choice"
          ? (v != null ? item.options[v] : null)
          : (Array.isArray(v) ? v.slice().sort((a, b) => a - b).map((j) => item.options[j]) : []);
        const answer = item.type === "choice"
          ? item.options[item.answer]
          : item.answer.map((j) => item.options[j]);
        answers.push(Object.assign(base, { picked: picked, answer: answer, correct: g.correct }));
      } else {                                   // open
        const rec = Object.assign(base, {
          response: String(v == null ? "" : v),
          model: item.model || "",
          correct: g.resolved ? true : null,     // null = ungraded (no `graded` field)
        });
        if (item.multiline) rec.multiline = true;
        answers.push(rec);
      }
      if (g.resolved) {
        objTotal++;
        if (g.correct) objScore++;
        const t = topicMap.get(item.topic) || { topic: item.topic, score: 0, total: 0 };
        t.total++;
        if (g.correct) t.score++;
        topicMap.set(item.topic, t);
      } else {
        needs = true;
      }
    });
    return {
      total: total,
      objective_total: objTotal,
      objective_score: objScore,
      needs_grading: needs,
      topics: Array.from(topicMap.values()),
      answers: answers,
    };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderQuestionsHTML(questions) {
    let html = "", lastTopic = null;
    questions.forEach(function (item, qi) {
      if (item.topic !== lastTopic) {
        html += '<h2 class="exam-topic">' + esc(item.topic) + "</h2>";
        lastTopic = item.topic;
      }
      if (!isKnown(item.type)) {
        html += '<div class="exam-error">Unknown question type "' + esc(item.type) +
          '" at #' + (qi + 1) + " — skipped. Fix the exam sidecar.</div>";
        return;
      }
      const ctx = item.ctx ? '<span class="ctx">' + esc(item.ctx) + "</span><br>" : "";
      const head = '<div class="q">' + (qi + 1) + ". " + ctx + esc(item.q);
      if (item.type === "choice" || item.type === "multi") {
        const hint = item.type === "multi"
          ? ' <span class="ctx">(select all that apply)</span>' : "";
        const opts = item.options.map(function (o, i) {
          return '<button class="opt" type="button" data-q="' + qi + '" data-i="' + i + '">' + esc(o) + "</button>";
        }).join("");
        html += '<div class="quiz">' + head + hint + '</div><div class="opts">' + opts + "</div></div>";
      } else { // open
        const control = item.multiline
          ? '<textarea class="fillin" data-q="' + qi + '" rows="2"></textarea>'
          : '<input class="fillin" data-q="' + qi + '" type="text" autocomplete="off">';
        html += '<div class="quiz">' + head + "</div>" + control + "</div>";
      }
    });
    return html;
  }

  function renderResultsHTML(scored, passMark) {
    const os = scored.objective_score, ot = scored.objective_total;
    const objPct = pct(os, ot);
    let head;
    if (scored.needs_grading) {
      const pending = scored.total - ot;
      head = '<div class="q">Submitted. Objective score so far: ' + os + "/" + ot +
        (objPct !== null ? " (" + objPct + "%)" : "") + ".</div>" +
        "<p>" + pending + " open response(s) sent to your teacher for grading. " +
        "Return to your teacher to receive your final grade.</p>";
    } else {
      const passed = objPct !== null && objPct >= passMark;
      head = '<div class="q">' + (passed ? "PASS" : "FAIL") + " &mdash; " + os + "/" + ot +
        " (" + (objPct === null ? 0 : objPct) + "%). Pass mark " + passMark + "%.</div>";
    }
    const topics = scored.topics.map(function (t) {
      return "<li>" + esc(t.topic) + ": " + t.score + "/" + t.total + "</li>";
    }).join("");
    return head + (topics ? '<ul class="exam-topics">' + topics + "</ul>" : "");
  }

  function mount(opts) {
    const questions = (opts && opts.questions) || [];
    const examId = (opts && opts.examId) || "?";
    const title = (opts && opts.title) || examId;
    const passMark = (opts && opts.passMark != null) ? opts.passMark : 70;
    const host = document.getElementById("exam");
    if (!host || !questions.length) return;

    const values = questions.map(function (q) { return q.type === "multi" ? new Set() : null; });

    function answerable(i) { return isKnown(questions[i].type); }

    function answeredCount() {
      return values.reduce(function (n, v, i) {
        if (!answerable(i)) return n;
        const t = questions[i].type;
        if (t === "multi") return n + (v && v.size ? 1 : 0);
        if (t === "choice") return n + (v !== null ? 1 : 0);
        return n + (v && String(v).trim() ? 1 : 0);
      }, 0);
    }

    function knownCount() {
      return questions.reduce(function (n, q) { return n + (isKnown(q.type) ? 1 : 0); }, 0);
    }

    function refreshBar() {
      const c = document.getElementById("exam-bar-count");
      if (c) c.textContent = "Answered " + answeredCount() + " / " + knownCount();
    }

    function render() {
      host.innerHTML = renderQuestionsHTML(questions) +
        '<div class="exam-bar"><span id="exam-bar-count"></span>' +
        '<button class="opt" id="exam-submit" type="button">Submit exam</button></div>';
      host.querySelectorAll(".opt[data-i]").forEach(function (b) {
        b.addEventListener("click", function () {
          const qi = parseInt(b.dataset.q, 10), i = parseInt(b.dataset.i, 10);
          if (questions[qi].type === "choice") {
            values[qi] = i;
            host.querySelectorAll('.opt[data-q="' + qi + '"]').forEach(function (x) { x.classList.remove("sel"); });
            b.classList.add("sel");
          } else {
            const set = values[qi];
            if (set.has(i)) { set.delete(i); b.classList.remove("sel"); }
            else { set.add(i); b.classList.add("sel"); }
          }
          refreshBar();
        });
      });
      host.querySelectorAll(".fillin").forEach(function (inp) {
        inp.addEventListener("input", function () { values[parseInt(inp.dataset.q, 10)] = inp.value; refreshBar(); });
      });
      const submit = document.getElementById("exam-submit");
      if (submit) submit.addEventListener("click", onSubmit);
      refreshBar();
    }

    function onSubmit() {
      if (answeredCount() < knownCount() &&
          !window.confirm("Some answers are blank — submit anyway? Blank answers count as wrong.")) return;
      const flat = values.map(function (v, i) { return questions[i].type === "multi" ? Array.from(v) : v; });
      const scored = scoreSubmission(questions, flat);

      // Build the POST payload: finalize for the fast path; null-fill when pending.
      let payload;
      if (scored.needs_grading) {
        payload = {
          exam: examId, title: title, pass_mark: passMark,
          total: scored.total, objective_score: scored.objective_score,
          objective_total: scored.objective_total, needs_grading: true,
          score: null, percent: null, passed: null, topics: [],
          answers: scored.answers,
        };
      } else {
        const p = pct(scored.objective_score, scored.objective_total);
        payload = {
          exam: examId, title: title, pass_mark: passMark,
          total: scored.total, objective_score: scored.objective_score,
          objective_total: scored.objective_total, needs_grading: false,
          score: scored.objective_score, percent: p,
          passed: p !== null && p >= passMark, topics: scored.topics,
          answers: scored.answers,
        };
      }
      if (global.ExamTracker) global.ExamTracker.record(payload);

      host.innerHTML = '<div class="quiz">' + renderResultsHTML(scored, passMark) + "</div>";
      window.scrollTo(0, 0);
    }

    render();
  }

  global.Exam = {
    isKnown: isKnown, normalize: normalize, pct: pct,
    grade: grade, scoreSubmission: scoreSubmission,
    renderQuestionsHTML: renderQuestionsHTML, renderResultsHTML: renderResultsHTML,
    mount: mount,
  };
})(typeof window !== "undefined" ? window : globalThis);
