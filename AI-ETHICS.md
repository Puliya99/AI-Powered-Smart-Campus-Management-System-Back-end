### AI Ethics & Data Privacy Guidelines

In the AI-Powered Smart Campus Management System, we prioritize ethical AI and student privacy. Our examination failure risk prediction system is designed with the following principles:

#### 1. No Biometric Storage
While the system monitors for face violations during quizzes (e.g., no face detected, multiple faces), **no raw biometric data or images are stored**. We only store metadata (violation type and timestamp) as signals for the AI model.

#### 2. Interpretability & Explainability (XAI)
Predictions are never "black boxes." For every risk score generated, the system provides:
- **Contributing Factors**: Clear reasons why the student is considered at risk (e.g., low attendance, poor quiz performance).
- **Actionable Recommendations**: Suggestions for improvement, not just a failure warning.

#### 3. Human-in-the-Loop
AI predictions are intended as an **early warning system for lecturers and advisors**, not for automated disciplinary actions. 
- **Human Intervention Required**: Predictions serve as a tool for lecturers to prioritize students who may need extra support.
- **No Automated Punishment**: A high-risk score does not automatically disqualify a student from exams or lead to penalties.

#### 4. Data Minimization & Privacy
- **Access Control**: Risk scores are only visible to authorized personnel (Lecturers and Admins). 
- **Student Dashboard**: Students are shown supportive suggestions and their own performance metrics, rather than raw failure probability scores, to maintain a growth mindset.

#### 5. Fairness & Bias Mitigation
- We regularly retrain models with balanced historical data.
- The use of GPA and previous exam scores helps the model understand long-term performance trends rather than reacting solely to a single poor result.

---
*This document outlines our commitment to the ethical development and deployment of AI in an educational environment.*
