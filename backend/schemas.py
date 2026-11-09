from pydantic import BaseModel, Field

class Application(BaseModel):
    revolving_utilization: float = Field(ge=0)
    age: int = Field(ge=18, le=120)
    late_30_59: float = Field(ge=0)
    debt_ratio: float = Field(ge=0)
    monthly_income: float | None = Field(default=None, ge=0)
    open_credit_lines: int = Field(ge=0)
    late_90: int = Field(ge=0)
    real_estate_loans: int = Field(ge=0)
    late_60_89: int = Field(ge=0)
    dependents: int | None = Field(default=None, ge=0)

    def to_model_input(self) -> dict:
        return {
            "RevolvingUtilizationOfUnsecuredLines": self.revolving_utilization,
            "age": self.age,
            "NumberOfTime30-59DaysPastDueNotWorse": self.late_30_59,
            "DebtRatio": self.debt_ratio,
            "MonthlyIncome": self.monthly_income,
            "NumberOfOpenCreditLinesAndLoans": self.open_credit_lines,
            "NumberOfTimes90DaysLate": self.late_90,
            "NumberRealEstateLoansOrLines": self.real_estate_loans,
            "NumberOfTime60-89DaysPastDueNotWorse": self.late_60_89,
            "NumberOfDependents": self.dependents,
        }

class ScoreResponse(BaseModel):
    probability_of_default: float
    decision: str
    threshold: float
    model_version: str
