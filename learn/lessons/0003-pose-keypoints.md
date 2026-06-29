---
title: Pose keypoints — turning a player into 17 body points
lesson_id: "0003"
drill_title: "Pose keypoints (COCO-17)"
mission: ../MISSION.md
drills:
  - q: "What does pose estimation output for each detected person?"
    options: ["named body-point coordinates", "a cropped player photo", "the player's name"]
    answer: 0
    why: "It returns the (x, y) location of each body joint — the COCO-17 keypoints (rtmpose.py:196-198)."
  - q: "The COCO format used here has how many keypoints per person?"
    options: ["seventeen", "twelve", "thirty"]
    answer: 0
    why: "COCO-17: nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles (rtmpose.py:179-186)."
  - ctx: "process_frame returns keypoints shaped (N, 17, 2)."
    q: "What is that last 2?"
    options: ["the x and y", "two players", "two frames"]
    answer: 0
    why: "Each keypoint is an (x, y) pixel coordinate: N persons × 17 joints × 2 numbers (rtmpose.py:197)."
  - q: "Why can RTMPose and YOLO-Pose be swapped freely?"
    options: ["both output COCO-17", "both need a GPU", "both detect the ball"]
    answer: 0
    why: "Identical 17-keypoint order, so downstream code doesn't care which model produced them (rtmpose.py:181, --pose-family)."
  - q: "Which keypoints become the player's tracked court position?"
    options: ["the two ankles", "the two wrists", "the two eyes"]
    answer: 0
    why: "The midpoint of left+right ankle (15, 16) is the player's ground position, later mapped to court metres (player_pose.py:67-75)."
  - ctx: "A wrist keypoint comes back with confidence 0.31 (threshold 0.5)."
    q: "What does the repo do with it?"
    options: ["zeroes it out", "doubles it up", "draws it red"]
    answer: 0
    why: "Low-confidence joints are set to 0 and treated as missing so unreliable points don't pollute tracking (rtmpose.py:240-243)."
---

<p class="kicker">Lesson 3 · Pose estimation</p>

# Turning a player into 17 body points

So far a player is just a blob of pixels in the ROI. **Pose estimation** converts
that blob into something the rest of the system can do maths on: a fixed set of
**named body joints**, each with an `(x, y)` location. Badminton is all about
*where the body is* — feet for court coverage, wrists for shots — so this is the
step that makes the analytics possible.

<div class="rule-box">
<strong>The one idea:</strong> A pose model takes an image of a person and returns
<strong>17 keypoints</strong> — nose, shoulders, elbows, wrists, hips, knees,
ankles, etc. — each as an <code>(x, y)</code> pixel coordinate plus a confidence
score. This repo then uses just a few of them.
</div>

## The COCO-17 skeleton

The repo uses the **COCO** keypoint convention: 17 joints in a fixed order
(index 0 = nose … 16 = right ankle). The order is the contract — every model
returns the *same 17 in the same slots* ([COCO keypoints](https://cocodataset.org/#keypoints-2020)).

<figure class="diagram">
<svg viewBox="0 0 600 340" role="img" aria-label="A human figure with 17 numbered COCO keypoints from nose to ankles, with body joints connected by skeleton lines">
  <!-- skeleton lines (repo connects indices 5..16 only, not the head) -->
  <g style="stroke:var(--blue);opacity:0.55" stroke-width="2">
    <line x1="260" y1="95" x2="340" y2="95"/>   <!-- 5-6 -->
    <line x1="260" y1="95" x2="235" y2="140"/>  <!-- 5-7 -->
    <line x1="235" y1="140" x2="215" y2="185"/> <!-- 7-9 -->
    <line x1="340" y1="95" x2="365" y2="140"/>  <!-- 6-8 -->
    <line x1="365" y1="140" x2="385" y2="185"/> <!-- 8-10 -->
    <line x1="260" y1="95" x2="275" y2="175"/>  <!-- 5-11 -->
    <line x1="340" y1="95" x2="325" y2="175"/>  <!-- 6-12 -->
    <line x1="275" y1="175" x2="325" y2="175"/> <!-- 11-12 -->
    <line x1="275" y1="175" x2="268" y2="235"/> <!-- 11-13 -->
    <line x1="268" y1="235" x2="262" y2="295"/> <!-- 13-15 -->
    <line x1="325" y1="175" x2="332" y2="235"/> <!-- 12-14 -->
    <line x1="332" y1="235" x2="338" y2="295"/> <!-- 14-16 -->
  </g>
  <!-- head keypoints (no lines in the repo) -->
  <g class="d-mono" font-size="10">
    <circle cx="300" cy="50" r="4" style="fill:var(--muted)"/><text x="308" y="48" style="fill:var(--muted)">0 nose</text>
    <circle cx="288" cy="42" r="3" style="fill:var(--muted)"/><text x="262" y="34" style="fill:var(--muted)">1</text>
    <circle cx="312" cy="42" r="3" style="fill:var(--muted)"/><text x="318" y="34" style="fill:var(--muted)">2</text>
    <circle cx="276" cy="48" r="3" style="fill:var(--muted)"/><text x="250" y="52" style="fill:var(--muted)">3</text>
    <circle cx="324" cy="48" r="3" style="fill:var(--muted)"/><text x="332" y="52" style="fill:var(--muted)">4</text>
  </g>
  <!-- body keypoints -->
  <g class="d-mono" font-size="10">
    <circle cx="260" cy="95" r="4" style="fill:var(--accent)"/><text x="228" y="92" style="fill:var(--ink)">5 sh.</text>
    <circle cx="340" cy="95" r="4" style="fill:var(--accent)"/><text x="348" y="92" style="fill:var(--ink)">6 sh.</text>
    <circle cx="235" cy="140" r="4" style="fill:var(--accent)"/><text x="205" y="138" style="fill:var(--ink)">7</text>
    <circle cx="365" cy="140" r="4" style="fill:var(--accent)"/><text x="372" y="138" style="fill:var(--ink)">8</text>
    <!-- wrists highlighted -->
    <circle cx="215" cy="185" r="6" style="fill:none;stroke:var(--good)" stroke-width="2"/>
    <circle cx="215" cy="185" r="4" style="fill:var(--accent)"/><text x="150" y="188" style="fill:var(--good)">9 wrist</text>
    <circle cx="385" cy="185" r="6" style="fill:none;stroke:var(--good)" stroke-width="2"/>
    <circle cx="385" cy="185" r="4" style="fill:var(--accent)"/><text x="394" y="188" style="fill:var(--good)">10 wrist</text>
    <circle cx="275" cy="175" r="4" style="fill:var(--accent)"/><text x="245" y="172" style="fill:var(--ink)">11 hip</text>
    <circle cx="325" cy="175" r="4" style="fill:var(--accent)"/><text x="333" y="172" style="fill:var(--ink)">12 hip</text>
    <circle cx="268" cy="235" r="4" style="fill:var(--accent)"/><text x="238" y="233" style="fill:var(--ink)">13</text>
    <circle cx="332" cy="235" r="4" style="fill:var(--accent)"/><text x="340" y="233" style="fill:var(--ink)">14</text>
    <!-- ankles highlighted -->
    <circle cx="262" cy="295" r="6" style="fill:none;stroke:var(--good)" stroke-width="2"/>
    <circle cx="262" cy="295" r="4" style="fill:var(--accent)"/><text x="190" y="298" style="fill:var(--good)">15 ankle</text>
    <circle cx="338" cy="295" r="6" style="fill:none;stroke:var(--good)" stroke-width="2"/>
    <circle cx="338" cy="295" r="4" style="fill:var(--accent)"/><text x="346" y="298" style="fill:var(--good)">16 ankle</text>
  </g>
  <text class="d-label" x="300" y="328" text-anchor="middle" font-size="11" style="fill:var(--muted)">green-ringed joints (wrists, ankles) are the ones this repo actually uses</text>
</svg>
<figcaption>The 17 COCO keypoints. The repo draws skeleton lines only between body joints 5–16 (head dots stay unconnected). Indices are fixed — index 16 is always the right ankle, in every model.</figcaption>
</figure>

## What the model hands back

For a frame, `process_frame` returns **two numpy arrays** (rtmpose.py:194-198):

- `keypoints` — shape `(N, 17, 2)` — N people, 17 joints each, 2 numbers `(x, y)`
- `scores` — shape `(N, 17)` — a confidence 0–1 for each of those joints

<figure class="diagram">
<svg viewBox="0 0 600 250" role="img" aria-label="The keypoints output is a stack of N person layers, each a 17 by 2 grid of x,y coordinates, paired with a 17-length scores list; low scores are zeroed">
  <!-- depth copies (N persons) -->
  <rect x="80" y="55" width="90" height="150" rx="3" style="fill:var(--surface);stroke:var(--rule);opacity:0.5"/>
  <rect x="70" y="45" width="90" height="150" rx="3" style="fill:var(--surface);stroke:var(--rule);opacity:0.75"/>
  <!-- front person grid 17x2 -->
  <rect x="60" y="35" width="90" height="150" rx="3" style="fill:var(--surface);stroke:var(--ink)" stroke-width="1.5"/>
  <line x1="105" y1="35" x2="105" y2="185" style="stroke:var(--rule)"/>
  <g style="stroke:var(--rule)">
    <line x1="60" y1="60" x2="150" y2="60"/><line x1="60" y1="85" x2="150" y2="85"/>
    <line x1="60" y1="110" x2="150" y2="110"/><line x1="60" y1="135" x2="150" y2="135"/>
    <line x1="60" y1="160" x2="150" y2="160"/>
  </g>
  <text class="d-mono" x="82" y="52" text-anchor="middle" font-size="9" style="fill:var(--ink)">x</text>
  <text class="d-mono" x="128" y="52" text-anchor="middle" font-size="9" style="fill:var(--ink)">y</text>
  <text class="d-mono" x="105" y="200" text-anchor="middle" font-size="9" style="fill:var(--muted)">17 rows</text>
  <!-- axis labels -->
  <text class="d-mono" x="105" y="25" text-anchor="middle" font-size="11" style="fill:var(--accent)">keypoints (N, 17, 2)</text>
  <text class="d-label" x="190" y="120" font-size="10" style="fill:var(--muted)">N persons</text>
  <line x1="155" y1="48" x2="180" y2="40" style="stroke:var(--muted)" stroke-width="1" marker-end="url(#c)"/>
  <defs><marker id="c" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <!-- scores + filter -->
  <text class="d-mono" x="400" y="25" text-anchor="middle" font-size="11" style="fill:var(--good)">scores (N, 17)</text>
  <g class="d-mono" font-size="11">
    <rect x="330" y="40" width="140" height="24" style="fill:var(--good);opacity:0.18;stroke:var(--rule)"/><text x="340" y="57" style="fill:var(--ink)">joint 9  → 0.92  keep</text>
    <rect x="330" y="66" width="140" height="24" style="fill:var(--bad);opacity:0.22;stroke:var(--rule)"/><text x="340" y="83" style="fill:var(--ink)">joint 10 → 0.31  drop</text>
    <rect x="330" y="92" width="140" height="24" style="fill:var(--good);opacity:0.18;stroke:var(--rule)"/><text x="340" y="109" style="fill:var(--ink)">joint 15 → 0.95  keep</text>
  </g>
  <text class="d-mono" x="400" y="150" text-anchor="middle" font-size="11" style="fill:var(--bad)">score &lt; 0.5  →  (x, y) = (0, 0)</text>
  <text class="d-label" x="400" y="172" text-anchor="middle" font-size="11" style="fill:var(--muted)">unreliable joints are erased so they</text>
  <text class="d-label" x="400" y="188" text-anchor="middle" font-size="11" style="fill:var(--muted)">can't pollute tracking (rtmpose.py:240-243)</text>
</svg>
<figcaption>The output is a small tensor: N people × 17 joints × (x, y), plus a matching grid of confidences. Any joint scoring below 0.5 has its coordinate zeroed — that's why "missing" keypoints show up as (0, 0) later.</figcaption>
</figure>

<div class="twocol">
<div class="card will">
<h3>RTMPose / RTMO</h3>
ONNX models via <code>rtmlib</code>. Default. Modes: lightweight / balanced /
performance (<code>rtmpose.py</code>).
</div>
<div class="card gt">
<h3>YOLO-Pose</h3>
Ultralytics model (<code>yolo_pose.py</code>). Pick with
<code>--pose-family yolo-pose</code>.
</div>
</div>

Both emit **COCO-17 in the same order**, so the entire rest of the pipeline is
identical regardless of which you choose. That's a clean example of a *swappable
component* — useful when you start extending the repo.

## What the repo actually uses

The model gives you 17 joints, but the analytics only need a few. This is the part
that connects pose to everything downstream (`player_pose.py:43-98`):

<figure class="diagram">
<svg viewBox="0 0 600 270" role="img" aria-label="From 17 keypoints the repo derives the ankle midpoint as the player position and the two wrists as hand points">
  <!-- mini body -->
  <g style="stroke:var(--rule)" stroke-width="2">
    <line x1="110" y1="70" x2="150" y2="70"/>
    <line x1="110" y1="70" x2="95" y2="110"/><line x1="95" y1="110" x2="85" y2="150"/>
    <line x1="150" y1="70" x2="165" y2="110"/><line x1="165" y1="110" x2="175" y2="150"/>
    <line x1="118" y1="135" x2="142" y2="135"/>
    <line x1="110" y1="70" x2="118" y2="135"/><line x1="150" y1="70" x2="142" y2="135"/>
    <line x1="118" y1="135" x2="115" y2="185"/><line x1="115" y1="185" x2="112" y2="230"/>
    <line x1="142" y1="135" x2="145" y2="185"/><line x1="145" y1="185" x2="148" y2="230"/>
  </g>
  <!-- wrists -->
  <circle cx="85" cy="150" r="6" style="fill:var(--accent)"/>
  <circle cx="175" cy="150" r="6" style="fill:var(--accent)"/>
  <!-- ankles -->
  <circle cx="112" cy="230" r="6" style="fill:var(--blue)"/>
  <circle cx="148" cy="230" r="6" style="fill:var(--blue)"/>
  <!-- ankle midpoint -->
  <circle cx="130" cy="230" r="5" style="fill:var(--good)"/>
  <!-- arrows to the right -->
  <line x1="185" y1="150" x2="300" y2="95" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#d)"/>
  <line x1="140" y1="232" x2="300" y2="195" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#d)"/>
  <defs><marker id="d" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <!-- wrist branch -->
  <text class="d-label" x="430" y="70" text-anchor="middle" font-size="13" style="fill:var(--accent)">wrists (9, 10)</text>
  <text class="d-label" x="430" y="90" text-anchor="middle" font-size="11" style="fill:var(--ink)">→ hand points</text>
  <text class="d-label" x="430" y="107" text-anchor="middle" font-size="11" style="fill:var(--muted)">used for shot / hit logic</text>
  <!-- ankle branch -->
  <text class="d-label" x="430" y="175" text-anchor="middle" font-size="13" style="fill:var(--blue)">ankles (15, 16)</text>
  <text class="d-label" x="430" y="195" text-anchor="middle" font-size="11" style="fill:var(--good)">midpoint = player position</text>
  <text class="d-label" x="430" y="212" text-anchor="middle" font-size="11" style="fill:var(--muted)">→ tracked, mapped to court metres</text>
  <text class="d-mono" x="430" y="235" text-anchor="middle" font-size="10" style="fill:var(--muted)">(x1, y1 ROI offset added back)</text>
</svg>
<figcaption>17 joints in, two derived signals out. The midpoint between the ankles is the player's spot on the ground (the thing that gets tracked); the wrists become hand points for shot logic. Everything else is mostly for the on-screen skeleton.</figcaption>
</figure>

A couple of practical details from `detect_players`:

- Keypoints come back in **ROI coordinates**, so the code adds the ROI offset
  `(x1, y1)` to get full-frame pixels (`player_pose.py:73-74`).
- A joint at `(0,0)` (or `≤ 1`) is treated as **missing** and skipped — that's the
  same zeroing from the confidence filter showing up downstream
  (`player_pose.py:69, 84-86`).

<div class="mission">
🎯 <strong>Mission link:</strong> the ankle-midpoint <em>is</em> the player position
that feeds tracking, speed, distance and the heatmaps. So if you ever wanted to,
say, base position on the hips instead of the ankles, or change which joints count
as "the player," <code>detect_players</code> (player_pose.py:67-80) is the exact
place — and now you know what those indices mean.
</div>

## Check yourself

<div class="quiz" id="quiz"></div>
<div class="progress" id="progress"></div>

## 🛠 Hands-on (10 min, optional)

Peek at the real output. In `detect_players` (`player_pose.py:49`), right after the
`process_frame` call:

```python
if keypoints_all is not None:
    print("people, joints, coords:", keypoints_all.shape)   # (N, 17, 2)
    print("first person ankles:", keypoints_all[0][15], keypoints_all[0][16])
```

Run on a short clip and watch the shape change with how many players are detected,
and see the ankle coordinates move. Then try swapping the model entirely:
`--pose-family yolo-pose` vs the default — the numbers come from a different model
but the shape and indices are identical. (Remove the prints after.)

<div class="ask">
💬 <strong>Ask your teacher:</strong> Want to dig into how a pose model produces
these points (heatmaps vs SimCC regression), or move to Lesson 4 — detecting the
shuttlecock and deciding which player is "top" vs "bottom"? Just ask.
</div>

<hr>
<h2 id="cheat-sheet">📋 Cheat-sheet (quick reference)</h2>

<div class="rule-box">
<strong>Key takeaway:</strong> pose model → <code>(N, 17, 2)</code> keypoints +
<code>(N, 17)</code> scores. Repo uses <strong>ankles (15,16) → player position</strong>
and <strong>wrists (9,10) → hands</strong>; low-confidence joints are zeroed.
</div>

| COCO-17 index | Joint | | index | Joint |
|---|---|---|---|---|
| 0 | nose | | 9 | **left wrist** |
| 1 / 2 | left / right eye | | 10 | **right wrist** |
| 3 / 4 | left / right ear | | 11 / 12 | left / right hip |
| 5 / 6 | left / right shoulder | | 13 / 14 | left / right knee |
| 7 / 8 | left / right elbow | | 15 / 16 | **left / right ankle** |

| Thing | Detail |
|---|---|
| `process_frame(roi)` | returns `keypoints (N,17,2)`, `scores (N,17)` |
| Coordinate | each keypoint is `(x, y)` in **pixels** |
| Confidence filter | score < 0.5 → coord set to `(0,0)` (rtmpose.py:241-243) |
| "Missing" joint | shows up as `(0,0)` / `≤1`, skipped (player_pose.py:69) |
| ROI offset | add `(x1, y1)` to get full-frame coords (player_pose.py:73) |
| Player position | midpoint of ankles 15 & 16 (player_pose.py:67-75) |
| Hands | wrists 9 & 10 (player_pose.py:82-87) |
| Backends | RTMPose/RTMO or YOLO-Pose — both COCO-17, swappable |

<p class="footer">Primary source: <a href="https://cocodataset.org/#keypoints-2020">COCO keypoint detection</a>. Code refs: <code>detection/rtmpose.py</code>, <code>detection/yolo_pose.py</code>, <code>visualization/player_pose.py</code>. Prev: <a href="?id=0002">Lesson 2 — Template matching</a>.</p>
