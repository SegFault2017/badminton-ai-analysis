# Baseline: comfortable in Python, zero computer-vision background

Established at workspace setup. Raymond programs comfortably in Python (classes,
imports, numpy-style code are fine), so lessons skip Python instruction entirely.
He has explicitly stated no prior computer-vision knowledge. This sets the floor:
start teaching at the most foundational CV concept needed to read this repo —
"a digital image is a numpy array" — and build up (ROI cropping → template
matching → pose keypoints → court homography). Prefers concept-first, then traces
real repo code, reinforced by quizzes and small hands-on tweaks.

Also already established (from the architecture walkthrough in chat, but treat as
*exposure*, not mastery until quizzed): the high-level pipeline shape
frame → is_court_view → detect players/ball → track → draw overlays → write video,
plus post-run position heatmaps/scatter.
