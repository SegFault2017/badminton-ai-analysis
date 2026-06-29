# Mission: Understand & extend the Good-Badminton CV analysis repo

## Why
Raymond forked this badminton match-analysis project and wants to be able to read
any file and explain how the pipeline works, then confidently modify and extend it
(add features, swap models, tweak the stats/visualizations). He's comfortable in
Python but has no computer-vision background — the CV concepts are the real gap.

## Success looks like
- Can open any file in `badminton_analysis/` and explain what it does and where it
  sits in the frame → detect → track → draw → output pipeline.
- Understands the core CV concepts this repo relies on: images as arrays, ROI
  cropping, template matching (rally detection), pose keypoints, and the
  pixel→meter court homography.
- Can make a real change — e.g. adjust the rally-detection threshold, add a stat to
  the overlay, or swap a pose model — and predict its effect before running.

## Constraints
- Comfortable in Python already — do NOT teach Python syntax; teach CV + domain.
- Learns best: concept-first, then trace the real repo code, then quizzes for
  retention, then small hands-on tweaks.
- Limited time per session — keep lessons short, one win each.

## Out of scope (for now)
- Training / fine-tuning neural networks from scratch (backprop, loss functions).
- CNN internals / the math inside YOLO and RTMPose — they're treated as black boxes.
- Building a CV project from zero (may revisit once the repo is understood).
