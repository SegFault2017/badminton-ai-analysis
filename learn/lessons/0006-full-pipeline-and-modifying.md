---
title: The whole pipeline — and making your first change
lesson_id: "0006"
drill_title: "Full pipeline (interleaved)"
mission: ../MISSION.md
drills:
  - q: "The first test a candidate frame must pass is…"
    options: ["the grayscale template match", "the pose detection", "the homography"]
    answer: 0
    why: "is_court_view runs first (L2); only court-view frames go on to detection and tracking. Non-court frames are skipped."
  - q: "A player's tracked position comes from which keypoints?"
    options: ["the two ankles", "the two wrists", "the nose and eyes"]
    answer: 0
    why: "The ankle midpoint (15, 16) is the ground position (L3) — feet on the floor, which the homography needs (L5)."
  - ctx: "The shuttle tracker sees a candidate 400 px from the last point."
    q: "Why does it reject it?"
    options: ["it exceeds the jump gate", "it is grayscale", "it is in the upper half"]
    answer: 0
    why: "Jumps over max_jump_pixels (220) are physically implausible and gated out (L4)."
  - q: "image_to_court converts pixel positions to…"
    options: ["court metres", "grayscale", "keypoints"]
    answer: 0
    why: "The homography maps angled pixels to real top-down court metres (L5) — what makes speed/distance real."
  - q: "Correct order of these three steps?"
    options: ["court-view → pose → metres", "pose → court-view → metres", "metres → pose → court-view"]
    answer: 0
    why: "Gate first (skip non-court), then detect pose on the ROI, then map the position to metres (L2 → L3 → L5)."
  - q: "Speed in m/s is possible because positions are stored in…"
    options: ["court metres", "raw pixels", "confidence scores"]
    answer: 0
    why: "Distance ÷ time only means something in real units; court_history holds metres (L5)."
  - q: "The upper/lower net threshold is computed from…"
    options: ["the court midline (6.7 m)", "the ball trajectory", "the template score"]
    answer: 0
    why: "court_to_image maps the 6.7 m midline to a pixel y → mid_height, the assignment threshold (L4 + L5)."
---

<p class="kicker">Lesson 6 · Capstone</p>

# The whole pipeline — and making your first change

You've met every piece. This lesson assembles them into one mental model of the
**whole system**, then hands you the second half of your mission: **making a real
change** and predicting its effect before you run it.

<div class="rule-box">
<strong>The one idea:</strong> the project is a pipeline that turns a <em>video</em>
into <em>court-metre positions</em>, then into <em>stats and visuals</em>. Each
lesson you did is one stage. Change a stage, and you can predict what moves
downstream.
</div>

## The system, end to end

There's a one-time **setup**, a per-frame **loop**, and a **post-processing** pass.
Each box is tagged with the lesson that explains it.

<figure class="diagram">
<svg viewBox="0 0 600 600" role="img" aria-label="End-to-end pipeline: setup loads template and solves the homography; the per-frame loop gates by court view then detects, tracks, maps to metres and draws; post-processing builds heatmaps">
  <defs><marker id="p" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <!-- SETUP band -->
  <rect x="10" y="15" width="580" height="120" rx="8" style="fill:none;stroke:var(--rule)" stroke-dasharray="4 4"/>
  <text class="d-label" x="22" y="33" font-size="11" style="fill:var(--muted)">SETUP (once)</text>
  <rect x="40" y="45" width="150" height="50" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="115" y="68" text-anchor="middle" font-size="12" style="fill:var(--ink)">load court template</text><text class="d-mono" x="115" y="84" text-anchor="middle" font-size="9" style="fill:var(--blue)">L2</text>
  <rect x="225" y="45" width="150" height="50" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="300" y="68" text-anchor="middle" font-size="12" style="fill:var(--ink)">annotate 4 corners</text><text class="d-mono" x="300" y="84" text-anchor="middle" font-size="9" style="fill:var(--blue)">L5</text>
  <rect x="410" y="45" width="150" height="50" rx="5" style="fill:var(--surface);stroke:var(--accent)" stroke-width="1.5"/><text class="d-label" x="485" y="65" text-anchor="middle" font-size="12" style="fill:var(--ink)">homography +</text><text class="d-label" x="485" y="80" text-anchor="middle" font-size="12" style="fill:var(--ink)">ROI + mid_height</text><text class="d-mono" x="540" y="91" font-size="9" style="fill:var(--blue)">L5</text>
  <line x1="190" y1="70" x2="223" y2="70" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#p)"/>
  <line x1="375" y1="70" x2="408" y2="70" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#p)"/>
  <!-- LOOP band -->
  <rect x="10" y="150" width="580" height="345" rx="8" style="fill:none;stroke:var(--rule)" stroke-dasharray="4 4"/>
  <text class="d-label" x="22" y="168" font-size="11" style="fill:var(--muted)">PER-FRAME LOOP</text>
  <!-- boxes -->
  <rect x="200" y="178" width="200" height="40" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="300" y="203" text-anchor="middle" font-size="12" style="fill:var(--ink)">read frame → grayscale</text><text class="d-mono" x="388" y="213" font-size="9" style="fill:var(--blue)">L1</text>
  <polygon points="300,228 410,258 300,288 190,258" style="fill:var(--surface);stroke:var(--accent)" stroke-width="2"/><text class="d-label" x="300" y="255" text-anchor="middle" font-size="11" style="fill:var(--accent)">court view?</text><text class="d-mono" x="300" y="270" text-anchor="middle" font-size="9" style="fill:var(--muted)">matchTemplate</text><text class="d-mono" x="360" y="248" font-size="9" style="fill:var(--blue)">L2</text>
  <rect x="200" y="305" width="200" height="38" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="300" y="328" text-anchor="middle" font-size="12" style="fill:var(--ink)">crop ROI → pose (17 kp)</text><text class="d-mono" x="388" y="338" font-size="9" style="fill:var(--blue)">L3</text>
  <rect x="200" y="356" width="200" height="38" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="300" y="379" text-anchor="middle" font-size="12" style="fill:var(--ink)">detect + track ball</text><text class="d-mono" x="388" y="389" font-size="9" style="fill:var(--blue)">L4</text>
  <rect x="200" y="407" width="200" height="38" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="300" y="425" text-anchor="middle" font-size="11" style="fill:var(--ink)">assign upper/lower →</text><text class="d-label" x="300" y="438" text-anchor="middle" font-size="11" style="fill:var(--ink)">image_to_court (m) → stats</text><text class="d-mono" x="388" y="423" font-size="9" style="fill:var(--blue)">L4·L5</text>
  <rect x="200" y="458" width="200" height="30" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="300" y="478" text-anchor="middle" font-size="12" style="fill:var(--ink)">draw overlays → write</text><text class="d-mono" x="388" y="486" font-size="9" style="fill:var(--blue)">L1</text>
  <!-- arrows -->
  <g style="stroke:var(--muted)" stroke-width="1.2">
    <line x1="300" y1="218" x2="300" y2="226" marker-end="url(#p)"/>
    <line x1="300" y1="288" x2="300" y2="303" marker-end="url(#p)"/>
    <line x1="300" y1="343" x2="300" y2="354" marker-end="url(#p)"/>
    <line x1="300" y1="394" x2="300" y2="405" marker-end="url(#p)"/>
    <line x1="300" y1="445" x2="300" y2="456" marker-end="url(#p)"/>
    <!-- no branch (skip) -->
    <line x1="410" y1="258" x2="470" y2="258" marker-end="url(#p)"/>
    <!-- loop back -->
    <path d="M400,473 H560 V198 H402" fill="none" marker-end="url(#p)"/>
  </g>
  <text class="d-label" x="500" y="252" font-size="11" style="fill:var(--bad)">skip</text>
  <text class="d-label" x="312" y="300" font-size="10" style="fill:var(--good)">yes</text>
  <text class="d-label" x="567" y="340" font-size="10" style="fill:var(--muted)" transform="rotate(90 567 340)">next frame</text>
  <!-- POST band -->
  <rect x="10" y="510" width="580" height="78" rx="8" style="fill:none;stroke:var(--rule)" stroke-dasharray="4 4"/>
  <text class="d-label" x="22" y="528" font-size="11" style="fill:var(--muted)">POST-PROCESSING</text>
  <rect x="120" y="538" width="170" height="40" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="205" y="562" text-anchor="middle" font-size="12" style="fill:var(--ink)">detections.jsonl</text>
  <rect x="330" y="538" width="170" height="40" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text class="d-label" x="415" y="558" text-anchor="middle" font-size="11" style="fill:var(--ink)">heatmaps + scatter</text><text class="d-mono" x="480" y="571" font-size="9" style="fill:var(--blue)">L5 (m)</text>
  <line x1="290" y1="558" x2="328" y2="558" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#p)"/>
</svg>
<figcaption>The whole system on one screen. Setup solves the homography once; the loop gates every frame by court view, then detects → tracks → maps to metres → draws; post-processing turns the logged metre positions into heatmaps. Each tag points back to its lesson.</figcaption>
</figure>

## Follow the data, not the code

The clearest way to hold the system in your head is to track **what the data
becomes** at each step — the thread you started in Lesson 1.

<figure class="diagram">
<svg viewBox="0 0 600 230" role="img" aria-label="Data transformation chain from mp4 to frame to grayscale to ROI to keypoints to pixel position to court metres to speed to outputs">
  <defs><marker id="q" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <g class="d-mono" font-size="11" text-anchor="middle">
    <text x="70"  y="40" style="fill:var(--ink)">video.mp4</text>
    <text x="70"  y="80" style="fill:var(--ink)">frame</text><text x="70" y="94" font-size="9" style="fill:var(--muted)">(H,W,3)</text>
    <text x="300" y="80" style="fill:var(--ink)">court ROI</text><text x="300" y="94" font-size="9" style="fill:var(--muted)">crop</text>
    <text x="530" y="80" style="fill:var(--ink)">17 keypoints</text><text x="530" y="94" font-size="9" style="fill:var(--muted)">(N,17,2)</text>
    <text x="530" y="150" style="fill:var(--ink)">ankle midpoint</text><text x="530" y="164" font-size="9" style="fill:var(--muted)">pixels</text>
    <text x="300" y="150" style="fill:var(--ink)">court position</text><text x="300" y="164" font-size="9" style="fill:var(--good)">metres</text>
    <text x="70"  y="150" style="fill:var(--ink)">speed / dist</text><text x="70" y="164" font-size="9" style="fill:var(--good)">m/s, m</text>
    <text x="300" y="210" style="fill:var(--ink)">overlay + jsonl → heatmap</text>
  </g>
  <g style="stroke:var(--muted)" stroke-width="1.2">
    <line x1="70" y1="48" x2="70" y2="68" marker-end="url(#q)"/>
    <line x1="110" y1="76" x2="260" y2="76" marker-end="url(#q)"/>
    <line x1="345" y1="76" x2="475" y2="76" marker-end="url(#q)"/>
    <line x1="530" y1="100" x2="530" y2="138" marker-end="url(#q)"/>
    <line x1="470" y1="148" x2="360" y2="148" marker-end="url(#q)"/>
    <line x1="240" y1="148" x2="130" y2="148" marker-end="url(#q)"/>
    <line x1="220" y1="158" x2="270" y2="200" marker-end="url(#q)"/>
  </g>
  <text class="d-label" x="190" y="68" font-size="9" style="fill:var(--blue)">L1·L2</text>
  <text class="d-label" x="410" y="68" font-size="9" style="fill:var(--blue)">L3</text>
  <text class="d-label" x="412" y="140" font-size="9" style="fill:var(--blue)">L5</text>
  <text class="d-label" x="185" y="140" font-size="9" style="fill:var(--blue)">L4·L5</text>
</svg>
<figcaption>Every arrow is one transform you now understand. The pivotal one is pixels → metres (L5): everything before it is computer vision, everything after is analytics.</figcaption>
</figure>

## Your first change

Time to extend, not just read. Here's a contained change that exercises Lessons 3
and 5 at once — and hides a genuine CV insight.

**Task: base the player's position on the hips instead of the ankles.**

In `detect_players` (`player_pose.py:67-75`), the position is the midpoint of the
**ankles** (keypoints 15, 16):

```python
lf = kp_arr[15]      # left ankle
rf = kp_arr[16]      # right ankle
mid_point = ((lf[0]+x1 + rf[0]+x1)/2, (lf[1]+y1 + rf[1]+y1)/2 + 10)
```

Change `15`/`16` to the **hips** `11`/`12` and predict the effect first.

<figure class="diagram">
<svg viewBox="0 0 600 220" role="img" aria-label="Using the ankle midpoint places the player at the feet on the ground; using the hip midpoint sits higher and back-projects to a court position further from the camera">
  <!-- body -->
  <g style="stroke:var(--rule)" stroke-width="2">
    <line x1="120" y1="40" x2="160" y2="40"/>
    <line x1="120" y1="40" x2="105" y2="80"/><line x1="160" y1="40" x2="175" y2="80"/>
    <line x1="128" y1="105" x2="152" y2="105"/>
    <line x1="120" y1="40" x2="128" y2="105"/><line x1="160" y1="40" x2="152" y2="105"/>
    <line x1="128" y1="105" x2="125" y2="155"/><line x1="125" y1="155" x2="122" y2="200"/>
    <line x1="152" y1="105" x2="155" y2="155"/><line x1="155" y1="155" x2="158" y2="200"/>
  </g>
  <!-- hips -->
  <circle cx="128" cy="105" r="5" style="fill:var(--accent)"/><circle cx="152" cy="105" r="5" style="fill:var(--accent)"/>
  <circle cx="140" cy="105" r="4" style="fill:var(--accent)"/>
  <text class="d-mono" x="200" y="108" font-size="10" style="fill:var(--accent)">hip midpoint (11,12)</text>
  <!-- ankles -->
  <circle cx="122" cy="200" r="5" style="fill:var(--good)"/><circle cx="158" cy="200" r="5" style="fill:var(--good)"/>
  <circle cx="140" cy="200" r="4" style="fill:var(--good)"/>
  <text class="d-mono" x="200" y="203" font-size="10" style="fill:var(--good)">ankle midpoint (15,16) ← current</text>
  <!-- ground note -->
  <line x1="90" y1="200" x2="600" y2="200" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>
  <text class="d-label" x="430" y="195" font-size="10" style="fill:var(--muted)">ground plane (what the homography maps)</text>
  <text class="d-label" x="430" y="120" font-size="11" style="fill:var(--ink)">hips sit ~1 m above the floor →</text>
  <text class="d-label" x="430" y="138" font-size="11" style="fill:var(--ink)">mapped through a ground-plane</text>
  <text class="d-label" x="430" y="156" font-size="11" style="fill:var(--ink)">homography, they land too far back.</text>
</svg>
<figcaption>The insight: the homography maps the <strong>ground plane</strong>. Feet touch the ground, so the ankle point maps to the player's true court spot. Hips float ~1 m up, so back-projecting them onto the ground places the player further from the camera than they are — distances and speeds drift. This is <em>why</em> the repo chose ankles.</figcaption>
</figure>

<div class="rule-box">
✅ <strong>Predict, then verify.</strong> Before editing, write down: (1) will the
on-screen position dot move up or down the body? (2) will court positions read
nearer or further from the camera? Then make the change and check. The point isn't
the edit — it's that you can now <em>reason about</em> the effect across two lessons.
</div>

### Stretch changes (pick any)

- **Looser/stricter rallies** (L2): change `threshold=0.75` in `is_court_view` or the
  `5`-frame debounce counts — predict the effect on `rally_count`.
- **Longer comet tail** (L4): `trajectory_length=30` → `60` in `ShuttlecockTracker`.
- **Different court** (L5): change `court_dimensions=(6.1, 13.4)` — what breaks, and
  what must the corner-click order match?

<div class="mission">
🎯 <strong>Mission complete (the core of it):</strong> you can read any file and place
it in this pipeline, you know the CV concepts it stands on, and you can make a change
and predict its effect. That was the whole goal. From here it's reps — keep making
small changes and predicting outcomes.
</div>

## Check yourself (interleaved — all five lessons)

<div class="quiz" id="quiz"></div>
<div class="progress" id="progress"></div>

<div class="ask">
💬 <strong>Ask your teacher:</strong> Want me to set an <strong>exam</strong> across
Lessons 1–6 to lock it in, suggest a bigger extension project (e.g. doubles support,
a new stat), or go deeper on any single stage? Just ask.
</div>

<hr>
<h2 id="cheat-sheet">📋 Cheat-sheet (quick reference)</h2>

<div class="rule-box">
<strong>Key takeaway:</strong> video → (gate by court view) → pose → track → <strong>pixels→metres</strong> → stats → overlay + heatmap. The homography is the hinge: CV before it, analytics after.
</div>

| Stage | File | Lesson |
|---|---|---|
| Orchestration / frame loop | `system.py` | L1 |
| Court-view gate + rallies | `system.py` (`is_court_view`) | L2 |
| Pose → 17 keypoints | `detection/rtmpose.py`, `yolo_pose.py` | L3 |
| Player position / skeleton | `visualization/player_pose.py` | L3 |
| Shuttlecock detect + track | `detection/shuttlecock.py` | L4 |
| Player assign + stats + jsonl | `tracking/player.py` | L4 |
| Homography (px ↔ m) | `court/mapper.py` | L5 |
| Stats overlay | `visualization/stats.py` | — |
| Heatmaps / scatter | `visualization/player_positions_*.py` | L5 |
| Video + audio I/O | `media/video_audio.py` | L1 |

| Quick "where do I change…" | Place |
|---|---|
| What counts as a court view / rally | `is_court_view` threshold, debounce counts (system.py:154-155, 474) |
| Which joints define a player | `detect_players` (player_pose.py:67-75) |
| Shuttle tracking strictness | `ShuttlecockTracker` gates (shuttlecock.py:22-27) |
| Court size / coordinate system | `CourtMapper(court_dimensions=…)` (mapper.py:6) |
| Upper/lower colours, trajectories | `player_pose.py:138` |

<p class="footer">Code refs: whole repo, centred on <code>badminton_analysis/system.py</code>. Prev: <a href="?id=0005">Lesson 5 — Homography</a>. Series start: <a href="?id=0001">Lesson 1</a>.</p>
