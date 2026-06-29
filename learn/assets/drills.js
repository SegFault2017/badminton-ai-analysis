/* ============================================================================
 * drills.js — sequential drill engine for grammar lessons.
 * ----------------------------------------------------------------------------
 * Reads its questions from the lesson front-matter instead of an inline
 * <script>, mounts into #quiz / #progress, gives instant per-question feedback
 * with an explanation, and waits for the learner to press "Next →" before
 * advancing (so there's always time to read the explanation). Supports
 * re-running, and logs the final attempt via DrillTracker.record() (which POSTs
 * to serve.py -> drill-results.json).
 *
 * Question shape (from front-matter `drills:`):
 *   { ctx?: string, q: string, options: string[], answer: number | number[], why: string }
 *   - ctx is optional situational lead-in (shown italic above the prompt).
 *   - answer is a 0-based correct index. If it's an ARRAY, the question is
 *     multi-answer: the options become toggles and a "Check" button appears;
 *     the user must pick exactly the correct set.
 *
 * Usage (from the template, after DrillTracker.init):
 *   Drills.mount({ questions, drill });
 * ========================================================================== */
(function (global) {
  function isMulti(item) { return Array.isArray(item.answer); }

  // Single-answer grade: 1 if the picked index matches, else 0.
  function grade(item, picked) { return picked === item.answer ? 1 : 0; }

  // Multi-answer grade: the picked Set must equal the correct index array.
  function gradeSet(selected, answerArr) {
    if (selected.size !== answerArr.length) return false;
    return answerArr.every((x) => selected.has(x));
  }

  function feedbackMessage(pct) {
    if (pct >= 80) return "Strong — this is clicking.";
    if (pct >= 50) return "Good. Re-read the rule boxes and run it again.";
    return "Worth another pass — slow down and apply the rule to each one.";
  }

  function mount(opts) {
    const questions = (opts && opts.questions) || [];
    const drill = (opts && opts.drill) || "main";

    const quizEl = document.getElementById("quiz");
    const progEl = document.getElementById("progress");
    if (!quizEl || !questions.length) return;

    let idx = 0, correct = 0, answered = false, answers = [], sel = new Set();

    function render() {
      const item = questions[idx];
      const ctx = item.ctx ? `<span class="ctx">${item.ctx}</span><br>` : "";
      const multi = isMulti(item);
      const hint = multi ? ` <span class="ctx">(select all that apply)</span>` : "";
      quizEl.innerHTML =
        `<div class="q">${ctx}${item.ctx ? "" : (idx + 1) + ". "}${item.q}${hint}</div>
         <div class="opts">${item.options
           .map((o, i) => `<button class="opt" data-i="${i}">${o}</button>`)
           .join("")}</div>
         ${multi ? `<button class="opt" id="check" style="max-width:10rem;">Check</button>` : ""}
         <div class="feedback" id="fb"></div>`;
      answered = false;
      sel = new Set();
      const optButtons = quizEl.querySelectorAll(".opt[data-i]");
      if (multi) {
        optButtons.forEach((b) =>
          b.addEventListener("click", () => {
            if (answered) return;
            const i = parseInt(b.dataset.i, 10);
            if (sel.has(i)) { sel.delete(i); b.classList.remove("sel"); }
            else { sel.add(i); b.classList.add("sel"); }
          })
        );
        const check = document.getElementById("check");
        if (check) check.addEventListener("click", () => chooseMulti());
      } else {
        optButtons.forEach((b) =>
          b.addEventListener("click", () => choose(parseInt(b.dataset.i, 10), b))
        );
      }
      if (progEl) progEl.textContent =
        `Question ${idx + 1} of ${questions.length}  ·  Score: ${correct}/${idx}`;
    }

    // After an answer is graded, show a Next button and wait for the learner.
    // The explanation stays on screen until they choose to move on.
    function showNext() {
      const last = idx >= questions.length - 1;
      const btn = document.createElement("button");
      btn.className = "opt drill-next";
      btn.id = "next";
      btn.style.maxWidth = "12rem";
      btn.style.marginTop = "0.7rem";
      btn.style.background = "var(--accent)";
      btn.style.color = "var(--paper)";
      btn.style.borderColor = "var(--accent)";
      btn.textContent = last ? "See results →" : "Next →";
      btn.addEventListener("click", () => {
        idx++;
        idx < questions.length ? render() : finish();
      });
      quizEl.appendChild(btn);
      btn.focus(); // so Enter / Space also advances
    }

    function choose(i, btn) {
      if (answered) return;
      answered = true;
      const item = questions[idx];
      const fb = document.getElementById("fb");
      const buttons = quizEl.querySelectorAll(".opt[data-i]");
      buttons.forEach((b) => (b.disabled = true));
      const right = grade(item, i) === 1;
      answers.push({
        q: idx + 1, correct: right,
        picked: item.options[i], answer: item.options[item.answer],
      });
      if (right) {
        btn.classList.add("correct");
        correct++;
        fb.className = "feedback show-good";
        fb.textContent = "✓ Correct — " + (item.why || "");
      } else {
        btn.classList.add("incorrect");
        buttons[item.answer].classList.add("correct");
        fb.className = "feedback show-bad";
        fb.textContent = "✗ Not quite — " + (item.why || "");
      }
      showNext();
    }

    function chooseMulti() {
      if (answered || sel.size === 0) return;
      answered = true;
      const item = questions[idx];
      const fb = document.getElementById("fb");
      const buttons = quizEl.querySelectorAll(".opt[data-i]");
      buttons.forEach((b) => (b.disabled = true));
      const check = document.getElementById("check");
      if (check) check.disabled = true;
      const right = gradeSet(sel, item.answer);
      buttons.forEach((b, i) => {
        const isCorrect = item.answer.includes(i);
        if (isCorrect) b.classList.add("correct");
        else if (sel.has(i)) b.classList.add("incorrect");
      });
      answers.push({
        q: idx + 1, correct: right,
        picked: [...sel].sort().map((i) => item.options[i]),
        answer: item.answer.map((i) => item.options[i]),
      });
      if (right) {
        correct++;
        fb.className = "feedback show-good";
        fb.textContent = "✓ Correct — " + (item.why || "");
      } else {
        fb.className = "feedback show-bad";
        fb.textContent = "✗ Not quite — " + (item.why || "");
      }
      showNext();
    }

    function finish() {
      const pct = Math.round((correct / questions.length) * 100);
      if (global.DrillTracker) {
        global.DrillTracker.record({ drill, score: correct, total: questions.length, answers });
      }
      quizEl.innerHTML =
        `<div class="q">Done! ${correct}/${questions.length} (${pct}%).</div>
         <p>${feedbackMessage(pct)}</p>
         <button class="opt" id="rerun" style="max-width:14rem;">↻ Run the drill again</button>`;
      const rerun = document.getElementById("rerun");
      if (rerun) rerun.addEventListener("click", () => {
        idx = 0; correct = 0; answered = false; answers = []; sel = new Set();
        render();
      });
      if (progEl) progEl.textContent = `Final: ${correct}/${questions.length}`;
    }

    render();
  }

  global.Drills = { mount, grade, gradeSet };
})(window);
