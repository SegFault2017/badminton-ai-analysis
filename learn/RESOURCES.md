# Computer Vision (for Good-Badminton) Resources

## Knowledge

- [OpenCV-Python Tutorials — Core Operations on Images](https://docs.opencv.org/4.x/d3/df2/tutorial_py_basic_ops.html)
  Official docs. Images as numpy arrays, pixel access, ROI slicing, channels.
  Use for: lessons on image fundamentals, cropping, BGR ordering.
- [OpenCV — Changing Colorspaces (cvtColor)](https://docs.opencv.org/4.x/df/d9d/tutorial_py_colorspaces.html)
  Use for: BGR↔grayscale↔HSV conversions (the `is_court_view` grayscale step).
- [OpenCV — Template Matching](https://docs.opencv.org/4.x/d4/dc6/tutorial_py_template_matching.html)
  Use for: understanding `matchTemplate` / rally (court-view) detection.
- [OpenCV — Geometric Transformations (Perspective / Homography)](https://docs.opencv.org/4.x/da/d6e/tutorial_py_geometric_transformations.html)
  Use for: the `CourtMapper` pixel→meter court transform lessons.
- [NumPy — the absolute basics for beginners](https://numpy.org/doc/stable/user/absolute_beginners.html)
  Use for: array shape/indexing intuition underpinning all of the above.
- [COCO keypoint format (17 body keypoints)](https://cocodataset.org/#keypoints-2020)
  Use for: pose-estimation lessons (RTMPose / YOLO-Pose output schema).

## Wisdom (Communities)

- [r/computervision](https://reddit.com/r/computervision)
  Practitioner subreddit. Use for: sanity-checking approaches, model choice questions.
- [OpenCV Forum](https://forum.opencv.org/)
  Moderated, library-specific. Use for: concrete OpenCV API/debug questions.

## Gaps
- No badminton/sports-analytics-specific community vetted yet. Revisit if the
  mission moves toward domain analytics rather than the CV mechanics.
