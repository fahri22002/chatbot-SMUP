# app.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import scrapping as sc
import rag  # <-- Pastikan ini diimpor

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "Ini adalah server AI untuk Chatbot Unpad"}

@app.post("/reply")
async def reply(req: Request):
    data = await req.json()
    message = data.get("message", "")
    
    # --- PERUBAHAN DI SINI ---
    # Panggil fungsi RAG untuk mendapatkan jawaban
    reply_text = rag.get_rag_response(message)
    # -------------------------
    
    return {"Reply": reply_text}

@app.get("/do-scrapping")
def do_scrapping_route(): # Ganti nama fungsi agar tidak bentrok
    print("Menerima permintaan /do-scrapping...")
    result = sc.mainscrapping() # Panggil fungsi dari scrapping.py
    print(f"Scrapping selesai: {result}")
    return {"Status": "Succeed", "Work": "Scrapping", "Detail": result}

@app.get("/do-rag")
def do_rag_route(): # Ganti nama fungsi agar tidak bentrok
    print("Menerima permintaan /do-rag...")
    processed_chunks = rag.mainrag() # Panggil fungsi dari rag.py
    print(f"RAG selesai: {processed_chunks} chunks diproses.")
    return {"Status": "Succeed", "Work": "RAG", "ProcessedChunks": processed_chunks}

if __name__ == "__main__":
    import uvicorn
    # Jalankan di port 8080
    uvicorn.run(app, host="127.0.0.1", port=8080)