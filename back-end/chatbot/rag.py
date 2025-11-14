import os
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
from collections import deque  # untuk menyimpan history percakapan

documents = None
indexed_docs = None
# 1. Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# 2. Fungsi ambil embedding teks
def get_embedding(text):
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=text
    )
    return np.array(result["embedding"], dtype=np.float32)

# 3. Fungsi cosine similarity
def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10)

# 4. Load semua dokumen dari folder "docs"
def load_documents(folder_path="doc/pages"):
    docs = []
    folder = Path(folder_path)
    for file in folder.glob("*.txt"):
        with open(file, "r", encoding="utf-8") as f:
            text = f.read()
            docs.append({"filename": file.name, "text": text})
    return docs

# 5. Index dokumen: simpan embedding
def index_documents(docs):
    for doc in docs:
        doc["embedding"] = get_embedding(doc["text"])
    print(f"Indexed {len(docs)} documents.")
    return docs

# 6. Retrieve top-k dokumen yang paling relevan
def retrieve_relevant_docs(question, docs, k=3):
    q_emb = get_embedding(question)
    scored = []
    for doc in docs:
        score = cosine_similarity(q_emb, doc["embedding"])
        scored.append((score, doc))
    scored.sort(reverse=True, key=lambda x: x[0])
    top_docs = scored[:k]
    return [doc for score, doc in top_docs]

# Hitung ukuran byte teks
def count_bytes(text):
    return len(text.encode("utf-8"))

# 7. Generate jawaban dengan konteks + 5 percakapan terakhir
def answer_question(question, docs, history, k=3):
    top_docs = retrieve_relevant_docs(question, docs, k)
    context_text = "\n\n".join([f"({doc['filename']}) {doc['text']}" for doc in top_docs])

    # Gabungkan riwayat percakapan sebelumnya
    history_text = "\n".join(
        [f"Q{i+1}: {h['q']}\nA{i+1}: {h['a']}" for i, h in enumerate(history)]
    ) if history else "(Belum ada percakapan sebelumnya)"

    prompt = f"""
Gunakan konteks berikut untuk menjawab pertanyaan pengguna dengan ringkas dan akurat.
Jika konteks tidak cukup, katakan bahwa kamu tidak menemukan jawabannya di konteks.

Riwayat percakapan terakhir (maksimal 5):
{history_text}

Konteks dokumen:
{context_text}

Pertanyaan: {question}
"""
    # Hitung ukuran total prompt dalam byte
    print(history_text)
    byte_size = count_bytes(prompt)
    print(f"\n=== Ukuran prompt (RAG context + history + question) ===")
    print(f"{byte_size} bytes")

    model = genai.GenerativeModel("models/gemini-2.5-flash")
    response = model.generate_content(prompt)

    print("\n=== Pertanyaan ===")
    print(question)
    print("\n=== Jawaban Model ===")
    print(response.text)
    print("\n=== Dokumen yang Dipakai ===")
    for doc in top_docs:
        print(f"- {doc['filename']}")

    # Simpan percakapan ke riwayat
    history.append({"q": question, "a": response.text})
    if len(history) > 5:
        history.popleft()  # hapus percakapan paling lama

    return response.text


# 8. Main execution
def mainrag(input):
    if documents is None:
        documents = load_documents()

    total_bytes = sum(count_bytes(doc["text"]) for doc in documents)
    print(f"\n=== Total ukuran semua file di doc/pages ===")
    print(f"{total_bytes} bytes")

    if indexed_docs is None:
        indexed_docs = index_documents(documents)

    # deque dengan batas 5 percakapan terakhir
    history = deque(maxlen=5)

    while True:
        # question = input("\nPertanyaan ('berhenti' untuk keluar): ")
        question = input
        if question.lower() == "berhenti":
            break
        return answer_question(question, indexed_docs, history, k=3)
    return "break"
