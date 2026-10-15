# Juggling motion references

The first hero starts with Columns. Left/right arrows or horizontal swipes select one pattern at a time. There is no automatic cycling. The selected pattern repeats until another is requested.

A shared motion controller finishes every ball's current flight, catches at the baseline, and changes lanes using a quintic ground-level carry. The latest requested pattern is queued during an existing handoff. Manual ball rotation remains disabled.

## Research

- Columns: https://libraryofjuggling.com/Tricks/3balltricks/Columns.html
- Cascade and Reverse Cascade: https://libraryofjuggling.com/Tricks/3balltricks/ReverseCascade.html
- Shower and mirrored Shower: https://libraryofjuggling.com/Tricks/3balltricks/Shower.html
- Half-Shower and mirrored Half-Shower: https://libraryofjuggling.com/Tricks/3balltricks/Half-Shower.html
- Juggler's Tennis: https://libraryofjuggling.com/Tricks/3balltricks/JugglersTennis.html
- Mills Mess: https://libraryofjuggling.com/Tricks/3balltricks/MillsMess.html
- Windmill: https://libraryofjuggling.com/Tricks/3balltricks/Windmill.html
- Box: https://libraryofjuggling.com/Tricks/3balltricks/Box.html
- High-Low Cascade: https://libraryofjuggling.com/TricksByDifficulty.html

These are ball-only product animations, not instructional demonstrations. Mills Mess and Windmill depend heavily on arm crossings, which are absent in this presentation. Their paths are visual interpretations. Fake Columns and Yo-Yo were researched but excluded because their defining actions require visibly carrying a ball above the baseline. They would contradict this presentation's invisible-hands-at-the-bottom constraint.

Flight arcs use a constant-acceleration parabola through the central part of each throw, with matched catch/release joins. The renderer keeps ball spin continuous and scales depth from the active path. Respect reduced-motion preferences by displaying a stationary selection.

## Validation

From frontend, run `node scripts/verify-juggling.cjs` and `npx tsc --noEmit`.

The motion check covers every pair of pattern selections, rapid input during handoffs, finite bounded paths, shared-frame idempotency, and catches/releases. Visual checks remain necessary for layout and the presentation of individual patterns.
