import os
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
from collections import deque
import time

# 1. Load environment variables
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("WARNING: GOOGLE_API_KEY not found in .env")
genai.configure(api_key=api_key)

# --- GLOBAL CACHE VARIABLES ---
# Variabel ini akan diisi saat server pertama kali nyala
INDEXED_DOCS = [] 
HISTORY = deque(maxlen=5)

# 2. Fungsi ambil embedding teks
def get_embedding(text):
    try:
        # Beri jeda sangat singkat untuk menghindari rate limit jika dokumen banyak
        # time.sleep(0.1) 
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text
        )
        return np.array(result["embedding"], dtype=np.float32)
    except Exception as e:
        print(f"Error embedding chunk: {e}")
        # Kembalikan array kosong/nol jika gagal, agar sistem tidak crash
        return np.zeros(768, dtype=np.float32)

# 3. Fungsi cosine similarity
def cosine_similarity(a, b):
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return np.dot(a, b) / (norm_a * norm_b)

# 4. Fungsi Load & Index Dokumen (Dipanggil saat Startup & Update)
import json

def load_and_index_documents(folder_path="doc/pages", cache_path="doc/embeddings_cache.json"):
    global INDEXED_DOCS
    print(f"\n--- Memulai Indexing Dokumen dari: {folder_path} ---")

    folder = Path(folder_path)
    if not folder.exists():
        print(f"Folder {folder_path} tidak ditemukan. Membuat folder baru...")
        os.makedirs(folder_path, exist_ok=True)
        INDEXED_DOCS = []
        return

    # === LOAD CACHE ===
    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception as e:
            print(f"Gagal membaca cache: {e}")

    new_docs = []
    files = list(folder.glob("*.txt"))
    print(f"Ditemukan {len(files)} file. Sedang memproses embedding...")

    for i, file in enumerate(files):
        try:
            text = file.read_text(encoding="utf-8").strip()
            if not text:
                continue

            # cek cache berdasarkan nama file dan ukuran terakhir
            mtime = os.path.getmtime(file)
            key = f"{file.name}:{mtime}"

            if key in cache:
                # ambil dari cache
                emb = np.array(cache[key], dtype=np.float32)
            else:
                # embed baru
                emb = get_embedding(text)
                cache[key] = emb.tolist()  # simpan ke cache

            new_docs.append({
                "filename": file.name,
                "text": text,
                "embedding": emb
            })

            if (i + 1) % 10 == 0:
                print(f"Processed {i + 1}/{len(files)} files...")

        except Exception as e:
            print(f"Gagal membaca file {file.name}: {e}")

    # === Simpan cache kembali ===
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f)
        print(f"Cache embeddings disimpan ke {cache_path}")
    except Exception as e:
        print(f"Gagal menyimpan cache: {e}")

    INDEXED_DOCS = new_docs
    print(f"--- Selesai! Total {len(INDEXED_DOCS)} dokumen terindeks di memori. ---")


# 5. Retrieve Dokumen Relevan
def retrieve_relevant_docs(question, k=3):
    if not INDEXED_DOCS:
        print("Warning: Index dokumen kosong.")
        return []
    
    try:
        q_emb = get_embedding(question)
        # Jika embedding pertanyaan gagal (nol semua)
        if np.all(q_emb == 0):
            return []

        scored = []
        for doc in INDEXED_DOCS:
            score = cosine_similarity(q_emb, doc["embedding"])
            scored.append((score, doc))
        
        # Urutkan dari score tertinggi
        scored.sort(reverse=True, key=lambda x: x[0])
        
        # Ambil top-k
        return [doc for score, doc in scored[:k]]
    except Exception as e:
        print(f"Error retrieving docs: {e}")
        return []

# 6. Generate Jawaban (Main Logic)
def mainrag(question):
    global HISTORY, INDEXED_DOCS

    # Safety check: Jika index kosong, coba load lagi
    if not INDEXED_DOCS:
        load_and_index_documents()

    # 1. Cari dokumen relevan
    top_docs = retrieve_relevant_docs(question, k=3)
    
    # Jika tidak ada dokumen sama sekali
    if not top_docs:
        return "Maaf, saya belum memiliki data dokumen yang cukup untuk menjawab pertanyaan Anda. Pastikan proses scraping sudah dilakukan."

    # 2. Susun Context
    context_text = "\n\n".join([f"Sumber: {d['filename']}\nIsi: {d['text']}" for d in top_docs])
    history_text = "\n".join([f"User: {h['q']}\nBot: {h['a']}" for h in HISTORY])

    # 3. Buat Prompt
    prompt = f"""
Anda adalah asisten AI untuk Universitas Padjadjaran (Unpad).
Tugas Anda adalah menjawab pertanyaan pengguna secara akurat, sopan, dan informatif berdasarkan DOKUMEN PENDUKUNG di bawah ini.

⚙️ FORMAT JAWABAN:
- Jawaban ditulis dalam **Markdown** agar mudah dibaca.
- Gunakan paragraf pendek, bullet list, tabel (jika perlu), dan **bold** untuk istilah penting.
- Jangan gunakan tanda kutip berlebih atau karakter escape seperti `\\n`.
- Jika menjawab poin, gunakan format markdown seperti:
  - **Poin Utama:** penjelasan
  - **Sub-poin:** detail

INSTRUKSI:
1. Jawab HANYA berdasarkan informasi di bagian "KONTEKS DOKUMEN".
2. Jika jawaban tidak ditemukan di dokumen, katakan: "Maaf, informasi tersebut tidak ditemukan dalam dokumen yang tersedia."
3. Jangan mengarang jawaban.
4. Gunakan Bahasa Indonesia yang baik dan sopan.


RIWAYAT PERCAKAPAN:
{history_text}

KONTEKS DOKUMEN:
{context_text}

PERTANYAAN PENGGUNA: 
{question}
"""

    print(f"Processing LLM request for: {question}")

    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        
        # REQUEST OPTIONS PENTING UNTUK MENGATASI TIMEOUT
        response = model.generate_content(
            prompt,
            request_options={"timeout": 600}  # Set timeout ke 600 detik (10 menit)
        )
        
        answer = response.text
        
        # Update history
        HISTORY.append({"q": question, "a": answer})
        return answer

    except Exception as e:
        error_msg = str(e)
        print(f"Gemini API Error: {error_msg}")
        
        # Fallback handling jika library versi lama menolak parameter timeout
        if "Unknown field" in error_msg:
            try:
                print("Retrying without timeout parameter...")
                response = model.generate_content(prompt)
                answer = response.text
                HISTORY.append({"q": question, "a": answer})
                return answer
            except Exception as e2:
                return f"Terjadi kesalahan sistem (API Error): {str(e2)}"
        
        if "504" in error_msg or "DeadlineExceeded" in error_msg:
            return "Maaf, server sedang sibuk dan permintaan Anda memakan waktu terlalu lama (Timeout). Mohon coba lagi dengan pertanyaan yang lebih singkat."

        return f"Maaf, terjadi kesalahan saat memproses jawaban: {error_msg}"

# Fungsi Helper untuk refresh index dari API/Button
def reload_rag():
    load_and_index_documents()