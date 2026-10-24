# Gridwise-
Carbon-aware scheduler for heavy home appliances in Boston. Uses New England grid carbon intensity data from Electricity Maps to find the cleanest time to run laundry, dishwashers, and electric vehicle charging before your deadline. Built at Hackachusetts

## Layout

    backend/    FastAPI service. Talks to Electricity Maps, picks the best window.
    frontend/   Vite + React UI. Talks only to the backend.

## Running the backend

    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env        # then paste your Electricity Maps key in
    uvicorn main:app --reload   # http://127.0.0.1:8000

Interactive API docs are at http://127.0.0.1:8000/docs once it's running.

## Running the frontend

    cd frontend
    npm install
    npm run dev                 # http://localhost:5173
