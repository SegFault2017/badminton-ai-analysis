---
title: Homography — turning pixels into real court metres
lesson_id: "0005"
drill_title: "Homography & court mapping"
mission: ../MISSION.md
drills:
  - q: "Why can't you measure real distance directly in pixels?"
    options: ["perspective distorts scale", "pixels are too small", "the video is grayscale"]
    answer: 0
    why: "The camera views the court at an angle, so a metre far away spans fewer pixels than a metre near — pixel distance ≠ real distance."
  - q: "What is a homography?"
    options: ["a plane-to-plane mapping", "a type of camera", "a pose keypoint"]
    answer: 0
    why: "A perspective transform (a 3×3 matrix) mapping points on one plane (the image) to another plane (the flat court)."
  - q: "How many point correspondences define it here?"
    options: ["four corners", "seventeen joints", "thirty frames"]
    answer: 0
    why: "The 4 clicked court corners map to 4 known court-metre coordinates — exactly enough to solve the 3×3 transform (mapper.py:20)."
  - q: "What does image_to_court return?"
    options: ["court metres", "a cropped image", "a confidence score"]
    answer: 0
    why: "It applies the homography to a pixel point and returns its (x, y) position on the court in metres (mapper.py:25-37)."
  - q: "Why does the repo need metres instead of pixels?"
    options: ["real speed & distance", "smaller files", "faster YOLO"]
    answer: 0
    why: "Speed (m/s) and distance (m) are only meaningful in real units; metres come from the homography (player.py court_history)."
  - ctx: "court_to_image is the inverse transform (metres → pixels)."
    q: "What is it used for?"
    options: ["drawing court lines", "detecting the ball", "reading the score"]
    answer: 0
    why: "Court grid lines are known in metres; converting them to pixels lets the overlay be drawn on the angled camera view (mapper.py:54-89)."
---

<p class="kicker">Lesson 5 · Court geometry</p>

# Turning pixels into real court metres

You now have player positions — but in **pixels**. Pixels can't tell you that a
player ran 4 metres or moved at 5 m/s, because the camera sees the court *at an
angle*. This lesson is the one piece of genuine CV geometry in the repo:
**homography**, the transform that converts angled pixel positions into a clean
top-down court measured in metres. It's what makes every "m/s" and "metre"
statistic real.

<div class="rule-box">
<strong>The one idea:</strong> The court is a flat plane. A camera viewing a plane
creates a fixed, solvable mapping between image pixels and real court coordinates.
That mapping is a <strong>homography</strong> — and 4 corner points are enough to
compute it.
</div>

## The problem: perspective lies about distance

In the camera view the court is a **trapezoid** — wider near the camera, narrower
far away. So equal real distances cover *unequal* pixel distances. Measuring in
pixels would make the far player look slower than the near one for the same real
movement.

<figure class="diagram">
<svg viewBox="0 0 600 270" role="img" aria-label="The court appears as a trapezoid in the camera; one metre near the camera spans many pixels while one metre far away spans few">
  <!-- trapezoid court -->
  <polygon points="240,55 360,55 470,235 130,235" style="fill:var(--surface);stroke:var(--rule)" stroke-width="1.5"/>
  <!-- far 1m (narrow) -->
  <line x1="258" y1="85" x2="342" y2="85" style="stroke:var(--bad)" stroke-width="2"/>
  <line x1="258" y1="80" x2="258" y2="90" style="stroke:var(--bad)" stroke-width="2"/>
  <line x1="342" y1="80" x2="342" y2="90" style="stroke:var(--bad)" stroke-width="2"/>
  <text class="d-label" x="300" y="74" text-anchor="middle" font-size="11" style="fill:var(--bad)">1 m far = few px</text>
  <!-- near 1m (wide) -->
  <line x1="170" y1="210" x2="430" y2="210" style="stroke:var(--good)" stroke-width="2"/>
  <line x1="170" y1="205" x2="170" y2="215" style="stroke:var(--good)" stroke-width="2"/>
  <line x1="430" y1="205" x2="430" y2="215" style="stroke:var(--good)" stroke-width="2"/>
  <text class="d-label" x="300" y="228" text-anchor="middle" font-size="11" style="fill:var(--good)">1 m near = many px</text>
  <text class="d-label" x="300" y="255" text-anchor="middle" font-size="11" style="fill:var(--muted)">same real distance, different pixel length → pixels can't measure metres</text>
  <text class="d-mono" x="300" y="45" text-anchor="middle" font-size="10" style="fill:var(--muted)">camera view (far)</text>
</svg>
<figcaption>Perspective: the far baseline is squished, the near one stretched. A naïve pixel measurement would badly distort speed and distance — hence the need to "undo" the perspective.</figcaption>
</figure>

## The fix: a homography from 4 corners

Remember the **4-corner annotation** flagged back in Lesson 2 (the "other court
thing")? This is where it pays off. You tell the system where the four court
corners are *in the image*, and it knows where they are *in metres* (a badminton
court is **6.1 × 13.4 m**). Four point-pairs is exactly enough to solve the 3×3
perspective matrix (`mapper.py:16-21`):

```python
court_points = [[0,0], [6.1,0], [6.1,13.4], [0,13.4]]          # corners in metres
self.matrix     = cv2.getPerspectiveTransform(image_corners, court_points)  # image → court
self.inv_matrix = cv2.getPerspectiveTransform(court_points, image_corners)  # court → image
```

<figure class="diagram">
<svg viewBox="0 0 600 300" role="img" aria-label="The four image corners of the trapezoid map to the four corners of a top-down rectangle in metres; a player point maps to a metre coordinate">
  <!-- image side: trapezoid -->
  <text class="d-label" x="120" y="30" text-anchor="middle" font-size="12" style="fill:var(--ink)">camera image (pixels)</text>
  <polygon points="80,55 180,55 220,210 40,210" style="fill:var(--surface);stroke:var(--rule)" stroke-width="1.5"/>
  <circle cx="95" cy="55" r="4" style="fill:var(--accent)"/><text class="d-mono" x="92" y="50" font-size="9" style="fill:var(--accent)">1</text>
  <circle cx="180" cy="55" r="4" style="fill:var(--accent)"/><text class="d-mono" x="184" y="50" font-size="9" style="fill:var(--accent)">2</text>
  <circle cx="220" cy="210" r="4" style="fill:var(--accent)"/><text class="d-mono" x="224" y="214" font-size="9" style="fill:var(--accent)">3</text>
  <circle cx="40" cy="210" r="4" style="fill:var(--accent)"/><text class="d-mono" x="28" y="214" font-size="9" style="fill:var(--accent)">4</text>
  <circle cx="150" cy="150" r="5" style="fill:var(--blue)"/>
  <text class="d-mono" x="156" y="148" font-size="9" style="fill:var(--blue)">player (px)</text>
  <!-- transform arrow -->
  <line x1="245" y1="135" x2="345" y2="135" style="stroke:var(--muted)" stroke-width="1.5" marker-end="url(#g)"/>
  <line x1="345" y1="170" x2="245" y2="170" style="stroke:var(--muted)" stroke-width="1.5" marker-end="url(#g)"/>
  <defs><marker id="g" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
  <text class="d-mono" x="295" y="125" text-anchor="middle" font-size="9" style="fill:var(--ink)">image_to_court</text>
  <text class="d-mono" x="295" y="190" text-anchor="middle" font-size="9" style="fill:var(--ink)">court_to_image</text>
  <text class="d-mono" x="295" y="152" text-anchor="middle" font-size="9" style="fill:var(--muted)">3×3 H</text>
  <!-- court side: rectangle -->
  <text class="d-label" x="470" y="30" text-anchor="middle" font-size="12" style="fill:var(--ink)">top-down court (metres)</text>
  <rect x="410" y="50" width="120" height="200" style="fill:var(--surface);stroke:var(--good)" stroke-width="1.5"/>
  <circle cx="410" cy="50" r="4" style="fill:var(--accent)"/><text class="d-mono" x="360" y="50" font-size="9" style="fill:var(--accent)">(0,0)</text>
  <circle cx="530" cy="50" r="4" style="fill:var(--accent)"/><text class="d-mono" x="534" y="50" font-size="9" style="fill:var(--accent)">(6.1,0)</text>
  <circle cx="530" cy="250" r="4" style="fill:var(--accent)"/><text class="d-mono" x="534" y="262" font-size="9" style="fill:var(--accent)">(6.1,13.4)</text>
  <circle cx="410" cy="250" r="4" style="fill:var(--accent)"/><text class="d-mono" x="360" y="262" font-size="9" style="fill:var(--accent)">(0,13.4)</text>
  <circle cx="470" cy="170" r="5" style="fill:var(--blue)"/>
  <text class="d-mono" x="476" y="168" font-size="9" style="fill:var(--blue)">(3.2, 9.5) m</text>
</svg>
<figcaption>The homography "unwarps" the angled court into a true rectangle. <code>image_to_court</code> sends a pixel point to its real metre coordinate; <code>court_to_image</code> goes back the other way.</figcaption>
</figure>

The two directions, both just `cv2.perspectiveTransform` with the right matrix:

- `image_to_court(point)` — pixels → metres. **This is the one tracking calls**
  every frame to log a player's court position (`mapper.py:25-37`).
- `court_to_image(points)` — metres → pixels. Used to **draw** the court grid:
  the lines are defined in metres (thirds, 11 rows) then converted to pixels so
  they sit correctly on the angled view (`mapper.py:54-89`).

<div class="rule-box">
🧭 <strong>Read vs write — why you need both directions.</strong>
<code>image_to_court</code> is for <strong>measuring</strong> (read the world: where
is the player, in metres?). <code>court_to_image</code> is for <strong>placing</strong>
(write onto the world: I know this court feature in metres — where does it go on the
angled screen?). The court grid is a clean, regular pattern <em>in metres</em>;
defining it there and converting to pixels is far easier than hand-computing each
warped line. Anytime you know something in real court coordinates and need to draw
it on the video — lines, zones, the net — you go metres → pixels.
</div>

<div class="rule-box">
🔗 <strong>Callback to Lesson 4:</strong> the net threshold that splits players into
upper/lower? It's computed right here — the court midline (6.7 m) is mapped to a
pixel <code>y</code> via <code>court_to_image</code> and stored as
<code>mid_height</code> (<code>mapper.py:73-77</code>). That's a second use of the
"placing" direction.
</div>

## The payoff: real speed and distance

Once positions are in metres, the analytics are just geometry. Distance between two
court positions is plain Euclidean distance **in metres**; divide by elapsed time
and you get **m/s**. That's exactly what `PlayerTracker` does over its
`court_history` trail (Lesson 4).

<figure class="diagram">
<svg viewBox="0 0 600 220" role="img" aria-label="Two court positions in metres give a real distance, divided by time gives speed in metres per second">
  <rect x="60" y="30" width="110" height="170" style="fill:var(--surface);stroke:var(--good)" stroke-width="1.5"/>
  <circle cx="95" cy="90" r="5" style="fill:var(--blue)"/><text class="d-mono" x="100" y="86" font-size="9" style="fill:var(--blue)">p1 (3.0, 4.0)</text>
  <circle cx="140" cy="150" r="5" style="fill:var(--accent)"/><text class="d-mono" x="145" y="166" font-size="9" style="fill:var(--accent)">p2 (4.5, 6.0)</text>
  <line x1="95" y1="90" x2="140" y2="150" style="stroke:var(--muted)" stroke-width="1.5" stroke-dasharray="3 3"/>
  <text class="d-label" x="115" y="215" text-anchor="middle" font-size="10" style="fill:var(--muted)">court (metres)</text>
  <!-- chain -->
  <text class="d-mono" x="330" y="70" text-anchor="middle" font-size="13" style="fill:var(--ink)">Δ = √(1.5² + 2.0²) = 2.5 m</text>
  <text class="d-mono" x="330" y="110" text-anchor="middle" font-size="13" style="fill:var(--ink)">time = 0.5 s</text>
  <text class="d-mono" x="330" y="155" text-anchor="middle" font-size="15" style="fill:var(--good)">speed = 2.5 / 0.5 = 5.0 m/s</text>
  <line x1="180" y1="120" x2="215" y2="120" style="stroke:var(--muted)" stroke-width="1.5" marker-end="url(#h)"/>
  <defs><marker id="h" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/></marker></defs>
</svg>
<figcaption>The whole point of the homography: real metres in, so a simple distance ÷ time gives a real speed. None of this works on raw pixels.</figcaption>
</figure>

<div class="mission">
🎯 <strong>Mission link:</strong> the homography is the hinge between the "computer
vision" half (pixels) and the "analytics" half (metres) of the project. The court
dimensions <code>(6.1, 13.4)</code> are hard-coded (<code>mapper.py:6</code>) — if
you adapted this to a different sport or a half-court drill, that's the number
you'd change, and the corner-click order must match the metre corners.
</div>

## Check yourself

<div class="quiz" id="quiz"></div>
<div class="progress" id="progress"></div>

## 🛠 Hands-on (10 min, optional)

See the unwarp happen. In `PlayerTracker._update_player_position`
(`player.py:136`), print pixels next to metres:

```python
print(f"pixels {centroid}  →  court {court_position} m")
```

Run on a clip and watch: as a player moves to the **far** side, small pixel changes
become correctly-sized metre changes (perspective undone). Compare a near-court and
far-court step of the same real size — in pixels they differ a lot; in metres they
should be close. (Remove the print after.)

<div class="ask">
💬 <strong>Ask your teacher:</strong> Want the intuition for why a 3×3 matrix (not
2×2) is needed — the role of homogeneous coordinates — or move to Lesson 6, where we
assemble the whole pipeline end-to-end and make a real change? Just ask.
</div>

<hr>
<h2 id="cheat-sheet">📋 Cheat-sheet (quick reference)</h2>

<div class="rule-box">
<strong>Key takeaway:</strong> a homography (3×3) maps the angled court image to a
top-down court in metres, solved from <strong>4 corner pairs</strong>.
<code>image_to_court</code> → metres (for stats); <code>court_to_image</code> →
pixels (for drawing). Metres make speed/distance real.
</div>

| Concept | Detail |
|---|---|
| Homography | perspective map between two planes; a 3×3 matrix |
| Solved from | 4 image corners ↔ 4 metre corners (`getPerspectiveTransform`, mapper.py:20) |
| Court size | `6.1 × 13.4 m`, hard-coded (mapper.py:6) |
| Corner order | TL, TR, BR, BL ↔ (0,0),(6.1,0),(6.1,13.4),(0,13.4) |
| `image_to_court` | pixels → metres; called every frame for stats (mapper.py:25) |
| `court_to_image` | metres → pixels; draws the court grid overlay (mapper.py:39) |
| `mid_height` | court 6.7 m mapped to pixel y → the upper/lower net threshold (mapper.py:73-77) |
| Payoff | distance (m) = Euclidean in court space; speed (m/s) = dist ÷ time |

| Two "courts" — resolved | Job |
|---|---|
| Template image (L2) | "is this a court view?" (rally gate) |
| 4-corner annotation (this lesson) | "where are the lines, in metres?" (homography) |

<p class="footer">Primary source: <a href="https://docs.opencv.org/4.x/da/d6e/tutorial_py_geometric_transformations.html">OpenCV — Geometric Transformations</a>. Code refs: <code>court/mapper.py</code>, <code>tracking/player.py</code>. Prev: <a href="?id=0004">Lesson 4 — Detection & tracking</a>.</p>
