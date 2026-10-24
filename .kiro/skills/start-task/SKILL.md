---
name: start-task
description: Ground yourself before starting a GridWise task. Read the steering files, summarize the constraints, and propose a plan before editing any code.
---
# Start Task

1. Read `.kiro/steering/project.md`, plus `backend/skills.md` and/or `frontend/skills.md` for whichever areas the task touches. If the task belongs to a feature in `.kiro/specs/`, read its `requirements.md`, `design.md` and `tasks.md` too.
2. Summarize:
   - The architecture relevant to this task
   - The files likely to change, and why
   - The rules that apply (especially the single-boundary files `grid_api.py`, `sms.py` and `frontend/src/lib/api.ts`, pure modules, and API shape changes that span both sides)
   - The validation commands you will run
3. Propose a short step-by-step plan. Don't edit any code until the user approves it.
4. Implement one step at a time, keeping each change minimal. For a new feature, add or update its spec in `.kiro/specs/<feature>/` and tick tasks as they're done.
