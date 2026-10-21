"""
Authentication service for Telegram Mini App and JWT token generation.
Implements Telegram's official HMAC-SHA256 signature verification algorithm.
"""
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import json
from typing import Optional, Dict, Any
from urllib.parse import parse_qsl, unquote
import jwt
from app.config import settings

def verify_telegram_init_data(init_data_raw: str, max_age_seconds: int = 86400) -> Optional[Dict[str, Any]]:
    """
    Verifies the Telegram WebApp initData string using Telegram's HMAC-SHA256 protocol.
    Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    """
    if not init_data_raw:
        return None

    # Parse query string
    parsed_items = dict(parse_qsl(init_data_raw, keep_blank_values=True))
    received_hash = parsed_items.pop("hash", None)
    if not received_hash:
        return None

    # 1. Sort remaining items alphabetically by key and format as key=<value> separated by \n
    data_check_arr = []
    for k in sorted(parsed_items.keys()):
        data_check_arr.append(f"{k}={parsed_items[k]}")
    data_check_string = "\n".join(data_check_arr)

    # 2. Secret key is HMAC-SHA256 of bot_token using "WebAppData" as key
    secret_key = hmac.new(
        b"WebAppData",
        settings.TELEGRAM_BOT_TOKEN.encode("utf-8"),
        hashlib.sha256
    ).digest()

    # 3. Calculate expected hash
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # In development mode, if a dummy token is configured, allow mock test data
    if settings.ENVIRONMENT == "development" and settings.TELEGRAM_BOT_TOKEN.startswith("dummy_token"):
        # Allow dev test logins while still parsing the user payload
        pass
    else:
        # Constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(calculated_hash, received_hash):
            return None

    # 4. Check auth_date for expiration
    auth_date_str = parsed_items.get("auth_date")
    if auth_date_str:
        try:
            auth_timestamp = int(auth_date_str)
            now_timestamp = int(datetime.now(timezone.utc).timestamp())
            if now_timestamp - auth_timestamp > max_age_seconds:
                return None  # Expired authentication payload
        except (ValueError, TypeError):
            return None

    # Parse user object if present
    user_str = parsed_items.get("user")
    user_data = None
    if user_str:
        try:
            user_data = json.loads(user_str)
        except json.JSONDecodeError:
            pass

    return {
        "raw": parsed_items,
        "user": user_data,
        "auth_date": parsed_items.get("auth_date"),
    }

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token for session persistence."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None
