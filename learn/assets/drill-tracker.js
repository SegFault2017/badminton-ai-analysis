/* ============================================================================
 * drill-tracker.js — shared drill result logger for /teach lessons
 * ----------------------------------------------------------------------------
 * Results are saved AUTOMATICALLY — no buttons, no download dialogs.
 *
 * How: lessons are served by assets/serve.py over http://localhost:8777.
 * When a drill finishes, record() POSTs the result to /save-result, which the
 * server appends to drill-results.json in the workspace.
 *
 * Resilience: if the page is opened as a file:// (no server) or the POST fails,
 * the attempt is queued in localStorage and flushed automatically next time a
 * drill runs while the server is reachable. So nothing is ever lost.
 *
 * USAGE in a lesson:
 *   1. <script src="../assets/drill-tracker.js"></script>
 *   2. DrillTracker.init({ lesson: "0004", title: "will vs going to" });
 *   3. On drill finish:
 *        DrillTracker.record({ drill:"main", score:8, total:10, answers:[...] });
 * ========================================================================== */
(function (global) {
  const isHttp = (location.protocol === "http:" || location.protocol === "https:");

  function makeQueue(key) {
    return {
      load() { try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; } },
      save(arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {} },
    };
  }

  function post(url, attempt) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attempt),
      keepalive: true,
    }).then(function (r) { if (!r.ok) throw new Error("bad status " + r.status); return r; });
  }

  function toast(msg, color) {
    let f = document.getElementById("dt-flash");
    if (!f) {
      f = document.createElement("div");
      f.id = "dt-flash";
      f.style.cssText =
        "position:fixed;right:1rem;bottom:1rem;z-index:9999;color:#fff;" +
        "font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:.8rem;" +
        "padding:.45rem .8rem;border-radius:6px;opacity:0;transition:opacity .3s;" +
        "pointer-events:none;box-shadow:0 1px 6px rgba(0,0,0,.2);";
      document.body.appendChild(f);
    }
    f.textContent = msg;
    f.style.background = color || "#1a1a1a";
    f.style.opacity = "1";
    setTimeout(function () { f.style.opacity = "0"; }, 2200);
  }

  // opts: { url, queueKey, defaults, build(ctx, result) -> attempt }
  function makeTracker(opts) {
    const q = makeQueue(opts.queueKey);
    const tracker = {
      _ctx: Object.assign({}, opts.defaults),
      init(ctx) { this._ctx = Object.assign({}, opts.defaults, ctx || {}); this._flush(); },
      record(result) {
        const attempt = opts.build(this._ctx, result);
        return post(opts.url, attempt)
          .then(function () { toast("✓ Result saved", "#1f6b3a"); })
          .catch(function () {
            const a = q.load(); a.push(attempt); q.save(a);
            toast("⚠ Saved locally — start serve.py to sync", "#9b6a1f");
          });
      },
      _flush() {
        const items = q.load();
        if (!items.length) return;
        const remaining = [];
        const next = function (i) {
          if (i >= items.length) {
            q.save(remaining);
            if (!remaining.length) toast("✓ Synced offline results", "#1f6b3a");
            return;
          }
          post(opts.url, items[i]).then(function () { next(i + 1); })
            .catch(function () { remaining.push(items[i]); next(i + 1); });
        };
        next(0);
      },
    };
    return tracker;
  }

  global.DrillTracker = makeTracker({
    url: isHttp ? "/save-result" : "http://127.0.0.1:8777/save-result",
    queueKey: "teach.pendingResults.v1",
    defaults: { lesson: "?", title: "?" },
    build: function (ctx, r) {
      return {
        lesson: ctx.lesson, title: ctx.title,
        drill: (r && r.drill) || "main",
        score: r.score, total: r.total, answers: r.answers || null,
      };
    },
  });

  global.ExamTracker = makeTracker({
    url: isHttp ? "/save-exam" : "http://127.0.0.1:8777/save-exam",
    queueKey: "teach.pendingExams.v1",
    defaults: { exam: "?", title: "?" },
    build: function (ctx, r) {
      return Object.assign({ exam: ctx.exam, title: ctx.title }, r);
    },
  });
})(typeof window !== "undefined" ? window : globalThis);
