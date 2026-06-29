---
title: Detection vs tracking — the shuttlecock and the two players
lesson_id: "0004"
drill_title: "Detection & tracking"
mission: ../MISSION.md
drills:
  - q: "What's the difference between detection and tracking?"
    options: ["per-frame vs across frames", "colour vs grayscale", "players vs the ball"]
    answer: 0
    why: "Detection finds an object in a single frame (no memory); tracking links it across frames using motion and history."
  - ctx: "The shuttlecock YOLO runs at conf=0.18 — unusually low."
    q: "Why such a low confidence threshold?"
    options: ["catch faint detections", "ignore the players", "speed up YOLO"]
    answer: 0
    why: "The shuttle is tiny and motion-blurred, so detections are weak; a low threshold keeps them and later filters remove the junk (shuttlecock.py:51)."
  - ctx: "A shuttle trajectory already exists."
    q: "How does the tracker choose the best candidate?"
    options: ["nearest the predicted spot", "the largest box", "the reddest pixel"]
    answer: 0
    why: "It predicts the next position and scores candidates by confidence minus distance-from-prediction (and size) (shuttlecock.py:136-143)."
  - q: "How does it predict the shuttle's next position?"
    options: ["continue the last motion", "average all points", "ask the user"]
    answer: 0
    why: "Constant velocity: predicted = last + (last − previous) (shuttlecock.py:171-177)."
  - ctx: "A new detection lands 400 px from the last point (gate is 220)."
    q: "What happens to it?"
    options: ["rejected as an outlier", "always accepted", "becomes a player"]
    answer: 0
    why: "Jumps beyond max_jump_pixels (220) are gated out as physically implausible (shuttlecock.py:154-162)."
  - q: "How does the repo decide a player is 'upper' vs 'lower'?"
    options: ["by court half (y)", "by shirt colour", "by player name"]
    answer: 0
    why: "A centroid above the net threshold is upper, below is lower. Players can't cross, so position alone is a reliable ID (player.py:107-120)."
---

<p class="kicker">Lesson 4 · Detection & tracking</p>

# Detection vs tracking

Lesson 3 gave you *per-frame* positions: this player's feet are here, the ball is
there. But a video is a sequence, and the analytics need **continuity** — the same
player followed over time, the ball's flight path, gaps filled when a detection
blinks out. That's the jump from **detection** to **tracking**, and this repo does
it two very different ways: a clever hand-rolled tracker for the shuttlecock, and a
beautifully simple trick for the two players.

<div class="rule-box">
<strong>The one idea:</strong> <strong>Detection</strong> answers "where is it in
<em>this</em> frame?" (no memory). <strong>Tracking</strong> answers "which object
is this, over <em>time</em>?" — using motion and history to stay consistent and
survive missed frames.
</div>

<figure class="diagram">
<svg viewBox="0 0 600 220" role="img" aria-label="Detection works on one frame; tracking links an object across several frames and predicts the next position">
  <!-- detection card -->
  <text class="d-label" x="150" y="28" text-anchor="middle" font-size="14" style="fill:var(--accent)">DETECTION — one frame</text>
  <rect x="55" y="40" width="190" height="120" rx="5" style="fill:var(--surface);stroke:var(--rule)" stroke-width="1.5"/>
  <circle cx="150" cy="100" r="8" style="fill:var(--accent);opacity:0.6"/>
  <rect x="128" y="78" width="44" height="44" rx="3" style="fill:none;stroke:var(--accent)" stroke-width="1.5"/>
  <text class="d-label" x="150" y="178" text-anchor="middle" font-size="11" style="fill:var(--muted)">"where is it now?"</text>
  <!-- tracking card -->
  <text class="d-label" x="445" y="28" text-anchor="middle" font-size="14" style="fill:var(--blue)">TRACKING — across frames</text>
  <g>
    <rect x="320" y="40" width="60" height="120" rx="4" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="390" y="40" width="60" height="120" rx="4" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="460" y="40" width="60" height="120" rx="4" style="fill:var(--surface);stroke:var(--rule)"/>
  </g>
  <circle cx="345" cy="120" r="6" style="fill:var(--blue)"/>
  <circle cx="418" cy="95" r="6" style="fill:var(--blue)"/>
  <circle cx="490" cy="70" r="6" style="fill:var(--blue)"/>
  <line x1="345" y1="120" x2="418" y2="95" style="stroke:var(--blue)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <line x1="418" y1="95" x2="490" y2="70" style="stroke:var(--blue)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <circle cx="555" cy="48" r="6" style="fill:none;stroke:var(--blue)" stroke-width="1.5" stroke-dasharray="2 2"/>
  <line x1="490" y1="70" x2="548" y2="52" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="2 2"/>
  <text class="d-label" x="445" y="178" text-anchor="middle" font-size="11" style="fill:var(--muted)">"same object over time → predict next"</text>
</svg>
<figcaption>Detection is memoryless and per-frame. Tracking strings detections together over time and can predict where the object goes next (dashed circle) — which is exactly how gaps get filled.</figcaption>
</figure>

## Tracking the shuttlecock (the hard case)

A shuttle is tiny, fast, and motion-blurred — detection alone is noisy and full of
false positives. So `ShuttlecockTracker` wraps the raw YOLO detector in a
**filter → predict → select → gate** pipeline (`shuttlecock.py`).

<figure class="diagram">
<svg viewBox="0 0 600 300" role="img" aria-label="Shuttlecock pipeline: detect, filter by size and ROI, predict next position, gate out implausible jumps, append to trajectory">
  <!-- pipeline boxes -->
  <g class="d-label" font-size="11" text-anchor="middle">
    <rect x="15"  y="20" width="125" height="38" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text x="77"  y="38" style="fill:var(--ink)">detect (YOLO)</text><text x="77" y="51" font-size="9" style="fill:var(--muted)">conf 0.18</text>
    <rect x="160" y="20" width="125" height="38" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text x="222" y="38" style="fill:var(--ink)">filter</text><text x="222" y="51" font-size="9" style="fill:var(--muted)">size · aspect · ROI</text>
    <rect x="305" y="20" width="125" height="38" rx="5" style="fill:var(--surface);stroke:var(--rule)"/><text x="367" y="38" style="fill:var(--ink)">predict + select</text><text x="367" y="51" font-size="9" style="fill:var(--muted)">nearest prediction</text>
    <rect x="450" y="20" width="135" height="38" rx="5" style="fill:var(--surface);stroke:var(--accent)" stroke-width="1.5"/><text x="517" y="38" style="fill:var(--ink)">gate → append</text><text x="517" y="51" font-size="9" style="fill:var(--muted)">reject jumps</text>
  </g>
  <g style="stroke:var(--muted)" stroke-width="1.2">
    <line x1="140" y1="39" x2="158" y2="39" marker-end="url(#e)"/>
    <line x1="285" y1="39" x2="303" y2="39" marker-end="url(#e)"/>
    <line x1="430" y1="39" x2="448" y2="39" marker-end="url(#e)"/>
  </g>
  <defs><marker id="e" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <!-- illustration: trajectory + prediction + gating -->
  <text class="d-label" x="40" y="100" font-size="11" style="fill:var(--muted)">trajectory so far →</text>
  <circle cx="120" cy="235" r="5" style="fill:var(--blue);opacity:0.5"/>
  <circle cx="165" cy="210" r="5" style="fill:var(--blue);opacity:0.65"/>
  <circle cx="210" cy="180" r="5" style="fill:var(--blue);opacity:0.8"/>
  <circle cx="255" cy="145" r="6" style="fill:var(--blue)"/>
  <line x1="120" y1="235" x2="255" y2="145" style="stroke:var(--blue)" stroke-width="1" opacity="0.5"/>
  <!-- predicted next -->
  <line x1="255" y1="145" x2="300" y2="110" style="stroke:var(--muted)" stroke-width="1.2" stroke-dasharray="3 3" marker-end="url(#e)"/>
  <circle cx="300" cy="110" r="8" style="fill:none;stroke:var(--muted)" stroke-width="1.5" stroke-dasharray="2 2"/>
  <text class="d-mono" x="300" y="95" text-anchor="middle" font-size="10" style="fill:var(--muted)">predicted</text>
  <!-- accepted candidate -->
  <circle cx="312" cy="118" r="6" style="fill:var(--good)"/>
  <text class="d-label" x="360" y="135" font-size="11" style="fill:var(--good)">✓ near prediction → accept</text>
  <!-- rejected candidate -->
  <circle cx="470" cy="240" r="6" style="fill:var(--bad)"/>
  <line x1="255" y1="145" x2="470" y2="240" style="stroke:var(--bad)" stroke-width="1.2" stroke-dasharray="4 3"/>
  <text class="d-label" x="470" y="262" text-anchor="middle" font-size="11" style="fill:var(--bad)">✗ jump &gt; 220 px → reject</text>
</svg>
<figcaption>The tracker predicts the next position by continuing the last motion, accepts the candidate closest to that prediction, and rejects physically impossible jumps. Accepted points go into a 30-long trajectory deque — the comet tail you see on screen.</figcaption>
</figure>

The moving parts, all in `shuttlecock.py`:

- **Filter** candidates: too big, wrong aspect ratio, or outside the ROI → discarded (`:107-115`). A shuttle is *small*, so a large box is never the bird.
- **Predict** next position with constant velocity: `predicted = last + (last − prev)` (`:171-177`).
- **Select** the candidate scoring highest on `confidence − distance·1.4 − size` (`:138-143`) — i.e. confident *and* near where the bird should be.
- **Gate**: reject jumps over `max_jump_pixels` (220) or `prediction_gate_pixels` (260) (`:154-169`).
- **Occlusion**: count `missing_frames`; tolerate up to 5 before giving up the last position (`:184-187`). Tracking *survives* brief misses.

## Tracking the players (the easy case — by design)

Generic multi-object tracking is hard: which blob is player A vs B, frame to
frame? The repo sidesteps it entirely with one piece of **domain knowledge**:
*in singles, each player owns one half of the court and can't cross the net.* So
identity is just **position** — compare a centroid's `y` to a threshold (the net
line) and label it `upper` or `lower` (`player.py:107-120`).

<figure class="diagram">
<svg viewBox="0 0 600 280" role="img" aria-label="Players are assigned to upper or lower by comparing their y position to the net threshold line">
  <!-- court -->
  <rect x="60" y="40" width="300" height="200" rx="3" style="fill:var(--surface);stroke:var(--rule)" stroke-width="1.5"/>
  <line x1="60" y1="140" x2="360" y2="140" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="6 4"/>
  <text class="d-mono" x="370" y="138" font-size="10" style="fill:var(--accent)">threshold y (net)</text>
  <text class="d-label" x="80" y="62" font-size="11" style="fill:var(--muted)">upper half</text>
  <text class="d-label" x="80" y="232" font-size="11" style="fill:var(--muted)">lower half</text>
  <!-- upper player -->
  <circle cx="200" cy="95" r="8" style="fill:var(--blue)"/>
  <text class="d-mono" x="215" y="92" font-size="10" style="fill:var(--blue)">y &lt; threshold</text>
  <!-- spurious upper detection -->
  <circle cx="110" cy="65" r="7" style="fill:var(--muted);opacity:0.5"/>
  <text class="d-mono" x="120" y="62" font-size="9" style="fill:var(--muted)">extra? keep nearest net</text>
  <!-- lower player -->
  <circle cx="240" cy="195" r="8" style="fill:var(--accent)"/>
  <text class="d-mono" x="255" y="198" font-size="10" style="fill:var(--accent)">y ≥ threshold</text>
  <!-- arrows to lanes -->
  <line x1="208" y1="95"  x2="455" y2="90"  style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#f)"/>
  <line x1="248" y1="195" x2="455" y2="195" style="stroke:var(--muted)" stroke-width="1.2" marker-end="url(#f)"/>
  <defs><marker id="f" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <!-- lanes -->
  <rect x="460" y="70" width="120" height="40" rx="5" style="fill:var(--blue);opacity:0.18;stroke:var(--rule)"/><text class="d-mono" x="520" y="95" text-anchor="middle" font-size="12" style="fill:var(--ink)">players["upper"]</text>
  <rect x="460" y="175" width="120" height="40" rx="5" style="fill:var(--accent);opacity:0.18;stroke:var(--rule)"/><text class="d-mono" x="520" y="200" text-anchor="middle" font-size="12" style="fill:var(--ink)">players["lower"]</text>
</svg>
<figcaption>Player "tracking" is really just assignment by court half. If more than one centroid lands in the upper half, the one nearest the net is kept (player.py:112-114). Each half's position is appended to a history deque — the trajectory trail.</figcaption>
</figure>

Each frame, `update` also stores the position into `history` (pixel trail) and
`court_history` (metre trail), and writes one record per frame to
`detections.jsonl`. Those trails are what speed, distance and the heatmaps are
computed from (`player.py:96-141`). On-screen the upper player is drawn yellow,
the lower magenta (`player_pose.py:138`).

<div class="mission">
🎯 <strong>Mission link:</strong> this is a textbook case of <em>domain knowledge
beating a generic algorithm</em>. If you extended the repo to <strong>doubles</strong>
(two players per half), this simple <code>y &lt; threshold</code> assignment would
break — you'd need real multi-object tracking. Knowing exactly where that
assumption lives (<code>player.py:104-120</code>) tells you precisely what to
rework.
</div>

## Check yourself

<div class="quiz" id="quiz"></div>
<div class="progress" id="progress"></div>

## 🛠 Hands-on (10 min, optional)

Watch both trackers work. In `ShuttlecockTracker.update_trajectory`
(`shuttlecock.py:73`), log the trajectory health:

```python
print(f"trajectory: {len(self.shuttlecock_trajectory)}  missing: {self.missing_frames}")
```

And in `PlayerTracker.update` (`player.py:116`), see the half-assignment:

```python
print(f"upper: {len(upper_court_centroids)}  lower: {len(lower_court_centroids)}")
```

Run on a clip: watch the shuttle trajectory grow and reset (and `missing` tick up
during replays/occlusions), and confirm you almost always get one upper + one
lower. Then imagine doubles — predict what the second number would do. (Revert
after.)

<div class="ask">
💬 <strong>Ask your teacher:</strong> Want to unpack the candidate-scoring formula
(why confidence×1000 vs distance×1.4), or move to Lesson 5 — the homography that
turns these pixel positions into real court metres? Just ask.
</div>

<hr>
<h2 id="cheat-sheet">📋 Cheat-sheet (quick reference)</h2>

<div class="rule-box">
<strong>Key takeaway:</strong> detection = per-frame; tracking = across-frames.
Shuttle: filter → predict (constant velocity) → select nearest prediction → gate
jumps → trajectory deque. Players: assign by court half (<code>y</code> vs net),
because they can't cross.
</div>

| Detection vs tracking | |
|---|---|
| Detection | find object in one frame, no memory (YOLO / pose model) |
| Tracking | link across frames using motion + history; survive misses |

| Shuttlecock tracker | Value (shuttlecock.py) |
|---|---|
| Detect confidence | `0.18` — low, shuttle is faint (`:51`) |
| Candidate filters | area ≤ `0.004`, aspect ≤ `4`, inside ROI (`:107-115`) |
| Prediction | `last + (last − prev)` constant velocity (`:171-177`) |
| Selection score | `conf·1000 − dist·1.4 − size` (`:138-143`) |
| Outlier gate | jump > `220` px or > `260` from prediction (`:154-169`) |
| Occlusion tolerance | up to `5` missing frames (`:184-187`) |
| Trajectory | `deque(maxlen=30)` → comet tail (`:40`) |

| Player tracker | Detail (player.py) |
|---|---|
| Assignment | `y < threshold` → upper, else lower (`:107-120`) |
| Extra in a half | keep the one nearest the net (`:112-114`) |
| Why it works | players can't cross → position = identity |
| Stored per frame | `history` (px), `court_history` (m), `detections.jsonl` |
| Breaks on | doubles (2 per half) → needs real MOT |

<p class="footer">Code refs: <code>detection/shuttlecock.py</code>, <code>tracking/player.py</code>. Prev: <a href="?id=0003">Lesson 3 — Pose keypoints</a>.</p>
