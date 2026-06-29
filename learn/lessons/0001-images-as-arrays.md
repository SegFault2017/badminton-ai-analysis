---
title: How this repo "sees" a video — frames as numpy arrays
lesson_id: "0001"
drill_title: "Images as arrays"
mission: ../MISSION.md
drills:
  - q: "In this repo, what is `cv2`?"
    options: ["the OpenCV library", "a numpy submodule", "the YOLO model"]
    answer: 0
    why: "`import cv2` is the OpenCV computer-vision library. It handles reading video, colour conversion, cropping, drawing overlays and template matching all through the repo."
  - ctx: "A colour frame from the video has shape (720, 1280, 3)."
    q: "Which number is the image width?"
    options: ["720", "1280", "3"]
    answer: 1
    why: "Shape order is (height, width, channels). Index 1 = width = 1280. system.py reads it via CAP_PROP_FRAME_WIDTH (system.py:181)."
  - q: "OpenCV stores the three colour channels in which order?"
    options: ["RGB", "BGR", "HSV"]
    answer: 1
    why: "OpenCV is BGR, not RGB — the classic gotcha when colours look swapped after loading an image."
  - ctx: "roi = frame[y1:y2, x1:x2]"
    q: "What does this line produce?"
    options: ["a cropped rectangle", "a grayscale frame", "a resized image"]
    answer: 0
    why: "Slicing the array by row range then column range crops a sub-rectangle. This is exactly how the repo isolates the court region (system.py:295-297)."
  - q: "A grayscale frame's shape contains how many numbers?"
    options: ["one", "two", "three"]
    answer: 1
    why: "Grayscale drops the channel axis → (height, width), two numbers. Colour has three. cvtColor(..., BGR2GRAY) does this conversion (system.py:262)."
  - q: "How does process_video step through the footage?"
    options: ["reads all frames at once", "reads one frame per loop", "reads every tenth frame"]
    answer: 1
    why: "while cap.isOpened(): ret, frame = cap.read() — one frame each iteration, processed, then the next (system.py:210-215)."
---

<p class="kicker">Lesson 1 · Foundations</p>

# How this repo "sees" a video

You're comfortable in Python, so the gap isn't the code — it's knowing **what the
data *is*** as it flows through the pipeline. Almost every line in
`badminton_analysis/` is doing something to one object: a **frame**. Nail what a
frame really is and most of the repo stops looking like magic.

<div class="rule-box">
<strong>The one idea:</strong> A digital image is just a grid of numbers — a
<em>numpy array</em>. A video is a sequence of those arrays. Everything else
(detection, cropping, drawing) is array manipulation.
</div>

## First, what is OpenCV?

You'll see `cv2.` on almost every line, so let's name it. **OpenCV** (Open Source
Computer Vision Library) is a large, battle-tested toolkit — started at Intel
around 2000 — for working with images and video. In Python you reach it through
one import:

```python
import cv2
```

<div class="rule-box">
🏷 <strong>Why <code>cv2</code> and not <code>opencv</code>?</strong> Pure history:
the Python module shipped with OpenCV 2.x was named <code>cv2</code>, and the name
stuck even though we're now on OpenCV 4. So <code>cv2</code> <em>is</em> OpenCV.
</div>

Think of OpenCV as the **plumbing** of this project. It does the unglamorous,
essential work around the AI models:

- **Read & write video** — `cv2.VideoCapture` (frames in), the video writer (frames out)
- **Convert colour** — `cv2.cvtColor` (BGR → grayscale)
- **Compare images** — `cv2.matchTemplate` (is this the court view?)
- **Draw on frames** — `cv2.rectangle`, `cv2.putText` (the overlays you see)
- **Geometry** — perspective transforms (pixel → court-metre mapping, later)

What OpenCV does **not** do here is the modern deep-learning detection — spotting
players and the shuttlecock. That's handed off to **YOLO** and **RTMPose**
(separate libraries). A useful mental split:

<div class="twocol">
<div class="card">
<strong>OpenCV (<code>cv2</code>)</strong><br>
the plumbing: load frames, crop, convert, draw, write, geometry.
</div>
<div class="card">
<strong>YOLO / RTMPose</strong><br>
the brains: deep-learning models that find players, poses and the shuttlecock.
</div>
</div>

OpenCV is so foundational that the array shapes we're about to discuss are
literally *defined by* what `cv2.VideoCapture` hands back.
([About OpenCV](https://opencv.org/about/))

## A frame is a numpy array

When OpenCV reads a colour frame, you get a numpy array shaped
`(height, width, 3)`:

- **height** — number of pixel rows
- **width** — number of pixel columns
- **3** — the colour channels for each pixel

So a 720p frame is `(720, 1280, 3)` — about 2.7 million numbers, each 0–255.
([OpenCV: Basic Operations on Images](https://docs.opencv.org/4.x/d3/df2/tutorial_py_basic_ops.html))

<figure class="diagram">
<svg viewBox="0 0 600 300" role="img" aria-label="A frame is a grid of pixels; each pixel holds three colour numbers B, G, R">
  <!-- width brace -->
  <text class="d-label" x="256" y="26" text-anchor="middle" font-size="15" style="fill:var(--accent)">width = 8 pixels</text>
  <line x1="120" y1="40" x2="392" y2="40" style="stroke:var(--muted)" stroke-width="1"/>
  <line x1="120" y1="35" x2="120" y2="45" style="stroke:var(--muted)" stroke-width="1"/>
  <line x1="392" y1="35" x2="392" y2="45" style="stroke:var(--muted)" stroke-width="1"/>
  <!-- height label -->
  <text class="d-label" x="34" y="140" text-anchor="middle" font-size="15" style="fill:var(--accent)" transform="rotate(-90 34 140)">height = 5 pixels</text>
  <line x1="104" y1="55" x2="104" y2="225" style="stroke:var(--muted)" stroke-width="1"/>
  <line x1="99" y1="55" x2="109" y2="55" style="stroke:var(--muted)" stroke-width="1"/>
  <line x1="99" y1="225" x2="109" y2="225" style="stroke:var(--muted)" stroke-width="1"/>
  <!-- grid outer -->
  <rect x="120" y="55" width="272" height="170" style="fill:var(--surface);stroke:var(--rule)" stroke-width="1.5"/>
  <!-- vertical grid lines -->
  <line x1="154" y1="55" x2="154" y2="225" style="stroke:var(--rule)"/>
  <line x1="188" y1="55" x2="188" y2="225" style="stroke:var(--rule)"/>
  <line x1="222" y1="55" x2="222" y2="225" style="stroke:var(--rule)"/>
  <line x1="256" y1="55" x2="256" y2="225" style="stroke:var(--rule)"/>
  <line x1="290" y1="55" x2="290" y2="225" style="stroke:var(--rule)"/>
  <line x1="324" y1="55" x2="324" y2="225" style="stroke:var(--rule)"/>
  <line x1="358" y1="55" x2="358" y2="225" style="stroke:var(--rule)"/>
  <!-- horizontal grid lines -->
  <line x1="120" y1="89" x2="392" y2="89" style="stroke:var(--rule)"/>
  <line x1="120" y1="123" x2="392" y2="123" style="stroke:var(--rule)"/>
  <line x1="120" y1="157" x2="392" y2="157" style="stroke:var(--rule)"/>
  <line x1="120" y1="191" x2="392" y2="191" style="stroke:var(--rule)"/>
  <!-- highlighted pixel (top-left) -->
  <rect x="120" y="55" width="34" height="34" style="fill:var(--accent);opacity:0.85"/>
  <!-- connector to the exploded pixel -->
  <line x1="154" y1="72" x2="430" y2="95" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="3 3"/>
  <!-- exploded pixel = 3 channel bands -->
  <text class="d-label" x="485" y="58" text-anchor="middle" font-size="13" style="fill:var(--ink)">1 pixel = 3 numbers</text>
  <rect x="430" y="70" width="110" height="30" style="fill:var(--blue);opacity:0.30;stroke:var(--rule)"/>
  <rect x="430" y="100" width="110" height="30" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/>
  <rect x="430" y="130" width="110" height="30" style="fill:var(--accent);opacity:0.30;stroke:var(--rule)"/>
  <text class="d-mono" x="485" y="90" text-anchor="middle" font-size="13" style="fill:var(--ink)">B = 0</text>
  <text class="d-mono" x="485" y="120" text-anchor="middle" font-size="13" style="fill:var(--ink)">G = 0</text>
  <text class="d-mono" x="485" y="150" text-anchor="middle" font-size="13" style="fill:var(--ink)">R = 255</text>
  <!-- shape caption -->
  <text class="d-mono" x="300" y="270" text-anchor="middle" font-size="15" style="fill:var(--ink)">numpy shape = (height, width, channels) = (5, 8, 3)</text>
</svg>
<figcaption>A frame is a grid of pixels. Here it's 5×8; a real 720p frame is 720×1280. Every pixel stores 3 numbers — Blue, Green, Red.</figcaption>
</figure>

<div class="rule-box">
⚠️ <strong>BGR, not RGB.</strong> OpenCV orders the channels Blue-Green-Red. If you
ever display a frame and the colours look wrong, this is almost always why.
(<a href="https://docs.opencv.org/4.x/df/d9d/tutorial_py_colorspaces.html">OpenCV: Changing Colorspaces</a>)
</div>

## Why grayscale matters in this project

Quick recap of *what* it is: grayscale throws away colour and keeps only
brightness — **each pixel becomes a single number, 0 (black) to 255 (white)**.
That's why the shape drops from `(H, W, 3)` to `(H, W)`: each pixel went from a
3-number colour triplet to one brightness value.

<figure class="diagram">
<svg viewBox="0 0 600 200" role="img" aria-label="Converting one colour pixel of three numbers into one grayscale brightness number">
  <!-- left: colour pixel = 3 bands -->
  <text class="d-mono" x="150" y="40" text-anchor="middle" font-size="14" style="fill:var(--accent)">COLOUR  (H, W, 3)</text>
  <rect x="90" y="55" width="120" height="30" style="fill:var(--blue);opacity:0.30;stroke:var(--rule)"/>
  <rect x="90" y="85" width="120" height="30" style="fill:var(--good);opacity:0.30;stroke:var(--rule)"/>
  <rect x="90" y="115" width="120" height="30" style="fill:var(--accent);opacity:0.30;stroke:var(--rule)"/>
  <text class="d-mono" x="150" y="75" text-anchor="middle" font-size="13" style="fill:var(--ink)">B = 0</text>
  <text class="d-mono" x="150" y="105" text-anchor="middle" font-size="13" style="fill:var(--ink)">G = 0</text>
  <text class="d-mono" x="150" y="135" text-anchor="middle" font-size="13" style="fill:var(--ink)">R = 255</text>
  <text class="d-label" x="150" y="165" text-anchor="middle" font-size="12" style="fill:var(--muted)">3 numbers per pixel</text>
  <!-- arrow -->
  <line x1="240" y1="100" x2="370" y2="100" style="stroke:var(--muted)" stroke-width="1.5" marker-end="url(#arrow1)"/>
  <defs>
    <marker id="arrow1" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/>
    </marker>
  </defs>
  <text class="d-mono" x="305" y="88" text-anchor="middle" font-size="11" style="fill:var(--ink)">cvtColor(BGR2GRAY)</text>
  <text class="d-mono" x="305" y="120" text-anchor="middle" font-size="10" style="fill:var(--muted)">.299·R + .587·G + .114·B</text>
  <!-- right: grayscale pixel = 1 cell -->
  <text class="d-mono" x="470" y="40" text-anchor="middle" font-size="14" style="fill:var(--good)">GRAY  (H, W)</text>
  <rect x="410" y="65" width="120" height="65" style="fill:var(--ink);opacity:0.30;stroke:var(--rule)"/>
  <text class="d-mono" x="470" y="103" text-anchor="middle" font-size="18" style="fill:var(--ink)">76</text>
  <text class="d-label" x="470" y="165" text-anchor="middle" font-size="12" style="fill:var(--muted)">1 number per pixel</text>
</svg>
<figcaption>The channel axis collapses: a 3-number BGR pixel becomes one brightness value, so <code>(H, W, 3)</code> → <code>(H, W)</code>. The grid size (H×W) is unchanged.</figcaption>
</figure>

But why does *this* repo convert every frame to gray? Because grayscale powers the
single most important decision in the pipeline: **"is the camera showing the court
right now?"** Everything downstream depends on that answer.

### The exact code path

```python
# 1. At startup, load the saved court picture AS grayscale
template_gray = cv2.imread(template_path, 0)            # system.py:392  (the 0 = grayscale)

# 2. Every frame, convert the live frame to grayscale
gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)   # system.py:262

# 3. Compare them — is this frame a court view?
is_court = self.is_court_view(gray_frame, template_gray) # system.py:266
```

And inside `is_court_view`:

```python
result = cv2.matchTemplate(frame, template_gray, cv2.TM_CCOEFF_NORMED)
return np.max(result) >= threshold                      # system.py:476-478
```

If this returns `False`, the frame is **skipped entirely** — no player detection,
no shuttlecock detection, no stats. So grayscale literally gates the whole engine.

### Three reasons grayscale (not colour) is the right call here

<div class="twocol">
<div class="card">
<strong>⚡ Speed</strong><br>
This check runs on <em>every single frame</em> — thousands per match. Grayscale is
⅓ the data, so <code>matchTemplate</code> is far cheaper.
</div>
<div class="card">
<strong>🛡 Robustness</strong><br>
A court is identified by its <em>lines and shapes</em>, not its colour. Dropping
colour means broadcast lighting, ads, and player-kit colours don't fool the match.
</div>
</div>

<div class="rule-box">
<strong>🔗 Both sides must match.</strong> <code>matchTemplate</code> compares two
images pixel-for-pixel — they must have the same number of channels. The template
is loaded gray, so the live frame must be gray too. That's the third reason the
conversion happens.
</div>

<div class="mission">
🎯 <strong>So what (for your mission):</strong> this grayscale → court-view check is
what segments the video into <em>rallies</em>, and rallies are the unit every stat
is measured over. If you ever wanted to make rally detection stricter or looser,
you'd tune the <code>threshold=0.75</code> in <code>is_court_view</code> — and now
you know why it operates on gray images. We'll go deep on this in the next lesson.
</div>

## Cropping is just slicing

Here's the payoff for already knowing Python. To analyse only the court area, the
repo doesn't call some special "crop" function — it **slices the array**:

```python
x1, y1 = roi_corners[0]
x2, y2 = roi_corners[1]
roi = frame[y1:y2, x1:x2]                                # system.py:295-297
```

`frame[rows, cols]` → take rows `y1..y2` and columns `x1..x2`. The result `roi`
is a smaller array — the region of interest fed to the pose detector. Same numpy
slicing you already know, applied to pixels.

## The frame loop

A video isn't loaded all at once — it's streamed one frame at a time:

```python
while cap.isOpened():                                    # system.py:210
    ret, frame = cap.read()   # ret=False when the video ends
    if not ret:
        break
    frame, detect_frame_count = self._process_frame(...)
```

Every concept in this course happens **inside that loop**, once per frame:
convert to gray → check court view → crop ROI → detect → track → draw → write out.

<figure class="diagram">
<svg viewBox="0 0 600 560" role="img" aria-label="The per-frame pipeline: read, grayscale, court-view decision, then crop, detect, track, draw, write; skipped if not a court view, then loop to the next frame">
  <defs>
    <marker id="arrow2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L7,3 L0,6 Z" style="fill:var(--muted)"/>
    </marker>
  </defs>
  <!-- boxes -->
  <g style="stroke:var(--rule)" stroke-width="1.5">
    <rect x="90" y="20"  width="240" height="40" rx="6" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="90" y="85"  width="240" height="40" rx="6" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="90" y="240" width="240" height="40" rx="6" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="90" y="305" width="240" height="40" rx="6" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="90" y="370" width="240" height="40" rx="6" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="90" y="435" width="240" height="40" rx="6" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="90" y="500" width="240" height="40" rx="6" style="fill:var(--surface);stroke:var(--rule)"/>
    <rect x="400" y="155" width="150" height="40" rx="6" style="fill:var(--surface-alt);stroke:var(--rule)"/>
  </g>
  <!-- decision diamond -->
  <polygon points="210,135 345,175 210,215 75,175" style="fill:var(--surface);stroke:var(--accent)" stroke-width="2"/>
  <!-- box texts -->
  <text class="d-label" x="210" y="45"  text-anchor="middle" font-size="14" style="fill:var(--ink)">Read frame  <tspan class="d-mono" font-size="11">(H, W, 3)</tspan></text>
  <text class="d-label" x="210" y="110" text-anchor="middle" font-size="14" style="fill:var(--ink)">To grayscale  <tspan class="d-mono" font-size="11">(H, W)</tspan></text>
  <text class="d-label" x="210" y="170" text-anchor="middle" font-size="13" style="fill:var(--accent)">Court view?</text>
  <text class="d-mono"  x="210" y="188" text-anchor="middle" font-size="10" style="fill:var(--muted)">matchTemplate ≥ 0.75</text>
  <text class="d-label" x="210" y="265" text-anchor="middle" font-size="14" style="fill:var(--ink)">Crop ROI  <tspan class="d-mono" font-size="11">frame[y1:y2, x1:x2]</tspan></text>
  <text class="d-label" x="210" y="330" text-anchor="middle" font-size="14" style="fill:var(--ink)">Detect players + ball</text>
  <text class="d-label" x="210" y="395" text-anchor="middle" font-size="14" style="fill:var(--ink)">Track + compute stats</text>
  <text class="d-label" x="210" y="460" text-anchor="middle" font-size="14" style="fill:var(--ink)">Draw overlays</text>
  <text class="d-label" x="210" y="525" text-anchor="middle" font-size="14" style="fill:var(--ink)">Write frame to video</text>
  <text class="d-label" x="475" y="180" text-anchor="middle" font-size="13" style="fill:var(--muted)">Skip frame</text>
  <!-- arrows (vertical spine) -->
  <g stroke-width="1.5" style="stroke:var(--muted)">
    <line x1="210" y1="60"  x2="210" y2="83"  marker-end="url(#arrow2)"/>
    <line x1="210" y1="125" x2="210" y2="133" marker-end="url(#arrow2)"/>
    <line x1="210" y1="215" x2="210" y2="238" marker-end="url(#arrow2)"/>
    <line x1="210" y1="280" x2="210" y2="303" marker-end="url(#arrow2)"/>
    <line x1="210" y1="345" x2="210" y2="368" marker-end="url(#arrow2)"/>
    <line x1="210" y1="410" x2="210" y2="433" marker-end="url(#arrow2)"/>
    <line x1="210" y1="475" x2="210" y2="498" marker-end="url(#arrow2)"/>
    <!-- no branch -->
    <line x1="345" y1="175" x2="400" y2="175" marker-end="url(#arrow2)"/>
    <!-- loop spine: write -> right -> up -> back into read; skip joins it -->
    <path d="M330,520 H575 V40 H332" fill="none" marker-end="url(#arrow2)"/>
    <line x1="550" y1="175" x2="575" y2="175"/>
  </g>
  <!-- branch labels -->
  <text class="d-label" x="222" y="232" font-size="12" style="fill:var(--good)">yes</text>
  <text class="d-label" x="360" y="168" font-size="12" style="fill:var(--bad)">no</text>
  <text class="d-label" x="582" y="290" font-size="12" style="fill:var(--muted)" transform="rotate(90 582 290)">next frame</text>
</svg>
<figcaption>One trip through the frame loop. The grayscale <strong>court-view check</strong> is the gate: a non-court frame is skipped entirely, so detection/tracking/stats only run on real rally footage. Then the loop pulls the next frame.</figcaption>
</figure>

<div class="mission">
🎯 <strong>Mission link:</strong> "Read any file and explain it." Files like
<code>shuttlecock.py</code> and <code>rtmpose.py</code> all receive a
<code>frame</code> or an <code>roi</code> — i.e. one of these arrays — and return
coordinates. Knowing the shape and slicing model is the key that unlocks reading
them.
</div>

## Check yourself

<div class="quiz" id="quiz"></div>
<div class="progress" id="progress"></div>

## 🛠 Hands-on (5 min, optional)

When you're ready to see this for real, add three lines inside the frame loop in
`badminton_analysis/system.py` (around line 215) and run on a short clip:

```python
print("colour frame:", frame.shape)          # (H, W, 3)
print("gray frame:  ", gray_frame.shape)      # (H, W)
# after roi is created in _process_frame:
print("roi:         ", roi.shape)             # smaller (h, w, 3)
```

Predict each shape *before* you run it. Matching your prediction to the output is
the fastest way to make this stick. (Remove the prints afterward.)

<div class="ask">
💬 <strong>Ask your teacher:</strong> Want me to walk through <em>why</em> the ROI
corners are where they are, or jump to the next concept — how
<code>matchTemplate</code> turns these arrays into rally detection? Just ask.
</div>

<hr>
<h2 id="cheat-sheet">📋 Cheat-sheet (quick reference)</h2>

<div class="rule-box">
<strong>Key takeaway:</strong> frame = numpy array; video = stream of arrays;
detection/cropping/drawing = array operations.
</div>

| Term | Meaning |
|---|---|
| **OpenCV** | Open Source Computer Vision library — the image/video toolkit |
| **`cv2`** | the Python import for OpenCV (named after the 2.x era) |
| **OpenCV's job here** | plumbing: read/write video, convert, crop, draw, geometry |
| **YOLO / RTMPose's job** | the brains: deep-learning detection of players, poses, shuttlecock |
| **ROI** (Region of Interest) | the sub-rectangle worth analysing — here the (expanded) court box, sliced out with `frame[y1:y2, x1:x2]`. Makes detection **faster** (fewer pixels) and **cleaner** (ignores crowd/ads; out-of-ROI detections are rejected — see [Lesson 4](?id=0004)) |

| Thing | Shape | In the repo |
|---|---|---|
| Colour frame | `(H, W, 3)` | `cap.read()` → `frame` |
| Grayscale frame | `(H, W)` | `cvtColor(frame, BGR2GRAY)` (sys.py:262) |
| Cropped ROI | `(h, w, 3)` | `frame[y1:y2, x1:x2]` (sys.py:297) |

| Rule | Detail |
|---|---|
| Shape order | `(height, width, channels)` — height first! |
| Channel order | **BGR**, not RGB (OpenCV quirk) |
| Pixel value range | `0`–`255` per channel (uint8) |
| Crop = | numpy slice `array[rows, cols]` |
| Video read | one frame per `while` iteration |

<p class="footer">Primary source: <a href="https://docs.opencv.org/4.x/d3/df2/tutorial_py_basic_ops.html">OpenCV-Python — Basic Operations on Images</a>. Code refs: <code>badminton_analysis/system.py</code>.</p>
