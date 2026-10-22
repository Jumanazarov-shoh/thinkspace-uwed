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
    if settings.is_sqlite:
        with engine.connect() as conn:
            try:
                res_u = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
                user_cols = [r[1] for r in res_u]
                if "last_activity_at" not in user_cols:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN last_activity_at DATETIME")
                    conn.commit()

                res_a = conn.exec_driver_sql("PRAGMA table_info(assignments)").fetchall()
                assign_cols = [r[1] for r in res_a]
                if "difficulty" not in assign_cols:
                    conn.exec_driver_sql("ALTER TABLE assignments ADD COLUMN difficulty VARCHAR(30) DEFAULT 'intermediate'")
                    conn.commit()
                if "attachment_url" not in assign_cols:
                    conn.exec_driver_sql("ALTER TABLE assignments ADD COLUMN attachment_url VARCHAR(500)")
                    conn.commit()

                res_s = conn.exec_driver_sql("PRAGMA table_info(submissions)").fetchall()
                sub_cols = [r[1] for r in res_s]
                if "is_late" not in sub_cols:
                    conn.exec_driver_sql("ALTER TABLE submissions ADD COLUMN is_late BOOLEAN NOT NULL DEFAULT 0")
                    conn.commit()
                if "submitted_at" not in sub_cols:
                    conn.exec_driver_sql("ALTER TABLE submissions ADD COLUMN submitted_at DATETIME")
                    conn.commit()
                if "review_status" not in sub_cols:
                    conn.exec_driver_sql("ALTER TABLE submissions ADD COLUMN review_status VARCHAR(35) NOT NULL DEFAULT 'awaiting_evaluation'")
                    conn.commit()

                res_e = conn.exec_driver_sql("PRAGMA table_info(evaluations)").fetchall()
                eval_cols = [r[1] for r in res_e]
                if "internal_notes" not in eval_cols:
                    conn.exec_driver_sql("ALTER TABLE evaluations ADD COLUMN internal_notes TEXT")
                    conn.commit()

                res_rc = conn.exec_driver_sql("PRAGMA table_info(rubric_criteria)").fetchall()
                rc_cols = [r[1] for r in res_rc]
                if "guidance" not in rc_cols:
                    conn.exec_driver_sql("ALTER TABLE rubric_criteria ADD COLUMN guidance TEXT")
                    conn.commit()
            except Exception:
                pass
