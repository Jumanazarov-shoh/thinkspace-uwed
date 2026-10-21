"""
Database setup for ThinkSpace | UWED.
SQLAlchemy 2.0 Engine supporting PostgreSQL and SQLite.
Uses thread-safe sessionmaker compatible with FastAPI threadpools without C-extension (greenlet) bottlenecks.
"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine_kwargs = {
    "echo": False,
}

if settings.is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

def get_db() -> Generator:
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

def create_tables() -> None:
    """Create all tables if they do not exist."""
    Base.metadata.create_all(bind=engine)
