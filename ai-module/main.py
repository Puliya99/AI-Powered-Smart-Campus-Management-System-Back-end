import os
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import datetime

app = FastAPI(title="Exam Failure Risk Prediction API")

MODEL_DIR = "models"
if not os.path.exists(MODEL_DIR):
    os.makedirs(MODEL_DIR)

DEFAULT_MODEL_PATH = os.path.join(MODEL_DIR, "model_v1.pkl")
METADATA_PATH = os.path.join(MODEL_DIR, "metadata.json")

import json

def save_metadata(metadata):
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f)

def load_metadata():
    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, 'r') as f:
            return json.load(f)
    return {"current_version": "v1", "models": {}}

class StudentData(BaseModel):
    student_id: str
    subject_id: str
    attendance_percentage: Optional[float] = 0
    average_assignment_score: Optional[float] = 0
    quiz_average: Optional[float] = 0
    gpa: Optional[float] = 0
    classes_missed: Optional[int] = 0
    late_submissions: Optional[int] = 0
    quiz_attempts: Optional[int] = 0
    face_violation_count: Optional[int] = 0
    payment_delay_days: Optional[int] = 0
    previous_exam_score: Optional[float] = 0
    exam_result: Optional[int] = None # 1 for FAIL, 0 for PASS

class PredictionResponse(BaseModel):
    student_id: str
    risk_score: float
    risk_level: str
    reasons: List[str]
    version: Optional[str] = None

@app.post("/train")
async def train(data: List[StudentData]):
    if len(data) < 10: # Minimum data to train
        raise HTTPException(status_code=400, detail="Not enough data to train. Need at least 10 records.")
    
    df = pd.DataFrame([d.dict() for d in data])
    
    # Feature Engineering
    df["attendance_risk"] = (df["attendance_percentage"] < 75).astype(int)
    df["low_gpa"] = (df["gpa"] < 2.5).astype(int)
    
    X = df.drop(columns=["student_id", "subject_id", "exam_result"])
    y = df["exam_result"]
    
    if y.isnull().any():
        raise HTTPException(status_code=400, detail="Target variable 'exam_result' is missing in some records.")

    # Split for evaluation
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluation
    accuracy = model.score(X_test, y_test)
    
    metadata = load_metadata()
    version_num = len(metadata["models"]) + 1
    version = f"v{version_num}"
    model_filename = f"model_{version}.pkl"
    model_path = os.path.join(MODEL_DIR, model_filename)
    
    joblib.dump(model, model_path)
    
    metadata["current_version"] = version
    metadata["models"][version] = {
        "path": model_path,
        "trained_at": datetime.datetime.now().isoformat(),
        "accuracy": float(accuracy),
        "records_used": len(data)
    }
    save_metadata(metadata)
    
    return {
        "message": "Model trained successfully", 
        "version": version,
        "accuracy": float(accuracy),
        "records_used": len(data)
    }

@app.post("/predict", response_model=PredictionResponse)
async def predict(data: StudentData):
    metadata = load_metadata()
    current_version = metadata.get("current_version", "v1")
    model_info = metadata.get("models", {}).get(current_version)
    
    if not model_info or not os.path.exists(model_info["path"]):
        # Fallback to simple logic if model doesn't exist
        res = fallback_predict(data)
        res["version"] = "fallback"
        return res
    
    model = joblib.load(model_info["path"])
    
    df = pd.DataFrame([data.dict()])
    df["attendance_risk"] = (df["attendance_percentage"] < 75).astype(int)
    df["low_gpa"] = (df["gpa"] < 2.5).astype(int)
    
    X = df.drop(columns=["student_id", "subject_id", "exam_result"])
    
    risk_score = model.predict_proba(X)[0][1] # Probability of FAIL (class 1)
    
    risk_level = "LOW"
    if risk_score >= 0.7:
        risk_level = "HIGH"
    elif risk_score >= 0.4:
        risk_level = "MEDIUM"
        
    reasons = []
    if data.attendance_percentage < 75:
        reasons.append("Low attendance")
    if data.quiz_average < 50:
        reasons.append("Low quiz performance")
    if data.face_violation_count > 3:
        reasons.append("Multiple face violations")
    if data.average_assignment_score < 50:
        reasons.append("Low assignment scores")
        
    return {
        "student_id": data.student_id,
        "risk_score": float(risk_score),
        "risk_level": risk_level,
        "reasons": reasons,
        "version": current_version
    }

def fallback_predict(data: StudentData):
    # Simple rule-based prediction when no model is trained
    score = 0.0
    reasons = []
    
    if data.attendance_percentage < 75:
        score += 0.4
        reasons.append("Low attendance")
    if data.quiz_average < 50:
        score += 0.2
        reasons.append("Low quiz performance")
    if data.average_assignment_score < 50:
        score += 0.2
        reasons.append("Low assignment scores")
    if data.face_violation_count > 3:
        score += 0.1
        reasons.append("Multiple face violations")
    if data.payment_delay_days > 15:
        score += 0.1
        reasons.append("Payment delays")
        
    score = min(score, 1.0)
    
    risk_level = "LOW"
    if score >= 0.7:
        risk_level = "HIGH"
    elif score >= 0.4:
        risk_level = "MEDIUM"
        
    return {
        "student_id": data.student_id,
        "risk_score": score,
        "risk_level": risk_level,
        "reasons": reasons
    }

if __name__ == "__main__":
    import uvicorn
    import sys
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    uvicorn.run(app, host="0.0.0.0", port=port)
