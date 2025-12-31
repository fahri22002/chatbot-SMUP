# FIX
import os
import time
import threading
import schedule
from fastapi import FastAPI, Request, Query, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles # Pengganti aiohttp static
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# Import modul internal kamu
import scrapping.run as rsc
import rag.rag as rag

# --- KONFIGURASI ---
PUBLIC_DIR = "public"
if not os.path.exists(PUBLIC_DIR):
    os.makedirs(PUBLIC_DIR)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/yourdb")
client = AsyncIOMotorClient(MONGO_URI)
db = client["newSMUP"]
chats_col = db["chats"]
messages_col = db["messages"]
device_tokens_col = db["device_tokens"]

# --- SCHEDULER ---
def start_scheduler():
    def job():
        print("Menjalankan scrapping terjadwal...")
        rsc.run_scrapping()

    def scheduler_thread():
        while True:
            schedule.run_pending()
            time.sleep(1)

    schedule.every().day.at("19:16").do(job)
    t = threading.Thread(target=scheduler_thread, daemon=True)
    t.start()
    print("Scheduler berjalan di background.")

# --- LIFECYCLE ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Server startup: memulai index")
    rag.load_and_index_documents()
    start_scheduler()
    yield
    print(">>> Server shutdown")

# --- APP INITIALIZATION ---
app = FastAPI(lifespan=lifespan)

# Setup Folder Static (Pengganti handle_static aiohttp)
app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")

# Helper MongoDB
def oid(s):
    try:
        return ObjectId(s)
    except:
        return None

# --- ENDPOINTS ---
@app.get("/messages")
async def get_messages(
    chatId: str,
    deviceToken: str,
    chatToken: str,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    device = await device_tokens_col.find_one({"deviceToken": deviceToken})
    if not device:
        raise HTTPException(403, detail="Invalid deviceToken")

    chat_oid = oid(chatId)
    if not chat_oid:
        raise HTTPException(400, detail="Invalid chatId")

    chat = await chats_col.find_one({"_id": chat_oid})
    if not chat:
        raise HTTPException(404, detail="Chat not found")

    if chat.get("chatToken") != chatToken:
        raise HTTPException(403, detail="Invalid chatToken")

    cursor = (
        messages_col
        .find({"chatId": chat_oid})
        .sort("createdAt", 1)
        .skip(skip)
        .limit(limit)
    )

    results = []
    async for m in cursor:
        results.append({
            "id": str(m["_id"]),
            "msg": m.get("msg", ""),
            "sender": m.get("sender", ""),
            "attachment": m.get("attachment"),
            "createdAt": m.get("createdAt"),
            "updatedAt": m.get("updatedAt")
        })

    return {
        "status": "ok",
        "chatId": chatId,
        "count": len(results),
        "messages": results
    }

@app.get("/do-rag")
async def do_scrapping():
    try:
        # 2. Reload Index RAG agar file baru terbaca di memori
        rag.reload_rag()
        
        
        return {
            "Status": "Succeed", 
            "Message": "Index diperbarui.",
        }
    except Exception as e:
        return {"Status": "Error", "Message": str(e)}
    
# --- RUN SERVER ---
PORT = os.getenv("PORT", 3067)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)