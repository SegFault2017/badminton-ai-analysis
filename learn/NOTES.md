# Teaching notes & preferences

## Learner preferences
- **Visual learner — every lesson must include diagrams.** Prefer inline SVG
  (renders natively, theme-aware via CSS vars, no dependencies). Good diagram types
  here: pixel-grid / array illustrations, channel-collapse visuals, and
  pipeline/decision flowcharts. Lead concepts with a diagram, then prose.
- Concept-first, then trace the real repo code, then quizzes, then small hands-on tweaks.
- Comfortable in Python — never teach Python syntax; teach CV + the domain.

## Diagram conventions (keep consistent across lessons)
- Wrap each in `<figure class="diagram">…<figcaption>…</figcaption></figure>`.
- Use `style="fill:var(--…)"` with the palette vars (`--accent` red, `--blue`,
  `--good` green, `--surface`, `--rule`, `--muted`, `--ink`) so light/dark both work.
- `viewBox` width ~600 (column is ~42rem); set `svg { max-width:100% }` (in CSS).
- Label shapes explicitly (e.g. `(H, W, 3)`), cite the `system.py` line near it.
