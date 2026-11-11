from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from backend.db import Base, engine, get_db
from backend.models import ApplicationRecord
from backend.schemas import Application, ApplicationOut, ScoreResponse
from src.scoring.model import ScoringModel

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Credit Scoring API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = ScoringModel()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/model/info")
def model_info():
    return {"version": model.version, "threshold": model.threshold, "metrics": model.metrics}

@app.post("/score", response_model=ScoreResponse)
def score(application: Application, db: Session = Depends(get_db)):
    result = model.predict(application.to_model_input())

    record = ApplicationRecord(**application.model_dump(), **result)
    db.add(record)
    db.commit()

    return result

@app.get("/applications", response_model=list[ApplicationOut])
def list_applications(limit: int = 50, decision: str | None = None, db: Session = Depends(get_db)):
    query = select(ApplicationRecord).order_by(ApplicationRecord.id.desc()).limit(limit)
    if decision:
        query = query.where(ApplicationRecord.decision == decision)
    return db.scalars(query).all()

@app.get("/applications/{app_id}", response_model=ApplicationOut)
def get_application(app_id: int, db: Session = Depends(get_db)):
    record = db.get(ApplicationRecord, app_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return record