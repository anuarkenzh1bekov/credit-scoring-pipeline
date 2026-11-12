from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from backend.db import Base, engine, get_db
from backend.models import ApplicationRecord
from backend.schemas import Application, ApplicationOut, ScoreResponse, DailyStats, StatsOut
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

@app.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    is_approved = case((ApplicationRecord.decision == "approve", 1), else_=0)

    total, approved, avg_prob = db.execute(
        select(
            func.count(ApplicationRecord.id),
            func.coalesce(func.sum(is_approved), 0),
            func.avg(ApplicationRecord.probability_of_default),
        )
    ).one()

    day = func.date(ApplicationRecord.created_at)
    rows = db.execute(
        select(day, func.count(ApplicationRecord.id), func.sum(is_approved))
        .group_by(day)
        .order_by(day)
    ).all()

    daily = [
        DailyStats(day=d, total=t, approved=a, approval_rate=round(a / t, 3))
        for d, t, a in rows
    ]

    return StatsOut(
        total=total,
        approved=approved,
        rejected=total - approved,
        approval_rate=round(approved / total, 3) if total else 0.0,
        avg_probability=round(avg_prob, 4) if avg_prob is not None else None,
        model_version=model.version,
        threshold=model.threshold,
        daily=daily,
    )