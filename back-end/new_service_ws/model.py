# models.py
from datetime import datetime
from bson import ObjectId

def now_doc():
    return {"createdAt": datetime.utcnow(), "updatedAt": datetime.utcnow()}

def make_chat_doc(device_token: str, status: str = "ACTIVE"):
    doc = {
        "deviceToken": device_token,
        "status": status,
        **now_doc()
    }
    return doc

def make_message_doc(chat_oid: ObjectId, msg: str, attachment_filename: str | None, sender: str = "USER"):
    doc = {
        "chatId": chat_oid,   # store as ObjectId
        "msg": msg,
        "attachment": attachment_filename,
        "sender": sender,
        **now_doc()
    }
    return doc

def str_to_oid(s: str):
    try:
        return ObjectId(s)
    except Exception:
        return None

