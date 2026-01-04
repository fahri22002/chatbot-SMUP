# db.py
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv()
# Koneksi ke MongoDB

MONGO_URI = os.getenv("MONGO_URI", "mongodb://shaka220081:shaka220081@localhost:27017/skripsi")
client = AsyncIOMotorClient(MONGO_URI)
# default database: gunakan nama dari URI path, atau 'testdb' jika tidak ada
db = client.get_default_database()

chats_col = db.get_collection("chat")
messages_col = db.get_collection("message")
device_tokens_col = db.get_collection("tokens")

