# server.py
import os
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Dict
from dotenv import load_dotenv
load_dotenv()

import websockets
from websockets.server import WebSocketServerProtocol
from bson import ObjectId

from db import chats_col, messages_col, device_tokens_col
from model import make_chat_doc, make_message_doc, str_to_oid
from storage import save_binary_file, ensure_storage
from ratelimit_c import allow_send, get_remaining, get_retry_after

# ENV
WS_HOST = os.getenv("WS_HOST", "0.0.0.0")
WS_PORT = int(os.getenv("WS_PORT", "8765"))
CHAT_TIMEOUT_MS = int(os.getenv("CHAT_TIMEOUT_MS", str(5 * 60 * 1000)))  # default 5 minutes
MAX_ATTACHMENT_SIZE = int(os.getenv("MAX_ATTACHMENT_SIZE", str(10 * 1024 * 1024)))  # 10MB
ALLOWED_MIMES = {"image/png", "image/jpeg", "image/jpg", "application/pdf"}
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".pdf"}
BASE_FILE_URL = os.getenv("BASE_FILE_URL", "")

# RAG
import rag.rag as rag
import rag.ocr as ocr

# In-memory maps
active_websockets: Dict[str, WebSocketServerProtocol] = {}  # chatId -> websocket
last_connected: Dict[str, int] = {}  # chatId -> last_connected_ms

def now_ms() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp() * 1000)

async def mark_chat_nonactive(chat_oid):
    await chats_col.update_one({"_id": chat_oid}, {"$set": {"status": "NONACTIVE", "updatedAt": datetime.utcnow()}})
    print(f"[monitor] chat {chat_oid} set to NONACTIVE")

async def monitor_inactive_chats():
    while True:
        try:
            now = now_ms()
            timeout = CHAT_TIMEOUT_MS
            to_mark = []
            for cid_str, last in list(last_connected.items()):
                if (now - last) > timeout:
                    to_mark.append(cid_str)
            for cid_str in to_mark:
                oid = str_to_oid(cid_str)
                if oid is None:
                    last_connected.pop(cid_str, None)
                    active_websockets.pop(cid_str, None)
                    continue
                ws = active_websockets.get(cid_str)
                if ws is None or ws.closed:
                    await mark_chat_nonactive(oid)
                    last_connected.pop(cid_str, None)
                    active_websockets.pop(cid_str, None)
            await asyncio.sleep( (timeout / 1000) / 2 )
        except Exception as e:
            print("monitor error:", e)
            await asyncio.sleep(1)

# Utilities
def gen_chat_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex  # long random token

def is_allowed_file(filename: str, mimetype: str | None, declared_size: int | None, actual_size: int) -> (bool, str):
    _, ext = os.path.splitext(filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_EXT:
        return False, f"extension {ext} not allowed"
    if mimetype:
        mt = mimetype.lower()
        if mt not in ALLOWED_MIMES:
            return False, f"mimetype {mimetype} not allowed"
    if declared_size is not None and declared_size > MAX_ATTACHMENT_SIZE:
        return False, f"declared filesize {declared_size} exceeds limit {MAX_ATTACHMENT_SIZE}"
    if actual_size > MAX_ATTACHMENT_SIZE:
        return False, f"actual filesize {actual_size} exceeds limit {MAX_ATTACHMENT_SIZE}"
    return True, ""

async def validate_device_token(chat_oid, device_token: str) -> bool:
    chat = await chats_col.find_one({"_id": chat_oid})
    if not chat:
        return False
    stored = chat.get("deviceToken")
    return stored == device_token


async def handler(ws: WebSocketServerProtocol, path):
    client = ws.remote_address
    print(f"[connect] from {client}")
    try:
        async for raw in ws:
            if isinstance(raw, bytes):
                # unexpected bytes frame (we expect binary only after server prompts)
                await ws.send(json.dumps({"status":"error","message":"Unexpected binary frame. Send header first."}))
                continue

            try:
                data = json.loads(raw)
            except Exception:
                await ws.send(json.dumps({"status":"error","message":"Invalid JSON"}))
                continue

            action = data.get("action")
            # update last_connected if chatId provided
            chat_id = data.get("chatId")
            if chat_id:
                last_connected[chat_id] = now_ms()
                active_websockets[chat_id] = ws
            # REGISTER DEVICE (1 device = 1 token)
            if action == "register_device":
                device_token = uuid.uuid4().hex + uuid.uuid4().hex
                await device_tokens_col.insert_one({
                    "deviceToken": device_token,
                    "lastChatId": None,
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                })
                await ws.send(json.dumps({
                    "status": "ok",
                    "action": "register_device",
                    "deviceToken": device_token
                }))
                continue

            # CREATE CHAT (Device Token Mode)
            elif action == "create_chat":
                device_token = data.get("deviceToken")
                if not device_token:
                    await ws.send(json.dumps({"status":"error","message":"deviceToken required"}))
                    continue

                device_doc = await device_tokens_col.find_one({"deviceToken": device_token})
                if not device_doc:
                    await ws.send(json.dumps({"status":"error","message":"invalid deviceToken"}))
                    continue

                # NON-AKTIFKAN CHAT LAMA JIKA ADA
                old_chat_id = device_doc.get("lastChatId")
                if old_chat_id:
                    await chats_col.update_one(
                        {"_id": str_to_oid(old_chat_id)},
                        {"$set": {"status": "NONACTIVE"}}
                    )

                # BUAT CHAT BARU
                chat_doc = make_chat_doc(device_token=device_token, status="ACTIVE")
                res = await chats_col.insert_one(chat_doc)
                chat_id_str = str(res.inserted_id)

                # UPDATE DEVICE -> LAST CHAT
                await device_tokens_col.update_one(
                    {"deviceToken": device_token},
                    {"$set": {"lastChatId": chat_id_str}}
                )

                await ws.send(json.dumps({
                    "status": "ok",
                    "action": "create_chat",
                    "chatId": chat_id_str,
                    "deviceToken": device_token
                }))


            # SEND MESSAGE (no attachment)
            elif action == "send_message":

                # DEVICE TOKEN VALIDATION
                device_token = data.get("deviceToken")
                device_doc = await device_tokens_col.find_one({"deviceToken": device_token})
                if not device_doc:
                    await ws.send(json.dumps({"status":"error","message":"invalid deviceToken"}))
                    continue

                # DEVICE MUST BE BOUND TO THIS CHAT
                if device_doc.get("lastChatId") != chat_id:
                    await ws.send(json.dumps({
                        "status": "error",
                        "message": "chat_not_bound_to_device",
                        "refresh": True
                    }))
                    continue

                # CHECK TOKEN & CHAT EXISTENCE
                chat_oid = str_to_oid(chat_id)
                if chat_oid is None:
                    await ws.send(json.dumps({"status":"error","message":"invalid chatId"}))
                    continue

                chat_doc = await chats_col.find_one({"_id": chat_oid})
                if not chat_doc:
                    await ws.send(json.dumps({"status":"error","message":"invalid chatId"}))
                    continue


                # NONACTIVE CHECK
                if chat_doc.get("status") == "NONACTIVE":
                    await ws.send(json.dumps({
                        "status": "error",
                        "message": "chat_nonactive",
                        "refresh": True
                    }))
                    continue

                # RATE LIMIT
                if not allow_send(device_token):
                    remaining = get_remaining(device_token)
                    await ws.send(json.dumps({"status":"error","message":"rate_limit_exceeded","remaining":remaining, "time_retry":get_retry_after(device_token)}))
                    continue

                msg_text = data.get("msg", "")

                # INSERT MESSAGE
                msg_doc = make_message_doc(chat_oid, msg_text, None, sender="USER")
                r = await messages_col.insert_one(msg_doc)
                message_oid = r.inserted_id

                # RAG REPLY
                
                msg_history = await messages_col.find({"chatId": chat_oid}).sort("createdAt", 1).to_list(None)
                reply_text = rag.mainrag(msg_history,msg_text)
                reply = make_message_doc(chat_oid, reply_text, None, sender="SELF")
                await messages_col.insert_one(reply)

                await ws.send(json.dumps({
                    "status": "ok",
                    "action": "send_message",
                    "messageId": str(message_oid),
                    "reply": reply_text
                }))

                print(f"[message] saved {message_oid} for chat {chat_id}")

            # SEND MESSAGE WITH ATTACHMENT (single binary expected after header)
            elif action == "send_message_with_attachment":


                # DEVICE TOKEN VALIDATION
                device_token = data.get("deviceToken")
                device_doc = await device_tokens_col.find_one({"deviceToken": device_token})
                if not device_doc:
                    await ws.send(json.dumps({"status":"error","message":"invalid deviceToken"}))
                    continue

                # DEVICE MUST BE BOUND TO THIS CHAT
                if device_doc.get("lastChatId") != chat_id:
                    await ws.send(json.dumps({
                        "status": "error",
                        "message": "chat_not_bound_to_device",
                        "refresh": True
                    }))
                    continue

                chat_oid = str_to_oid(chat_id)
                if chat_oid is None:
                    await ws.send(json.dumps({"status":"error","message":"invalid chatId"}))
                    continue

                chat_doc = await chats_col.find_one({"_id": chat_oid})
                if not chat_doc:
                    await ws.send(json.dumps({"status":"error","message":"invalid chatId"}))
                    continue

                # NONACTIVE CHECK
                if chat_doc.get("status") == "NONACTIVE":
                    await ws.send(json.dumps({
                        "status": "error",
                        "message": "chat_nonactive",
                        "refresh": True
                    }))
                    continue

                # RATE LIMIT
                if not allow_send(device_token):
                    remaining = get_remaining(device_token)
                    await ws.send(json.dumps({"status":"error","message":"rate_limit_exceeded","remaining":remaining, "time_retry":get_retry_after(device_token)}))
                    continue

                filename = data.get("filename")
                declared_size = data.get("filesize")
                mimetype = data.get("mimetype")
                msg_text = data.get("msg", "")

                # placeholder message
                placeholder = make_message_doc(chat_oid, msg_text, None, sender="USER")
                r = await messages_col.insert_one(placeholder)
                message_oid = r.inserted_id
                message_id_str = str(message_oid)

                # request binary
                await ws.send(json.dumps({
                    "status": "ok",
                    "action": "ready_for_binary",
                    "messageId": message_id_str
                }))

                # receive binary
                try:
                    binary_frame = await asyncio.wait_for(ws.recv(), timeout=30)
                except asyncio.TimeoutError:
                    await ws.send(json.dumps({"status":"error","message":"timeout waiting for binary"}))
                    continue

                if not isinstance(binary_frame, (bytes, bytearray)):
                    await ws.send(json.dumps({"status":"error","message":"expected binary frame"}))
                    continue

                actual_size = len(binary_frame)
                allowed, reason = is_allowed_file(filename, mimetype, declared_size, actual_size)
                if not allowed:
                    await messages_col.update_one(
                        {"_id": message_oid},
                        {"$set": {"attachment": None, "updatedAt": datetime.utcnow()}}
                    )
                    await ws.send(json.dumps({"status":"error","message":"file_rejected","reason":reason}))
                    continue

                # save file
                saved_name = save_binary_file(message_id_str, filename, binary_frame)

                file_url = f"{BASE_FILE_URL}/public/upload/{saved_name}" if BASE_FILE_URL else f"/public/upload/{saved_name}"

                await messages_col.update_one(
                    {"_id": message_oid},
                    {"$set": {"attachment": file_url, "updatedAt": datetime.utcnow()}}
                )

                # RAG reply
                ocr_msg_text = ocr.ocr_file(os.path.join(os.getenv("STORAGE_PATH", "public/upload"), saved_name))
                msg_history = await messages_col.find({"chatId": chat_oid}).sort("createdAt", 1).to_list(None)
                reply_text = rag.mainragocr(msg_history, msg_text, ocr_msg_text)
                reply = make_message_doc(chat_oid, reply_text, None, sender="SELF")
                await messages_col.insert_one(reply)

                await ws.send(json.dumps({
                    "status":"ok",
                    "action":"send_message_with_attachment",
                    "messageId": message_id_str,
                    "attachment": saved_name,
                    "reply": reply_text
                }))

                print(f"[message+file] saved {message_id_str} file {saved_name} for chat {chat_id}")

            elif action == "ping":
                # simple keepalive
                await ws.send(json.dumps({"status":"ok","action":"pong"}))
                if chat_id:
                    last_connected[chat_id] = now_ms()
                    active_websockets[chat_id] = ws

            else:
                await ws.send(json.dumps({"status":"error","message":"unknown action"}))

    except websockets.exceptions.ConnectionClosedOK:
        print(f"[disconnect] {client} closed")
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"[disconnect] {client} error {e}")
    except Exception as e:
        print("handler exception:", e)
    finally:
        # cleanup references to this ws
        to_drop = [cid for cid, w in active_websockets.items() if w is ws]
        for cid in to_drop:
            active_websockets.pop(cid, None)
            last_connected[cid] = now_ms()
        print(f"[cleanup] connection {client} cleaned - removed {to_drop}")

async def main():
    ensure_storage()
    asyncio.create_task(monitor_inactive_chats())
    print(f"Starting WebSocket server at {WS_HOST}:{WS_PORT}")
    async with websockets.serve(handler, WS_HOST, WS_PORT, max_size=None, max_queue=None):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
