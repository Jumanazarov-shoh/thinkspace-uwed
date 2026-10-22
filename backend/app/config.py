"""
ThinkSpace | UWED Configuration
Loaded from environment variables with sensible defaults for local development.
"""
from typing import List, Union, Optional
import os

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import field_validator
    IS_V2 = True
except (ImportError, Exception):
    try:
        from pydantic import BaseSettings, validator
        SettingsConfigDict = None
        field_validator = None
        IS_V2 = False
    except Exception:
        from pydantic import BaseModel as BaseSettings
        validator = None
        SettingsConfigDict = None
        field_validator = None
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

    if IS_V2:
        model_config = SettingsConfigDict(env_file=".env", extra="ignore")

        @field_validator("CORS_ORIGINS", mode="before")
        @classmethod
        def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
            if isinstance(v, str):
                return [i.strip() for i in v.split(",") if i.strip()]
            return v
    else:
        class Config:
            env_file = ".env"
            extra = "ignore"

        if 'validator' in globals() and validator is not None:
            @validator("CORS_ORIGINS", pre=True)
            def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
                if isinstance(v, str):
                    return [i.strip() for i in v.split(",") if i.strip()]
                return v

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

# Populate from environment variables if running as plain BaseModel fallback
def _build_settings() -> Settings:
    s = Settings()
    for field_name in s.__fields__ if hasattr(s, '__fields__') else getattr(s, 'model_fields', {}):
        if field_name in os.environ:
            val = os.environ[field_name]
            if field_name == "CORS_ORIGINS" and isinstance(val, str):
                val = [i.strip() for i in val.split(",") if i.strip()]
            elif field_name in ("SUPER_ADMIN_TELEGRAM_ID", "ACCESS_TOKEN_EXPIRE_MINUTES", "MAX_FILE_SIZE_MB"):
                try:
                    val = int(val)
                except ValueError:
                    pass
            setattr(s, field_name, val)
    return s

settings = _build_settings()
