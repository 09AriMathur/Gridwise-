---
name: wrap-up
description: End a GridWise task. Run validation, report the results, and propose specific lessons for the steering files.
---
# Wrap Up

1. Run validation for each area you changed: `cd backend && pytest` and/or `cd frontend && npm run build`. Report the exact commands and results. If a failure predates your change, say so and leave it alone.
2. Review this session for:
   - Corrections the user gave you
   - Root causes of bugs you fixed
   - Architectural details or edge cases not yet in `.kiro/steering/`
   - Answers to the "Open Questions" in `project.md`
3. For each item, propose the exact text and the target file:
   - A whole-project lesson goes to `.kiro/steering/project.md` (Recent Lessons, or the section it belongs in)
   - A backend-only or frontend-only lesson goes to `backend.md` or `frontend.md`
4. Apply the edits only after the user approves them. Skip anything generic ("be careful", "write clean code"). If nothing new came up, say so and stop.
