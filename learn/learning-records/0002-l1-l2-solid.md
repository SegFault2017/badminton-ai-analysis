# Solid grasp of image fundamentals and template-matching/rally detection

Drill evidence: Lesson 1 (images as arrays) 83% (5/6), Lesson 2 (template matching
→ rally detection) 100% (6/6). Treat these as mastered floors:
- Images are numpy arrays `(H,W,3)`; grayscale `(H,W)`; ROI = slicing; BGR order.
- `matchTemplate` as a whole-frame similarity score; the 0.75 court-view gate;
  the 5-frame debounce state machine that defines rallies.

Implication: can build on "frames in → coordinates out" and the rally concept
directly. From Lesson 3 onward, lean on these without re-explaining. Next gaps:
detection vs pose distinction, multi-object tracking/assignment, and homography.
