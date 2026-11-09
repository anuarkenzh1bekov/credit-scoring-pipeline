from pathlib import Path
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "models" / "model_v1.joblib"

class ScoringModel:
    def __init__(self, path: Path = MODEL_PATH):
        artifact = joblib.load(path)
        self.model = artifact["model"]
        self.threshold = artifact["threshold"]
        self.features = artifact["features"]
        self.version = artifact["version"]
        self.metrics = artifact["metrics"]

    def predict(self, data: dict) -> dict:
        df = pd.DataFrame([data])[self.features].astype(float)
        proba = float(self.model.predict_proba(df)[0, 1])
        return {
            "probability_of_default": round(proba, 4),
            "decision": "reject" if proba >= self.threshold else "approve",
            "threshold": self.threshold,
            "model_version": self.version,
        }