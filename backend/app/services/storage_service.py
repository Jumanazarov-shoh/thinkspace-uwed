"""
Centralized Storage Service for ThinkSpace | UWED.
Provides an abstract storage interface supporting Local File Storage (development)
and ready for Supabase Storage (production).
"""
import abc
import os
import re
import uuid
from typing import Optional, Tuple
from fastapi import HTTPException
from app.config import settings

def sanitize_filename(filename: str) -> str:
    """
    Sanitize uploaded filename to prevent directory traversal and filesystem attacks.
    """
    if not filename:
        return "unnamed_file"
    # Strip path separators and null bytes
    cleaned = filename.replace("/", "_").replace("\\", "_").replace("\x00", "")
    # Remove leading dots to prevent hidden or dot-dot files
    cleaned = re.sub(r"^\.+", "", cleaned)
    # Remove dangerous characters
    cleaned = re.sub(r"[^\w.\-_ ]", "_", cleaned).strip()
    return cleaned or "attachment"

class StorageProvider(abc.ABC):
    @abc.abstractmethod
    async def save_file(
        self,
        content: bytes,
        original_filename: str,
        mime_type: str
    ) -> Tuple[str, int]:
        """
        Saves file bytes and returns (storage_path, file_size_bytes).
        """
        pass

    @abc.abstractmethod
    def get_file_path(self, storage_path: str) -> Optional[str]:
        """
        Returns full local filesystem path or URL for downloading.
        """
        pass

    @abc.abstractmethod
    def delete_file(self, storage_path: str) -> bool:
        """
        Deletes the file from storage.
        """
        pass

class LocalStorageProvider(StorageProvider):
    def __init__(self, upload_dir: Optional[str] = None, max_size_mb: Optional[int] = None):
        self.upload_dir = upload_dir or settings.UPLOAD_DIR
        self.max_size_bytes = (max_size_mb or settings.MAX_FILE_SIZE_MB) * 1024 * 1024
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_file(
        self,
        content: bytes,
        original_filename: str,
        mime_type: str
    ) -> Tuple[str, int]:
        size_bytes = len(content)
        if size_bytes > self.max_size_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"Fayl hajmi ruxsat etilgan {settings.MAX_FILE_SIZE_MB}MB dan oshib ketdi."
            )

        clean_name = sanitize_filename(original_filename)
        ext = clean_name.split(".")[-1].lower() if "." in clean_name else ""
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Fayl formati ruxsat etilmagan: .{ext}. Ruxsat etilgan turlar: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )

        unique_filename = f"{uuid.uuid4().hex}_{clean_name}"
        # Normalize and ensure path stays inside upload_dir
        dest_path = os.path.abspath(os.path.join(self.upload_dir, unique_filename))
        upload_root = os.path.abspath(self.upload_dir)
        if not dest_path.startswith(upload_root):
            raise HTTPException(status_code=400, detail="Xavfli fayl yo'li aniqlandi (Path traversal blocked).")

        with open(dest_path, "wb") as f:
            f.write(content)

        return unique_filename, size_bytes

    def get_file_path(self, storage_path: str) -> Optional[str]:
        # Strip any directories from storage_path to avoid path escape
        basename = os.path.basename(storage_path)
        full_path = os.path.abspath(os.path.join(self.upload_dir, basename))
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return full_path
        return None

    def delete_file(self, storage_path: str) -> bool:
        path = self.get_file_path(storage_path)
        if path and os.path.exists(path):
            try:
                os.remove(path)
                return True
            except OSError:
                return False
        return False

class SupabaseStorageProvider(StorageProvider):
    """
    Production-ready provider for Supabase Storage.
    Configured via SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
    Ensures private storage with signed download URLs or authenticated streaming.
    """
    def __init__(self, supabase_url: str = "", service_key: str = "", bucket: str = "submissions"):
        self.supabase_url = (supabase_url or "").rstrip("/")
        self.service_key = service_key or ""
        self.bucket = bucket or "submissions"

    async def save_file(
        self,
        content: bytes,
        original_filename: str,
        mime_type: str
    ) -> Tuple[str, int]:
        import httpx
        clean_name = sanitize_filename(original_filename)
        unique_name = f"{uuid.uuid4().hex}_{clean_name}"
        storage_path = f"{self.bucket}/{unique_name}"

        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{unique_name}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apiKey": self.service_key,
            "Content-Type": mime_type or "application/octet-stream"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, content=content, headers=headers)
            if resp.status_code not in (200, 201):
                raise HTTPException(
                    status_code=502,
                    detail=f"Faylni Supabase Storage ga yuklashda xatolik: {resp.text}"
                )

        return storage_path, len(content)

    def get_file_path(self, storage_path: str) -> Optional[str]:
        """
        Generates a secure signed URL for private bucket access (valid for 1 hour).
        """
        import httpx
        # storage_path format: 'submissions/uuid_filename' or just 'uuid_filename'
        object_key = storage_path.replace(f"{self.bucket}/", "")
        url = f"{self.supabase_url}/storage/v1/object/sign/{self.bucket}/{object_key}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apiKey": self.service_key,
            "Content-Type": "application/json"
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json={"expiresIn": 3600}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    signed_url_path = data.get("signedURL") or data.get("signedUrl")
                    if signed_url_path:
                        if signed_url_path.startswith("http"):
                            return signed_url_path
                        return f"{self.supabase_url}{signed_url_path}"
        except Exception:
            pass

        return f"{self.supabase_url}/storage/v1/object/{self.bucket}/{object_key}"

    def delete_file(self, storage_path: str) -> bool:
        import httpx
        object_key = storage_path.replace(f"{self.bucket}/", "")
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket}/{object_key}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apiKey": self.service_key
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.delete(url, headers=headers)
                return resp.status_code in (200, 204)
        except Exception:
            return False

_storage_instance: Optional[StorageProvider] = None

def get_storage_provider() -> StorageProvider:
    global _storage_instance
    if _storage_instance is None:
        if getattr(settings, "STORAGE_BACKEND", "local") == "supabase" and getattr(settings, "SUPABASE_URL", None) and getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None):
            _storage_instance = SupabaseStorageProvider(
                supabase_url=settings.SUPABASE_URL,
                service_key=settings.SUPABASE_SERVICE_ROLE_KEY,
                bucket=getattr(settings, "SUPABASE_STORAGE_BUCKET", "submissions")
            )
        else:
            _storage_instance = LocalStorageProvider()
    return _storage_instance
