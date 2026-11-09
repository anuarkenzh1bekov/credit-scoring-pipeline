from fastapi import FastAPI

from backend.schemas import Application, ScoreResponse
from src.scoring.model import ScoringModel

app = FastAPI(title="Credit Scoring API")
model = ScoringModel()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/model/info")
def model_info():
    return {"version": model.version, "threshold": model.threshold, "metrics": model.metrics}

@app.post("/score", response_model=ScoreResponse)
def score(application: Application):
    return model.predict(application.to_model_input())