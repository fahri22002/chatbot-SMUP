# storage.py
import os
from pathlib import Path
from datetime import datetime

STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "public/upload"))

def ensure_storage():
    STORAGE_PATH.mkdir(parents=True, exist_ok=True)

def save_binary_file(message_id: str, original_filename: str, data: bytes) -> str:
    """
    Save binary to storage folder. Returned filename = <message_id><ext>
    """
    ensure_storage()
    _, ext = os.path.splitext(original_filename)
    ext = ext.lower()
    filename = f"{message_id}{ext}"
    dest = STORAGE_PATH / filename
    with open(dest, "wb") as f:
        f.write(data)
    return filename
