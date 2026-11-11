from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


class ApplicationRecord(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    source: Mapped[str] = mapped_column(String(20), default="web")

    # анкета
    revolving_utilization: Mapped[float] = mapped_column(Float)
    age: Mapped[int] = mapped_column(Integer)
    late_30_59: Mapped[int] = mapped_column(Integer)
    debt_ratio: Mapped[float] = mapped_column(Float)
    monthly_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    open_credit_lines: Mapped[int] = mapped_column(Integer)
    late_90: Mapped[int] = mapped_column(Integer)
    real_estate_loans: Mapped[int] = mapped_column(Integer)
    late_60_89: Mapped[int] = mapped_column(Integer)
    dependents: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # результат
    probability_of_default: Mapped[float] = mapped_column(Float)
    decision: Mapped[str] = mapped_column(String(10))
    threshold: Mapped[float] = mapped_column(Float)
    model_version: Mapped[str] = mapped_column(String(20))