# Guided case designer — local validation

September 8, 2026. Changes are confined to the `enclosure-work` engine and GUI.

| Check                          | Result                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| Engine `npm test`              | 206 passed                                                                                       |
| GUI unit suite                 | 433 passed                                                                                       |
| Full Chromium suite            | 40 passed; one existing GitHub-loading test skipped                                              |
| Production build               | Passed                                                                                           |
| Preview path build             | Passed under `/ergogen-gui-preview/`                                                             |
| Preview browser checks         | Explicit generation, model packaging and offline reload passed                                   |
| Scoped ESLint                  | No errors; three existing unused-variable warnings in ConfigContext tests                        |
| Modified production TypeScript | No errors                                                                                        |
| Whole-project TypeScript       | Existing errors remain in test globals, React DOM declarations, KiCanvas JSX and unrelated files |

Regression coverage includes analysis with no CAD initialization, all four
mounting systems, unavailable placement spans, stable/manual references,
consecutive edits, stale worker success/error responses, worker restart,
explicit generation, export gating, undo and save/reopen. Browser checks cover
help, keyboard access, tooltip clipping, dragging and 3D selection.

Mechanical checks cover both cover constructions, separate M3 clearance and
receiver bores, screw access through the middle frame, connected STEP parts,
PCB tolerances, explicit switch corner relief, and switch openings through the
CNC cover. Gasket contacts must remain covered. Keycap dimensions are visibly
unresolved until measured envelopes are entered.

Board checks cover flipped/rotated footprints, helper points, underside
components, model transforms, missing/ambiguous assets, dependency cycles,
keepouts, nested ZIP model paths, accepted/rejected PCB holes and preservation of board source text.
KiCad 10.0.6 reopened the exported board and an accepted hole proposal. Its 3D
renderer displayed the packaged STL-to-VRML model. Exported case STEP files
were reimported and checked for valid positive-volume geometry.

BHK and the small reference case were inspected in assembled, section,
exploded and individual-part views. Screenshots and exported projects are
available in the ignored `test-results/` directory; the changelog includes the
mounting plan screenshot.

Original STEP assets remain unchanged. Nonuniform scales use a 0.01 mm faceted
assembly reference; board model transforms retain their original precision.
Threads are manufacturing metadata rather than helical STEP geometry.
Physical fit and manufacturing approval require a fabricated prototype and
supplier review. Nothing was published or deployed.

## Follow-up: grouped setup and mounting performance

- Engine: 211 tests passed; build passed.
- GUI: 441 unit tests passed; production build passed.
- New regressions were observed failing for missing dimensions, count placement,
  grouped Review, worker reuse, contour reuse, and clearing the count field.
- A 60-switch local fixture took 3.8 seconds for initial analysis and 1.0 second
  for a cached contact-count edit. Initial contour construction remains expensive.
- Unknown body dimensions remain explicit warnings; physical geometry conflicts
  still block generation. This does not certify unchecked component clearance.
- Automatic model reuse preserves each footprint transform; explicit group
  assignment is separate. Affected findings route to the relevant wizard step.
- Final Chromium suite: 42 passed, one existing GitHub-loading test skipped.
  Includes BHK boundary repair through Review, explicit generation with missing
  dimensions, requested contacts, and model export/reopening.
