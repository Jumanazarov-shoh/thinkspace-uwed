"""
ThinkSpace | UWED Configuration
Loaded from environment variables with sensible defaults for local development.
"""
from typing import List, Union, Optional
import os
try:
    from pydantic_settings import BaseSettings
    from pydantic import field_validator as validator_decorator
    IS_V2 = True
except ImportError:
    from pydantic import BaseSettings, validator as validator_decorator
    IS_V2 = False

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    APP_NAME: str = "ThinkSpace | UWED"
    
    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = "dummy_token_for_local_testing"
    MINI_APP_URL: str = "http://localhost:5173"
    SUPER_ADMIN_TELEGRAM_ID: int = 0
    
    # Security
    SECRET_KEY: str = "thinkspace-insecure-dev-secret-key-32chars-min-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALGORITHM: str = "HS256"
    
    # Database
    DATABASE_URL: str = "sqlite:///./thinkspace.db"
    
    # Storage & Uploads
    STORAGE_BACKEND: str = "local"  # "local" or "supabase"
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: List[str] = [
        "pdf", "docx", "xlsx", "pptx", "txt", "doc", "md",
        "png", "jpg", "jpeg", "webp"
    ]
    
    # Supabase (Production)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "submissions"
    
    # CORS
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    
    # Internationalization
    DEFAULT_LANGUAGE: str = "uz"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @validator_decorator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

settings = Settings()
