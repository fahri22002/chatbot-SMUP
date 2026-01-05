import os
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path
import json
import re
from collections import Counter
from natsort import natsorted

# --- IMPORT LANGCHAIN ---
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferWindowMemory
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

# --- IMPORT NLTK (WORDNET) ---
import nltk
from nltk.corpus import wordnet as wn
from nltk.tokenize import word_tokenize

# Setup NLTK (Download data jika belum ada)
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('tokenizers/punkt_tab')
    nltk.data.find('corpora/wordnet')
    nltk.data.find('corpora/omw-1.4')
except LookupError:
    print("Downloading NLTK data (WordNet & Tokenizers)...")
    nltk.download('punkt')
    nltk.download('punkt_tab')
    nltk.download('wordnet')
    nltk.download('omw-1.4') 
    print("NLTK data downloaded.")

# 1. Load environment variables
load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("WARNING: GOOGLE_API_KEY not found in .env")

# Konfigurasi GenAI Native (hanya untuk embedding manual)
genai.configure(api_key=api_key)

# --- GLOBAL VARIABLES ---
INDEXED_DOCS = [] 
URL_HISTORY = {} # Variabel untuk menyimpan mapping Filename -> URL

# --- LANGCHAIN SETUP ---

# Model Utama
llm = ChatGoogleGenerativeAI(
    model="gemini-flash-latest",
    google_api_key=api_key,
    temperature=0.3,
    timeout=600,
    convert_system_message_to_human=True
)

# A. Setup Memory
memory = ConversationBufferWindowMemory(
    k=5, 
    memory_key="chat_history", 
    input_key="question"
)

# B. Setup Prompt Reranking
rerank_template = """
Anda adalah sistem penilai relevansi dokumen.
Diberikan pertanyaan pengguna dan daftar kutipan dokumen, tugas Anda adalah memilih dokumen mana yang paling relevan untuk menjawab pertanyaan tersebut.

PERTANYAAN: {question}

DAFTAR DOKUMEN:
{docs_list}

INSTRUKSI:
1. Analisis relevansi setiap dokumen terhadap pertanyaan.
2. Pilih maksimal 3 ID dokumen yang paling relevan (misal: DOC_1, DOC_3).
3. Urutkan dari yang paling relevan.
4. HANYA kembalikan ID dokumen dipisahkan koma. Contoh: DOC_2, DOC_5, DOC_1
5. Jika tidak ada yang relevan, kembalikan: NONE

OUTPUT ID:
"""
rerank_prompt = PromptTemplate(
    input_variables=["question", "docs_list"],
    template=rerank_template
)
rerank_chain = LLMChain(llm=llm, prompt=rerank_prompt)

# C. Setup Prompt Jawaban Akhir (Format HTML)
qa_template = """
Anda adalah asisten AI untuk Universitas Padjadjaran (Unpad).
Jawablah pertanyaan berdasarkan dokumen terpilih di bawah ini.

KONTEKS DOKUMEN TERPILIH:
{context}

RIWAYAT PERCAKAPAN:
{chat_history}

PERTANYAAN: {question}

⚙️ FORMAT JAWABAN (WAJIB HTML):
1.  Jawaban HARUS dalam format HTML valid (tanpa tag ```html di awal).
2.  Gunakan tag <p> untuk setiap paragraf.
3.  Untuk langkah-langkah atau urutan, GUNAKAN tag <ol> dan <li> (Ordered List).
4.  Untuk poin-poin daftar, GUNAKAN tag <ul> dan <li> (Unordered List).
5.  Untuk tabel, GUNAKAN tag <table border="1" style="border-collapse: collapse; width: 100%;">, <thead>, <tbody>, <tr>, <th>, dan <td>.
6.  Gunakan <strong> untuk menebalkan teks penting.
7.  JANGAN gunakan format Markdown (seperti **bold** atau - list).
8.  Jika informasi tidak ada di konteks, katakan: "<p>Maaf, informasi tersebut tidak ditemukan dalam dokumen.</p>"

JAWABAN (HTML):
"""

qa_prompt = PromptTemplate(
    input_variables=["history", "context", "question"],
    template=qa_template
)
qa_chain = LLMChain(llm=llm, prompt=qa_prompt, memory=memory)


# --- FUNGSI UTILITY ---

def get_embedding(text):
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text
        )
        return np.array(result["embedding"], dtype=np.float32)
    except Exception as e:
        print(f"Error embedding: {e}")
        return np.zeros(768, dtype=np.float32)

def cosine_similarity(a, b):
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return np.dot(a, b) / (norm_a * norm_b)

def load_url_history(path="./scrapping/doc/urlHistory.txt"):
    """
    Membaca file urlHistory.txt dan mengubahnya menjadi dictionary.
    Format file: filename.txt | https://url...
    """
    url_map = {}
    if not os.path.exists(path):
        print(f"WARNING: File {path} tidak ditemukan.")
        return url_map

    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if "|" in line:
                    parts = line.strip().split("|", 1)
                    if len(parts) == 2:
                        fname = parts[0].strip()
                        url = parts[1].strip()
                        url_map[fname] = url
        print(f"--- URL History Loaded: {len(url_map)} entries ---")
    except Exception as e:
        print(f"Error loading URL history: {e}")
    
    return url_map

def load_and_index_documents(folder_path="./scrapping/doc/pages", cache_path="./scrapping/doc/embeddings_cache.json"):
    global INDEXED_DOCS, URL_HISTORY
    
    # 1. Load URL History terlebih dahulu
    URL_HISTORY = load_url_history()

    print(f"\n--- Memulai Indexing Dokumen dari: {folder_path} ---")

    folder = Path(folder_path)
    if not folder.exists():
        os.makedirs(folder_path, exist_ok=True)
        INDEXED_DOCS = []
        return

    cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            pass

    new_docs = []
    files = natsorted(list(folder.glob("*.txt")), key=lambda x: x.name) # <-- PAKAI YANG BARU INI
    
    for i, file in enumerate(files):
        try:
            text = file.read_text(encoding="utf-8").strip()
            if not text: continue

            mtime = os.path.getmtime(file)
            key = f"{file.name}:{mtime}"

            if key in cache:
                emb = np.array(cache[key], dtype=np.float32)
            else:
                emb = get_embedding(text)
                cache[key] = emb.tolist()

            tokens = set(word_tokenize(text.lower()))

            new_docs.append({
                "id": f"DOC_{i}",
                "filename": file.name,
                "text": text,
                "tokens": tokens,
                "embedding": emb
            })
        except Exception as e:
            print(f"Skip {file.name}: {e}")

    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f)
    except: pass

    INDEXED_DOCS = new_docs
    print(f"--- Selesai! {len(INDEXED_DOCS)} dokumen terindeks. ---")


def format_answer_with_sources(answer_text, docs):
    """
    Menambahkan link sumber referensi ke bawah jawaban.
    Prioritas:
    1. Cek di URL_HISTORY berdasarkan filename.
    2. Cek regex URL di dalam teks dokumen.
    """
    found_urls = set()
    
    # 1. Cek dari URL_HISTORY
    for doc in docs:
        fname = doc.get('filename')
        if fname and fname in URL_HISTORY:
            found_urls.add(URL_HISTORY[fname])

    # 2. Cek dari isi text (Fallback jika tidak ada di history)
    for doc in docs:
        text_content = doc.get('text', '')
        urls = re.findall(r'(?:URL|Url|page ini|link)\s*:?\s*(https?://\S+)', text_content)
        for url in urls:
            clean_url = url.rstrip('.,;)')
            found_urls.add(clean_url)

    # Bersihkan output LLM dari formatting block
    clean_answer = answer_text.replace("```html", "").replace("```", "")

    # Susun HTML Sumber
    if found_urls:
        list_items = "".join([f'<li><a href="{u}" target="_blank" style="color: #2563eb; text-decoration: underline;">{u}</a></li>' for u in found_urls])
        sources_html = f"""
        <br><hr style="border-top: 1px solid #e5e7eb; margin: 16px 0;">
        <p><strong>Sumber Referensi:</strong></p>
        <ul>{list_items}</ul>
        """
        return clean_answer + sources_html
    
    return clean_answer


# --- RETRIEVAL ENGINE ---

def retrieve_by_embedding(question, k=5):
    if not INDEXED_DOCS: return []
    try:
        q_emb = get_embedding(question)
        if np.all(q_emb == 0): return []

        scored = []
        for doc in INDEXED_DOCS:
            score = cosine_similarity(q_emb, doc["embedding"])
            scored.append((score, doc))
        
        scored.sort(reverse=True, key=lambda x: x[0])
        return [doc for score, doc in scored[:k]]
    except:
        return []

def retrieve_by_wordnet(question, k=5):
    if not INDEXED_DOCS: return []
    
    q_tokens = word_tokenize(question.lower())
    expanded_keywords = set(q_tokens)
    for token in q_tokens:
        synsets = wn.synsets(token, lang='ind')
        for syn in synsets:
            for lemma in syn.lemmas(lang='ind'):
                expanded_keywords.add(lemma.name().lower().replace('_', ' '))
    
    scored = []
    for doc in INDEXED_DOCS:
        doc_tokens = doc["tokens"]
        match_count = len(doc_tokens.intersection(expanded_keywords))
        if match_count > 0:
            scored.append((match_count, doc))
    
    scored.sort(reverse=True, key=lambda x: x[0])
    return [doc for score, doc in scored[:k]]


# --- MAIN RAG LOGIC ---

def mainrag0(history, question, ocr_text=None):
    return f"<p>RAG belum diinisialisasi. {question} dengan OCR : {ocr_text}</p>"

def mainrag(history, question):
    global INDEXED_DOCS
    if not INDEXED_DOCS:
        load_and_index_documents()

    print(f"\nProcessing: {question}")

    # 1. Retrieval
    docs_emb = retrieve_by_embedding(question, k=5)
    docs_wn = retrieve_by_wordnet(question, k=5)
    combined_docs = {d['id']: d for d in (docs_emb + docs_wn)}.values()
    
    if not combined_docs:
        return "<p>Maaf, tidak ditemukan informasi yang relevan.</p>"

    # 2. Reranking
    docs_str = "\n".join([f"ID: {d['id']}\nCuplikan: {d['text'][:300]}...\n" for d in combined_docs])
    try:
        print("--- Melakukan Reranking via LLM ---")
        rerank_res = rerank_chain.invoke({"question": question, "docs_list": docs_str})
        relevant_ids = [x.strip() for x in rerank_res['text'].split(',')]
        final_docs = [d for d in combined_docs if d['id'] in relevant_ids]
        
        if not final_docs:
            print("Fallback: Top Embedding.")
            final_docs = docs_emb[:3]
        else:
            print(f"LLM Memilih Dokumen: {[d['filename'] for d in final_docs]}")

    except Exception as e:
        print(f"Reranking Error: {e}")
        final_docs = docs_emb[:3]

    # 3. Generate Answer
    context_text = "\n\n".join([f"Sumber: {d['filename']}\nIsi: {d['text']}" for d in final_docs])

    try:
        response = qa_chain.invoke({
            "question": question,
            "context": context_text,
            "chat_history": history
        })
        # UPDATE: Format jawaban dengan link sumber
        return format_answer_with_sources(response['text'], final_docs)

    except Exception as e:
        return f"<p>Error generation: {str(e)}</p>"
    
def mainragocr(history, question, ocr_text=None):
    global INDEXED_DOCS
    if not INDEXED_DOCS:
        load_and_index_documents()

    print(f"\nProcessing OCR RAG: {question}")

    question_combined = question + "\n[Info Tambahan dari Gambar/OCR]:\n" + (ocr_text if ocr_text else "")

    docs_emb = retrieve_by_embedding(question_combined, k=5)
    docs_wn = retrieve_by_wordnet(question_combined, k=5)
    combined_docs = {d['id']: d for d in (docs_emb + docs_wn)}.values()
    
    if not combined_docs:
        return "<p>Maaf, tidak ditemukan informasi yang relevan.</p>"

    docs_str = "\n".join([f"ID: {d['id']}\nCuplikan: {d['text'][:300]}...\n" for d in combined_docs])
    
    try:
        print("--- Melakukan Reranking (OCR Context) ---")
        rerank_res = rerank_chain.invoke({"question": question_combined, "docs_list": docs_str})
        relevant_ids = [x.strip() for x in rerank_res['text'].split(',')]
        final_docs = [d for d in combined_docs if d['id'] in relevant_ids]
        
        if not final_docs:
            final_docs = docs_emb[:3]

    except Exception as e:
        print(f"Reranking Error: {e}")
        final_docs = docs_emb[:3]

    context_text = "\n\n".join([f"Sumber: {d['filename']}\nIsi: {d['text']}" for d in final_docs])

    try:
        response = qa_chain.invoke({
            "question": question_combined,
            "context": context_text,
            "chat_history": history
        })
        # UPDATE: Format jawaban dengan link sumber
        return format_answer_with_sources(response['text'], final_docs)

    except Exception as e:
        return f"<p>Error generation: {str(e)}</p>"


def reload_rag():
    load_and_index_documents()
    memory.clear()