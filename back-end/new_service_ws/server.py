# FIX BANGET
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
from bson.objectid import ObjectId


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
import rag.rag_temp as rag
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
                if ws is None or ws.close_code is not None:
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


async def handler(ws: WebSocketServerProtocol):
    client = ws.remote_address
    print(f"[connect] from {client}")
    # KUNCI: Tambahkan variabel ini di awal handler untuk menampung metadata file
    # pending_upload = None
    try:
        pending_upload_metadata = None
        async for raw in ws:
            if isinstance(raw, bytes):
                if isinstance(raw, bytes):
                    if pending_upload_metadata:
                        p = pending_upload_metadata
                        # 1. Simpan biner ke storage
                        saved_name = save_binary_file(p["temp_id"], p["filename"], raw)
                        
                        # 2. Balas ke frontend: "Ini nama file kamu di server"
                        await ws.send(json.dumps({
                            "status": "ok",
                            "action": "upload_file",
                            "server_filename": saved_name 
                        }))
                        pending_upload_metadata = None # Kosongkan kantong
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

            # A. Action baru untuk registrasi upload
            elif action == "upload_file":
                pending_upload_metadata = {
                    "temp_id": uuid.uuid4().hex,
                    "filename": data.get("filename")
                }
                await ws.send(json.dumps({"status": "ok", "action": "ready_for_upload"}))

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

                # INSERT MESSAGE USER
                msg_doc = make_message_doc(chat_oid, msg_text, None, sender="USER")
                r = await messages_col.insert_one(msg_doc)
                message_oid = r.inserted_id

                # --- BAGIAN STREAMING RAG ---
                msg_history = await messages_col.find({"chatId": chat_oid}).sort("createdAt", 1).to_list(None)
                formatted_history = ""
                for m in msg_history:
                    role = "User" if m.get("sender") == "USER" else "AI"
                    formatted_history += f"{role}: {m.get('text')}\n"
                
                full_reply = ""
                # Beritahu frontend bahwa streaming dimulai
                await ws.send(json.dumps({
                    "status": "start_stream",
                    "action": "send_message",
                    "messageId": str(message_oid)
                }))

                # Panggil generator streaming dari rag_temp
                async for chunk in rag.mainrag_stream(formatted_history, msg_text):
                    full_reply += chunk
                    # Kirim potongan teks langsung ke WebSocket
                    await ws.send(json.dumps({
                        "status": "streaming",
                        "chunk": chunk
                    }))

                # Setelah streaming selesai, tambahkan sumber referensi
                # Kita panggil format_answer_with_sources di akhir
                # Ambil docs lagi (atau simpan dari mainrag_stream)
                docs_for_sources = await rag.VECTOR_STORE.asimilarity_search(msg_text, k=4)
                docs_dict = [{"filename": d.metadata.get("source"), "text": d.page_content} for d in docs_for_sources]
                
                final_html = rag.format_answer_with_sources(full_reply, docs_dict)

                # SIMPAN JAWABAN LENGKAP KE DATABASE
                reply_doc = make_message_doc(chat_oid, final_html, None, sender="SELF")
                await messages_col.insert_one(reply_doc)

                # Beritahu frontend bahwa streaming selesai
                await ws.send(json.dumps({
                    "status": "ok",
                    "action": "send_message",
                    "final_reply": final_html # Kirim versi lengkap dengan sumber
                }))

                print(f"[stream] completed for chat {chat_id}")

                # ... (kode action lainnya) ...

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
                uploaded_file = data.get("filename")

                # 1. Simpan pesan USER ke database
                file_url = f"{BASE_FILE_URL}/public/upload/{uploaded_file}" if BASE_FILE_URL else f"/public/upload/{uploaded_file}"
                print("Received send_message_with_attachment for file:", file_url)
                msg_doc = make_message_doc(chat_oid, msg_text, file_url, sender="USER")
                r = await messages_col.insert_one(msg_doc)
                message_oid = r.inserted_id

                # 2. OCR (Karena file fisik SUDAH ADA di server dari proses upload_file tadi)
                ocr_path = os.path.join(os.getenv("STORAGE_PATH", "public/upload"), uploaded_file)
                ocr_text = ocr.ocr_file(ocr_path) # <--- PERBEDAANNYA DISINI


                # --- BAGIAN STREAMING RAG ---
                msg_history = await messages_col.find({"chatId": chat_oid}).sort("createdAt", 1).to_list(None)
                formatted_history = ""
                for m in msg_history:
                    role = "User" if m.get("sender") == "USER" else "AI"
                    formatted_history += f"{role}: {m.get('text')}\n"
                
                full_reply = ""
                # Beritahu frontend bahwa streaming dimulai
                await ws.send(json.dumps({
                    "status": "start_stream",
                    "action": "send_message",
                    "messageId": str(message_oid)
                }))

                # Panggil generator streaming dari rag_temp
                async for chunk in rag.mainragocr_stream(formatted_history, msg_text, ocr_text):
                    full_reply += chunk
                    # Kirim potongan teks langsung ke WebSocket
                    await ws.send(json.dumps({
                        "status": "streaming",
                        "chunk": chunk
                    }))

                # Setelah streaming selesai, tambahkan sumber referensi
                # Kita panggil format_answer_with_sources di akhir
                # Ambil docs lagi (atau simpan dari mainrag_stream)
                docs_for_sources = await rag.VECTOR_STORE.asimilarity_search(msg_text, k=4)
                docs_dict = [{"filename": d.metadata.get("source"), "text": d.page_content} for d in docs_for_sources]
                
                final_html = rag.format_answer_with_sources(full_reply, docs_dict)

                # SIMPAN JAWABAN LENGKAP KE DATABASE
                reply_doc = make_message_doc(chat_oid, final_html, None, sender="SELF")
                await messages_col.insert_one(reply_doc)

                # Beritahu frontend bahwa streaming selesai
                await ws.send(json.dumps({
                    "status": "ok",
                    "action": "send_message",
                    "final_reply": final_html # Kirim versi lengkap dengan sumber
                }))

                print(f"[stream] completed for chat {chat_id}")

                # ... (kode action lainnya) ...

            # === TAMBAHAN BARU: LOAD HISTORY ===
            elif action == "get_history":
                # 1. Validasi Token (Sama seperti send_message)
                device_token = data.get("deviceToken")
                device_doc = await device_tokens_col.find_one({"deviceToken": device_token})
                if not device_doc or device_doc.get("lastChatId") != chat_id:
                     await ws.send(json.dumps({"status":"error", "message":"unauthorized"}))
                     continue
                
                chat_oid = str_to_oid(chat_id)
                if not chat_oid:
                    continue

                # 2. Ambil Pesan dari Database
                cursor = messages_col.find({"chatId": chat_oid}).sort("createdAt", 1)
                stored_messages = await cursor.to_list(None)

                # 3. Format agar sesuai dengan Frontend React
                history_payload = []
                for m in stored_messages:
                    # Konversi 'SELF' -> 'bot', 'USER' -> 'user'
                    sender_fe = "bot" if m.get("sender") == "SELF" else "user"
                    history_payload.append({
                        "sender": sender_fe,
                        "text": m.get("text", ""),
                        "attachmentUrl": m.get("attachment")
                    })

                # 4. Kirim ke Frontend
                await ws.send(json.dumps({
                    "status": "ok",
                    "action": "get_history",
                    "messages": history_payload
                }))
            
            # ... (kode action lainnya) ...

            # SEND MESSAGE WITH ATTACHMENT (single binary expected after header)
            # elif action == "send_message_with_attachment":


            #     # DEVICE TOKEN VALIDATION
            #     device_token = data.get("deviceToken")
            #     device_doc = await device_tokens_col.find_one({"deviceToken": device_token})
            #     if not device_doc:
            #         await ws.send(json.dumps({"status":"error","message":"invalid deviceToken"}))
            #         continue

            #     # DEVICE MUST BE BOUND TO THIS CHAT
            #     if device_doc.get("lastChatId") != chat_id:
            #         await ws.send(json.dumps({
            #             "status": "error",
            #             "message": "chat_not_bound_to_device",
            #             "refresh": True
            #         }))
            #         continue

            #     chat_oid = str_to_oid(chat_id)
            #     if chat_oid is None:
            #         await ws.send(json.dumps({"status":"error","message":"invalid chatId"}))
            #         continue

            #     chat_doc = await chats_col.find_one({"_id": chat_oid})
            #     if not chat_doc:
            #         await ws.send(json.dumps({"status":"error","message":"invalid chatId"}))
            #         continue

            #     # NONACTIVE CHECK
            #     if chat_doc.get("status") == "NONACTIVE":
            #         await ws.send(json.dumps({
            #             "status": "error",
            #             "message": "chat_nonactive",
            #             "refresh": True
            #         }))
            #         continue

            #     # RATE LIMIT
            #     if not allow_send(device_token):
            #         remaining = get_remaining(device_token)
            #         await ws.send(json.dumps({"status":"error","message":"rate_limit_exceeded","remaining":remaining, "time_retry":get_retry_after(device_token)}))
            #         continue

            #     msg_text = data.get("msg", "")
            #     uploaded_file = data.get("attachment") # Referensi file dari tahap sebelumnya
                
            #     # Simpan pesan user ke DB
            #     msg_doc = make_message_doc(chat_oid, msg_text, uploaded_file, sender="USER")
            #     await messages_col.insert_one(msg_doc)

            #     # Beritahu streaming dimulai
            #     await ws.send(json.dumps({"status": "start_stream", "action": "send_message"}))

            #     full_reply = ""
            #     # Jika ada file, jalankan RAG OCR, jika tidak RAG biasa
            #     if uploaded_file:
            #         ocr_path = os.path.join(os.getenv("STORAGE_PATH", "public/upload"), uploaded_file)
            #         ocr_text = ocr.ocr_file(ocr_path)
            #         # Gunakan formatted history untuk context
            #         async for chunk in rag.mainragocr_stream(formatted_history, msg_text, ocr_text):
            #             full_reply += chunk
            #             await ws.send(json.dumps({"status": "streaming", "chunk": chunk}))
            #     else:
            #         async for chunk in rag.mainrag_stream(formatted_history, msg_text):
            #             full_reply += chunk
            #             await ws.send(json.dumps({"status": "streaming", "chunk": chunk}))

            #     # Simpan balasan bot dan kirim status 'ok'
            # # Di dalam handler(ws: WebSocketServerProtocol):

            elif action == "admin_reload_rag":
                # Kamu bisa tambahkan pengecekan token rahasia di sini jika perlu
                try:
                    rag.reload_rag() # Memperbarui INDEXED_DOCS di memori proses WS
                    await ws.send(json.dumps({
                        "status": "ok", 
                        "action": "admin_reload_rag", 
                        "message": "Index RAG pada WebSocket berhasil diperbarui"
                    }))
                    print("[admin] RAG Reloaded via WebSocket command")
                except Exception as e:
                    await ws.send(json.dumps({"status": "error", "message": str(e)}))

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