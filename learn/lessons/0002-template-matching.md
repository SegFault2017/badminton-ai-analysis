---
title: Template matching — how the repo knows it's looking at the court
lesson_id: "0002"
drill_title: "Template matching & rally detection"
mission: ../MISSION.md
drills:
  - q: "What does `cv2.matchTemplate` actually measure?"
    options: ["how similar two images are", "how many players appear", "how fast the ball moves"]
    answer: 0
    why: "It scores how well a template matches an image — a similarity measure, not a detector. (OpenCV: Template Matching)"
  - ctx: "The court template is resized to the full frame size (system.py:400)."
    q: "So what does matchTemplate return here?"
    options: ["a single similarity score", "a list of court corners", "a cropped player image"]
    answer: 0
    why: "When the template is the same size as the image there's only one position to compare, so the result is one score — np.max of a 1×1 map (system.py:476)."
  - q: "TM_CCOEFF_NORMED ranges about −1 to 1. A higher score means…"
    options: ["a closer match", "a darker frame", "a longer rally"]
    answer: 0
    why: "1.0 is a perfect match; higher = more similar. The repo treats ≥ 0.75 as 'this is the court view' (system.py:474)."
  - ctx: "is_court_view returns False for a replay close-up."
    q: "What does the pipeline do with that frame?"
    options: ["skips it entirely", "counts a new rally", "saves a heatmap"]
    answer: 0
    why: "Non-court frames are skipped — no detection, no stats. Only true court footage is analysed (system.py:290-291)."
  - q: "Why match on grayscale instead of colour? (recall, L1)"
    options: ["shape-based and faster", "to add more colour", "to find the ball"]
    answer: 0
    why: "Court identity lives in lines/shapes; gray is ⅓ the data and robust to lighting. Both images must share channel count too."
  - q: "How many consecutive court frames start a new rally?"
    options: ["five", "one", "thirty"]
    answer: 0
    why: "court_view_frames_threshold = 5 debounces flicker before a rally starts (system.py:154, 276-281)."
---

<p class="kicker">Lesson 2 · Rally detection</p>

# How the repo knows it's looking at the court

In Lesson 1 you saw the pipeline has a **decision gate**: *"is the camera showing
the court right now?"* Frames that pass get analysed; frames that fail (replays,
crowd shots, close-ups) get skipped. This lesson is how that gate works —
**template matching** — and how single-frame yes/no answers become **rallies**,
the unit every statistic is measured over.

<div class="rule-box">
<strong>The one idea:</strong> Template matching slides a reference picture (the
"template") over an image and scores how well they line up. The repo uses it to
ask one question per frame: <em>does this frame look like the court view?</em>
</div>

## The general idea: slide and score

Classic template matching looks for a small picture *inside* a bigger one. You
slide the template to every position and compute a similarity score at each spot.
The result is a **similarity map** — bright where the template fits well. The
brightest point (`np.max`) is the best match; its location (`argmax`) is *where*.
([OpenCV: Template Matching](https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html))

<figure class="diagram">
<svg viewBox="0 0 600 250" role="img" aria-label="A small template slides over a search image and produces a similarity map with a bright peak at the best match">
  <!-- template patch -->
  <text class="d-label" x="80" y="28" text-anchor="middle" font-size="13" style="fill:var(--blue)">template</text>
  <rect x="50" y="35" width="60" height="45" rx="3" style="fill:var(--blue);opacity:0.30;stroke:var(--blue)"/>
  <!-- search image -->
  <text class="d-label" x="165" y="115" text-anchor="middle" font-size="13" style="fill:var(--ink)">search image</text>
  <rect x="50" y="120" width="230" height="110" rx="4" style="fill:var(--surface);stroke:var(--rule)" stroke-width="1.5"/>
  <!-- ghost slide positions -->
  <rect x="58" y="128" width="60" height="45" rx="3" style="fill:none;stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>
  <rect x="130" y="155" width="60" height="45" rx="3" style="fill:none;stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>
  <!-- the real match -->
  <rect x="205" y="175" width="60" height="45" rx="3" style="fill:var(--accent);opacity:0.30;stroke:var(--accent)" stroke-width="1.5"/>
  <!-- arrow -->
  <line x1="295" y1="170" x2="350" y2="170" style="stroke:var(--muted)" stroke-width="1.5" marker-end="url(#a)"/>
  <defs><marker id="a" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <text class="d-label" x="322" y="158" text-anchor="middle" font-size="10" style="fill:var(--muted)">score every spot</text>
  <!-- similarity map -->
  <text class="d-label" x="480" y="40" text-anchor="middle" font-size="13" style="fill:var(--ink)">similarity map</text>
  <g style="stroke:var(--rule)">
    <rect x="370" y="50" width="220" height="170" style="fill:var(--surface)"/>
    <!-- low cells faint, peak bright bottom-right to mirror the match -->
    <rect x="515" y="160" width="55" height="45" style="fill:var(--accent);opacity:0.85"/>
    <rect x="460" y="160" width="55" height="45" style="fill:var(--accent);opacity:0.35"/>
    <rect x="515" y="115" width="55" height="45" style="fill:var(--accent);opacity:0.35"/>
  </g>
  <text class="d-mono" x="543" y="187" text-anchor="middle" font-size="12" style="fill:var(--paper)">peak</text>
  <text class="d-label" x="480" y="240" text-anchor="middle" font-size="11" style="fill:var(--muted)">brightest = best match (max = score, argmax = where)</text>
</svg>
<figcaption>General template matching: slide the template everywhere, build a similarity map, take the peak. The peak's <em>value</em> is the match score; its <em>location</em> is where the template was found.</figcaption>
</figure>

## This repo's twist: the template *is* the whole frame

Here's the part that surprises people. The repo doesn't look for a small patch
inside the frame. At startup it **resizes the court template to the full frame
size**:

```python
template_gray = cv2.resize(template_gray, (frame_width, frame_height))  # system.py:400
```

When the template and the image are the *same size*, there's only **one** position
to compare — so the similarity map is just `1×1`, a **single number**. The repo
isn't asking *"where is the court?"* — it's asking *"how much does this entire
frame resemble a known court view?"* That single score becomes a yes/no gate:

```python
def is_court_view(self, frame, template_gray, threshold=0.75):     # system.py:474
    result = cv2.matchTemplate(frame, template_gray, cv2.TM_CCOEFF_NORMED)
    return np.max(result) >= threshold                              # system.py:476-478
```

<figure class="diagram">
<svg viewBox="0 0 600 290" role="img" aria-label="Each frame is compared to the court template; a court view scores high and is analysed, a replay scores low and is skipped">
  <!-- template in the middle -->
  <rect x="235" y="120" width="130" height="55" rx="5" style="fill:var(--surface);stroke:var(--accent)" stroke-width="2"/>
  <text class="d-label" x="300" y="143" text-anchor="middle" font-size="12" style="fill:var(--accent)">court template</text>
  <text class="d-mono"  x="300" y="161" text-anchor="middle" font-size="10" style="fill:var(--muted)">demo.png (full frame)</text>
  <!-- top row: court frame -->
  <rect x="20" y="20" width="120" height="50" rx="5" style="fill:var(--good);opacity:0.20;stroke:var(--rule)"/>
  <text class="d-label" x="80" y="42" text-anchor="middle" font-size="12" style="fill:var(--ink)">court frame</text>
  <text class="d-mono"  x="80" y="58" text-anchor="middle" font-size="10" style="fill:var(--muted)">wide rally shot</text>
  <line x1="140" y1="45" x2="233" y2="130" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#b)"/>
  <text class="d-mono" x="430" y="48" text-anchor="middle" font-size="13" style="fill:var(--good)">score 0.91  ≥ 0.75  ✓</text>
  <text class="d-label" x="430" y="68" text-anchor="middle" font-size="12" style="fill:var(--ink)">COURT VIEW → analyse frame</text>
  <line x1="365" y1="140" x2="500" y2="80" style="stroke:var(--good)" stroke-width="1.2" marker-end="url(#b)"/>
  <!-- bottom row: replay frame -->
  <rect x="20" y="225" width="120" height="50" rx="5" style="fill:var(--bad);opacity:0.18;stroke:var(--rule)"/>
  <text class="d-label" x="80" y="247" text-anchor="middle" font-size="12" style="fill:var(--ink)">replay / close-up</text>
  <text class="d-mono"  x="80" y="263" text-anchor="middle" font-size="10" style="fill:var(--muted)">player face, crowd</text>
  <line x1="140" y1="250" x2="233" y2="165" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#b)"/>
  <text class="d-mono" x="430" y="232" text-anchor="middle" font-size="13" style="fill:var(--bad)">score 0.32  &lt; 0.75  ✗</text>
  <text class="d-label" x="430" y="252" text-anchor="middle" font-size="12" style="fill:var(--ink)">SKIP frame</text>
  <line x1="365" y1="155" x2="500" y2="215" style="stroke:var(--bad)" stroke-width="1.2" marker-end="url(#b)"/>
  <defs><marker id="b" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
</svg>
<figcaption>Whole-frame matching as a scene classifier. A wide rally shot resembles the template (high score → analyse); a replay or close-up doesn't (low score → skip). The 0.75 threshold is the dividing line.</figcaption>
</figure>

<div class="rule-box">
⚠️ <strong>Two different "court" things — don't mix them up.</strong> The
<em>template image</em> here answers "is this a court view?" (this lesson). The
separate <em>4-corner annotation</em> (<code>court_annotations.txt</code>) answers
"where exactly are the court lines, in metres?" — that's the homography in a later
lesson. Same word, different jobs.
</div>

## From single frames to rallies

One frame's yes/no is noisy — a stray frame can score just over or under 0.75. So
the repo **debounces**: it waits for **5 consecutive** court frames before
declaring a rally has started, and **5 consecutive** non-court frames before
declaring it over (`system.py:154-155, 276-287`). This is a tiny **state machine**.

<figure class="diagram">
<svg viewBox="0 0 600 230" role="img" aria-label="A timeline of court and non-court frames; five consecutive court frames start a rally, five consecutive non-court frames end it">
  <!-- frame squares -->
  <g font-size="11" class="d-mono" text-anchor="middle">
    <!-- N N C C C C C C C C C C N N N N N  (17 frames), origin x=40 cell 30 -->
    <!-- helper: x = 40 + 30*i -->
    <!-- 0 N -->
    <rect x="40"  y="70" width="24" height="24" rx="3" style="fill:var(--muted);opacity:0.25;stroke:var(--rule)"/><text x="52"  y="87" style="fill:var(--ink)">N</text>
    <rect x="70"  y="70" width="24" height="24" rx="3" style="fill:var(--muted);opacity:0.25;stroke:var(--rule)"/><text x="82"  y="87" style="fill:var(--ink)">N</text>
    <rect x="100" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="112" y="87" style="fill:var(--ink)">C</text>
    <rect x="130" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="142" y="87" style="fill:var(--ink)">C</text>
    <rect x="160" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="172" y="87" style="fill:var(--ink)">C</text>
    <rect x="190" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="202" y="87" style="fill:var(--ink)">C</text>
    <rect x="220" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.55;stroke:var(--good)" stroke-width="1.5"/><text x="232" y="87" style="fill:var(--ink)">C</text>
    <rect x="250" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="262" y="87" style="fill:var(--ink)">C</text>
    <rect x="280" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="292" y="87" style="fill:var(--ink)">C</text>
    <rect x="310" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="322" y="87" style="fill:var(--ink)">C</text>
    <rect x="340" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="352" y="87" style="fill:var(--ink)">C</text>
    <rect x="370" y="70" width="24" height="24" rx="3" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/><text x="382" y="87" style="fill:var(--ink)">C</text>
    <rect x="400" y="70" width="24" height="24" rx="3" style="fill:var(--muted);opacity:0.25;stroke:var(--rule)"/><text x="412" y="87" style="fill:var(--ink)">N</text>
    <rect x="430" y="70" width="24" height="24" rx="3" style="fill:var(--muted);opacity:0.25;stroke:var(--rule)"/><text x="442" y="87" style="fill:var(--ink)">N</text>
    <rect x="460" y="70" width="24" height="24" rx="3" style="fill:var(--muted);opacity:0.25;stroke:var(--rule)"/><text x="472" y="87" style="fill:var(--ink)">N</text>
    <rect x="490" y="70" width="24" height="24" rx="3" style="fill:var(--muted);opacity:0.25;stroke:var(--rule)"/><text x="502" y="87" style="fill:var(--ink)">N</text>
    <rect x="520" y="70" width="24" height="24" rx="3" style="fill:var(--bad);opacity:0.40;stroke:var(--bad)" stroke-width="1.5"/><text x="532" y="87" style="fill:var(--ink)">N</text>
  </g>
  <text class="d-label" x="40" y="55" font-size="11" style="fill:var(--muted)">frames over time  →   (C = court, N = non-court)</text>
  <!-- start marker -->
  <line x1="232" y1="70" x2="232" y2="40" style="stroke:var(--good)" stroke-width="1.2"/>
  <text class="d-label" x="232" y="32" text-anchor="middle" font-size="11" style="fill:var(--good)">5th C → rally starts</text>
  <!-- end marker -->
  <line x1="532" y1="94" x2="532" y2="120" style="stroke:var(--bad)" stroke-width="1.2"/>
  <text class="d-label" x="532" y="135" text-anchor="middle" font-size="11" style="fill:var(--bad)">5th N → rally ends</text>
  <!-- rally_active bar -->
  <rect x="232" y="160" width="300" height="18" rx="4" style="fill:var(--good);opacity:0.30;stroke:var(--good)"/>
  <text class="d-mono" x="382" y="173" text-anchor="middle" font-size="11" style="fill:var(--ink)">rally_active = True   (rally_count += 1)</text>
  <text class="d-label" x="120" y="173" text-anchor="middle" font-size="11" style="fill:var(--muted)">idle</text>
  <text class="d-label" x="565" y="173" text-anchor="middle" font-size="11" style="fill:var(--muted)">idle</text>
</svg>
<figcaption>The rally state machine. A single flicker can't start or stop a rally — it takes 5 consecutive frames each way. Each rally start bumps <code>rally_count</code>, and that's the bucket player stats are accumulated into.</figcaption>
</figure>

<div class="mission">
🎯 <strong>Mission link:</strong> rallies are the unit every statistic is grouped
by (the heatmaps and scatter plots are "per rally"). So this template-matching
gate doesn't just save compute — it <em>defines the data structure</em> of your
output. Want cleaner rally splits? You'd tune <code>threshold</code> (how
court-like a frame must be) or the <code>5</code>-frame debounce counts.
</div>

## Check yourself

<div class="quiz" id="quiz"></div>
<div class="progress" id="progress"></div>

## 🛠 Hands-on (10 min, optional)

See the gate with your own eyes. In `is_court_view` (`system.py:474`), print the
real score before the return:

```python
score = float(np.max(cv2.matchTemplate(frame, template_gray, cv2.TM_CCOEFF_NORMED)))
print(f"court score: {score:.2f}")
return score >= threshold
```

Run on a short clip and watch the numbers: rally shots sit high, replays/close-ups
drop. Then experiment — set `threshold=0.6` (looser, more frames accepted) vs
`0.9` (stricter), and see how rally count and which frames get analysed change.
Predict the direction *before* you run. (Revert when done.)

<div class="ask">
💬 <strong>Ask your teacher:</strong> Want to see why TM_CCOEFF_NORMED is more
lighting-robust than a plain pixel difference, or move on to Lesson 3 (pose
keypoints — how players become 17 body points)? Just ask.
</div>

<hr>
<h2 id="cheat-sheet">📋 Cheat-sheet (quick reference)</h2>

<div class="rule-box">
<strong>Key takeaway:</strong> template matching = "how similar?". The repo matches
the <em>whole frame</em> to a court template → one score → ≥ 0.75 means "court
view" → 5-in-a-row debounces it into rallies.
</div>

| Concept | Detail |
|---|---|
| `cv2.matchTemplate` | slides template over image, returns a similarity map |
| `TM_CCOEFF_NORMED` | normalised score, ~ −1…1; **1.0 = perfect match** |
| `np.max(result)` | the best score (here the *only* score — template = full frame) |
| Threshold | `0.75` → court view vs skip (`is_court_view`, sys.py:474) |
| Input | **grayscale** frame + grayscale template (same size, same channels) |

| Rally state machine | Value (system.py) |
|---|---|
| Frames to **start** a rally | 5 consecutive court (`:154, :276`) |
| Frames to **end** a rally | 5 consecutive non-court (`:155, :284`) |
| On start | `rally_count += 1`, `start_new_rally()` (`:279-281`) |
| Why debounce | one stray frame shouldn't start/stop a rally |

| Two "courts" | Job |
|---|---|
| Template image | "is this a court view?" (this lesson) |
| 4-corner annotation | "where are the lines, in metres?" (homography lesson) |

<p class="footer">Primary source: <a href="https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html">OpenCV-Python — Template Matching</a>. Code refs: <code>badminton_analysis/system.py</code> (<code>is_court_view</code>, rally state machine). Prev: <a href="?id=0001">Lesson 1 — Images as arrays</a>.</p>
