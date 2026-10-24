---
name: wrap-up
description: End a GridWise task. Run validation, report the results, and propose specific lessons for the steering files.
---
# Wrap Up

1. Run validation for each area you changed: `cd backend && ./venv/bin/python -m pytest` and/or `cd frontend && npx tsc --noEmit -p . && npm run build`. For UI changes, also check light and dark at desktop and 390 px. Report the exact commands and results. If a failure predates your change, say so and leave it alone.
2. Review this session for:
   - Corrections the user gave you
   - Root causes of bugs you fixed
   - Architectural details or edge cases not yet in `.kiro/steering/`
   - Answers to the "Open Questions" in `project.md`
   - Spec tasks in `.kiro/specs/*/tasks.md` that are now done (tick them) or newly discovered (add them)
3. For each item, propose a one-line rule and its destination, using the table in the Learning Loop section of `.kiro/steering/project.md`: global `~/.kiro/steering/AGENTS.md`, `project.md`, `backend/skills.md`, `frontend/skills.md`, a skill, or a lint rule/hook.
4. Apply the edits only after the user approves them. Skip anything generic ("be careful", "write clean code"). If nothing new came up, say so and stop.
