from aiohttp import web
import os

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI, Request, UploadFile, File, Form # Tambahkan UploadFile, File, Form
import shutil
from pypdf import PdfReader
from pydantic import BaseModel
import io
import scrapping.run as rsc
import rag.rag as rag
import schedule
import threading
import time

PUBLIC_DIR = "public"
def start_scheduler():
    def job():
        print("Menjalankan scrapping terjadwal...")
        rsc.run_scrapping()

    def scheduler_thread():
        while True:
            schedule.run_pending()
            time.sleep(1)

    # Atur jadwal - jam 1 malam saja
    schedule.every().day.at("01:00").do(job)

    # Thread daemon
    t = threading.Thread(target=scheduler_thread, daemon=True)
    t.start()
    print("Scheduler berjalan di background.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Server startup: memulai index")
    rag.load_and_index_documents()

    # START SCHEDULER DISINI
    start_scheduler()

    yield
    print(">>> Server shutdown")
async def handle_static(request):
    file_path = os.path.join(PUBLIC_DIR, request.match_info['path'])
    if not os.path.isfile(file_path):
        raise web.HTTPNotFound()
    return web.FileResponse(file_path)

import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/yourdb")
client = AsyncIOMotorClient(MONGO_URI)
db = client["newSMUP"]

chats_col = db["chats"]
messages_col = db["messages"]
device_tokens_col = db["device_tokens"]

app = FastAPI()

def oid(s):
    try:
        return ObjectId(s)
    except:
        return None
@app.get("/messages")
async def get_messages(
    chatId: str,
    deviceToken: str,
    chatToken: str,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    # Validate deviceToken
    device = await device_tokens_col.find_one({"deviceToken": deviceToken})
    if not device:
        raise HTTPException(403, detail="Invalid deviceToken")

    chat_oid = oid(chatId)
    if not chat_oid:
        raise HTTPException(400, detail="Invalid chatId")

    # Validate chat ownership
    chat = await chats_col.find_one({"_id": chat_oid})
    if not chat:
        raise HTTPException(404, detail="Chat not found")

    if chat.get("chatToken") != chatToken:
        raise HTTPException(403, detail="Invalid chatToken")

    # Fetch messages
    cursor = (
        messages_col
        .find({"chatId": chat_oid})
        .sort("createdAt", 1)    # ascending order
        .skip(skip)
        .limit(limit)
    )

    results = []
    async for m in cursor:
        results.append({
            "id": str(m["_id"]),
            "msg": m.get("msg", ""),
            "sender": m.get("sender", ""),
            "attachment": m.get("attachment"),   # URL string
            "createdAt": m.get("createdAt"),
            "updatedAt": m.get("updatedAt")
        })

    return JSONResponse({
        "status": "ok",
        "chatId": chatId,
        "count": len(results),
        "messages": results
    })

start_scheduler()
app = web.Application()
app.router.add_get('/public/{path:.*}', handle_static)

web.run_app(app, port=3000)
