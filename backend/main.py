"""Creates the app, adds CORS, includes routes."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes import router

app = FastAPI(title="GridWise", version="0.1.0")

# The frontend runs on a different port, so the browser treats it as a
# different origin and blocks the request unless we allow it here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
