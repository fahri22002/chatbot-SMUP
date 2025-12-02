import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import scrapping as sc
import rag

# --- LIFESPAN: Dijalankan otomatis saat server Start ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n>>> SERVER STARTUP: Memulai Indexing Knowledge Base...")
    # Load dokumen ke memori saat aplikasi mulai
    rag.load_and_index_documents()
    print(">>> SERVER STARTUP: Indexing Selesai. Chatbot Siap!\n")
    yield
    print(">>> SERVER SHUTDOWN")

app = FastAPI(lifespan=lifespan)

# Middleware CORS agar bisa diakses dari Frontend Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global counter (opsional)
temp = 0

@app.get("/")
async def read_root():
    global temp
    temp += 1
    return {"Hello": "World", "Status": "Running", "Temp": temp}

@app.post("/reply")
async def reply(req: Request):
    global temp
    temp += 1
    try:
        data = await req.json()
        message = data.get("message", "")
        
        if not message:
            return {"Reply": "Pesan tidak boleh kosong.", "Temp": temp}

        # Panggil fungsi RAG yang sudah dioptimasi
        reply_text = rag.mainrag(message)
        return {"Reply": reply_text, "Temp": temp}
        
    except Exception as e:
        print(f"Error in /reply endpoint: {e}")
        return {"Reply": f"Error server: {str(e)}", "Temp": temp}

@app.get("/do-scrapping")
async def do_scrapping():
    try:
        # 1. Jalankan Scrapping (download file .txt)
        sc.delete_folder()
        sc.mainscrapping()
        
        
        return {
            "Status": "Succeed", 
            "Message": "Scrapping selesai.",
            "Temp": temp
        }
    except Exception as e:
        return {"Status": "Error", "Message": str(e)}
    
@app.get("/do-rag")
async def do_scrapping():
    try:
        # 2. Reload Index RAG agar file baru terbaca di memori
        rag.reload_rag()
        
        
        return {
            "Status": "Succeed", 
            "Message": "Index diperbarui.",
            "Temp": temp
        }
    except Exception as e:
        return {"Status": "Error", "Message": str(e)}

@app.get("/get-documents")
async def get_documents():
    """Endpoint untuk menampilkan list file di Admin Panel"""
    docs = []
    folder_path = "doc/pages"
    
    if os.path.exists(folder_path):
        # Menggunakan os.listdir untuk listing file
        files = [f for f in os.listdir(folder_path) if f.endswith('.txt')]
        files.sort() # Urutkan nama file
        
        for filename in files:
            file_path = os.path.join(folder_path, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                    # Ekstrak URL dari baris pertama (jika ada format 'URL page ini:')
                    lines = content.split('\n')
                    url = "-"
                    if lines and "URL page ini:" in lines[0]:
                        url = lines[0].split("URL page ini:")[-1].strip()
                    
                    # Buat snippet pendek
                    snippet = content[:150].replace('\n', ' ') + "..." if len(content) > 150 else content
                    
                    docs.append({
                        "filename": filename,
                        "url": url,
                        "content": content,
                        "snippet": snippet,
                        "size": f"{os.path.getsize(file_path) / 1024:.2f} KB"
                    })
            except Exception as e:
                print(f"Skipping corrupted file {filename}: {e}")
                continue
                
    return {"data": docs}

if __name__ == "__main__":
    # Pastikan port sama dengan yang dipanggil di frontend (8080)
    uvicorn.run(app, host="127.0.0.1", port=8080)