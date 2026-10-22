"""
Authentication service for Telegram Mini App and JWT token generation.
Implements Telegram's official HMAC-SHA256 signature verification algorithm.
"""
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import json
from typing import Optional, Dict, Any, Tuple
from urllib.parse import parse_qsl
import jwt
from app.config import settings

def verify_telegram_init_data(
    init_data_raw: str,
    bot_token: Optional[str] = None,
    max_age_seconds: int = 86400
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Verifies the Telegram WebApp initData string using Telegram's official HMAC-SHA256 protocol.
    Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app

    Returns:
        (result_dict, None) on success
        (None, error_reason) on failure
    """
    if not init_data_raw or not init_data_raw.strip():
        return None, "initData missing: Mini App was opened outside Telegram or initData payload is empty"

    token = bot_token or settings.TELEGRAM_BOT_TOKEN
    if not token or token.startswith("dummy_"):
        return None, "bot token missing: TELEGRAM_BOT_TOKEN is not configured with a live token on the backend server"

    # Parse query string
    try:
        parsed_items = dict(parse_qsl(init_data_raw, keep_blank_values=True))
    except Exception as e:
        return None, f"malformed initData: failed to parse query string ({e})"

    received_hash = parsed_items.pop("hash", None)
    if not received_hash:
        return None, "initData hash missing: 'hash' signature parameter was not found in initData"

    # 1. Sort remaining items alphabetically by key and format as key=<value> separated by \n
    data_check_arr = []
    for k in sorted(parsed_items.keys()):
        data_check_arr.append(f"{k}={parsed_items[k]}")
    data_check_string = "\n".join(data_check_arr)

    # 2. Secret key is HMAC-SHA256 of bot_token using "WebAppData" as key
    secret_key = hmac.new(
        b"WebAppData",
        token.encode("utf-8"),
        hashlib.sha256
    ).digest()

    # 3. Calculate expected hash
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # Constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(calculated_hash, received_hash):
        return None, "initData hash invalid: Telegram HMAC-SHA256 signature mismatch (verify TELEGRAM_BOT_TOKEN matches the bot that launched the Mini App)"

    # 4. Check auth_date for expiration
    auth_date_str = parsed_items.get("auth_date")
    if not auth_date_str:
        return None, "auth_date missing: 'auth_date' timestamp was not found in initData"

    try:
        auth_timestamp = int(auth_date_str)
        now_timestamp = int(datetime.now(timezone.utc).timestamp())
        # Check if auth_date is older than max_age_seconds
        if now_timestamp - auth_timestamp > max_age_seconds:
            return None, f"auth_date expired: session was created {now_timestamp - auth_timestamp}s ago (limit is {max_age_seconds}s)"
        # Check if auth_date is suspiciously in the far future
        if auth_timestamp - now_timestamp > 300:
            return None, "auth_date invalid: timestamp is in the future"
    except (ValueError, TypeError):
        return None, "auth_date malformed: unable to parse integer timestamp"

    # Parse user object if present
    user_str = parsed_items.get("user")
    if not user_str:
        return None, "user data missing: 'user' field was not found in initData"

    try:
        user_data = json.loads(user_str)
    except json.JSONDecodeError:
        return None, "user data malformed: 'user' field is not valid JSON"

    if not isinstance(user_data, dict) or "id" not in user_data:
        return None, "user id missing: 'user' JSON object does not contain required 'id' attribute"

    return {
        "raw": parsed_items,
        "user": user_data,
        "auth_date": auth_timestamp,
    }, None

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
