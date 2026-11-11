import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://scoring:scoring@127.0.0.1:55433/scoring",
)

engine = create_engine(DATABASE_URL)
SessinLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessinLocal()
    try:
        yield db
    finally:
        db.close()
