import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "cincontra.db")
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("CINCONTRA_DATABASE_URL")
    or f"sqlite:///{DEFAULT_DB_PATH}"
)

if DATABASE_URL.startswith("sqlite:///"):
    db_file_path = DATABASE_URL[len("sqlite:///"):]
    if db_file_path and db_file_path != ":memory:":
        db_dir = os.path.dirname(db_file_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
