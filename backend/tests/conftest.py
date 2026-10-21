"""
Pytest fixtures and test environment setup.
Uses an isolated in-memory SQLite database for fast, reliable unit & integration tests.
"""
import pytest
from typing import Generator
from starlette.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole, UserStatus, RoleEnum
from app.services.auth_service import create_access_token

from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False
)

TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)

@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def super_admin_user(db_session: Session) -> User:
    user = User(
        telegram_id=999999,
        username="superadmin",
        first_name="Super",
        last_name="Admin",
        display_name="Super Admin",
        status=UserStatus.APPROVED.value,
        preferred_language="uz"
    )
    db_session.add(user)
    db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_name=RoleEnum.SUPER_ADMIN.value))
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def super_admin_token(super_admin_user: User) -> str:
    return create_access_token(data={"sub": str(super_admin_user.id), "tg_id": super_admin_user.telegram_id})

@pytest.fixture
def moderator_user(db_session: Session) -> User:
    user = User(
        telegram_id=888888,
        username="moderator",
        first_name="Mod",
        last_name="User",
        display_name="Mod User",
        status=UserStatus.APPROVED.value,
        preferred_language="uz"
    )
    db_session.add(user)
    db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_name=RoleEnum.MODERATOR.value))
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def moderator_token(moderator_user: User) -> str:
    return create_access_token(data={"sub": str(moderator_user.id), "tg_id": moderator_user.telegram_id})

@pytest.fixture
def evaluator_user(db_session: Session) -> User:
    user = User(
        telegram_id=777777,
        username="evaluator1",
        first_name="Eval",
        last_name="One",
        display_name="Evaluator One",
        status=UserStatus.APPROVED.value,
        preferred_language="uz"
    )
    db_session.add(user)
    db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_name=RoleEnum.EVALUATOR.value))
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def evaluator_token(evaluator_user: User) -> str:
    return create_access_token(data={"sub": str(evaluator_user.id), "tg_id": evaluator_user.telegram_id})

@pytest.fixture
def member_user(db_session: Session) -> User:
    user = User(
        telegram_id=111111,
        username="member1",
        first_name="Aziz",
        last_name="Rahimov",
        display_name="Aziz Rahimov",
        status=UserStatus.APPROVED.value,
        preferred_language="uz"
    )
    db_session.add(user)
    db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_name=RoleEnum.MEMBER.value))
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def member_token(member_user: User) -> str:
    return create_access_token(data={"sub": str(member_user.id), "tg_id": member_user.telegram_id})
