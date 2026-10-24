---
name: start-task
description: Ground yourself before starting a GridWise task. Read the steering files, summarize the constraints, and propose a plan before editing any code.
---
# Start Task

1. Read `.kiro/steering/project.md`, plus `backend.md` and/or `frontend.md` for whichever areas the task touches.
2. Summarize:
   - The architecture relevant to this task
   - The files likely to change, and why
   - The rules that apply (especially the single-boundary files `grid_api.py` and `api.js`, and API shape changes that span both sides)
   - The validation commands you will run
3. Propose a short step-by-step plan. Don't edit any code until the user approves it.
4. Implement one step at a time, keeping each change minimal.
