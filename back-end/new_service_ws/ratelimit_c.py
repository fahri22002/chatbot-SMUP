# ratelimit.py
import time
from collections import deque
import os

# Rate-limit config
MAX_MSGS = int(os.getenv("RATE_LIMIT_MAX", "10"))  # default 10
WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # 60 seconds

# store chatId -> deque of timestamps (epoch seconds)
_rate_map: dict[str, deque] = {}

def allow_send(device_token: str) -> bool:
    """
    Return True if allowed, False if rate-limited.
    """
    now = time.time()
    dq = _rate_map.get(device_token)
    if dq is None:
        from collections import deque
        dq = deque()
        _rate_map[device_token] = dq

    # drop old
    while dq and (now - dq[0]) > WINDOW_SECONDS:
        dq.popleft()

    if len(dq) >= MAX_MSGS:
        return False

    dq.append(now)
    return True

def get_remaining(device_token: str) -> int:
    now = time.time()
    dq = _rate_map.get(device_token)
    if dq is None:
        return MAX_MSGS
    while dq and (now - dq[0]) > WINDOW_SECONDS:
        dq.popleft()
    return max(0, MAX_MSGS - len(dq))

def get_retry_after(device_token: str) -> int:
    now = time.time()
    dq = _rate_map.setdefault(device_token, deque())

    # drop expired timestamps
    while dq and now - dq[0] > WINDOW_SECONDS:
        dq.popleft()

    # masih bisa kirim → tidak perlu tunggu
    if len(dq) < MAX_MSGS:
        return 0

    # penuh → hitung sampai entry tertua keluar window
    oldest = dq[0]
    retry_sec = WINDOW_SECONDS - (now - oldest)

    return max(0, int(retry_sec))